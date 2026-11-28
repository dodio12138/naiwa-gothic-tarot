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
# 知识问答：问牌本身（意象、对应、原典、命题），不是问自己的处境
EXPLAIN = re.compile(r'(代表|象征|意味着|寓意)(什么|啥|着什么)|怎么理解|如何理解|是什么意思|什么意思|对应(什么|哪|的是)|什么元素|哪个星座|什么星座|'
                     r'什么行星|希伯来|数字.{0,4}(意思|含义)|和.{1,8}的?区别|有什么不同|韦特|原典|传统上|为什么画|为什么是(这|那)')
PARABLE = ['讲个故事', '讲个小故事', '讲个寓言', '寓言', '打个比方', '打比方', '用个比喻', '比喻一下', '讲个童话']
ANALOGY = ['打个比方', '打比方', '用个比喻', '比喻一下']
# 以下只在有上一轮回答（多轮）时才看
EXPAND = {'shorter': ['说短一点', '短一点', '简单点', '一句话说', '一句话概括', '简短点'],
          'angle': ['换个角度', '换一个角度', '别的角度', '另一种理解'],
          'deeper': ['再说说', '再多说', '多说一点', '展开', '具体点', '具体一点', '详细', '再深一点', '深入', '还有呢', '继续说']}
COUNTERFACTUAL = re.compile(r'(如果|要是|假如|换成).{0,8}(逆位|正位|换成|另一张|不是这张)')
DENY = ['不对', '不是这样', '不太对', '不准', '不像我', '说错了', '我不同意', '不认同', '没有啊', '不是的', '并不是', '不太像']
DISCOMFORT = ['不舒服', '难受', '有点怕', '别这么说', '听着不好受', '有点重']
AGREE = ['说中了', '说得对', '是的', '确实', '有道理', '对的', '挺准', '很准', '被说中']
UNSURE = ['不知道', '说不清', '不确定', '可能吧', '也许吧', '不好说']
NOFEEL = ['没什么感觉', '没感觉', '没啥感觉', '没触动', '一般般', '没什么特别']
ADDINFO = ['其实', '补充', '忘了说', '还有一件事', '我说的是', '情况是']


def about_other(question):
    return bool(THIRD_PARTY.search(question or ''))


def _has(text, words):
    t = (text or '').lower()
    return [w for w in words if w.lower() in t]


def decide(question, user_turns, history=None, mode=None, n_cards=1):
    """返回 (动作, 依据)。依据用于调试轨迹，说明为什么选这个动作；多轮与新动作的子类型写在依据的开头（如「EXPAND:shorter」）。

    history：上一轮之后的对话（assistant / user 交替，最后一条是用户刚说的话）；mode：程序直接调用的生成（whisper / compress）。
    """
    if mode == 'whisper':
        return 'WHISPER', 'WHISPER:程序调用'
    if mode == 'compress':
        return 'COMPRESS', 'COMPRESS:multi' if n_cards > 1 else 'COMPRESS:程序调用'
    history = history or []
    latest_user = history[-1]['content'] if history and history[-1]['role'] == 'user' else ''
    latest = latest_user or (user_turns[-1] if user_turns else '')
    everything = ' '.join([question or ''] + list(user_turns or []) + [h['content'] for h in history if h['role'] == 'user'])

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
    if latest_user:   # 多轮：对上一轮的反馈
        if _has(latest_user, DISCOMFORT):
            return 'ACK', 'ACK:discomfort'
        if _has(latest_user, DENY):
            return 'REVISE', 'REVISE:用户不认同上一轮'
        if COUNTERFACTUAL.search(latest_user):
            return 'EXPAND', 'EXPAND:counterfactual'
        for sub, words in EXPAND.items():
            if _has(latest_user, words):
                return 'EXPAND', f'EXPAND:{sub}'
        for sub, words in (('agree', AGREE), ('nofeel', NOFEEL), ('unsure', UNSURE), ('addinfo', ADDINFO)):
            if _has(latest_user, words):
                return 'ACK', f'ACK:{sub}'
    hit = _has(latest or question, PARABLE)
    if hit:   # 「打个比方」是一两句的比方，其余是小寓言
        return 'PARABLE', 'PARABLE:analogy' if _has(latest or question, ANALOGY) else 'PARABLE:story'
    if EXPLAIN.search(latest or question or ''):
        return 'EXPLAIN', f'EXPLAIN:知识问答'
    hit = _has(latest, ASSOCIATION)
    if hit:
        return 'REFLECT', f'个人联想：{hit}'
    if latest_user:
        if _has(latest_user, DECISION):
            return 'ASK', 'ASK:多轮里的决策问题'
        return 'ACK', 'ACK:other'
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
