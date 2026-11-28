"""把检查通过的语料导出成训练格式（Kaggle 上的 LoRA 直接读）。

- sft_<split>.jsonl：{"messages": [system, user, assistant]}，assistant 就是运行时模型应输出的那段话
- dpo_<split>.jsonl：{"prompt": [system, user], "chosen": [assistant], "rejected": [assistant], "error_type": ...}
切分按牌的组合（build_cases.py 里的 split），测试集（benchmark）里的组合在抽样时已经避开。
有自动检查问题的样例不导出（issues 非空），除非 --keep-flagged。
用法：python3 ai/corpus/export.py
"""
import json
import os
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))


def main(keep_flagged=False):
    rows = [json.loads(l) for l in open(os.path.join(HERE, 'corpus.jsonl'), encoding='utf-8') if l.strip()]
    # 行为测试集（benchmark）里出现过的问题原文不进训练，保证测试集完全留出
    bench_q = {json.loads(l)['input'].get('question', '') for l in open(os.path.join(HERE, '..', 'benchmark', 'cases_pilot.jsonl'), encoding='utf-8')} - {''}
    dropped = [r['case_id'] for r in rows if r['input'].get('question') in bench_q]
    rows = [r for r in rows if r['input'].get('question') not in bench_q]
    print('去掉与测试集同问题的样例', dropped)
    out = os.path.join(HERE, 'data')
    os.makedirs(out, exist_ok=True)
    files, cnt = {}, Counter()
    for r in rows:
        if r['issues'] and not keep_flagged:
            continue
        if r['task'] == 'cross_summary':   # 第一批用牌义占位的整体一句，已被第二批的 spread_summary（真实逐张解读）取代
            continue
        sp = r['split']
        meta = {'case_id': r['case_id'], 'task': r['task'], 'action': r['action']}
        sft = dict(meta, messages=r['messages'] + [{'role': 'assistant', 'content': r['response']}])
        files.setdefault(f'sft_{sp}', []).append(sft)
        cnt[f'sft_{sp}'] += 1
        if r.get('rejected'):
            files.setdefault(f'dpo_{sp}', []).append(dict(meta, prompt=r['messages'], error_type=r['error_type'],
                                                          chosen=[{'role': 'assistant', 'content': r['response']}],
                                                          rejected=[{'role': 'assistant', 'content': r['rejected']}]))
            cnt[f'dpo_{sp}'] += 1
    for name, lst in files.items():
        with open(os.path.join(out, name + '.jsonl'), 'w', encoding='utf-8') as f:
            for x in lst:
                f.write(json.dumps(x, ensure_ascii=False) + '\n')
    print(dict(sorted(cnt.items())))


if __name__ == '__main__':
    main('--keep-flagged' in sys.argv)
