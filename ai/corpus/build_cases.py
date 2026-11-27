"""生成训练语料的输入（v0.6 第 7 章：以运行时实际接口格式生成语料）。

每条样例 = 运行时真实发给模型的 system + user 提示词（由 ai/runtime/engine.py 的同一套函数生成），
目标回答由「老师」（审核过的人工 / 大模型写作）另行填写，见 ai/corpus/README.md。

用法：python3 ai/corpus/build_cases.py  → ai/corpus/cases.jsonl 与分批文件 ai/corpus/batches/batch_XX.jsonl
"""
import hashlib
import json
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'runtime'))
from engine import SYSTEM, _prompt, build_state, card_prompt, summary_prompt  # noqa: E402
from policy import decide  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
SEED = 20261127
MAJORS = [f'major_{i:02d}' for i in range(22)]

# ── 问题库（只用于生成输入；不涉及危机，危机由程序固定话术处理，不进训练）──
Q = {
    'work': ['最近工作上很迷茫，该往哪里使劲？', '我在现在的公司还能做下去吗？', '换了新岗位，怎么适应得快一点？', '项目一直推不动，问题出在哪？',
             '要不要接下这个新机会？', '和领导的关系总是很紧张，怎么办？', '最近总觉得自己在原地打转。', '我适合做现在这份工作吗？'],
    'study': ['考研这条路我该继续吗？', '最近学不进去，怎么调整？', '毕业以后的方向很模糊。', '要不要换专业？'],
    'self': ['最近总是提不起劲，想看看是怎么回事。', '我想更了解现在的自己。', '我是不是太在意别人的看法了？', '怎样才能对自己好一点？',
             '最近情绪起伏很大，想找找原因。', '我总是拖延，想听听牌怎么说。', '我该怎么面对接下来的变化？', '想给自己一点方向。'],
    'love_self': ['我在这段关系里需要什么？', '分手以后，我该怎么往前走？', '我总是在关系里委屈自己，为什么？', '要不要开始一段新的感情？',
                  '怎么和伴侣好好沟通？', '我还没准备好恋爱，这样可以吗？'],
    'family': ['和家人的关系最近很僵，怎么办？', '我该怎么和父母谈我的决定？', '家里的事让我很累。'],
    'decision': ['要不要辞职去做自己想做的事？', '该不该搬去另一个城市？', '要不要和朋友合伙？', '该不该继续这段关系？', '要不要报这个课程？', '要不要回老家发展？'],
    'other': ['他是不是不喜欢我了？', '她心里到底怎么想我？', '对方会不会回来找我？', '他会不会选我？', '她是不是在骗我？', 'ta 还爱我吗？'],
    'none': [''],
}
ASSOC = ['这张牌让我想到外婆家的院子', '看到这个画面，我想起第一次一个人出远门', '它让我想到小时候总是一个人等爸妈下班', '这个画面让我想到最近搬家的那天',
         '我想到大学毕业那年的夏天', '它让我想起以前养过的一只狗', '这让我想到我一直没说出口的一句话', '看着它我想到和好朋友吵架的那次']
MEANING_ONLY = ['我只想知道牌义，别分析我', '直接说牌义就好', '不要分析，只要牌义']
PLAY = ['奶蛙你吃过月亮吗？我就是来玩梗的', '就是来玩的，奶蛙今天心情怎么样', '开玩笑的，抽到这张是不是说明我今晚该吃火锅', '我就是来玩梗的：奶蛙会不会游泳？',
        '逗你的，奶蛙你是青蛙吗', '就是来玩的，这张牌能帮我抢到演唱会门票吗']

# ── 任务与配额（第一批）──
TASKS = [
    # (任务名, 牌阵, 张数, 问题领域, 用户说的话, 数量)
    ('single_answer', 'one', 1, ['work', 'study', 'self', 'love_self', 'family', 'none'], None, 88),
    ('three_answer', 'three', 3, ['work', 'self', 'love_self', 'family', 'none'], None, 80),
    ('cross_card', 'five', 5, ['work', 'self', 'love_self', 'study', 'none'], None, 50),      # ≥4 张时运行时逐张生成
    ('cross_summary', 'five', 5, ['work', 'self', 'love_self', 'study', 'none'], None, 20),   # 逐张之后的一句整体
    ('decision_ask', 'one', 1, ['decision'], None, 40),
    ('decision_ask_three', 'three', 3, ['decision'], None, 20),
    ('meaning_only', 'one', 1, ['none', 'self', 'work'], 'meaning', 44),
    ('reflect_association', 'one', 1, ['none', 'self'], 'assoc', 60),
    ('playful', 'one', 1, ['none'], 'play', 40),
    ('third_party', 'one', 1, ['other'], None, 24),
    ('third_party_three', 'three', 3, ['other'], None, 16),
]
DPO_SHARE = 0.33   # 约三分之一的样例另写一条「反面回答」
ERROR_TYPES = ['prediction', 'diagnosis', 'symbol_error', 'gothic_style', 'preachy', 'blame_user', 'ignore_position', 'mind_reading', 'over_questioning', 'list_format']


