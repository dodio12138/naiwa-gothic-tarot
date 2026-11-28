"""在语料的留出测试集上对照几个模型：用运行时同样的调用（engine._chat），按 ai/corpus/check.py 的同一套规则检查输出。

用法：python3 ai/train/eval_corpus.py qwen3:1.7b naiwa-sft:1.7b   → ai/train/reports/corpus_test.md
（测试集按牌的组合留出，训练时没见过；另外仍要跑 ai/runtime/bench.py 看行为测试集）
"""
import json
import os
import sys
import time
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'ai', 'runtime'))
sys.path.insert(0, os.path.join(ROOT, 'ai', 'corpus'))
from engine import SYSTEM, _chat  # noqa: E402
from check import check  # noqa: E402


def main(models):
    rows = [json.loads(l) for l in open(os.path.join(ROOT, 'ai/corpus/corpus.jsonl'), encoding='utf-8')]
    test = [r for r in rows if r['split'] == 'test' and r['task'] != 'cross_summary']
    out = {m: [] for m in models}
    for m in models:
        t0 = time.time()
        for r in test:
            user = r['messages'][1]['content'].removesuffix('\n/no_think')   # _chat 会自己补上
            n = 160 if r['task'] in ('cross_card', 'spread_card') else 120 if r['task'] == 'spread_summary' else 60 if r['task'] == 'ask_question' else 420
            text, _ = _chat(m, SYSTEM, user, num_predict=n)
            iss = check(dict(r, want_rejected=None), text)
            out[m].append({'case_id': r['case_id'], 'task': r['task'], 'output': text, 'issues': iss})
        print(f"{m}：{sum(bool(x['issues']) for x in out[m])} / {len(test)} 条有问题，{time.time() - t0:.0f}s")
    os.makedirs(os.path.join(HERE, 'reports'), exist_ok=True)
    lines = ['# 语料留出测试集对照', '', f'测试样例 {len(test)} 条（按牌组合留出）。检查规则同 ai/corpus/check.py。', '',
             '| 模型 | 有问题的条数 | 主要问题 |', '|---|---:|---|']
    for m in models:
        kinds = Counter(i.split('：')[0].split('（')[0] for x in out[m] for i in x['issues'])
        lines.append(f"| {m} | {sum(bool(x['issues']) for x in out[m])} / {len(test)} | " + '、'.join(f'{k} {v}' for k, v in kinds.most_common(5)) + ' |')
    lines += ['', '## 逐条', '']
    for i, r in enumerate(test):
        lines.append(f"### {r['case_id']}（{r['task']}）")
        lines.append(f"- 老师：{r['response']}")
        for m in models:
            x = out[m][i]
            lines.append(f"- {m}：{x['output']}" + (f"  \n  ⚠ {'；'.join(x['issues'])}" if x['issues'] else ''))
        lines.append('')
    open(os.path.join(HERE, 'reports', 'corpus_test.md'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    json.dump(out, open(os.path.join(HERE, 'reports', 'corpus_test.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('报告：ai/train/reports/corpus_test.md')


if __name__ == '__main__':
    main(sys.argv[1:] or ['qwen3:1.7b'])
