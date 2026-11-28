# 训练语料（22 张大牌 · 第一批）

给本地小模型（qwen3:1.7b）做 LoRA 用。训练在 Kaggle 上跑，本地用同一套 benchmark 对照。

## 原则
- **输入 = 运行时真实提示词**：`build_cases.py` 直接调用 `ai/runtime/engine.py` 的 `SYSTEM`、`build_state`、`_prompt`、`card_prompt`、`summary_prompt`，所以训练时看到的格式和上线时一模一样。
- **模型只学「写一段话」**：动作（ANSWER / ASK / REFLECT …）由 `policy.py` 的确定性规则选，危机、哀悼、结束是固定话术，不进训练。
- 目标回答只依据提示词里给出的牌义、位置和传统意象（已去掉哥特 / 风格化夜晚的内容）；奶蛙版特有画面可以提，但不说成传统。
- 按**牌的组合**切分 train / val / test，同一组合不会跨集合；benchmark 里的（问题，牌组合）在抽样时避开。

## 规模
三批共 940 条样例。导出时去掉两类：第一批用牌义占位的 20 条 cross_summary，和 2 条与行为测试集问题原文相同的样例。实际监督训练 918 条（train 835 / val 56 / test 27），偏好对 355 对（314 / 28 / 13）。
第三批（150 条，`build_cases3.py` + `WRITER_BRIEF3.md`）专门补第一次微调暴露的弱点：诱导预测（能不能赢 / 会不会成）、三张牌决策类逐张解读后提问、不替用户假设心里的想法（新反面类型 presume_feelings）。

| 任务 | 动作 | 条数 |
|---|---|---|
| single_answer 单张解读 | ANSWER | 88 |
| daily_answer 每日一牌 | ANSWER | 10 |
| three_answer 三张（时间之流） | ANSWER | 80 |
| mirror_answer / mirror_reflect 镜像牌阵（3 张，原创） | ANSWER / REFLECT | 16 + 4 |
| cross_card 五张牌阵逐张一句（第一批，单张抽取） | ANSWER / ASK | 50 |
| spread_card 整副大牌阵逐张一句：五张、马蹄、凯尔特十字、两难抉择、共鸣 | ANSWER / ASK | 234 |
| spread_summary 整副大牌阵的整体一句（提示词里是老师自己写的逐张解读） | ANSWER / ASK | 36 |
| ask_question 大牌阵决策类最后单独的一个问题 | ASK | 8 |
| decision_ask / _three 决策类 | ASK | 60 |
| meaning_only 只要牌义 | ANSWER_MEANING | 44 |
| reflect_association 个人联想 | REFLECT | 60 |
| playful 玩梗 | PLAYFUL_REPLY | 40 |
| third_party / _three 问他人 | ANSWER | 40 |
| bait_single / bait_three 诱导预测（第三批） | ANSWER | 50 + 20 |
| ask_three_pos 三张决策、逐张后提问（第三批） | ASK | 40 |
| self_answer / self_three 自我类、不替用户假设（第三批） | ANSWER | 20 + 20 |

反面回答的错误类型：预测 35、忽略或说错位置 35、读心 31、哥特风格 29、归咎用户 28、鸡汤说教 24、编造 / 说错意象 24、过度追问 21、诊断 16、列表格式 14。

## 流程
```bash
python3 ai/corpus/build_cases.py          # 1. 第一批输入 → cases.jsonl、batches/
python3 ai/corpus/build_cases2.py         #    第二批输入 → jobs2.jsonl、cases2_small.jsonl、addon_rejected.jsonl、batches2/
# 2. 老师写回答（子代理按 WRITER_BRIEF.md / WRITER_BRIEF2.md 分批写）
python3 ai/corpus/assemble2.py <第二批输出目录>   #    整副牌阵拆成逐张 / 整体 / 提问样例 → cases2.jsonl、teacher/out2_*.jsonl
#    语义审查改动套用后：python3 ai/corpus/assemble2.py --refresh（用改过的逐张解读重建整体一句的提示词）
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
- 老师回答由大模型写、子代理审查（两批共改 30 处），没有逐条人工审核；可以抽看 `corpus.jsonl`。
- 危机、哀悼、结束是程序固定话术，不在语料里；英文语料没有做。
- 只覆盖 22 张大牌；小牌要等牌面画面标注做完。
