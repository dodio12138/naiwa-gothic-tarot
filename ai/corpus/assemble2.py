"""把第二批老师回答拆成运行时格式的样例。

整副牌阵 → 每张一条 spread_card（提示词 = card_prompt）、一条 spread_summary（提示词 = summary_prompt，里面放老师自己写的逐张解读）、
决策类再加一条 ask_question（提示词与 engine.run 里单独提问的那一步一致）。
用法：python3 ai/corpus/assemble2.py <第二批输出目录>；审查改动套用后 python3 ai/corpus/assemble2.py --refresh
产出：ai/corpus/cases2.jsonl；ai/corpus/teacher/out2_jobs.jsonl、out2_small.jsonl、out2_addon.jsonl
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'runtime'))
from engine import SYSTEM, build_state, summary_prompt  # noqa: E402


def load(p):
    return [json.loads(l) for l in open(p, encoding='utf-8') if l.strip()]


def msgs(user):
    return [{'role': 'system', 'content': SYSTEM}, {'role': 'user', 'content': user + '\n/no_think'}]


def main(src):
    jobs = {j['job_id']: j for j in load(os.path.join(HERE, 'jobs2.jsonl'))}
    outs = {}
    for f in sorted(os.listdir(src)):
        if f.startswith('jobs_out_') and f.endswith('.jsonl'):
            for o in load(os.path.join(src, f)):
                outs[o['job_id']] = o
    missing = [k for k in jobs if k not in outs]
    if missing:
        sys.exit(f'缺少整副牌阵的回答：{missing}')
    cases, out_jobs = [], []
    for jid, j in jobs.items():
        o = outs[jid]
        assert len(o['lines']) == len(j['heads']), jid
        base = {'action': j['action'], 'action_reason': j['action_reason'], 'split': j['split'], 'job_id': jid}
        rl = o.get('rejected_line') or {}
        for i, (cid, p, line) in enumerate(zip(j['case_ids']['lines'], j['card_prompts'], o['lines'])):
            want = j.get('want_rejected_line') or {}
            cases.append(dict(base, case_id=cid, task='spread_card', input=dict(j['input'], focus_index=i), messages=msgs(p),
                              want_rejected=want.get('error_type') if want.get('index') == i else None))
            hit = rl and rl.get('index') == i
            out_jobs.append({'case_id': cid, 'response': line, 'rejected': rl['text'] if hit else None, 'error_type': rl['error_type'] if hit else None})
        st = build_state(j['input'])
        rs = o.get('rejected_summary') or {}
        cases.append(dict(base, case_id=j['case_ids']['summary'], task='spread_summary', input=j['input'],
                          messages=msgs(summary_prompt(st, o['lines'])), want_rejected=j.get('want_rejected_summary')))
        out_jobs.append({'case_id': j['case_ids']['summary'], 'response': o['summary'], 'rejected': rs.get('text'), 'error_type': rs.get('error_type')})
        if j.get('ask_prompt'):
            cases.append(dict(base, case_id=j['case_ids']['question'], task='ask_question', input=j['input'],
                              messages=msgs(j['ask_prompt']), want_rejected=None))
            out_jobs.append({'case_id': j['case_ids']['question'], 'response': o['question'], 'rejected': None, 'error_type': None})
    cases += load(os.path.join(HERE, 'cases2_small.jsonl'))
    small = load(os.path.join(src, 'small_out.jsonl'))
    addon_ids = {a['case_id'] for a in load(os.path.join(HERE, 'addon_rejected.jsonl'))}
    out_small = [o for o in small if o['case_id'] not in addon_ids]
    out_addon = [{'case_id': o['case_id'], 'response': None, 'rejected': o['rejected'], 'error_type': o['error_type']} for o in small if o['case_id'] in addon_ids]
    cases.sort(key=lambda c: c['case_id'])

    def dump(p, rows):
        with open(p, 'w', encoding='utf-8') as f:
            for r in rows:
                f.write(json.dumps(r, ensure_ascii=False) + '\n')
    dump(os.path.join(HERE, 'cases2.jsonl'), cases)
    os.makedirs(os.path.join(HERE, 'teacher'), exist_ok=True)
    dump(os.path.join(HERE, 'teacher', 'out2_jobs.jsonl'), out_jobs)
    dump(os.path.join(HERE, 'teacher', 'out2_small.jsonl'), out_small)
    dump(os.path.join(HERE, 'teacher', 'out2_addon.jsonl'), out_addon)
    print('第二批样例', len(cases), '整副拆出', len(out_jobs), '小样例', len(out_small), '补反面', len(out_addon))


def refresh():
    """审查改了逐张解读之后：用 teacher/out2_jobs.jsonl 里现在的逐张解读，重建整体一句的提示词"""
    resp = {o['case_id']: o['response'] for o in load(os.path.join(HERE, 'teacher', 'out2_jobs.jsonl'))}
    jobs = {j['job_id']: j for j in load(os.path.join(HERE, 'jobs2.jsonl'))}
    cases = load(os.path.join(HERE, 'cases2.jsonl'))
    changed = 0
    for c in cases:
        if c['task'] == 'spread_summary':
            j = jobs[c['job_id']]
            m = msgs(summary_prompt(build_state(j['input']), [resp[cid] for cid in j['case_ids']['lines']]))
            if m != c['messages']:
                c['messages'] = m
                changed += 1
    with open(os.path.join(HERE, 'cases2.jsonl'), 'w', encoding='utf-8') as f:
        for c in cases:
            f.write(json.dumps(c, ensure_ascii=False) + '\n')
    print('重建整体一句提示词', changed)


if __name__ == '__main__':
    refresh() if sys.argv[1] == '--refresh' else main(sys.argv[1])
