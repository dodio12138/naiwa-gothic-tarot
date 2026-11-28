"""第四批起：v0.6 原计划其余任务的语料输入（阶段 2 试写 / 阶段 3 批量用同一个脚本，按 --scale 放大）。

任务（动作）：
- explain_knowledge（EXPLAIN）：意象代表什么、元素 / 星象对应、韦特原典、两张牌的区别、编号
- explain_philosophy（EXPLAIN）：命题与矛盾：怎么理解、什么时候不适用、两极之间
- parable（PARABLE）：讲个小故事 / 打个比方
- whisper（WHISPER，程序调用）：为某张牌写一句低语
- compress（COMPRESS，程序调用）：把一段解读压缩成一句（解读取自已审查的语料）
- expand（EXPAND，多轮）：上一轮 = 已审查语料里的回答；用户说「再说说 / 换个角度 / 说短一点 / 如果是逆位呢」
- feedback（REVISE / ACK，多轮）：用户不认同 / 认同 / 不确定 / 没感觉 / 补充 / 不舒服 / 其他

多轮样例的第一轮直接取自已有语料（同一副牌、同一个问题），所以切分（按牌组合）与原样例一致。
输入一律用运行时的 engine.build_messages 生成。问题原文不得出现在留出测试集与行为测试集里。

用法：python3 ai/corpus/build_cases4.py pilot       → cases4_pilot.jsonl、batches4_pilot/（每类 40 条）
      python3 ai/corpus/build_cases4.py full <起始编号> → cases4_full.jsonl、batches4_full/（按计划配额）
"""
import json
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'ai', 'runtime'))
sys.path.insert(0, HERE)
from build_cases import MAJORS, positions, split_of  # noqa: E402
from engine import SYSTEM, build_messages, build_state, knowledge  # noqa: E402
from policy import decide  # noqa: E402

K = knowledge()
HELD = set()
for f in ('ai/eval/heldout_v1.jsonl', 'ai/eval/heldout_v2_new.jsonl', 'ai/benchmark/cases_pilot.jsonl'):
    for l in open(os.path.join(ROOT, f), encoding='utf-8'):
        i = json.loads(l)['input']
        HELD.add(i.get('question', ''))
        HELD.update(i.get('user_turns') or [])
        HELD.update(h['content'] for h in i.get('history') or [] if h['role'] == 'user')
HELD.discard('')

NAME = {cid: K.cards[cid]['name']['zh'] for cid in MAJORS}

# ── 问法模板（{card} 牌名，{img} 意象，{a}{b} 矛盾两极，{other} 另一张牌）──
KNOW_IMG = ['这张牌里的{img}代表什么？', '{img}在这里象征什么？', '画面上的{img}是什么意思？', '为什么画{img}？它代表啥', '{card}里那个{img}，寓意是什么？',
            '想知道{img}在{card}里象征什么', '{img}这个细节代表什么呀']
KNOW_CORR = ['{card}对应什么元素？', '{card}对应哪个星座或者行星？', '{card}在占星上对应什么？', '这张牌对应的是什么星座？', '{card}和哪个元素有关？对应什么']
KNOW_WAITE = ['{card}在韦特原典里怎么说？', '韦特是怎么解释{card}的？', '传统上{card}代表什么？', '{card}这张牌是什么意思？', '韦特那本书里{card}的占卜义是什么？']
KNOW_CMP = ['{card}和{other}有什么不同？', '{card}和{other}的区别是什么？', '{card}跟{other}有什么区别', '同样是讲……，{card}和{other}有什么不同？']
PHILO = ['{card}里的{a}和{b}怎么理解？', '{a}和{b}在这张牌里是什么意思？', '怎么理解{card}说的{a}？', '{card}讲的{a}，和{b}有什么不同？',
         '这张牌里「{a}」和「{b}」的张力怎么理解？', '{card}说的{a}是什么意思，什么时候不适用？']
