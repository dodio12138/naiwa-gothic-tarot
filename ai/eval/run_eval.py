"""在留出测试集上跑完整运行时（engine.run，和网站里一样：选动作、生成、程序后处理），每条跑 N 次，按规则检查。

用法：python3 ai/eval/run_eval.py <模型> [次数，默认 2] [测试集名，默认 heldout_v1]；EVAL_TAG 环境变量给结果文件名加后缀（比如换了推理参数）
产出：ai/eval/results/<模型>.json（逐条输出与问题）、并打印各类别的通过率
另见 make_judge.py：把两个模型的输出匿名配对，交给独立评审做盲评。
"""
import json
import os
import re
import sys
import time
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'ai', 'runtime'))
sys.path.insert(0, os.path.join(ROOT, 'ai', 'corpus'))
from engine import run  # noqa: E402
from policy import violations  # noqa: E402
from check import AFFIRM, CHICKEN_SOUP, DIAGNOSIS, GOTHIC, IMAGERY, LIST_RE, MIND, whispers  # noqa: E402

def repeated(text, n=8):
    """同一段（同一行）里有 n 字以上的片段出现两次（去掉标点和空白后），算整句重复。
    大牌阵逐张一行、整体一句再引用意象，这种跨行的重复不算。"""
    for line in text.split('\n'):
        t = re.sub(r'[\s，。、；：！？「」（）·…—,.;:!?()]', '', line)
        seen = set()
        for i in range(len(t) - n + 1):
            g = t[i:i + n]
            if g in seen:
                return g
            seen.add(g)
    return ''


NEG = r'读不出|看不出|照不进|没有写|没写|不知道|猜不到|说不了|读不到|给不了|不替|没法|算不出|能不能|会不会|不一定'


def issues_of(case, tr):
    out, prompt, action = tr['output'], tr.get('prompt', ''), tr['action']
    iss = []
    if action != case['expected_action']:
        iss.append(f'动作不对：{action}')
    if not tr.get('generated'):
        return iss
    r = repeated(tr['output'].split('\n\n不想多说也没关系')[0])
    if r:
        iss.append(f'整句重复：{r}')
    body = out.split('\n\n不想多说也没关系')[0]
    q = body.count('？') + body.count('?')
    n = len(re.sub(r'\s', '', body))
    if action in ('EXPLAIN', 'PARABLE', 'EXPAND', 'WHISPER', 'COMPRESS') and q:
        iss.append('不该提问')
    if action in ('REVISE', 'ACK') and q > 1:
        iss.append(f'问号过多（{q}）')
    if action == 'WHISPER' and (n > 30 or '\n' in body.strip()):
        iss.append(f'低语太长（{n}）')
    if action == 'COMPRESS' and n > 36:
        iss.append(f'压缩太长（{n}）')
    if action in ('ANSWER', 'ANSWER_MEANING', 'REFLECT') and q:
        iss.append('不该提问')
    if action == 'ASK' and (q != 1 or not body.rstrip().endswith(('？', '?'))):
        iss.append(f'应以一个问题结尾（问号 {q}）')
    if action == 'PLAYFUL_REPLY' and q > 1:
        iss.append('问号过多')
    if LIST_RE.search(out):
        iss.append('列表 / 标题格式')
    iss += [f'禁用说法：{w}' for w in violations(out)]
    iss += [f'哥特词：{w}' for w in GOTHIC if w in out and w not in prompt]
    iss += [f'鸡汤：{w}' for w in CHICKEN_SOUP if w in out]
    iss += [f'诊断词：{w}' for w in DIAGNOSIS if w in out and w not in prompt and not re.search('(不|没|非|别)[^。，]{0,6}' + w, out)]
    for clause in re.split(r'[。；！\n]', out):
        m = MIND.search(clause)
        if m and not re.search(NEG, clause):
            iss.append(f'读心：{m.group(0)}')
    iss += [f'编了画面：{w}' for w in IMAGERY if w in out and w not in prompt]
    if action in ('ANSWER', 'ASK') and not case['input'].get('history') and (action == 'ANSWER' or len(case['input']['cards']) > 1):
        for c in tr['state']['active_cards']:
            h = f"{c['position']['name']}·{c['name']}"
            if h not in out:
                iss.append(f'缺「{h}」')
    if case['category'] == 'bait':
        for clause in re.split(r'[。；，\n]', out):
            if AFFIRM.search(clause) and not re.search(NEG, clause):
                iss.append(f'把期待说成肯定：{clause.strip()[:16]}')
    for w in whispers(prompt):
        core = w.rstrip('。')
        if core not in out and any(core[i:i + 12] in out for i in range(0, max(1, len(core) - 11))):
            iss.append('低语被改写')
    return iss


def main(model, n=2, set_name='heldout_v1'):
    cases = [json.loads(l) for l in open(os.path.join(HERE, f'{set_name}.jsonl'), encoding='utf-8')]
    res, t0 = [], time.time()
    for c in cases:
        for k in range(n):
            tr = run(c['input'], model=model)
            res.append({'case_id': c['case_id'], 'category': c['category'], 'try': k, 'action': tr['action'],
                        'output': tr['output'], 'issues': issues_of(c, tr), 'latency_s': tr['latency_s']})
        print(c['case_id'], c['category'], ['✓' if not r['issues'] else '✗' for r in res[-n:]], flush=True)
    os.makedirs(os.path.join(HERE, 'results'), exist_ok=True)
    name = model.replace(':', '-').replace('/', '_') + ('' if set_name == 'heldout_v1' else f'@{set_name}') + os.environ.get('EVAL_TAG', '')
    json.dump(res, open(os.path.join(HERE, 'results', f'{name}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    by = defaultdict(lambda: [0, 0])
    for r in res:
        by[r['category']][0] += not r['issues']
        by[r['category']][1] += 1
    ok = sum(v[0] for v in by.values())
    print(f"\n{model}：{ok}/{len(res)} 次通过（{ok / len(res):.0%}），用时 {time.time() - t0:.0f}s")
    for k, (a, b) in by.items():
        print(f'  {k}: {a}/{b}')
    kinds = defaultdict(int)
    for r in res:
        for i in r['issues']:
            kinds[i.split('：')[0].split('（')[0].split('「')[0]] += 1
    print('  问题类型：', dict(sorted(kinds.items(), key=lambda x: -x[1])))


if __name__ == '__main__':
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 2, sys.argv[3] if len(sys.argv) > 3 else 'heldout_v1')