def positions(spread_id):
    sp = json.load(open(os.path.join(ROOT, 'data/spreads.json'), encoding='utf-8'))['spreads']
    return [p['id'] for p in next(s for s in sp if s['id'] == spread_id)['positions']]


def bench_keys():
    keys = set()
    for l in open(os.path.join(ROOT, 'ai/benchmark/cases_pilot.jsonl'), encoding='utf-8'):
        if l.strip():
            c = json.loads(l)
            keys.add((c['input'].get('question', ''), tuple(sorted(k['card_id'] for k in c['input']['cards']))))
    return keys


def split_of(cards):
    """按牌的组合切分，同一组合永远在同一个集合里（防止测试泄漏）"""
    h = int(hashlib.md5('|'.join(sorted(cards)).encode()).hexdigest(), 16) % 100
    return 'test' if h < 5 else 'val' if h < 10 else 'train'


def main():
    rnd = random.Random(SEED)
    avoid = bench_keys()
    cases, n = [], 0
    single_cycle = [(c, o) for c in MAJORS for o in ('upright', 'reversed')]   # 单张任务尽量覆盖每张牌的正逆位
    rnd.shuffle(single_cycle)
    ci = 0
    for task, spread, k, domains, turn_kind, count in TASKS:
        pos = positions(spread)
        made = 0
        while made < count:
            if k == 1:
                cid, ori = single_cycle[ci % len(single_cycle)]
                ci += 1
                cards = [{'card_id': cid, 'orientation': ori, 'position_id': pos[0]}]
            else:
                ids = rnd.sample(MAJORS, k)
                cards = [{'card_id': c, 'orientation': 'reversed' if rnd.random() < 0.35 else 'upright', 'position_id': p} for c, p in zip(ids, pos)]
            dom = rnd.choice(domains)
            question = rnd.choice(Q[dom])
            turns = []
            if turn_kind == 'meaning':
                turns = [rnd.choice(MEANING_ONLY)]
            elif turn_kind == 'assoc':
                turns = [rnd.choice(ASSOC)]
            elif turn_kind == 'play':
                question = rnd.choice(PLAY)
            if (question, tuple(sorted(c['card_id'] for c in cards))) in avoid:
                continue
            action, why = decide(question, turns)
            inp = {'spread_id': spread, 'cards': cards, 'question': question, 'user_turns': turns}
            state = build_state(inp)
            if task == 'cross_card':      # 只取其中一张，和运行时的逐张提示词一致
                focus = rnd.randrange(k)
                inp['focus_index'] = focus
                prompt = card_prompt(state, state['active_cards'][focus])
            elif task == 'cross_summary':  # 各位置的解读用牌义占位（运行时是模型自己写的逐张解读）
                lines = [f"{c['position']['name']}·{c['name']}：{c['meaning']}" for c in state['active_cards']]
                prompt = summary_prompt(state, lines)
            else:
                prompt = _prompt(state, action)
            n += 1
            made += 1
            cases.append({
                'case_id': f'corpus.{n:04d}', 'task': task, 'action': action, 'action_reason': why,
                'split': split_of([c['card_id'] for c in cards]),
                'input': inp,
                'messages': [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': prompt + '\n/no_think'}],
                'want_rejected': None,
            })
    # 偏好对：抽三分之一，指定一种错误类型（在不适用的动作上换成合适的错误）
    for c in cases:
        if rnd.random() < DPO_SHARE:
            pool = ERROR_TYPES[:]
            if c['action'] != 'ANSWER' or len(c['input']['cards']) == 1 or c['task'].startswith('cross'):
                pool.remove('ignore_position')
            if not c['task'].startswith('third_party'):
                pool.remove('mind_reading')
            if c['task'].startswith('cross') or c['action'] != 'ASK':
                pool.remove('over_questioning') if c['action'] not in ('REFLECT', 'ANSWER_MEANING', 'ANSWER') else None
            c['want_rejected'] = rnd.choice(pool)
    os.makedirs(os.path.join(HERE, 'batches'), exist_ok=True)
    with open(os.path.join(HERE, 'cases.jsonl'), 'w', encoding='utf-8') as f:
        for c in cases:
            f.write(json.dumps(c, ensure_ascii=False) + '\n')
    nb = 7   # 交错分批：每批都混有各种任务，避免一个写作者只写一种、句式趋同
    for b in range(nb):
        with open(os.path.join(HERE, 'batches', f'batch_{b + 1:02d}.jsonl'), 'w', encoding='utf-8') as f:
            for c in cases[b::nb]:
                f.write(json.dumps(c, ensure_ascii=False) + '\n')
    from collections import Counter
    print('样例', len(cases), dict(Counter(c['action'] for c in cases)))
    print('切分', dict(Counter(c['split'] for c in cases)), '偏好对', sum(1 for c in cases if c['want_rejected']))
    print('批次', nb)


if __name__ == '__main__':
    main()
