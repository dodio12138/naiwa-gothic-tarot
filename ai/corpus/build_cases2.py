"""第二批语料（补第一批的不足）：

A. 大牌阵整副写：五张、马蹄、凯尔特十字、两难抉择、共鸣（≥4 张，运行时逐张生成 + 一句整体 + 决策时单独一个问题）。
   老师一次写完整副的逐张解读和整体一句，之后由 assemble2.py 拆成运行时的逐张 / 整体 / 提问样例；
   整体一句的提示词里放的是老师自己写的逐张解读（与运行时一致），替代第一批里用牌义占位的 cross_summary。
B. 少于 4 张的原创牌阵与每日一牌：镜像（3 张）、每日一牌（1 张），走普通提示词。
C. 给第一批已有的样例补反面回答：忽略位置（三张解读）、读心（问他人）。

用法：python3 ai/corpus/build_cases2.py → ai/corpus/jobs2.jsonl、cases2.jsonl、addon_rejected.jsonl、batches2/
"""
import json
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'runtime'))
sys.path.insert(0, HERE)
from build_cases import ASSOC, MAJORS, Q, bench_keys, positions, split_of  # noqa: E402
from engine import SYSTEM, _prompt, build_state, card_prompt  # noqa: E402
from policy import decide  # noqa: E402

SEED = 20261128
START = 483   # 接着第一批的编号
ASK_Q = "用户的问题：{q}\n\n只写一个开放、不诱导、帮用户想清楚自己在意什么的问题，一句话。"   # 与 engine.run 一致

Q2 = dict(Q)
Q2['relation_self'] = ['我在这段关系里到底想要什么？', '我和伴侣最近总是吵架，想看看我们之间。', '我和好朋友之间好像有了距离。', '想看看我和室友的相处。',
                       '我和妈妈的关系一直很别扭。', '暧昧了很久，我该怎么看这段关系？']
Q2['shadow'] = ['我最近总是讨厌某一类人，想看看自己。', '为什么我在别人面前总是很懂事？', '我想看看自己不愿意承认的那一面。', '最近总觉得自己在演一个角色。', '']
Q2['daily'] = ['', '今天要面试，抽一张。', '今天有点累，看看今天。', '今天想给自己一点提醒。']

JOBS = [  # (牌阵, 问题领域, 套数)
    ('five', ['work', 'self', 'love_self', 'decision', 'none'], 6),
    ('horseshoe', ['work', 'self', 'study', 'love_self', 'none'], 8),
    ('celtic', ['self', 'work', 'love_self', 'family', 'none'], 6),
    ('crossroads', ['decision'], 8),
    ('resonance', ['relation_self', 'other'], 8),
]
SMALL = [  # (任务, 牌阵, 问题领域, 用户说的话, 条数)
    ('mirror_answer', 'mirror', ['shadow'], None, 16),
    ('mirror_reflect', 'mirror', ['shadow'], 'assoc', 4),
    ('daily_answer', 'daily', ['daily'], None, 10),
]
LINE_ERRORS = ['ignore_position', 'symbol_error', 'prediction', 'gothic_style', 'blame_user', 'diagnosis']
SUM_ERRORS = ['prediction', 'preachy', 'blame_user', 'ignore_position']


def deal(rnd, spread):
    pos = positions(spread)
    ids = rnd.sample(MAJORS, len(pos))
    return [{'card_id': c, 'orientation': 'reversed' if rnd.random() < 0.35 else 'upright', 'position_id': p} for c, p in zip(ids, pos)]


