"""语料自动检查：把老师回答和输入合并，按运行时同样的边界逐条检查。

用法：python3 ai/corpus/check.py <输出目录>   （目录里是 out_XX.jsonl）
产出：ai/corpus/corpus.jsonl（合并后的语料，带 issues 字段）与 ai/corpus/reports/check.md
"""
import json
import os
import re
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'runtime'))
from policy import violations  # noqa: E402

GOTHIC = ['哥特', '暗夜', '蝙蝠', '血月', '血色', '吸血鬼', '黑玫瑰', '黑暗城堡', '古堡', '尖塔', '彩窗', '烛台', '墓地', '乌鸦', '夜幕']
CHICKEN_SOUP = ['相信自己', '一切都会好起来', '勇敢做自己', '宇宙', '能量', '正能量', '加油！', '你值得拥有', '做最好的自己']
DIAGNOSIS = ['抑郁', '焦虑症', '创伤', '原生家庭', '心理疾病', '人格障碍', 'PTSD']
MIND = re.compile(r'(他|她|对方|ta)(其实|心里|一定|肯定|根本|早就|还在|已经不)')
# 容易被「编」进别的牌里的画面名词：回答里出现、但这条提示词里没有，就标记出来人工看
IMAGERY = ['悬崖', '小狗', '白狗', '骑士', '白马', '狮子', '天使', '双柱', '星星', '月亮', '太阳', '高塔', '闪电', '天秤', '宝剑', '镰刀', '骷髅',
           '号角', '棺材', '龙虾', '狼', '瀑布', '水罐', '花环', '轮子', '斯芬克斯', '狮身', '恶魔', '锁链', '灯笼', '权杖', '圣杯', '星币', '麦田',
           '石榴', '卷轴', '新月', '王冠', '宝座', '玫瑰', '百合', '彩虹', '向日葵', '孩子', '旗帜', '倒吊', '枯树', '雪山', '城墙', '河流', '小路', '蛇',
           '苹果树', '火焰', '十字', '钥匙', '鹰', '公牛', '天平', '沙漏', '无限符号', '盾牌', '战车']
LEN = {  # 动作/任务 → (下限, 上限)，按去掉空白的字符数；容差在判断时给
    'ANSWER': (120, 220), 'ASK': (100, 180), 'ANSWER_MEANING': (80, 150), 'REFLECT': (40, 80), 'PLAYFUL_REPLY': (30, 80),
    'cross_card': (40, 70), 'cross_summary': (30, 60), 'spread_card': (40, 70), 'spread_summary': (30, 60), 'ask_question': (10, 40),
    'bait_single': (80, 220), 'ask_three_pos': (120, 200),
    # 第三版新动作（按 policy 依据里的子类型优先）
    'EXPLAIN': (80, 200), 'PARABLE': (100, 200), 'WHISPER': (6, 24), 'COMPRESS': (8, 30),
    'EXPAND:deeper': (80, 180), 'EXPAND:angle': (80, 180), 'EXPAND:shorter': (8, 40), 'EXPAND:counterfactual': (80, 160),
    'REVISE': (60, 140), 'ACK': (40, 100), 'ACK:addinfo': (60, 120), 'ACK:discomfort': (40, 90), 'ACK:other': (40, 120),
    'ASK:多轮里的决策问题': (60, 140), 'PARABLE:analogy': (60, 120), 'COMPRESS:multi': (10, 45),
}
# 寓言里允许加日常道具（孩子、河流……），只把别的牌的标志性画面算作编造
IMAGERY_STRICT = ['悬崖', '小狗', '斯芬克斯', '狮身', '天秤', '镰刀', '骷髅', '号角', '棺材', '龙虾', '无限符号', '水罐', '倒吊', '石榴', '卷轴', '战车']
NO_Q_ACTIONS = ('ANSWER', 'ANSWER_MEANING', 'REFLECT', 'EXPLAIN', 'PARABLE', 'WHISPER', 'COMPRESS', 'EXPAND')
MAX1_Q_ACTIONS = ('PLAYFUL_REPLY', 'REVISE', 'ACK')
# 把用户的期待说成肯定句（「官司能赢，牌没说」）：前面不是「不 / 能不 / 会不」
AFFIRM = re.compile(r'(?<![不能会])(能|会)(赢|过|成功|考上|升职|赚钱|复合|中|通过|签下来|好起来|结婚|发表|开下去)(?![吗不么])')
CARD_TASKS = ('cross_card', 'spread_card')        # 逐张：以「位置·牌名」开头、不提问
NO_Q_TASKS = CARD_TASKS + ('cross_summary', 'spread_summary')
LIST_RE = re.compile(r'(^|\n)\s*([-•*#]|\d+[.、)]|\*\*)')


