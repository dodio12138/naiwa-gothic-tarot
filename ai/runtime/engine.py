"""最小闭环：抽牌结果 → 检索与规则 → 结构化状态 → 选动作 → 受状态约束的生成 → 输出检查。

对应 v0.6 第 9.7 节的运行顺序。模型用本地 Ollama（默认 qwen3:1.7b，未微调），只负责写一段话；
危机转向与结束是程序直接给出的固定话术，不经过模型。
"""
import json
import os
import re
import time
import urllib.request

from knowledge import Knowledge
from policy import about_other, decide, violations

OLLAMA = 'http://localhost:11434/api/chat'
# 生成参数：默认值；做实验时可用环境变量 NAIWA_GEN='{"repeat_penalty": 1.1}' 覆盖
GEN = {'temperature': 0.6, 'top_p': 0.9}
GEN.update(json.loads(os.environ.get('NAIWA_GEN', '{}')))

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
    'ANSWER': '按位置逐张解读：每张都以「位置·牌名」开头（例如「现在·星星」），一两句，引用一个看得见的意象；再用一句话说整体；最后可以用一句给定的低语收尾（原文照用）。不要提问，不要用列表符号。总长 120～220 字。',
    'ASK': '先简短解读（引用看得见的意象，不替用户做决定），然后用一个开放、不诱导的问题结尾，帮用户想清楚自己在意什么。总长 100～180 字。',
    'ANSWER_MEANING': '用户只想知道牌义：直接讲这张牌在当前方向下的含义和关键词，不分析用户本人，不联系用户的经历，不提问。80～150 字。',
    'REFLECT': '用户说出了自己的联想。只用一两句轻轻接住（可以复述用户的原话），然后停下：不解释这段记忆，不说它代表什么、来自哪里，不把它和牌义联系起来下结论，不追问细节，不做任何诊断。40～80 字。',
    'PLAYFUL_REPLY': '用户明确是来玩梗的。用一两句轻松、带点自嘲的话接住，不做心理分析，不讲大道理；可以邀请对方「比一张牌」。30～80 字。',
    # ── v0.6 原计划的其余任务（第三版起）──
    'EXPLAIN': '用户问的是牌本身的知识或含义。依据给出的资料直接回答：说清这是韦特原典的说法、通行解读，还是对应体系（元素、星象）；用一个给出的意象落地；涉及观点时说清它在什么情况下成立、什么情况下不适用。不分析用户，不提问。80～200 字。',
    'PARABLE': '用这张牌给出的意象讲一个很短的寓言：一个小场景、一个转折，100～200 字。牌面意象是故事的核心，可以加少量日常道具，但不加别的牌的标志性画面。不点名用户、不给用户贴标签，结尾不说教、不总结道理，可以留白。不提问。',
    'WHISPER': '写一句低语：一句话，24 字以内，只借一个给出的意象，克制、留白，不说教、不预测，不用「你」开头，不照抄已有的低语。只输出这一句。',
    'COMPRESS': '把上面这段解读压缩成一句话，30 字以内，保留最关键的意象和意思，不加新内容。只输出这一句。',
}
# 多轮：同一动作按用户的说法细分（policy 依据里的子类型）
SUB_GUIDE = {
    'PARABLE:analogy': '用户想听一个比方。用一两句话，把这张牌的意思比作一件日常的事或物（60～120 字）：先说比方，再用一句点出它和牌面哪个意象对应。不点名用户、不贴标签、不说教，不提问。',
    'COMPRESS:multi': '把上面这段解读压缩成一句话，45 字以内，保留最关键的意象和意思，不加新内容。只输出这一句。',
    'EXPAND:deeper': '用户想听更多。在上一轮的基础上往下展开一层：换一个上一轮没用过的意象，或从意象推到它背后的观点，或落到用户问题的具体情境。不重复上一轮的句子，不预测、不替用户决定，不提问。80～180 字。',
    'EXPAND:angle': '用户想换个角度。用另一个意象，或这张牌的另一面（矛盾的另一极）来读，不否定上一轮，不重复上一轮的句子，不提问。80～180 字。',
    'EXPAND:shorter': '用户想听短一点。用一两句话重说上一轮的重点，40 字以内，不加新内容，不提问。',
    'EXPAND:counterfactual': '用户问「如果换成……会怎样」。依据牌义说清哪些意思会变、哪些不变；没有给出资料的牌只按牌名常识简短说，不编画面；不预测结果，不提问。80～160 字。',
    'REVISE:用户不认同上一轮': '用户不认同上一轮的说法。先坦然接受，不辩解、不坚持，收回那个具体的说法；再从牌面给一个不同的读法，或请用户说说哪里不贴合（最多一个问题）。不说「其实你就是……」。60～140 字。',
    'ACK:agree': '用户认同。简短回应，不夸大牌的准确（不说「牌很准」「被我说中了」），可以把话交回给用户，不提问。40～100 字。',
    'ACK:unsure': '用户不确定。说这很正常，牌只是一个看的角度，可以先放着；也可以给一个很短的不同角度，不强求。最多一个问题。40～100 字。',
    'ACK:nofeel': '用户对这段解读没什么感觉。说没有共鸣也没关系，不追着解释；可以先放着，或者换一个很轻的角度。最多一个问题。40～100 字。',
    'ACK:addinfo': '用户补充了自己的情况。只把它和已经说过的牌义轻轻连起来，不下结论、不扩大成判断，不预测。最多一个问题。60～120 字。',
    'ACK:discomfort': '用户听了有些不舒服。先放慢，承认刚才的话可能说重了；不再继续解读，请用户选择：继续、换个轻一点的方式，还是先停下（只问这一个问题）。40～90 字。',
    'ACK:other': '回应用户刚才说的话：依据已经说过的牌义，简短、不预测、不替用户决定。最多一个问题。40～120 字。',
    'ASK:多轮里的决策问题': '用户在接着问一个要不要的问题。依据已经说过的牌义简短回应，不替用户决定，以一个开放、不诱导的问题结尾。60～140 字。',
}


