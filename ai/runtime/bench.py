"""跑独立测试集 ai/benchmark/cases_pilot.jsonl，输出报告到 ai/runtime/reports/。

用法：python3 ai/runtime/bench.py [模型名，默认 qwen3:1.7b] [只跑的 case_id ...]
检查项：
- expected_action：程序选的动作是否符合预期
- must_not：输出里不能出现（前面紧跟否定词的不算，例如「不一定会」；正反问的前半截也不算，例如「明年会不会」）
- must_mention_any：至少提到其中一个
"""
import json
import os
import re
import sys
import time

sys.path.insert(0, os.path.dirname(__file__))
from engine import run  # noqa: E402
from knowledge import ROOT  # noqa: E402

NEG = re.compile(r'(不|没|非|别|无|未|并非|不是|不会|不一定)$')


def hits(text, words):
    out = []
    for w in words or []:
        for m in re.finditer(re.escape(w), text):
            # 前面紧跟否定词，或者是「会不会」「能不能」这种正反问的前半截，都不算
            if not NEG.search(text[max(0, m.start() - 4):m.start()]) and not text[m.end():m.end() + 1] == '不':
                out.append(w)
                break
    return out


def main():
    model = sys.argv[1] if len(sys.argv) > 1 else 'qwen3:1.7b'
    only = set(sys.argv[2:])
    cases = [json.loads(l) for l in open(os.path.join(ROOT, 'ai/benchmark/cases_pilot.jsonl'), encoding='utf-8') if l.strip()]
    if only:
        cases = [c for c in cases if c['case_id'] in only]
    rows, traces = [], []
    for c in cases:
        tr = run(c['input'], model=model)
        ch = c['checks']
        out = tr['output']
        res = {'case_id': c['case_id'], 'action': tr['action'], 'latency_s': tr['latency_s'], 'output': out}
        exp = ch.get('expected_action')
        res['action_ok'] = exp is None or exp == tr['action'] or (exp == 'ANSWER' and tr['action'].startswith('ANSWER'))   # 只要牌义 = ANSWER 的一种
        res['must_not_hits'] = hits(out, ch.get('must_not'))
        mm = ch.get('must_mention_any')
        res['mention_ok'] = True if not mm else any(w in out for w in mm)
        res['pass'] = res['action_ok'] and not res['must_not_hits'] and res['mention_ok']
        rows.append(res)
        traces.append(tr)
        print(f"{c['case_id']} {'通过' if res['pass'] else '未通过'} · {tr['action']} · {tr['latency_s']}s", flush=True)

    os.makedirs(os.path.join(ROOT, 'ai/runtime/reports'), exist_ok=True)
    tag = model.replace(':', '-')
    with open(os.path.join(ROOT, f'ai/runtime/reports/traces_{tag}.json'), 'w', encoding='utf-8') as f:
        json.dump(traces, f, ensure_ascii=False, indent=1)
    passed = sum(r['pass'] for r in rows)
    gen = [t for t in traces if t.get('generated')]
    tok = sum(t['stats']['eval_count'] or 0 for t in gen)
    ms = sum(t['stats']['eval_ms'] for t in gen)
    md = [f"# 测试集报告 · {model}", '', f"- 时间：{time.strftime('%Y-%m-%d %H:%M')}",
          f"- 通过：{passed} / {len(rows)}",
          f"- 生成速度：{tok / (ms / 1000):.1f} tokens/s（{len(gen)} 次模型调用，平均每次 {sum(t['latency_s'] for t in gen) / max(1, len(gen)):.1f} 秒）" if gen else '- 没有调用模型',
          '', '| 样例 | 结果 | 动作 | 耗时 | 问题 |', '|---|---|---|---|---|']
    for r in rows:
        prob = []
        if not r['action_ok']:
            prob.append('动作不符')
        if r['must_not_hits']:
            prob.append('说了：' + '、'.join(r['must_not_hits']))
        if not r['mention_ok']:
            prob.append('没提到应提的词')
        md.append(f"| {r['case_id']} | {'✅' if r['pass'] else '❌'} | {r['action']} | {r['latency_s']}s | {'；'.join(prob)} |")
    md += ['', '## 逐条输出', '']
    for c, r in zip(cases, rows):
        md += [f"### {r['case_id']} · {r['action']}", '',
               f"输入：{c['input'].get('question') or '（无提问）'}" + (f" ／ 用户说：{' / '.join(c['input']['user_turns'])}" if c['input'].get('user_turns') else ''), '',
               '> ' + r['output'].replace('\n', '\n> '), '']
    with open(os.path.join(ROOT, f'ai/runtime/reports/bench_{tag}.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(md) + '\n')
    print(f'通过 {passed} / {len(rows)}；报告：ai/runtime/reports/bench_{tag}.md')


if __name__ == '__main__':
    main()