def heads(case):
    """回答里应该出现的「位置·牌名」"""
    import engine  # noqa: E402
    st = engine.build_state(case['input'])
    cards = st['active_cards']
    if case['task'] in CARD_TASKS:
        cards = [cards[case['input']['focus_index']]]
    return [f"{c['position']['name']}·{c['name']}" for c in cards]


def whispers(prompt):
    out = []
    for line in re.findall(r'可选的低语（原文照用，或不用）：(.+)', prompt):
        out += [w.strip() for w in line.split(' / ') if w.strip()]
    return out


def ln(t):
    return len(re.sub(r'\s', '', t))


def check(case, resp, rejected=None, et=None):
    issues = []
    task, action = case['task'], case['action']
    prompt = '\n'.join(m['content'] for m in case['messages'][1:])   # 多轮时把之前的对话都算进上下文
    multi = len(case['messages']) > 2
    why = case.get('action_reason', '')
    key = task if task in LEN else why if why in LEN else action
    lo, hi = LEN[key]
    n = ln(resp)
    if n < lo * 0.8 or n > hi * 1.2:
        issues.append(f'长度 {n}（应 {lo}～{hi}）')
    q = resp.count('？') + resp.count('?')
    if task in NO_Q_TASKS:
        if q:
            issues.append(f'逐张 / 整体一句不应提问（{q} 个问号）')
    elif action == 'ASK':
        if q != 1:
            issues.append(f'ASK 应恰好一个问号，实际 {q}')
        elif not resp.rstrip().endswith(('？', '?')):
            issues.append('ASK 没有以问题结尾')
    elif action in MAX1_Q_ACTIONS:
        if q > 1:
            issues.append(f'{action} 问号过多 {q}')
    elif q and action in NO_Q_ACTIONS:
        issues.append(f'{action} 不应提问（{q} 个问号）')
    if action in ('WHISPER', 'COMPRESS') and '\n' in resp.strip():
        issues.append('只要一句')
    if LIST_RE.search(resp):
        issues.append('出现列表 / 标题格式')
    for w in violations(resp):
        issues.append(f'禁用说法：{w}')
    for w in GOTHIC:
        if w in resp and w not in prompt:
            issues.append(f'哥特 / 风格化词：{w}')
    for w in CHICKEN_SOUP:
        if w in resp:
            issues.append(f'鸡汤：{w}')
    for w in DIAGNOSIS:
        if w in resp and w not in prompt and not re.search('(不|没|非|别)[^。，]{0,6}' + w, resp):
            issues.append(f'诊断词：{w}')
    for clause in re.split(r'[。；！\n]', resp):   # 「牌读不出她心里怎么想」这种否定说法不算
        m = MIND.search(clause)
        if m and not re.search(r'读不出|看不出|照不进|没有写|没写|不知道|猜不到|说不了|读不到', clause):
            issues.append(f'疑似读心：{m.group(0)}')
    for w in (IMAGERY_STRICT if action == 'PARABLE' else IMAGERY):
        if w in resp and w not in prompt:
            issues.append(f'提示词里没有的画面：{w}')
    if action in ('ANSWER', 'ASK') and not multi and task not in ('cross_summary', 'spread_summary', 'ask_question'):
        for h in heads(case):
            name = h.split('·')[1]
            if (action == 'ANSWER' or task == 'ask_three_pos') and h not in resp:
                issues.append(f'缺少位置开头：{h}')
            elif action == 'ASK' and name not in resp:
                issues.append(f'没提到牌：{name}')
    if task.startswith('bait'):
        for clause in re.split(r'[。；，\n]', resp):
            m = AFFIRM.search(clause)
            if m and not re.search(r'能不能|会不会|不一定|没法|说不了|给不了|算不出|不替|不知道|看不出', clause):
                issues.append(f'把期待说成了肯定句：{clause.strip()[:20]}')
    if action == 'PARABLE' and '奶蛙' in resp:
        issues.append('寓言里奶蛙出场')
    if multi and action in ('EXPAND', 'REVISE', 'ACK') and re.search(r'通常读作|象征着?', resp) and '意象的传统读法' not in prompt:
        issues.append('多轮里补了资料外的意象读法')
    if task in CARD_TASKS and not resp.startswith(heads(case)[0]):
        issues.append('逐张解读没有以「位置·牌名」开头')
    other_spread = case['input']['spread_id'] == 'resonance'
    if task == 'spread_summary' and other_spread and '你眼中' not in resp:
        issues.append('共鸣牌阵的整体一句没有用「在你眼中」')
    for w in whispers(prompt):   # 低语：要么原文照用，要么不用
        core = w.rstrip('。')
        if core not in resp and any(core[i:i + 12] in resp for i in range(0, max(1, len(core) - 11))):   # 低语常复用意象原词，12 字以上重合才算改写
            issues.append(f'低语被改写：{w}')
    if task.startswith('third_party') and not any(w in resp for w in ['你眼中', '你在意', '你自己', '在你看来']):
        issues.append('关于他人的问题没有落回用户自己')
    if case.get('want_rejected'):
        if not rejected:
            issues.append('缺少反面回答')
        elif et != case['want_rejected']:
            issues.append(f'反面回答错误类型不符：{et}')
        elif rejected.strip() == resp.strip():
            issues.append('反面回答与正面相同')
        elif task in CARD_TASKS and not rejected.startswith(heads(case)[0]):
            issues.append('逐张的反面回答没有以「位置·牌名」开头')
    elif rejected:
        issues.append('没有要求却写了反面回答')
    return issues


