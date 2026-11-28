# 奶蛙 AI 数据（22 张大阿卡纳）

按 [技术设计 v0.6](../docs/tarot_slm_technical_design_v0.6.md) 准备的第一批数据，用于以后在 Kaggle 训练本地小语言模型（Qwen3 1.7B / 4B 对照），并先用「基础模型 + 检索 / 规则」跑通闭环。**这里只有数据和格式，不含模型、训练代码或服务端。**

## 范围
先以 v0.6 第 13 章建议的 7 张做试点，2026-11-27 扩到全部 22 张大阿卡纳（文件名仍沿用 `*_pilot`）。最初的 7 张：

| ID | 牌 | 选它的理由 |
|---|---|---|
| `major_00` | 愚者 | 开端、未知、轻与风险 |
| `major_04` | 皇帝 | 秩序、控制、责任 |
| `major_12` | 倒吊人 | 暂停、换视角、牺牲 |
| `major_15` | 恶魔 | 依附、束缚、欲望（文档里的标准示例） |
| `major_16` | 高塔 | 崩塌、突变、真相 |
| `major_17` | 星星 | 希望、修复 |
| `major_18` | 月亮 | 不确定、投射、梦 |

## 目录
```text
ai/
├── schemas/                  # JSON Schema：每类记录的格式（见下）
├── sources/                  # 原典：来源清单、韦特原文（大牌 / 小牌）、黄金黎明小牌称号
├── knowledge_base/
│   ├── cards_minor.json      # 56 张小牌的知识表（脚本生成：站内牌义 + 韦特原文 + 黄金黎明称号与旬星）
│   ├── imagery_compare_pilot.json  # 与韦特传统意象的对照（人工整理）
│   └── cards_pilot.json      # 7 张牌的知识侧表（脚本生成，不手改）
├── semantic_framework/
│   ├── propositions_pilot.json   # 命题
│   ├── contradictions_pilot.json # 矛盾 / 张力
│   ├── seeds_pilot.json          # 语义种子（含低语式箴言）
│   ├── inquiry_pilot.json        # 追问树
│   └── changes_pilot.json        # 修改记录
├── benchmark/
│   └── cases_pilot.jsonl     # 独立测试集（不参与训练）
└── scripts/
    ├── build_kb.mjs          # 由 data/cards.json + data/visual_symbols.json 生成 cards_pilot.json
    └── validate.mjs          # 校验 ID 唯一、引用存在、中英文齐全
```

