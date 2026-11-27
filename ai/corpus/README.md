# 训练语料（22 张大牌 · 第一批）

给本地小模型（qwen3:1.7b）做 LoRA 用。训练在 Kaggle 上跑，本地用同一套 benchmark 对照。

## 原则
- **输入 = 运行时真实提示词**：`build_cases.py` 直接调用 `ai/runtime/engine.py` 的 `SYSTEM`、`build_state`、`_prompt`、`card_prompt`、`summary_prompt`，所以训练时看到的格式和上线时一模一样。
- **模型只学「写一段话」**：动作（ANSWER / ASK / REFLECT …）由 `policy.py` 的确定性规则选，危机、哀悼、结束是固定话术，不进训练。
- 目标回答只依据提示词里给出的牌义、位置和传统意象（已去掉哥特 / 风格化夜晚的内容）；奶蛙版特有画面可以提，但不说成传统。
- 按**牌的组合**切分 train / val / test，同一组合不会跨集合；benchmark 里的（问题，牌组合）在抽样时避开。

## 规模
| 任务 | 动作 | 条数 |
|---|---|---|
| single_answer 单张解读 | ANSWER | 88 |
| three_answer 三张（时间之流） | ANSWER | 80 |
| cross_card 五张牌阵逐张一句 | ANSWER / ASK | 50 |
| cross_summary 五张牌阵整体一句 | ANSWER / ASK | 20 |
| decision_ask / _three 决策类 | ASK | 60 |
| meaning_only 只要牌义 | ANSWER_MEANING | 44 |
| reflect_association 个人联想 | REFLECT | 60 |
| playful 玩梗 | PLAYFUL_REPLY | 40 |
| third_party / _three 问他人 | ANSWER | 40 |

共 482 条监督样例，其中 157 条另有「反面回答」用于偏好训练（DPO）。错误类型分布：哥特风格 27、预测 26、归咎用户 24、鸡汤说教 19、编造 / 说错意象 19、过度追问 16、列表格式 14、诊断 9、忽略位置 2、读心 1（后两类只在多张 / 问他人的样例里出现，偏少，下一批补）。

## 流程
```bash
python3 ai/corpus/build_cases.py          # 1. 抽样生成输入 → cases.jsonl、batches/
# 2. 老师写回答（子代理按 WRITER_BRIEF.md 分批写），再做语义审查
python3 ai/corpus/check.py ai/corpus/teacher  # 3. 自动检查 → corpus.jsonl、reports/check.md
python3 ai/corpus/export.py               # 4. 导出 → data/sft_*.jsonl、data/dpo_*.jsonl
```

## 文件
- `cases.jsonl`：输入（case_id、task、action、input、messages、want_rejected）
- `corpus.jsonl`：合并后的语料（加 response、rejected、error_type、issues）
- `data/sft_{train,val,test}.jsonl`：`{"messages": [system, user, assistant]}`
- `data/dpo_{train,val,test}.jsonl`：`{"prompt": [system, user], "chosen": [...], "rejected": [...]}`
- `teacher/out_*.jsonl`：老师回答原件（审查改动已套用）；`reports/review_out_*.jsonl`：语义审查改了哪些、为什么
- `WRITER_BRIEF.md`：写作规则；`reports/check.md`：自动检查报告

## 已知局限
- 只覆盖单张、三张、五张牌阵；马蹄、凯尔特十字、原创牌阵没有单独样例（运行时 ≥4 张都是逐张生成，cross_card 覆盖了这种格式）。
- cross_summary 的「各位置的解读」用牌义占位，和运行时（模型自己写的逐张解读）略有差别。
- 老师回答由大模型写、子代理审查，没有逐条人工审核；可以抽看 `corpus.jsonl`。
