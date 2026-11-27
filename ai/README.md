# 奶蛙 AI 数据（试点）

按 [技术设计 v0.6](../docs/tarot_slm_technical_design_v0.6.md) 准备的第一批数据，用于以后在 Kaggle 训练本地小语言模型（Qwen3 1.7B / 4B 对照），并先用「基础模型 + 检索 / 规则」跑通闭环。**这里只有数据和格式，不含模型、训练代码或服务端。**

## 试点范围
v0.6 第 13 章建议的最小垂直切片，共 7 张大阿卡纳：

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
├── knowledge_base/
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
node ai/scripts/build_kb.mjs     # 重新生成知识侧表
node ai/scripts/validate.mjs     # 校验
```

## 审核状态
2026-11-27：两个独立子代理按 v0.6 标准审查全部条目，修改后命题、矛盾、种子、追问树、测试样例均已标为 `reviewed`；知识侧表仍为 `draft`（原典出处 source_refs 待补）。修改记录见 `semantic_framework/changes_pilot.json`。

## 下一步（未做）
1. 补知识侧表的原典出处。
2. 用未微调的 Qwen3 + 检索 / 规则，在本地跑通「抽牌结果 → 结构化状态 → 回答」的最小闭环（v0.6 第 19.5 节第 3 步）。
3. 闭环稳定后，再按第 7 章的流水线批量生产 SFT 语料，并在 Kaggle 上做 LoRA 训练与对照评估。
