"""最小闭环：抽牌结果 → 检索与规则 → 结构化状态 → 选动作 → 受状态约束的生成 → 输出检查。

对应 v0.6 第 9.7 节的运行顺序。模型用本地 Ollama（默认 qwen3:4b，未微调），只负责写一段话；
危机转向与结束是程序直接给出的固定话术，不经过模型。
"""
import json
import re
import time
import urllib.request

from knowledge import Knowledge
from policy import decide, violations

OLLAMA = 'http://localhost:11434/api/chat'

SYSTEM = """你是「奶蛙」：一只面无表情、温和、话不多的黄色梨形小生物，在一个塔罗网站里陪用户看牌。

说话方式：克制、简短、带一点象征和留白；不说教，不喊口号，不用鸡汤；用简体中文。

必须遵守：
1. 只依据给你的牌义、位置含义和「画面里看得见的传统意象」来解读；没列出来的画面细节不要编。
2. 不预测具体事件或结果，不说「一定会」「注定」；未来类位置只说「可能的方向」。
3. 不做心理诊断，不推测创伤或病症；不替用户下决定。
4. 不推断其他人的真实想法；关系类问题只谈用户自己眼中的对方。
5. 每次最多问一个问题；用户没要求时不追问私事。
6. 不要输出思考过程、标题或列表符号，直接说话。
/no_think"""

ACTION_GUIDE = {
    'ANSWER': '按位置逐张简短解读（每张一两句，引用一个看得见的意象），再用一句话说整体；最后可以用一句给定的低语收尾（选最贴切的一句，原文照用）。不要提问。总长 120～220 字。',
    'ASK': '先简短解读（引用看得见的意象，不替用户做决定），然后用一个开放、不诱导的问题结尾，帮用户想清楚自己在意什么。总长 100～180 字。',
    'ANSWER_MEANING': '用户只想知道牌义：直接讲这张牌在当前方向下的含义和关键词，不分析用户本人，不联系用户的经历，不提问。80～150 字。',
    'REFLECT': '用户说出了自己的联想。先用用户自己的话轻轻复述，不分析原因，不追问细节，不做任何诊断；告诉对方可以不说、也可以随时停下。可以给一句温和的低语。60～120 字。',
    'PLAYFUL_REPLY': '用户明确是来玩梗的。用一两句轻松、带点自嘲的话接住，不做心理分析，不讲大道理；可以邀请对方「比一张牌」。30～80 字。',
}

CLOSE_TEXT = {'zh': '好。这张牌就留在这里。', 'en': 'All right. This card can stay here.'}
SAFETY_TEXT = {
    'zh': '听起来你现在挺难受的。牌先放一放。如果你有伤害自己的念头，或正身处危险，请马上联系身边信任的人、当地的心理援助热线或急救电话。愿意的话，也可以说说发生了什么。',
    'en': "It sounds like you're having a hard time. Let's set the cards aside. If you're thinking of hurting yourself or you're in danger, please reach out right away to someone you trust, a local crisis line, or emergency services. If you'd like, you can also tell me what's happening.",
}

_K = None


def knowledge():
    global _K
    if _K is None:
        _K = Knowledge()
    return _K


def build_state(inp, lang='zh'):
    """v0.6 第 9.2 / 9.7 节的结构化状态（精简版）"""
    K = knowledge()
    sp = K.spreads[inp['spread_id']]
    cards = []
    for c in inp['cards']:
        pos = K.position(inp['spread_id'], c['position_id'])
        ctx = K.card_context(c['card_id'], c['orientation'], lang)
        ctx['position'] = {'id': pos['id'], 'name': pos['name'][lang], 'meaning': pos['meaning'][lang]}
        cards.append(ctx)
    turns = inp.get('user_turns') or []
    return {
        'spread': {'id': sp['id'], 'name': sp['name'][lang], 'note': (sp.get('note') or {}).get(lang, '')},
        'question': inp.get('question', ''),
        # 用户明确说出的话才算事实；其余都不写进事实
        'known_facts': [{'source': 'user', 'text': t} for t in ([inp['question']] if inp.get('question') else []) + turns],
        'active_cards': cards,
    }