def guide_for(action, why):
    """这一轮的写法要求：多轮的子类型优先，其余按动作"""
    return SUB_GUIDE.get(why) or SUB_GUIDE.get(why.split('：')[0]) or ACTION_GUIDE[action]

EXIT_TEXT = {'zh': '不想多说也没关系，可以不说，也可以随时停下。', 'en': "You don't have to say more. You can stop whenever you like."}
GRIEF_TEXT = {
    'zh': '听到这个消息，很难过。这个时候，牌可以先放一放，它说不了关于离开的人的任何事。想说说那个人，或者只是安静待一会儿，都可以。',
    'en': "I'm so sorry. Let's set the cards aside for now — they can't say anything about the one you lost. You can tell me about them, or just sit quietly for a while.",
}
OTHER_TEXT = {'zh': '（牌读不出对方心里怎么想；它能照见的，是你自己在意什么。）', 'en': "(The cards can't read the other person's mind; what they can show is what matters to you.)"}
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
        'spread': {'id': sp['id'], 'name': sp['name'][lang], 'note': (sp.get('note') or {}).get(lang, ''),
                   # 牌阵里有「对方」这个位置（共鸣牌阵）时，才需要提醒「只是你眼中的对方」
                   'has_other': any(p['id'] == 'other' for p in sp['positions'])},
        'question': inp.get('question', ''),
        # 用户明确说出的话才算事实；其余都不写进事实
        'known_facts': [{'source': 'user', 'text': t} for t in ([inp['question']] if inp.get('question') else []) + turns],
        'active_cards': cards,
    }


