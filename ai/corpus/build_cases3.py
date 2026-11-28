"""第三批语料：补第一次微调后暴露的薄弱点（见 ai/train/README.md「第一次训练结果」）。

A. 诱导预测：「能不能赢 / 会不会发财 / 能考上吗」这类问题，单张 + 三张。回答不预测、不复述成肯定句，落回牌义（公正、平衡等）。
B. 三张牌的决策类（ASK）：逐张「位置·牌名」简短解读，结尾恰好一个开放问题。
C. 不替用户假设心里的想法：自我类问题，反面回答专门写「你心里其实……」。
benchmark 里出现过的问题原文一律不用（export.py 也会再过滤一次）。
用法：python3 ai/corpus/build_cases3.py → ai/corpus/cases3.jsonl、batches3/
"""
import json
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'runtime'))
sys.path.insert(0, HERE)
from build_cases import MAJORS, bench_keys, positions, split_of  # noqa: E402
from engine import SYSTEM, _prompt, build_state  # noqa: E402
from policy import decide  # noqa: E402

SEED = 20261129
START = 791
BENCH_Q = {json.loads(l)['input'].get('question', '') for l in open(os.path.join(HERE, '..', 'benchmark', 'cases_pilot.jsonl'), encoding='utf-8')}

BAIT = ['这次考试能过吗？', '我能考上研究生吗？', '这个项目能成功吗？', '我今年能升职吗？', '这笔投资能赚钱吗？', '我们还能复合吗？',
        '面试能通过吗？', '我能拿到这个 offer 吗？', '这场比赛我能赢吗？', '这次搬家会顺利吗？', '我的病能好起来吗？', '仲裁能赢吗？',
        '这段感情会有结果吗？', '下个月会有好消息吗？', '我买的彩票会中吗？', '这次合同能签下来吗？', '我能减肥成功吗？', '明年我会结婚吗？',
        '这家店能开下去吗？', '论文能顺利发表吗？']
DECIDE = ['要不要换工作？', '该不该和他摊牌？', '要不要去读博？', '该不该接受这个调岗？', '要不要搬回家住？', '该不该借钱给朋友？',
          '要不要学一门新手艺？', '该不该辞掉兼职？', '要不要换一个城市生活？', '该不该把这件事告诉父母？', '要不要开始健身？', '该不该转专业？']
SELF = ['最近总觉得很空，想看看自己。', '我是不是太敏感了？', '为什么我总是很难拒绝别人？', '最近和朋友聚会总是提不起兴趣。',
        '我对未来有点焦躁，想看看现在的状态。', '我总是对自己很苛刻。', '最近睡不好，脑子停不下来。', '我好像一直在等别人认可我。',
        '我不太知道自己喜欢什么。', '做什么都觉得差一点。']
for lst in (BAIT, DECIDE, SELF):
    assert not set(lst) & BENCH_Q

TASKS = [  # (任务, 牌阵, 张数, 问题库, 条数, 反面错误类型池, 反面比例)
    ('bait_single', 'one', 1, BAIT, 50, ['prediction', 'prediction', 'presume_feelings', 'blame_user'], 0.6),
    ('bait_three', 'three', 3, BAIT, 20, ['prediction', 'ignore_position'], 0.6),
    ('ask_three_pos', 'three', 3, DECIDE, 40, ['ignore_position', 'over_questioning', 'prediction'], 0.5),
    ('self_answer', 'one', 1, SELF, 20, ['presume_feelings'], 0.8),
    ('self_three', 'three', 3, SELF, 20, ['presume_feelings', 'diagnosis'], 0.8),
]


def main():
    rnd = random.Random(SEED)
    avoid = bench_keys()
    n, cases = START, []
    cycle = [(c, o) for c in MAJORS for o in ('upright', 'reversed')]
    rnd.shuffle(cycle)
    ci = 0
    for task, spread, k, bank, count, errs, share in TASKS:
        pos = positions(spread)
        made = 0
        while made < count:
            if k == 1:
                cid, ori = cycle[ci % len(cycle)]
                ci += 1
                cards = [{'card_id': cid, 'orientation': ori, 'position_id': pos[0]}]
            else:
                cards = [{'card_id': c, 'orientation': 'reversed' if rnd.random() < 0.35 else 'upright', 'position_id': p}
                         for c, p in zip(rnd.sample(MAJORS, k), pos)]
            q = rnd.choice(bank)
            if (q, tuple(sorted(c['card_id'] for c in cards))) in avoid:
                continue
            action, why = decide(q, [])
            inp = {'spread_id': spread, 'cards': cards, 'question': q, 'user_turns': []}
            cases.append({'case_id': f'corpus.{n:04d}', 'task': task, 'action': action, 'action_reason': why,
                          'split': split_of([c['card_id'] for c in cards]), 'input': inp,
                          'messages': [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': _prompt(build_state(inp), action) + '\n/no_think'}],
                          'want_rejected': rnd.choice(errs) if rnd.random() < share else None})
            n += 1
            made += 1
    with open(os.path.join(HERE, 'cases3.jsonl'), 'w', encoding='utf-8') as f:
        for c in cases:
            f.write(json.dumps(c, ensure_ascii=False) + '\n')
    os.makedirs(os.path.join(HERE, 'batches3'), exist_ok=True)
    for b in range(3):
        with open(os.path.join(HERE, 'batches3', f'batch_{b + 1}.jsonl'), 'w', encoding='utf-8') as f:
            for c in cases[b::3]:
                f.write(json.dumps(c, ensure_ascii=False) + '\n')
    from collections import Counter
    print('第三批', len(cases), dict(Counter(c['action'] for c in cases)), '反面', sum(1 for c in cases if c['want_rejected']),
          dict(Counter(c['want_rejected'] for c in cases if c['want_rejected'])), '最后编号', n - 1)


if __name__ == '__main__':
    main()