PARABLE_ASK = ['用这张牌讲个小故事吧', '给我讲个寓言', '能打个比方吗', '用个比喻说说这张牌', '讲个小故事就好', '用这张牌讲个童话',
               '讲个寓言给我听吧', '可以打个比方说说吗', '比喻一下这张牌', '讲个故事，不用分析我']
PARABLE_CTX = ['', '', '最近工作很累', '想换个方向', '和家里人有点别扭', '最近总睡不好', '在犹豫要不要表白', '刚搬到新地方', '学习提不起劲', '和朋友闹别扭了']
EXPAND_ASK = {
    'deeper': ['再说说', '再多说一点', '展开讲讲', '具体点', '能具体一点吗', '详细说说', '再深一点', '还有呢', '继续说', '多说一点吧'],
    'angle': ['换个角度说说', '换一个角度呢', '有没有别的角度', '还有另一种理解吗', '换个角度看看'],
    'shorter': ['说短一点', '简单点', '一句话概括', '能简短点吗', '一句话说说重点', '短一点就好'],
    'counterfactual': ['如果是{o}呢？', '要是{o}会怎样？', '假如换成{o}呢', '{o}的话会不一样吗', '要是{o}的话呢？'],   # {o} 由程序按牌的实际方向取反
}
FEEDBACK = {
    'deny': ['不对，我不是这样的', '不太对，我不是因为这个', '说错了，我没有那么想', '我不同意，这不是我的问题', '不像我，我其实挺坚定的',
             '不是这样，我只是太累了', '没有啊，我并不害怕', '不太像我现在的情况', '并不是，我已经想清楚了', '不是的，我只是没时间'],
    'agree': ['说中了', '确实是这样', '有道理', '是的，我就是这样', '挺准的', '对的，最近就是这样', '被说中了，有点意外', '确实，我一直在拖'],
    'unsure': ['不知道', '说不清', '不确定', '可能吧', '也许吧', '不好说'],
    'nofeel': ['没什么感觉', '没感觉', '没啥感觉', '一般般吧', '没什么特别的', '没触动'],
    'addinfo': ['其实这件事已经拖了半年了', '其实我身边没有人可以商量', '补充一下，我已经做了一部分决定', '其实是最近换了领导', '忘了说，我下个月就要做决定了',
                '其实我已经试过一次了', '我说的是工作上的事', '情况是家里也有压力'],
    'discomfort': ['听着有点难受', '有点不舒服', '这话有点重', '听着不好受', '别这么说，有点怕'],
    'other': ['那我现在应该先做什么', '这是好事还是坏事', '那接下来呢', '这跟我的问题有什么关系', '我该怎么理解这一张'],
}


def card_ctx(cid, ori='upright'):
    return K.card_context(cid, ori)


def mk(case_id, task, inp, rnd, want=None):
    st = build_state(inp)
    action, why = decide(inp.get('question', ''), inp.get('user_turns') or [], inp.get('history'), inp.get('mode'), len(inp['cards']))
    msgs = build_messages(inp, st, action, why)
    msgs[-1]['content'] += '\n/no_think'
    return {'case_id': case_id, 'task': task, 'action': action, 'action_reason': why,
            'split': split_of([c['card_id'] for c in inp['cards']]), 'input': inp,
            'messages': [{'role': 'system', 'content': SYSTEM}] + msgs, 'want_rejected': want}


def one(cid, ori):
    return {'spread_id': 'one', 'cards': [{'card_id': cid, 'orientation': ori, 'position_id': 'message'}], 'user_turns': []}


SEEN = set()


def fresh(cid, q):
    """同一张牌、同一个问题只用一次"""
    if (cid, q) in SEEN:
        return False
    SEEN.add((cid, q))
    return True