def _prompt(state, action, guide=None, compact=False):
    lines = [f"牌阵：{state['spread']['name']}" + (f"（{state['spread']['note']}）" if state['spread']['note'] else '')]
    lines.append(f"用户的问题：{state['question'] or '（没有提问，做纯符号解读，不要追问私事）'}")
    if state['spread']['note']:
        lines.append(f"这个牌阵的边界（必须遵守）：{state['spread']['note']}"
                     + (" 解读时用「在你眼中」来说对方，不替对方下结论。" if state['spread']['has_other'] else ''))
    if about_other(state['question']):
        lines.append("这个问题关于另一个人：不要猜对方会怎样、心里怎么想；把解读放回用户自己身上（用「在你眼中」「你在意的是」这样的说法）。")
    for f in state['known_facts'][1 if state['question'] else 0:]:
        lines.append(f"用户刚才说：{f['text']}")
    for c in state['active_cards']:
        o = '逆位' if c['orientation'] == 'reversed' else '正位'
        lines.append(f"\n【{c['position']['name']}】（{c['position']['meaning']}）{c['name']} · {o}")
        lines.append(f"关键词：{'、'.join(c['keywords'])}")
        lines.append(f"牌义：{c['meaning']}")
        if c.get('visible_traditional'):
            lines.append(f"画面里看得见的传统意象：{'；'.join(c['visible_traditional'][:4 if compact else 6])}")
        if compact:
            continue
        if action == 'EXPLAIN':
            if c.get('correspondence'):
                lines.append(f"对应（黄金黎明体系）：{c['correspondence']}")
            if c.get('archetype'):
                lines.append(f"传统画面说明：{c['archetype']}")
            lines += knowledge_lines(c)
        if c.get('naiwa_specific'):
            lines.append(f"奶蛙版特有的画面（可以提，但不要说成传统）：{'；'.join(c['naiwa_specific'])}")
        if c.get('propositions'):
            lines.append('可以借用的观点（不是事实，注意反例）：' + ' / '.join(
                f"{p['text']}（不适用：{'；'.join(p['counterexamples'][:2])}）" for p in c['propositions'][:2]))
        if c.get('whispers'):
            lines.append('可选的低语（原文照用，或不用）：' + ' / '.join(w['text'] for w in c['whispers'][:3]))
    lines.append(f"\n这一轮你要做的：{guide or ACTION_GUIDE[action]}")
    return '\n'.join(lines)


BASIS = {'waite_symbolism': '韦特原典', 'golden_dawn': '黄金黎明', 'modern_convention': '通行读法'}


def knowledge_lines(c):
    """知识问答用的资料（每条都标明出处）"""
    o = '逆位' if c['orientation'] == 'reversed' else '正位'
    lines = []
    if c.get('imagery_readings'):
        lines.append('意象的传统读法：' + ' / '.join(f"{x['imagery']}——{x['reading']}（{BASIS.get(x['basis'], x['basis'])}）" for x in c['imagery_readings']))
    if c.get('correspondence'):
        lines.append(f"对应（黄金黎明体系）：{c['correspondence']}")
    if c.get('archetype'):
        lines.append(f"传统画面说明：{c['archetype']}")
    if c.get('waite_divinatory'):
        lines.append(f"韦特原典的{o}占卜义（1911，英文原文；韦特自己说占卜义是约定俗成的，常和今天的通行读法不同）：{c['waite_divinatory']}")
    if c.get('contradictions'):
        lines.append('这张牌里的张力（本站整理的解读，不是原典）：' + ' / '.join(f"{x['poles']}：{x['text']}" for x in c['contradictions'][:2]))
    return lines


def build_messages(inp, state, action, why):
    """这一轮发给模型的对话（不含 system）。训练语料用同一个函数生成，保证格式一致。

    单轮：一条 user（牌面资料 + 写法要求）。
    多轮：第一条 user 是第一轮的提示词（牌多时用紧凑版），接着是之前的对话，最后一条 user =「用户说：……」+ 这一轮的写法要求。
    程序调用：whisper（按 focus 那张牌写一句低语）、compress（压缩 inp['text']）。
    """
    guide = guide_for(action, why)
    if action == 'WHISPER':
        c = state['active_cards'][inp.get('focus_index', 0)]
        o = '逆位' if c['orientation'] == 'reversed' else '正位'
        lines = [f"牌：{c['name']} · {o}" + (f"（位置：{c['position']['name']}，{c['position']['meaning']}）" if len(state['active_cards']) > 1 else ''),
                 f"牌义：{c['meaning']}", f"画面里看得见的传统意象：{'；'.join((c.get('visible_traditional') or [])[:6])}"]
        if c.get('whispers'):
            lines.append('已有的低语（看风格，不要照抄）：' + ' / '.join(w['text'] for w in c['whispers'][:3]))
        if state['question']:
            lines.append(f"用户的问题：{state['question']}")
        lines.append(f"\n这一轮你要做的：{guide}")
        return [{'role': 'user', 'content': '\n'.join(lines)}]
    if action == 'COMPRESS':
        names = '、'.join(f"{c['name']}（{'逆位' if c['orientation'] == 'reversed' else '正位'}）" for c in state['active_cards'])
        return [{'role': 'user', 'content': f"牌：{names}\n一段解读：{inp['text']}\n\n这一轮你要做的：{guide}"}]
    history = inp.get('history') or []
    if not history:
        return [{'role': 'user', 'content': _prompt(state, action, guide)}]
    first_action = inp.get('first_action', 'ANSWER')
    msgs = [{'role': 'user', 'content': _prompt(state, first_action, compact=len(state['active_cards']) >= 4)}]
    msgs += [dict(h) for h in history[:-1]]
    extra = ''
    if action == 'EXPLAIN':
        extra = '\n\n资料：\n' + '\n'.join(f"【{c['name']}】\n" + '\n'.join(knowledge_lines(c)) for c in state['active_cards'])
    msgs.append({'role': 'user', 'content': f"用户说：{history[-1]['content']}{extra}\n\n这一轮你要做的：{guide}"})
    return msgs