def _prompt(state, action):
    lines = [f"牌阵：{state['spread']['name']}" + (f"（{state['spread']['note']}）" if state['spread']['note'] else '')]
    lines.append(f"用户的问题：{state['question'] or '（没有提问，做纯符号解读，不要追问私事）'}")
    for f in state['known_facts'][1 if state['question'] else 0:]:
        lines.append(f"用户刚才说：{f['text']}")
    for c in state['active_cards']:
        o = '逆位' if c['orientation'] == 'reversed' else '正位'
        lines.append(f"\n【{c['position']['name']}】（{c['position']['meaning']}）{c['name']} · {o}")
        lines.append(f"关键词：{'、'.join(c['keywords'])}")
        lines.append(f"牌义：{c['meaning']}")
        if c.get('visible_traditional'):
            lines.append(f"画面里看得见的传统意象：{'；'.join(c['visible_traditional'][:6])}")
        if c.get('naiwa_specific'):
            lines.append(f"奶蛙版特有的画面（可以提，但不要说成传统）：{'；'.join(c['naiwa_specific'])}")
        if c.get('propositions'):
            lines.append('可以借用的观点（不是事实，注意反例）：' + ' / '.join(
                f"{p['text']}（不适用：{'；'.join(p['counterexamples'][:2])}）" for p in c['propositions'][:2]))
        if c.get('whispers'):
            lines.append('可选的低语（原文照用，或不用）：' + ' / '.join(w['text'] for w in c['whispers'][:3]))
    lines.append(f"\n这一轮你要做的：{ACTION_GUIDE[action]}")
    return '\n'.join(lines)


def _chat(model, system, user, num_predict=420):
    body = json.dumps({
        'model': model, 'stream': False, 'think': False,
        'messages': [{'role': 'system', 'content': system}, {'role': 'user', 'content': user + '\n/no_think'}],
        'options': {'temperature': 0.6, 'top_p': 0.9, 'num_predict': num_predict, 'num_ctx': 4096},
    }).encode()
    req = urllib.request.Request(OLLAMA, data=body, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=600) as r:
        d = json.load(r)
    text = re.sub(r'<think>.*?</think>', '', d['message']['content'], flags=re.S)
    text = re.sub(r'<think>.*', '', text, flags=re.S).strip()   # 没写完的思考段（被长度截断）整段丢掉
    return text, {'eval_count': d.get('eval_count'), 'eval_ms': (d.get('eval_duration') or 0) / 1e6,
                  'prompt_tokens': d.get('prompt_eval_count'), 'total_ms': (d.get('total_duration') or 0) / 1e6}


def run(inp, model='qwen3:4b', lang='zh'):
    """跑一轮，返回完整调试轨迹（v0.6 第 21.8 节：检索内容、状态、动作、提示词、输出、耗时）"""
    t0 = time.time()
    action, why = decide(inp.get('question', ''), inp.get('user_turns') or [])
    state = build_state(inp, lang)
    trace = {'input': inp, 'model': model, 'action': action, 'action_reason': why, 'state': state}
    if action == 'SAFETY_REDIRECT':
        trace.update(output=SAFETY_TEXT[lang], generated=False)
    elif action == 'CLOSE':
        trace.update(output=CLOSE_TEXT[lang], generated=False)
    else:
        prompt = _prompt(state, action)
        text, stats = _chat(model, SYSTEM, prompt)
        bad = violations(text)
        retried = False
        if bad:   # 命中禁用说法：带着提醒重写一次
            retried = True
            text, stats = _chat(model, SYSTEM, prompt + f"\n\n注意：上一次的回答用了不允许的说法（{'、'.join(bad)}），请重写，避免它们。")
            bad = violations(text)
        trace.update(prompt=prompt, output=text, generated=True, stats=stats, retried=retried, violations=bad)
    trace['latency_s'] = round(time.time() - t0, 1)
    return trace
