# 在 Kaggle 上训练（Qwen3-1.7B · LoRA）

## 一、Kaggle 上跑
1. 登录 Kaggle → Create → **Import Notebook**，选本目录的 `kaggle_lora_qwen3.ipynb`。
2. 右侧 Settings：Accelerator 选 **GPU T4 x2**（或 P100），**Internet 打开**（第一次用 GPU / 联网需要手机验证）。
3. Run All。数据直接从公开仓库的 `ai/corpus/data/` 下载；训练 3 轮约 20～30 分钟，加上对照生成和导出共 30～50 分钟。
4. 跑完在右侧 Output 下载 `naiwa_out.zip`，里面有：
   - `naiwa-qwen3-1.7b-sft.q8_0.gguf`：微调后的模型（约 1.8 GB）
   - `compare_test.json`：留出测试集上微调前 / 后 / 老师的回答对照
   - `sft_log.json`、`train_meta.json`：训练损失与参数

笔记本顶部可调：`RUN_DPO`（默认关，先只看监督训练的效果）、`EPOCHS`、`LR`、LoRA 秩等。

## 二、放回本机对照
```bash
bash ai/train/import_to_ollama.sh ~/Downloads/naiwa_out/naiwa-qwen3-1.7b-sft.q8_0.gguf naiwa-sft:1.7b
```
```bash
python3 ai/runtime/bench.py naiwa-sft:1.7b
```
```bash
python3 ai/train/eval_corpus.py qwen3:1.7b naiwa-sft:1.7b
```
- `bench.py`：行为测试集（危机、哀悼、问他人、只要牌义……16 条），看微调后有没有退步。
- `eval_corpus.py`：语料的留出测试集（20 条，训练时没见过的牌组合），按 `ai/corpus/check.py` 同一套规则检查，报告在 `ai/train/reports/corpus_test.md`，可以逐条读三方回答。
- 想用网站 / 命令行试：`python3 ai/runtime/cli.py` 里把模型换成 `naiwa-sft:1.7b`。

## 格式对齐（重要）
训练时的提示词是按本机 Ollama 的 qwen3 模板**逐字**渲染的（system 后一个空行、用户消息末尾追加 ` /no_think`、助手以空思考块开头），已用贪心解码在本机验证一致；导入时模板也照抄 qwen3:1.7b。改了 `ai/runtime/engine.py` 的提示词，要重新生成语料（`ai/corpus/`）再训练。

## 基线（未微调）
- qwen3:1.7b（Ollama 默认 q4_K_M）：行为测试集 16/16；语料留出测试集 7/20 条有格式问题（低语被改写、没提到牌、问他人时没落回用户自己）。
- 微调后的是 q8_0，比默认的 q4_K_M 精度高；要严格对照，可以另外 `ollama pull qwen3:1.7b-q8_0` 一起比。

## 重新生成笔记本
笔记本由 `make_notebook.py` 生成，改参数或代码请改它再运行：`python3 ai/train/make_notebook.py`。