def _chat(model, system, user, num_predict=420):
    """user 可以是一段文字（单轮），也可以是对话列表（多轮）；/no_think 只加在最后一条用户消息上"""
    msgs = [{'role': 'user', 'content': user}] if isinstance(user, str) else [dict(m) for m in user]
    msgs[-1]['content'] += '\n/no_think'
    body = json.dumps({
        'model': model, 'stream': False, 'think': False,
        'messages': [{'role': 'system', 'content': system}] + msgs,
        'options': dict(GEN, num_predict=num_predict, num_ctx=4096),
    }).encode()
    req = urllib.request.Request(OLLAMA, data=body, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=600) as r:
        d = json.load(r)
    text = re.sub(r'<think>.*?</think>', '', d['message']['content'], flags=re.S)
    text = re.sub(r'<think>.*', '', text, flags=re.S).strip()   # 没写完的思考段（被长度截断）整段丢掉
    return text, {'eval_count': d.get('eval_count'), 'eval_ms': (d.get('eval_duration') or 0) / 1e6,
                  'prompt_tokens': d.get('prompt_eval_count'), 'total_ms': (d.get('total_duration') or 0) / 1e6}


def card_prompt(state, c):
    """分步生成时单张牌的提示词（训练语料复用同一个函数）"""
    o = '逆位' if c['orientation'] == 'reversed' else '正位'
    vis = '；'.join((c.get('visible_traditional') or [])[:4])
    return (f"位置：{c['position']['name']}（{c['position']['meaning']}）\n牌：{c['name']} · {o}\n关键词：{'、'.join(c['keywords'])}\n牌义：{c['meaning']}"
            + (f"\n画面里看得见的传统意象：{vis}" if vis else '')
            + (f"\n牌阵边界：{state['spread']['note']}" if state['spread']['note'] else '')
            + f"\n\n用一两句话解读这张牌在这个位置上的意思，以「{c['position']['name']}·{c['name']}：」开头，不提问，不用列表，40～70 字。")


def summary_prompt(state, lines):
    """分步生成最后一句整体的提示词"""
    q = state['question'] or '（没有提问）'
    return ("用户的问题：" + q + "\n各位置的解读：\n" + '\n'.join(lines)
            + (f"\n牌阵边界：{state['spread']['note']}" if state['spread']['note'] else '')
            + "\n\n用一句话说整体（不预测结果，不替任何人下结论" + ("，用「在你眼中」来说对方" if state['spread']['has_other'] else '') + "），30～60 字。")


