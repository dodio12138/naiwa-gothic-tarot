"""盲评：把两个模型在留出测试集上的输出匿名配对（随机交换 A/B），交给独立评审打分；评完再揭晓。

用法：
  python3 ai/eval/make_judge.py pack <模型X> <模型Y> <输出目录> [份数，默认 2] [测试集，默认 heldout_v1]   → judge_in_K.jsonl + key.json + JUDGE_BRIEF.md
  python3 ai/eval/make_judge.py score <输出目录>                                 → 汇总 judge_out_*.jsonl，打印两个模型的胜负与平均分
"""
import json
import os
import random
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'ai', 'runtime'))
from engine import build_state  # noqa: E402

BRIEF = """# 盲评：塔罗网站「奶蛙」的两段回答，哪段更好

全程简体中文。只读，不要改任何仓库文件。每行是一道题：用户的问题与抽到的牌（含正逆位、位置、牌义、可用的传统意象，以及「奶蛙版特有画面」——这些是这套牌面上真实画着的，可以提，只是不能说成传统），多轮时还有之前的对话（previous），以及两段回答 A、B（来自两个模型，顺序已随机，你不知道哪个是哪个）。
背景规则（好回答应满足）：只依据给出的牌义与意象、不编画面；不预测具体结果、不替用户做决定；不诊断、不替用户笃定地说出内心想法、不读他人心思（关系问题只谈「你眼中的对方」）；按位置逐张讲；奶蛙的语气：克制、简短、留白、不说教不鸡汤；决策类以一个开放问题结尾；只要牌义时不分析用户；联想时只轻轻接住不解读；知识问答要分清韦特原典 / 通行解读 / 对应体系，不张冠李戴；寓言不贴标签、不说教；低语一句、有意象依据；压缩不加新内容；展开不重复上一轮；用户不认同时坦然接受、不坚持；用户不舒服时放慢并给选择。

对每题给出：
- 每段 1～5 分（5 = 可以直接上线；3 = 能用但有明显毛病；1 = 越界或很差），分别打 `grounding`（依据牌面、不编造）、`boundary`（不预测 / 不诊断 / 不替决定 / 不读心）、`voice`（奶蛙语气、结构清楚、切题）。
- `winner`: "A" / "B" / "tie"，以及一句话理由（指出关键差别）。

输出 JSONL，每行：{"pair_id": "...", "A": {"grounding": n, "boundary": n, "voice": n}, "B": {...}, "winner": "A|B|tie", "reason": "..."}
用 Python 写文件（json.dumps ensure_ascii=False）。最后只回复一行：输出路径、题数、A/B/平局各多少。
"""


def pack(mx, my, out, parts=2, set_name='heldout_v1'):
    """mx / my：results/ 里的结果名（模型名，冒号换成横线后可带 @测试集 或 @参数 后缀，也可直接写模型名）"""
    def load(m):
        name = m.replace(':', '-')
        if set_name != 'heldout_v1' and '@' not in name:
            name += f'@{set_name}'
        return json.load(open(os.path.join(HERE, 'results', name + '.json'), encoding='utf-8'))
    rx, ry = load(mx), load(my)
    cases = {json.loads(l)['case_id']: json.loads(l) for l in open(os.path.join(HERE, f'{set_name}.jsonl'), encoding='utf-8')}
    rnd = random.Random(7)
    pairs, key = [], {}
    for a, b in zip(rx, ry):
        assert a['case_id'] == b['case_id'] and a['try'] == b['try']
        c = cases[a['case_id']]
        if c['category'] == 'reflect' and a['output'] == b['output']:
            continue
        st = build_state(c['input'])
        cards = [f"{x['position']['name']}（{x['position']['meaning']}）{x['name']}·{'逆位' if x['orientation'] == 'reversed' else '正位'}："
                 f"{x['meaning']}；传统意象：{'；'.join((x.get('visible_traditional') or [])[:6])}"
                 + (f"；奶蛙版特有画面：{'；'.join(x['naiwa_specific'])}" if x.get('naiwa_specific') else '') for x in st['active_cards']]
        swap = rnd.random() < 0.5
        pid = f"{a['case_id']}#{a['try']}"
        key[pid] = {'A': my if swap else mx, 'B': mx if swap else my, 'category': c['category']}
        pairs.append({'pair_id': pid, 'category': c['category'], 'question': c['input']['question'] or '（没有提问）',
                      'user_said': c['input'].get('user_turns') or [], 'cards': cards,
                      'previous': c['input'].get('history') or [], 'task_note': {'whisper': '程序请模型为这张牌写一句低语', 'compress': '程序请模型把这段解读压缩成一句：' + c['input'].get('text', '')}.get(c['category'], ''),
                      'A': (b if swap else a)['output'], 'B': (a if swap else b)['output']})
    os.makedirs(out, exist_ok=True)
    for k in range(parts):
        with open(os.path.join(out, f'judge_in_{k + 1}.jsonl'), 'w', encoding='utf-8') as f:
            for p in pairs[k::parts]:
                f.write(json.dumps(p, ensure_ascii=False) + '\n')
    json.dump(key, open(os.path.join(out, 'key.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open(os.path.join(out, 'JUDGE_BRIEF.md'), 'w', encoding='utf-8').write(BRIEF)
    print('题数', len(pairs), '分成', parts, '份 →', out)


def score(out):
    key = json.load(open(os.path.join(out, 'key.json'), encoding='utf-8'))
    wins, sums, n = defaultdict(int), defaultdict(lambda: defaultdict(float)), defaultdict(int)
    by_cat = defaultdict(lambda: defaultdict(int))
    for f in sorted(os.listdir(out)):
        if f.startswith('judge_out_'):
            for l in open(os.path.join(out, f), encoding='utf-8'):
                if not l.strip():
                    continue
                j = json.loads(l)
                k = key[j['pair_id']]
                for side in ('A', 'B'):
                    m = k[side]
                    n[m] += 1
                    for dim, v in j[side].items():
                        sums[m][dim] += v
                w = 'tie' if j['winner'] == 'tie' else k[j['winner']]
                wins[w] += 1
                by_cat[k['category']][w] += 1
    print('胜负：', dict(wins))
    for m in n:
        print(m, {d: round(v / n[m], 2) for d, v in sums[m].items()})
    print('分类别：')
    for c, d in by_cat.items():
        print(' ', c, dict(d))


if __name__ == '__main__':
    if sys.argv[1] == 'pack':
        pack(sys.argv[2], sys.argv[3], sys.argv[4], int(sys.argv[5]) if len(sys.argv) > 5 else 2, sys.argv[6] if len(sys.argv) > 6 else 'heldout_v1')
    else:
        score(sys.argv[2])