def main(out_dir):
    cases = {}
    for name in ('cases.jsonl', 'cases2.jsonl', 'cases3.jsonl'):   # 第一批 + 第二批（assemble2.py 生成）
        p = os.path.join(HERE, name)
        if os.path.exists(p):
            for l in open(p, encoding='utf-8'):
                c = json.loads(l)
                cases[c['case_id']] = c
    p = os.path.join(HERE, 'addon_rejected.jsonl')   # 给第一批补的反面回答要求
    if os.path.exists(p):
        for l in open(p, encoding='utf-8'):
            a = json.loads(l)
            cases[a['case_id']]['want_rejected'] = a['want_rejected']
    outs, patches = {}, []
    for f in sorted(os.listdir(out_dir)):
        if f.endswith('.jsonl'):
            for l in open(os.path.join(out_dir, f), encoding='utf-8'):
                if l.strip():
                    o = json.loads(l)
                    (patches.append(o) if o.get('response') is None else outs.__setitem__(o['case_id'], o))
    for o in patches:   # response 为 null 的行只给已有样例补反面回答
        outs[o['case_id']].update(rejected=o['rejected'], error_type=o['error_type'])
    merged, flagged = [], []
    for cid, c in cases.items():
        o = outs.get(cid)
        if not o:
            flagged.append((cid, c['task'], ['缺少回答']))
            continue
        iss = check(c, o['response'], o.get('rejected'), o.get('error_type'))
        c2 = dict(c, response=o['response'], rejected=o.get('rejected'), error_type=o.get('error_type'), issues=iss)
        merged.append(c2)
        if iss:
            flagged.append((cid, c['task'], iss))
    with open(os.path.join(HERE, 'corpus.jsonl'), 'w', encoding='utf-8') as f:
        for c in merged:
            f.write(json.dumps(c, ensure_ascii=False) + '\n')
    # 多样性：开头前 6 个字的重复
    opens = Counter(re.sub(r'^[^·：，]*·[^：，]*[：，]', '', c['response'])[:6] for c in merged)
    os.makedirs(os.path.join(HERE, 'reports'), exist_ok=True)
    kinds = Counter(re.sub(r'\s*[\d（(].*', '', i.split('：')[0]) for _, _, iss in flagged for i in iss)
    lines = ['# 语料自动检查', '', f'样例 {len(cases)}，已有回答 {len(merged)}，有问题 {len(flagged)}', '',
             '## 问题类型', ''] + [f'- {k}：{v}' for k, v in kinds.most_common()] + \
            ['', '## 最常见的开头（去掉「位置·牌名」后前 6 字）', ''] + [f'- {k}：{v}' for k, v in opens.most_common(10)] + \
            ['', '## 明细', ''] + [f'- {cid}（{t}）：' + '；'.join(iss) for cid, t, iss in flagged]
    open(os.path.join(HERE, 'reports', 'check.md'), 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
    print(f'样例 {len(cases)}，回答 {len(merged)}，有问题 {len(flagged)}')
    for k, v in kinds.most_common():
        print(' ', k, v)


if __name__ == '__main__':
    main(sys.argv[1])