def _card_lines(state, model, lang):
    """张数多（≥4）时分步生成：每张牌单独一两句，再单独写一句整体；小模型一次写不全 6～10 张"""
    lines, stats_all = [], []
    for c in state['active_cards']:
        t, st = _chat(model, SYSTEM, card_prompt(state, c), num_predict=160)
        head = f"{c['position']['name']}·{c['name']}"
        if not t.startswith(head):
            t = f"{head}：{t.split('：', 1)[-1] if '：' in t[:20] else t}"
        lines.append(t.strip())
        stats_all.append(st)
    t, st = _chat(model, SYSTEM, summary_prompt(state, lines), num_predict=120)
    stats_all.append(st)
    agg = {'eval_count': sum(x['eval_count'] or 0 for x in stats_all), 'eval_ms': sum(x['eval_ms'] for x in stats_all),
           'prompt_tokens': sum(x['prompt_tokens'] or 0 for x in stats_all), 'total_ms': sum(x['total_ms'] for x in stats_all), 'calls': len(stats_all)}
    return '\n'.join(lines) + '\n\n' + t.strip(), agg


def _strip_questions(text):
    """个人联想之后不追问：去掉带问号的句子"""
    parts = re.split(r'(?<=[。！？!?\n])', text)
    keep = [x for x in parts if '？' not in x and '?' not in x]
    return ''.join(keep).strip()


def run(inp, model='qwen3:1.7b', lang='zh'):
    """跑一轮，返回完整调试轨迹（v0.6 第 21.8 节：检索内容、状态、动作、提示词、输出、耗时）"""
    t0 = time.time()
    action, why = decide(inp.get('question', ''), inp.get('user_turns') or [], inp.get('history'), inp.get('mode'), len(inp['cards']))
    state = build_state(inp, lang)
    trace = {'input': inp, 'model': model, 'action': action, 'action_reason': why, 'state': state}
    if action == 'SAFETY_REDIRECT':
        trace.update(output=SAFETY_TEXT[lang], generated=False)
    elif action == 'REFLECT' and why.startswith('哀悼'):   # 哀悼不交给模型：小模型会把真实的死亡解读成「转变」
        trace.update(output=GRIEF_TEXT[lang] + '\n\n' + EXIT_TEXT[lang], generated=False)
    elif action == 'CLOSE':
        trace.update(output=CLOSE_TEXT[lang], generated=False)
    else:
        msgs = build_messages(inp, state, action, why)
        prompt = '\n\n'.join(m['content'] for m in msgs)   # 调试与检查用：整段对话的文字
        limit = {'WHISPER': 60, 'COMPRESS': 80}.get(action, 420)
        if action in ('ANSWER', 'ASK') and len(state['active_cards']) >= 4 and not inp.get('history'):
            text, stats = _card_lines(state, model, lang)
            if action == 'ASK':
                tq, _ = _chat(model, SYSTEM, f"用户的问题：{state['question']}\n\n只写一个开放、不诱导、帮用户想清楚自己在意什么的问题，一句话。", num_predict=60)
                text += '\n\n' + tq.strip()
            if state['spread']['has_other'] and '你眼中' not in text and lang == 'zh':
                text += '\n\n（这里的「对方」只是你眼中的对方，牌读不出别人的真实想法。）'
        else:
            text, stats = _chat(model, SYSTEM, msgs, num_predict=limit)
        bad = violations(text)
        retried = False
        if bad:   # 命中禁用说法：带着提醒重写一次
            retried = True
            msgs2 = [dict(m) for m in msgs]
            msgs2[-1]['content'] += f"\n\n注意：上一次的回答用了不允许的说法（{'、'.join(bad)}），请重写，避免它们。"
            text, stats = _chat(model, SYSTEM, msgs2, num_predict=limit)
            bad = violations(text)
        if action in ('WHISPER', 'COMPRESS'):   # 只要一句
            text = re.split(r'\n', text.strip())[0].strip('「」"\' ')
        if action == 'REFLECT':   # 个人联想之后：去掉追问，由程序补上「可以不说、可以停」的出口，不依赖模型记得
            text = _strip_questions(text) or ('嗯，你想起了那个时候。' if lang == 'zh' else 'I hear what came to mind.')
            text = text.rstrip() + '\n\n' + EXIT_TEXT[lang]
        if about_other(inp.get('question', '')) and not any(w in text for w in ['你眼中', '你在意', '你自己']) and lang == 'zh':
            text = text.rstrip() + '\n\n' + OTHER_TEXT[lang]
        trace.update(prompt=prompt, messages=msgs, output=text, generated=True, stats=stats, retried=retried, violations=bad)
    trace['latency_s'] = round(time.time() - t0, 1)
    return trace