def main():
    rnd = random.Random(SEED)
    avoid = bench_keys()
    n = START
    jobs, cases = [], []
    for spread, domains, count in JOBS:
        for _ in range(count):
            cards = deal(rnd, spread)
            question = rnd.choice(Q2[rnd.choice(domains)])
            if (question, tuple(sorted(c['card_id'] for c in cards))) in avoid:
                cards = deal(rnd, spread)
            action, why = decide(question, [])
            inp = {'spread_id': spread, 'cards': cards, 'question': question, 'user_turns': []}
            st = build_state(inp)
            job = {'job_id': f'job.{len(jobs) + 1:03d}', 'spread_id': spread, 'action': action, 'action_reason': why, 'question': question,
                   'split': split_of([c['card_id'] for c in cards]), 'input': inp,
                   'card_prompts': [card_prompt(st, c) for c in st['active_cards']],
                   'heads': [f"{c['position']['name']}·{c['name']}" for c in st['active_cards']],
                   'summary_rule': '用一句话说整体（不预测结果，不替任何人下结论' + ('，用「在你眼中」来说对方' if st['spread']['has_other'] else '') + '），30～60 字。',
                   'ask_prompt': ASK_Q.format(q=question) if action == 'ASK' else None,
                   'case_ids': {}}
            # 每副牌阵编号：逐张、整体、（提问）
            job['case_ids']['lines'] = [f'corpus.{n + i:04d}' for i in range(len(cards))]
            n += len(cards)
            job['case_ids']['summary'] = f'corpus.{n:04d}'
            n += 1
            if job['ask_prompt']:
                job['case_ids']['question'] = f'corpus.{n:04d}'
                n += 1
            if rnd.random() < 0.5:   # 一半的牌阵挑一张写反面
                job['want_rejected_line'] = {'index': rnd.randrange(len(cards)), 'error_type': rnd.choice(LINE_ERRORS)}
            if spread == 'resonance' or rnd.random() < 0.35:
                job['want_rejected_summary'] = 'mind_reading' if spread == 'resonance' else rnd.choice(SUM_ERRORS)
            jobs.append(job)
    for task, spread, domains, turn_kind, count in SMALL:
        made = 0
        while made < count:
            cards = deal(rnd, spread)
            question = rnd.choice(Q2[rnd.choice(domains)])
            turns = [rnd.choice(ASSOC)] if turn_kind == 'assoc' else []
            if (question, tuple(sorted(c['card_id'] for c in cards))) in avoid:
                continue
            action, why = decide(question, turns)
            inp = {'spread_id': spread, 'cards': cards, 'question': question, 'user_turns': turns}
            cases.append({'case_id': f'corpus.{n:04d}', 'task': task, 'action': action, 'action_reason': why,
                          'split': split_of([c['card_id'] for c in cards]), 'input': inp,
                          'messages': [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': _prompt(build_state(inp), action) + '\n/no_think'}],
                          'want_rejected': rnd.choice(['prediction', 'diagnosis', 'symbol_error', 'blame_user', 'ignore_position'])
                          if rnd.random() < 0.4 and action == 'ANSWER' and len(cards) > 1 else
                          (rnd.choice(['diagnosis', 'over_questioning', 'preachy']) if rnd.random() < 0.4 else None)})
            n += 1
            made += 1
    # C. 给第一批补反面：没有反面回答的三张解读 → 忽略位置；问他人 → 读心
    first = [json.loads(l) for l in open(os.path.join(HERE, 'cases.jsonl'), encoding='utf-8')]
    three = [c['case_id'] for c in first if c['task'] == 'three_answer' and not c['want_rejected']]
    other = [c['case_id'] for c in first if c['task'].startswith('third_party') and not c['want_rejected']]
    addon = [{'case_id': cid, 'want_rejected': 'ignore_position'} for cid in rnd.sample(three, 22)] + \
            [{'case_id': cid, 'want_rejected': 'mind_reading'} for cid in rnd.sample(other, 22)]

    def dump(name, rows):
        with open(os.path.join(HERE, name), 'w', encoding='utf-8') as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + '\n')
    dump('jobs2.jsonl', jobs)
    dump('cases2_small.jsonl', cases)
    dump('addon_rejected.jsonl', addon)
    # 写作分批：整副牌阵 4 批，小样例 + 补反面 1 批
    os.makedirs(os.path.join(HERE, 'batches2'), exist_ok=True)
    for b in range(4):
        dump(f'batches2/jobs_{b + 1}.jsonl', jobs[b::4])
    byid = {c['case_id']: c for c in first}
    resp = {json.loads(l)['case_id']: json.loads(l)['response'] for l in open(os.path.join(HERE, 'corpus.jsonl'), encoding='utf-8')}
    extra = cases + [dict(byid[a['case_id']], want_rejected=a['want_rejected'], existing_response=resp[a['case_id']], addon=True) for a in addon]
    dump('batches2/small_and_addon.jsonl', extra)
    lines = sum(len(j['heads']) for j in jobs)
    print('整副牌阵', len(jobs), '逐张', lines, '提问', sum(1 for j in jobs if j['ask_prompt']), '小样例', len(cases), '补反面', len(addon), '最后编号', n - 1)


if __name__ == '__main__':
    main()
