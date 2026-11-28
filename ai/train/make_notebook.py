"""生成 Kaggle 训练笔记本 kaggle_lora_qwen3.ipynb（改这里，再运行本脚本重新生成）。"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
cells = []


def md(s):
    cells.append({'cell_type': 'markdown', 'metadata': {}, 'source': s.strip('\n')})


def code(s):
    cells.append({'cell_type': 'code', 'metadata': {}, 'execution_count': None, 'outputs': [], 'source': s.strip('\n')})


md('''
# 奶蛙 · 暗夜塔罗：Qwen3-1.7B LoRA 微调

按 `docs/tarot_slm_technical_design_v0.6.md` 的节奏：先 LoRA 监督训练（SFT），偏好训练（DPO）可选；导出 GGUF，放回本机 Ollama，用同一套测试集对照。

**Kaggle 设置**：右侧 Settings → Accelerator 选 **GPU T4 x2** 或 **P100**（只用一张卡），Internet 打开。全部运行约 30～50 分钟。
跑完后到右侧 Output 下载 `naiwa_out.zip`（里面是 GGUF 和训练记录）。

数据来自公开仓库的 `ai/corpus/data/`；也可以把这几个文件做成 Kaggle Dataset 挂到 `/kaggle/input/`，下面会优先用本地挂载的。
''')

code('''
# ── 可调参数 ──
BASE_MODEL = "Qwen/Qwen3-1.7B"
REPO_RAW = "https://raw.githubusercontent.com/dodio12138/naiwa-gothic-tarot/main/ai/corpus/data"
RUN_DPO = False          # 先只做 SFT 看效果；之后想试偏好训练再改成 True
EPOCHS = 3
LR = 1e-4
LORA_R, LORA_ALPHA, LORA_DROPOUT = 16, 32, 0.05
MAX_LEN = 2048           # 最长样例约 2100 字，按 token 算在 1600 以内
DPO_BETA, DPO_LR, DPO_EPOCHS = 0.1, 5e-6, 1
GGUF_TYPE = "q8_0"       # q8_0 约 1.8 GB；本机也可以再用 ollama create --quantize 压到 q4_K_M
OUT = "/kaggle/working"

import os
os.environ["CUDA_VISIBLE_DEVICES"] = "0"   # 只用一张卡，避免双卡 DataParallel 的问题
os.environ["TOKENIZERS_PARALLELISM"] = "false"
''')

code('''
# 固定版本，避免 Kaggle 镜像升级后接口变化
!pip install -q "transformers==4.53.2" "peft==0.16.0" "trl==0.19.1" "accelerate==1.8.1" "datasets==3.6.0" sentencepiece
''')

code('''
import json, glob, re, urllib.request, torch, random
print(torch.__version__, torch.cuda.get_device_name(0))
BF16 = torch.cuda.is_bf16_supported()
print("bf16 支持:", BF16)

def load_split(name):
    local = glob.glob(f"/kaggle/input/**/{name}.jsonl", recursive=True)
    if local:
        text = open(local[0], encoding="utf-8").read()
    else:
        text = urllib.request.urlopen(f"{REPO_RAW}/{name}.jsonl").read().decode("utf-8")
    return [json.loads(l) for l in text.splitlines() if l.strip()]

sft = {s: load_split(f"sft_{s}") for s in ("train", "val", "test")}
dpo = {s: load_split(f"dpo_{s}") for s in ("train", "val", "test")}
print({k: len(v) for k, v in sft.items()}, {k: len(v) for k, v in dpo.items()})
''')

md('''
## 提示词格式
必须和本机 Ollama 运行时**逐字一致**（已在本机用贪心解码对照验证）：qwen3 模板在 system 后多一个空行，并在用户消息末尾追加 ` /no_think`，助手开头是空的思考块。
''')

code('''
def render_prompt(system, user):
    return ("<|im_start|>system\\n\\n" + system + "<|im_end|>\\n"
            "<|im_start|>user\\n" + user + " /no_think<|im_end|>\\n"
            "<|im_start|>assistant\\n<think>\\n\\n</think>\\n\\n")

def to_pc(row):
    m = row["messages"]
    return {"prompt": render_prompt(m[0]["content"], m[1]["content"]), "completion": m[2]["content"],
            "task": row["task"], "case_id": row["case_id"]}

print(to_pc(sft["train"][0])["prompt"][-300:])
''')

code('''
from transformers import AutoTokenizer, AutoModelForCausalLM
tok = AutoTokenizer.from_pretrained(BASE_MODEL)
END = "<|im_end|>"
END_ID = tok.convert_tokens_to_ids(END)

def tokenize(ex):
    p = tok(ex["prompt"], add_special_tokens=False)["input_ids"]
    c = tok(ex["completion"] + END, add_special_tokens=False)["input_ids"]
    ids = (p + c)[:MAX_LEN]
    labels = ([-100] * len(p) + c)[:MAX_LEN]      # 只在回答部分算损失
    return {"input_ids": ids, "attention_mask": [1] * len(ids), "labels": labels}

from datasets import Dataset
ds = {s: Dataset.from_list([to_pc(r) for r in rows]).map(tokenize) for s, rows in sft.items()}
lens = sorted(len(x) for x in ds["train"]["input_ids"])
print("token 长度 p50/p95/max:", lens[len(lens)//2], lens[int(len(lens)*.95)], lens[-1], "| 截断条数:", sum(l >= MAX_LEN for l in lens))
''')

code('''
from peft import LoraConfig, get_peft_model
dtype = torch.bfloat16 if BF16 else torch.float32     # T4 不支持 bf16：权重用 fp32，训练时 fp16 自动混合精度
model = AutoModelForCausalLM.from_pretrained(BASE_MODEL, torch_dtype=dtype, device_map={"": 0}, attn_implementation="sdpa")
model.config.use_cache = False
model.gradient_checkpointing_enable(gradient_checkpointing_kwargs={"use_reentrant": False})
model.enable_input_require_grads()
lora = LoraConfig(r=LORA_R, lora_alpha=LORA_ALPHA, lora_dropout=LORA_DROPOUT, bias="none", task_type="CAUSAL_LM",
                  target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"])
model = get_peft_model(model, lora)
model.print_trainable_parameters()
''')

md('## 监督训练（SFT）')

code('''
from transformers import Trainer, TrainingArguments, DataCollatorForSeq2Seq
args = TrainingArguments(
    output_dir=f"{OUT}/sft", num_train_epochs=EPOCHS, learning_rate=LR, lr_scheduler_type="cosine", warmup_ratio=0.05,
    per_device_train_batch_size=2, per_device_eval_batch_size=2, gradient_accumulation_steps=8,
    bf16=BF16, fp16=not BF16, logging_steps=5, eval_strategy="epoch", save_strategy="no",
    report_to="none", group_by_length=True, remove_unused_columns=True, seed=42)
cols = ["input_ids", "attention_mask", "labels"]
trainer = Trainer(model=model, args=args,
                  train_dataset=ds["train"].select_columns(cols), eval_dataset=ds["val"].select_columns(cols),
                  data_collator=DataCollatorForSeq2Seq(tok, padding=True, label_pad_token_id=-100))
trainer.train()
log = trainer.state.log_history
json.dump(log, open(f"{OUT}/sft_log.json", "w"), ensure_ascii=False, indent=1)
print([(round(x["epoch"], 2), round(x["eval_loss"], 4)) for x in log if "eval_loss" in x])
''')

md('''
## 对照：微调前 vs 微调后（留出的测试集）
用和运行时一样的采样参数（temperature 0.6, top_p 0.9），同时做几条和本地 `check.py` 一样的格式检查。
''')

code('''
model.config.use_cache = True
model.eval()

def gen(prompt, n=420):
    x = tok(prompt, return_tensors="pt", add_special_tokens=False).to(model.device)
    with torch.no_grad():
        y = model.generate(**x, max_new_tokens=n, do_sample=True, temperature=0.6, top_p=0.9, eos_token_id=END_ID, pad_token_id=tok.pad_token_id)
    return tok.decode(y[0][x["input_ids"].shape[1]:], skip_special_tokens=True).strip()

def quick_issues(task, action, text):
    """和 ai/corpus/check.py 同口径的几条硬检查（完整检查在本机跑）"""
    iss, q = [], text.count("？") + text.count("?")
    no_q = task in ("cross_card", "spread_card", "spread_summary") or action in ("ANSWER", "ANSWER_MEANING", "REFLECT")
    if no_q and q: iss.append("不该提问")
    if action == "ASK" and task not in ("cross_card", "spread_card", "spread_summary") and q != 1: iss.append("问号数不对")
    if re.search(r"(^|\\n)\\s*([-•*#]|\\d+[.、)]|\\*\\*)", text): iss.append("列表格式")
    if any(w in text for w in ["命中注定", "注定会", "一定会发生", "你患有", "童年创伤"]): iss.append("禁用说法")
    if any(w in text for w in ["哥特", "暗夜", "蝙蝠", "血月", "吸血鬼"]): iss.append("哥特词")
    return iss

random.seed(0)
rows = [to_pc(r) for r in sft["test"]]
report = []
for r in rows:
    with model.disable_adapter():
        base = gen(r["prompt"])
    tuned = gen(r["prompt"])
    act = next(x["action"] for x in sft["test"] if x["case_id"] == r["case_id"])
    report.append({"case_id": r["case_id"], "task": r["task"], "action": act, "base": base, "tuned": tuned, "teacher": r["completion"],
                   "base_issues": quick_issues(r["task"], act, base), "tuned_issues": quick_issues(r["task"], act, tuned)})
json.dump(report, open(f"{OUT}/compare_test.json", "w"), ensure_ascii=False, indent=1)
print("微调前有问题:", sum(bool(x["base_issues"]) for x in report), "/", len(report),
      "| 微调后有问题:", sum(bool(x["tuned_issues"]) for x in report), "/", len(report))
for x in report[:4]:
    print("\\n==", x["case_id"], x["task"], "\\n[前]", x["base"][:220], "\\n[后]", x["tuned"][:220])
''')

md('''
## 可选：偏好训练（DPO）
`RUN_DPO = True` 时，在 SFT 合并后的模型上再加一层 LoRA 做 DPO（参考模型 = 关掉这层 LoRA 的 SFT 模型）。
''')

code('''
if RUN_DPO:
    from trl import DPOTrainer, DPOConfig
    model = model.merge_and_unload()
    model.config.use_cache = False
    def to_dpo(r):   # DPOTrainer 会自己在回答末尾加 eos（即 <|im_end|>），这里不再加
        m = r["prompt"]
        return {"prompt": render_prompt(m[0]["content"], m[1]["content"]),
                "chosen": r["chosen"][0]["content"], "rejected": r["rejected"][0]["content"]}
    dtr = Dataset.from_list([to_dpo(r) for r in dpo["train"]])
    dva = Dataset.from_list([to_dpo(r) for r in dpo["val"]])
    cfg = DPOConfig(output_dir=f"{OUT}/dpo", beta=DPO_BETA, learning_rate=DPO_LR, num_train_epochs=DPO_EPOCHS,
                    per_device_train_batch_size=1, per_device_eval_batch_size=1, gradient_accumulation_steps=8,
                    max_length=MAX_LEN, max_prompt_length=MAX_LEN - 300, bf16=BF16, fp16=not BF16,
                    gradient_checkpointing=True, logging_steps=5, eval_strategy="epoch", save_strategy="no", report_to="none")
    dpo_trainer = DPOTrainer(model=model, args=cfg, train_dataset=dtr, eval_dataset=dva, processing_class=tok,
                             peft_config=LoraConfig(r=8, lora_alpha=16, lora_dropout=0.05, task_type="CAUSAL_LM",
                                                    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"]))
    dpo_trainer.train()
    json.dump(dpo_trainer.state.log_history, open(f"{OUT}/dpo_log.json", "w"), ensure_ascii=False, indent=1)
    model = dpo_trainer.model
''')

md('## 合并、导出 GGUF')

code('''
merged = f"{OUT}/merged"
m = model.merge_and_unload() if hasattr(model, "merge_and_unload") else model
m = m.to(torch.float16)
m.config.use_cache = True
m.save_pretrained(merged, safe_serialization=True)
tok.save_pretrained(merged)
del m; torch.cuda.empty_cache()
''')

code('''
import subprocess, sys
LLAMA = "/tmp/llama.cpp"
if not os.path.exists(LLAMA):
    subprocess.run(["git", "clone", "-q", "--depth", "1", "https://github.com/ggml-org/llama.cpp", LLAMA], check=True)
print(subprocess.run(["git", "-C", LLAMA, "log", "-1", "--format=llama.cpp %h %cs"], capture_output=True, text=True).stdout)
GGUF = f"{OUT}/naiwa-qwen3-1.7b-{'sft-dpo' if RUN_DPO else 'sft'}.{GGUF_TYPE}.gguf"
# 不装 llama.cpp 的 requirements（会替换掉 Kaggle 自带的 torch）；缺哪个模块补哪个
PIP_NAME = {"mistral_common": "mistral-common", "google": "protobuf"}
for _ in range(4):
    r = subprocess.run([sys.executable, f"{LLAMA}/convert_hf_to_gguf.py", merged, "--outtype", GGUF_TYPE, "--outfile", GGUF], capture_output=True, text=True)
    miss = re.search(r"No module named '([\\w.]+)'", r.stderr)
    if r.returncode == 0 or not miss:
        break
    mod = miss.group(1).split(".")[0]
    print("补装", mod)
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", PIP_NAME.get(mod, mod)], check=True)
print(r.stderr[-1500:])
assert r.returncode == 0, "GGUF 转换失败，见上面的报错"
print(os.path.getsize(GGUF) / 1e9, "GB")
''')

code('''
meta = {"base_model": BASE_MODEL, "run_dpo": RUN_DPO, "epochs": EPOCHS, "lr": LR, "lora": [LORA_R, LORA_ALPHA, LORA_DROPOUT],
        "max_len": MAX_LEN, "gguf": os.path.basename(GGUF), "data": {k: len(v) for k, v in sft.items()}}
json.dump(meta, open(f"{OUT}/train_meta.json", "w"), ensure_ascii=False, indent=1)
!cd {OUT} && rm -rf merged sft dpo && zip -q -0 naiwa_out.zip *.gguf *.json && ls -lh naiwa_out.zip
''')

nb = {'cells': cells, 'metadata': {'kernelspec': {'display_name': 'Python 3', 'language': 'python', 'name': 'python3'},
                                   'language_info': {'name': 'python'},
                                   'kaggle': {'accelerator': 'gpu', 'isInternetEnabled': True}},
      'nbformat': 4, 'nbformat_minor': 5}
for c in nb['cells']:   # ipynb 的 source 按行存
    c['source'] = [l + '\n' for l in c['source'].split('\n')]
    c['source'][-1] = c['source'][-1].rstrip('\n')
json.dump(nb, open(os.path.join(HERE, 'kaggle_lora_qwen3.ipynb'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('ok', len(cells), 'cells')