def gen_explain_knowledge(rnd, n):
    out = []
    while len(out) < n:
        cid, ori = rnd.choice(MAJORS), rnd.choice(['upright', 'upright', 'reversed'])
        c = card_ctx(cid, ori)
        kind = rnd.choices(['img', 'corr', 'waite', 'cmp'], [5, 2, 2, 2])[0]
        if kind == 'img':
            q = rnd.choice(KNOW_IMG).format(img=rnd.choice(c['visible_traditional']), card=NAME[cid])
        elif kind == 'corr':
            q = rnd.choice(KNOW_CORR).format(card=NAME[cid])
        elif kind == 'waite':
            q = rnd.choice(KNOW_WAITE).format(card=NAME[cid])
        else:
            q = rnd.choice(KNOW_CMP).format(card=NAME[cid], other=NAME[rnd.choice([m for m in MAJORS if m != cid])]).replace('同样是讲……，', '')
        if q in HELD or decide(q, [])[0] != 'EXPLAIN' or not fresh(cid, q):
            continue
        inp = dict(one(cid, ori), question=q)
        out.append(('explain_knowledge', inp))
    return out


def gen_explain_philosophy(rnd, n):
    out = []
    while len(out) < n:
        cid, ori = rnd.choice(MAJORS), rnd.choice(['upright', 'upright', 'reversed'])
        c = card_ctx(cid, ori)
        if not c.get('contradictions'):
            continue
        a, b = rnd.choice(c['contradictions'])['poles'].split('／')
        q = rnd.choice(PHILO).format(card=NAME[cid], a=a, b=b)
        if q in HELD or decide(q, [])[0] != 'EXPLAIN' or not fresh(cid, q):
            continue
        out.append(('explain_philosophy', dict(one(cid, ori), question=q)))
    return out


def gen_parable(rnd, n):
    out = []
    while len(out) < n:
        cid, ori = rnd.choice(MAJORS), rnd.choice(['upright', 'reversed'])
        ctx, ask = rnd.choice(PARABLE_CTX), rnd.choice(PARABLE_ASK)
        q = (ctx + '，' + ask) if ctx and rnd.random() < 0.5 else ask
        if q in HELD or decide(q, [])[0] != 'PARABLE' or not fresh(cid + ori, q):
            continue
        out.append(('parable', dict(one(cid, ori), question=q)))
    return out


def gen_whisper(rnd, n):
    out = []
    for _ in range(n):
        if rnd.random() < 0.7:
            inp = dict(one(rnd.choice(MAJORS), rnd.choice(['upright', 'reversed'])), question=rnd.choice(['', '', rnd.choice(PARABLE_CTX)]), mode='whisper')
        else:
            pos = positions('three')
            inp = {'spread_id': 'three', 'user_turns': [], 'question': rnd.choice(['', rnd.choice(PARABLE_CTX)]), 'mode': 'whisper', 'focus_index': rnd.randrange(3),
                   'cards': [{'card_id': cid, 'orientation': rnd.choice(['upright', 'reversed']), 'position_id': p} for cid, p in zip(rnd.sample(MAJORS, 3), pos)]}
        out.append(('whisper', inp))
    return out


def reviewed_first_turns():
    """已审查语料里可以当「上一轮」的回答：单张 / 三张的 ANSWER，没有问题标记"""
    rows = [json.loads(l) for l in open(os.path.join(HERE, 'corpus.jsonl'), encoding='utf-8')]
    return [r for r in rows if not r['issues'] and r['action'] == 'ANSWER' and len(r['messages']) == 2
            and r['input']['spread_id'] in ('one', 'three', 'daily') and not r['input'].get('user_turns') and r['input'].get('question', '') not in HELD]


def gen_compress(rnd, n, firsts):
    out = []
    for r in rnd.sample(firsts, min(n, len(firsts))):
        inp = {k: r['input'][k] for k in ('spread_id', 'cards')}
        out.append(('compress', dict(inp, question='', user_turns=[], mode='compress', text=r['response'])))
    return out