## 原典（`ai/sources/`）
- `sources.json`：来源清单（作者、版本、章节、语言、许可、URL）。
- `waite_pkt_major.json`：A. E. Waite《The Pictorial Key to the Tarot》（1911，公有领域，取自 [Wikisource](https://en.wikisource.org/wiki/The_Pictorial_Key_to_the_Tarot)）22 张大牌的英文原文：第二部分 §2 的象征解说、第三部分 §2 的占卜义。
- 知识侧表的 `source_refs` 指向这里，`waite_1911` 是原文占卜义。
- **注意**：韦特列出的大牌占卜义和今天的通行解读差别很大（例如愚者是 folly、mania；星星首先是 loss、theft，hope 只是「另一种读法」），他自己也说这些占卜义「人为而武断」。所以每条 `traditional_rws` 条目都要标 `tradition_basis`：`waite_divinatory`（韦特占卜义）/ `waite_symbolism`（韦特象征解说）/ `modern_convention`（今天 RWS 体系的通行解读），不把通行解读冒充成韦特原话。
- `waite_pkt_minor.json`：56 张小牌的韦特原文（第三部分 §2 的画面描述与占卜义；圣杯二在原文里没有逆位义）。
- `golden_dawn_minor_titles.json`：40 张王牌与数字牌的黄金黎明称号（如 The Lord of Dominion），出自《777》Col. CXXXIII–CXXXVI。
- 小牌对应：36 张数字牌的旬星按黄金黎明规则逐张验证（36/36 一致），王牌为「元素力量之根」；宫廷牌的元素是现代常用对应（国王火、骑士风），与黄金黎明（骑士火、王子风）不同，已标为 modern_convention。
- 黄金黎明的占星 / 元素对应已对照 Crowley《777》（1909）Table I 逐张核实：`source_refs` 记到路径与栏目；因手头副本基于仍受版权保护的《777 Revised》，只记录书目、位置与对应事实，不收录原文。

## 数据原则（摘自 v0.6）
- **知识库定义知识，语义框架定义思想**：牌义、画面符号、对应关系放在知识库；命题、矛盾、种子、追问树放在语义框架。
- **来源分开标**：`source_kind` 区分 `traditional`（韦特传统）、`original_interpretation`（本项目原创解读）；`framework` 标明是传统还是现代扩展（荣格、存在主义、辩证法、道家……），现代扩展不冒充传统。
- **只用传统意象，不用哥特风格**：牌面上的哥特与风格化夜晚元素（黑玫瑰、哥特城堡、给白天的牌加的满月、蜡烛、血月、废墟……）不进入 AI 数据；传统没有、我们多出的其它元素（用户已决定保留）放在 `naiwa_symbol_refs`，作为奶蛙版特有的象征，和传统意象分开标注。对照见 `imagery_compare_pilot.json`。
- **画面符号以实际牌面为准**：`symbol_refs` 引用 `data/visual_symbols.json` 里这张牌真实可见的符号 ID；传统里有、我们画面里没有的符号，不能写成「画面里看到」。
- **反例必填**：每个命题和种子都要写不适用的情况，防止把解释强加给用户（例：外部强制导致无法离开，不应归咎于当事人）。
- **非临床、非预测**：不诊断、不预言；追问树必须有「用户拒绝 / 只要牌义 / 明显不适」的出口。
- **审核状态**：全部从 `draft` 开始，人工审核后改为 `reviewed`；只有 `reviewed` 的条目可以进训练集。

## 审核
审核页（claude.ai 私有页面，标记存在页面的数据库里）：https://claude.ai/artifact/2KicWT8o96YF2TdMHMn9pK ，模板在 `ai/review/review_tpl.html`。

## 测试集的检查方式
`must_not` 写成带主语的短语（如「你们一定会复合」而不是「一定会复合」），避免「不一定会复合」这类正确的否定句被子串匹配误判；以后的评测脚本仍应识别否定词，`must_mention_any` 命中任一即可。

## 常用命令
```bash
node ai/scripts/build_kb.mjs     # 重新生成大牌知识侧表
node ai/scripts/build_minor.mjs  # 重新生成小牌知识表
node ai/scripts/validate.mjs     # 校验
```

## 审核状态
2026-11-27：先审 7 张试点（审稿人 A / B），再扩到 22 张——三个子代理分写其余 15 张，两个独立子代理（C / D）审查后修改。目前 22 张的命题 66、矛盾 44、种子 88、追问树 22、测试样例 16 均为 `reviewed`。原典已补：知识侧表的 `source_refs` 指向韦特 1911 原文，57 条传统条目都标了依据与原文证据；知识侧表的对应关系已对照《777》核实。修改记录见 `semantic_framework/changes_pilot.json`。

## 本地闭环（`ai/runtime/`）
只用 Python 标准库 + 本机 Ollama，模型未微调：
```bash
python3 ai/runtime/cli.py three major_16:r:past major_17:u:present major_18:u:future --q 分手以后我还能好起来吗
python3 ai/runtime/cli.py one major_15:u:message --q 我该不该离开现在的工作 --trace   # 打印完整调试轨迹
python3 ai/runtime/bench.py qwen3:1.7b      # 跑测试集，报告在 ai/runtime/reports/
```
流程（v0.6 第 9.7 节）：按牌 ID 检索牌义、传统意象、命题与低语 → 结构化状态 → **程序**按规则选动作（危机 / 停止 / 只要牌义 / 玩梗 / 联想 / 决策 / 默认）→ 模型只写一段话 → 程序检查禁用说法（命中就重写一次）。危机转向、哀悼（提到亲友离世）与结束是固定话术，不经过模型（小模型会把真实的死亡解读成「转变」）；问的是别人怎么想时，提示词要求把解读放回用户自己，必要时由程序补一句边界；个人联想之后程序去掉追问并补上「可以不说、可以停」；4 张以上的牌阵逐张生成再写整体。

2026-11-27 基线（i9-9980HK，CPU）：

| 模型 | 测试集 | 生成速度 | 平均每次 |
|---|---|---|---|
| qwen3:0.6b | 16 / 16 | 约 38 tokens/s | 约 7 秒 |
| qwen3:1.7b | 16 / 16（个别条目会随机波动） | 约 17 tokens/s | 约 16 秒 |

本机的 `qwen3:4b` 是强制思考版（Qwen3-4B-Thinking-2507），每次先想很久，不适合对话，不参与对照。
测试集只能抓到明显越界；读输出还能看到未微调模型的问题：未来位用「将……」近似预言、画面细节说错、偶尔把冲突位的特质直接安在用户身上、结尾像鸡汤——这些留给 Kaggle 上的 SFT 解决。

## 训练语料（22 张大牌）
见 [corpus/README.md](corpus/README.md)：790 条样例（导出监督训练 770 条）+ 252 对偏好数据，覆盖全部牌阵，输入就是运行时的真实提示词（`engine.py` 同一套函数生成），按牌组合切分 train 706 / val 44 / test 20，导出在 `corpus/data/`。

## 下一步（未做）
1. 在 Kaggle 上跑 [train/kaggle_lora_qwen3.ipynb](train/README.md)（qwen3:1.7b LoRA，先 SFT、DPO 可选），导出 GGUF 放回本机 Ollama，用行为测试集和语料留出测试集对比微调前后。
2. 小阿卡纳的语义框架（命题、种子、追问树）：先给 56 张牌面做画面标注，再按大牌的做法分批写、审查，之后扩充语料。
