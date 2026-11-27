"""行为策略（确定性规则，v0.6 第 9.1、21.4、29.1 节）。

优先级：安全 / 停止 > 明确的认真诉求（只要牌义）> 明确的娱乐授权 > 个人联想 > 默认解读。
模型不参与这一步：它只负责在选定的动作下写一段话。
"""
import re

CRISIS = ['活着没意思', '活着真没意思', '不想活', '想死', '去死', '自杀', '轻生', '伤害自己', '结束生命', '活不下去', '撑不下去了',
          'kill myself', 'suicide', 'want to die', 'end my life', 'hurt myself', 'self-harm']
STOP = ['不想聊了', '不聊了', '别问了', '不想说了', '算了吧', '结束吧', "don't want to talk", 'stop asking']
MEANING_ONLY = ['只想知道牌义', '只要牌义', '直接说牌义', '别分析', '不要分析', 'just the meaning']
PLAY = ['玩梗', '来玩的', '就是来玩', '开玩笑', '逗你', 'just kidding', 'for the meme']
GRIEF = ['去世', '离世', '过世', '病逝', '不在了', '刚走', 'passed away', 'died']
ASSOCIATION = ['让我想到', '让我想起', '我想到', '我想起', 'reminds me']
# 问的是另一个人（会不会、是不是、心里怎么想）：牌读不出他人的想法
THIRD_PARTY = re.compile(r'(他|她|对方|ta|TA)(会不会|是不是|还爱|爱不爱|喜欢|心里|在想|怎么想|会选|会回来)')
DECISION = ['该不该', '要不要', '应不应该', '应该怎么选', 'should i']


def about_other(question):
    return bool(THIRD_PARTY.search(question or ''))


def _has(text, words):
    t = (text or '').lower()
    return [w for w in words if w.lower() in t]


def decide(question, user_turns):
    """返回 (动作, 依据)。依据用于调试轨迹，说明为什么选这个动作。"""
    latest = user_turns[-1] if user_turns else ''
    everything = ' '.join([question or ''] + list(user_turns or []))

    hit = _has(everything, CRISIS)
    if hit:
        return 'SAFETY_REDIRECT', f'危机信号：{hit}'
    hit = _has(latest, STOP)
    if hit:
        return 'CLOSE', f'用户要求停止：{hit}'
    hit = _has(everything, GRIEF)
    if hit:   # 哀悼：先接住，不解读死亡、不急着找意义（v0.6 第 26.3 节）
        return 'REFLECT', f'哀悼：{hit}'
    hit = _has(latest or question, MEANING_ONLY)
    if hit:
        return 'ANSWER_MEANING', f'只要牌义：{hit}'
    hit = _has(everything, PLAY)
    if hit:
        return 'PLAYFUL_REPLY', f'明确娱乐语境：{hit}'
    hit = _has(latest, ASSOCIATION)
    if hit:
        return 'REFLECT', f'个人联想：{hit}'
    hit = _has(question, DECISION)
    if hit:
        return 'ASK', f'决策类问题，先给解读再问一个开放问题：{hit}'
    return 'ANSWER', '默认：依据牌面与位置解读'


# 输出检查：确定性的边界（与测试集分开，测试集是额外的独立检查）
NEGATION = re.compile(r'(不|没|非|别|无|未|并非|不是|不会|不一定)$')
FORBIDDEN = [
    '命中注定', '注定会', '一定会发生', '必然会', '你患有', '你有抑郁', '你有焦虑症', '你的创伤', '童年创伤',
    '他心里一定', '她心里一定', '他肯定', '她肯定',
]


def violations(text):
    """返回输出里命中的禁用说法（前面紧跟否定词的不算，例如「不是命中注定」）"""
    found = []
    for w in FORBIDDEN:
        for m in re.finditer(re.escape(w), text):
            if not NEGATION.search(text[max(0, m.start() - 4):m.start()]):
                found.append(w)
                break
    return found