def gen_multi(rnd, n, firsts, table, task):
    """上一轮取自已审查语料（可重复使用，但同一条上一轮配同一句话只用一次）"""
    out, used = [], set()
    while len(out) < n:
        r = rnd.choice(firsts)
        sub = rnd.choice(list(table))
        said = rnd.choice(table[sub])
        if sub == 'counterfactual':   # 按实际方向取反，并点明是哪一张
            cards = r['input']['cards']
            k = rnd.randrange(len(cards))
            o = '正位' if cards[k]['orientation'] == 'reversed' else '逆位'
            said = said.format(o=o)
            if len(cards) > 1:   # 多张时点名是哪一张
                said = f"{NAME[cards[k]['card_id']]}那张{rnd.choice(['如果是', '要是换成', '假如是'])}{o}呢？"
        if said in HELD or (r['case_id'], said) in used:
            continue
        used.add((r['case_id'], said))
        inp = {k: r['input'][k] for k in ('spread_id', 'cards', 'question')}
        inp.update(user_turns=[], first_action='ANSWER', parent_case_id=r['case_id'],
                   history=[{'role': 'assistant', 'content': r['response']}, {'role': 'user', 'content': said}])
        out.append((task, inp))
    return out


def main(mode, start):
    rnd = random.Random(20261201 if mode == 'pilot' else 20261202)
    q = {'explain_knowledge': 20, 'explain_philosophy': 20, 'parable': 40, 'whisper': 25, 'compress': 15, 'expand': 40, 'feedback': 40} if mode == 'pilot' else \
        {'explain_knowledge': 1400, 'explain_philosophy': 2500, 'parable': 2000, 'whisper': 1500, 'compress': 1000, 'expand': 1500, 'feedback': 1500}
    firsts = reviewed_first_turns()
    items = gen_explain_knowledge(rnd, q['explain_knowledge']) + gen_explain_philosophy(rnd, q['explain_philosophy']) + gen_parable(rnd, q['parable']) + \
        gen_whisper(rnd, q['whisper']) + gen_compress(rnd, min(q['compress'], len(firsts)), firsts) + \
        gen_multi(rnd, min(q['expand'], len(firsts)), firsts, EXPAND_ASK, 'expand') + gen_multi(rnd, min(q['feedback'], len(firsts)), firsts, FEEDBACK, 'feedback')
    errs = {'explain_knowledge': ['symbol_error', 'source_confusion', 'blame_user'], 'explain_philosophy': ['preachy', 'absolute_claim', 'symbol_error'],
            'parable': ['preachy', 'blame_user', 'symbol_error'], 'whisper': ['preachy', 'prediction', 'symbol_error'], 'compress': ['adds_content', 'prediction'],
            'expand': ['repeat_previous', 'prediction', 'symbol_error'], 'feedback': ['insist_after_denial', 'over_questioning', 'presume_feelings', 'prediction']}
    cases = []
    for i, (task, inp) in enumerate(items):
        act = decide(inp.get('question', ''), [], inp.get('history'), inp.get('mode'), len(inp['cards']))[0]
        pool = [e for e in errs[task] if e != 'insist_after_denial' or act == 'REVISE']
        want = rnd.choice(pool) if rnd.random() < 0.3 else None
        if act == 'REVISE' and rnd.random() < 0.6:
            want = 'insist_after_denial'
        cases.append(mk(f'corpus.{start + i:05d}', task, inp, rnd, want))
    tag = 'pilot' if mode == 'pilot' else 'full'
    with open(os.path.join(HERE, f'cases4_{tag}.jsonl'), 'w', encoding='utf-8') as f:
        for c in cases:
            f.write(json.dumps(c, ensure_ascii=False) + '\n')
    nb = 5 if mode == 'pilot' else max(1, len(cases) // 120)
    d = os.path.join(HERE, f'batches4_{tag}')
    os.makedirs(d, exist_ok=True)
    for b in range(nb):
        with open(os.path.join(d, f'batch_{b + 1:03d}.jsonl'), 'w', encoding='utf-8') as f:
            for c in cases[b::nb]:
                f.write(json.dumps(c, ensure_ascii=False) + '\n')
    from collections import Counter
    print(tag, len(cases), dict(Counter(c['task'] for c in cases)), dict(Counter(c['action_reason'].split('：')[0] for c in cases)),
          '反面', sum(1 for c in cases if c['want_rejected']), '批次', nb)


if __name__ == '__main__':
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 941)
