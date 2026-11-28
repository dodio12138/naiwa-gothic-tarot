# 写作说明（第二批补充）

先完整读 `ai/corpus/WRITER_BRIEF.md`，那里的声音、硬规则、反面回答的错误类型全部适用。这里只说第二批新增的两种输入。全程简体中文；只读仓库，不改仓库文件，不做 git 操作。**草稿只放在你自己的子目录里**（指令里会给），不要用 parts/、build.py 这类共享名字。

## 一、整副牌阵（batches2/jobs_N.jsonl）
每行是一副 ≥4 张的牌阵（五张 / 马蹄 / 凯尔特十字 / 两难抉择 / 共鸣）。运行时会**逐张**让模型写，每张的提示词就是 `card_prompts[i]`；全部写完后，再把逐张解读拼起来让模型写一句整体（规则见 `summary_rule`）；如果 `ask_prompt` 不为空（决策类问题），最后再单独让模型写一个问题。

你要写：
- `lines`：与 `heads` 一一对应，第 i 条以「heads[i]：」开头（照抄，包括空格和括号），40～70 字，一两句，不提问，引用该张 card_prompts 里给出的一个意象。**逐张写的时候只看这一张自己的提示词**，但整副读下来要连贯、不重复用同样的句式。
- `summary`：一句话，30～60 字，不预测结果、不逐张复述，不提问。有「对方」位置（共鸣牌阵）时用「在你眼中」说对方。
- `question`：只有 ask_prompt 不为空时写：一个开放、不诱导、帮用户想清楚自己在意什么的问题，一句话，恰好一个问号，10～40 字。否则 null。
- 牌阵边界：两难抉择牌阵不替用户选 A 或 B；共鸣牌阵里「对方（我眼中）」只谈用户眼中的对方，不说对方真实想法。
- 未来 / 结果 / 可能的发展类位置只说可能的方向。
- 反面：
  - `want_rejected_line` 不为空时，给第 index 张写一条反面 `rejected_line`。它也要以 heads[index] 开头，长度相近，明确犯指定错误。`ignore_position` 在这里的意思是：无视或说错这个位置的含义，例如把「阻碍」当成助力、把「可能的发展」说成已经发生。
  - `want_rejected_summary` 不为空时，给整体一句写一条反面 `rejected_summary`。

输出一行：
```json
{"job_id": "job.001", "lines": ["…", "…"], "summary": "…", "question": "…或 null",
 "rejected_line": {"index": 2, "text": "…", "error_type": "…"} 或 null,
 "rejected_summary": {"text": "…", "error_type": "…"} 或 null}
```

## 二、小样例与补反面（batches2/small_and_addon.jsonl）
- 没有 `addon` 字段的行：和第一批一样（镜像牌阵 3 张、每日一牌 1 张），按 messages 里的提示词写 `response`；want_rejected 不为空时另写 `rejected`。镜像牌阵借用荣格概念只是比喻：不能说「你的阴影是……」这种测评口吻，不诊断。
- `addon: true` 的行：标准回答已经有了（`existing_response`），**只写反面** `rejected`，犯 want_rejected 指定的错误，长度与 existing_response 相近、同样通顺：
  - `ignore_position`（三张解读）：不按过去 / 现在 / 未来逐张讲，把三张混在一起说，或把位置弄错（如把未来那张当成现在）。
  - `mind_reading`（问他人）：断言对方的真实想法或行为（「她其实一直在乎你，只是不好意思说」）。
输出一行：`{"case_id": "…", "response": "…（addon 行写 null）", "rejected": "…或 null", "error_type": "…或 null"}`

## 自检
用 Python 写文件并检查：行数与 id 一一对应；lines 数量等于 heads 数量且每条以对应 head 开头；字数区间；问号（lines / summary / ANSWER 类 response 无问号，question 恰好一个）；error_type 等于要求；低语只能原文照用。最后只回复一行：输出路径、条数、反面条数。
