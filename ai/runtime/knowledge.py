"""知识检索：按牌 ID 精确查找，不用向量检索（v0.6 第 9.4 节：78 张牌规模下优先 ID 精确查找）。

数据来源
- data/cards.json        78 张牌的站内牌义（所有牌都有）
- data/spreads.json      牌阵与位置含义
- ai/knowledge_base/     试点 7 张：与传统意象的对照、可见符号
- ai/semantic_framework/ 试点 7 张：命题、种子（低语）、追问树
"""
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
# 黄金黎明体系：十二星座各属一个元素（事实，不是解读）；行星牌不另配四元素
SIGN_ELEMENT = {'白羊': '火', '狮子': '火', '射手': '火', '金牛': '土', '处女': '土', '摩羯': '土',
                '双子': '风', '天秤': '风', '水瓶': '风', '巨蟹': '水', '天蝎': '水', '双鱼': '水'}
PLANETS = ['水星', '金星', '火星', '木星', '土星', '月亮', '太阳']


def explain_correspondence(text):
    """给对应补一句元素说明，免得用户问「什么元素」时资料里只有星座"""
    for sign, el in SIGN_ELEMENT.items():
        if sign + '座' in text:
            return f'{text}（{sign}座属{el}象星座，所以这张牌也常被归入{el}元素）'
    if '元素' not in text and any(p == text.strip() or text.startswith(p) for p in PLANETS):
        return f'{text}（行星牌：黄金黎明体系里行星牌不另配四元素）'
    return text


def _read(path):
    with open(os.path.join(ROOT, path), encoding='utf-8') as f:
        return json.load(f)


class Knowledge:
    def __init__(self):
        self.cards = {c['id']: c for c in _read('data/cards.json')['cards']}
        self.spreads = {s['id']: s for s in _read('data/spreads.json')['spreads']}
        self.kb = {c['card_id']: c for c in _read('ai/knowledge_base/cards_pilot.json')['cards']}
        vs = {a['card_id']: a for a in _read('data/visual_symbols.json')['artworks']}
        self.symbols = {cid: {s['id']: s for s in vs[cid]['visual_symbols']} for cid in vs}
        self.naiwa_kept = {cid: c['naiwa_kept'] for cid, c in _read('ai/knowledge_base/imagery_compare_pilot.json')['cards'].items()}
        sf = 'ai/semantic_framework/'
        self.props = [p for p in _read(sf + 'propositions_pilot.json')['propositions'] if p['review_status'] == 'reviewed']
        self.seeds = [s for s in _read(sf + 'seeds_pilot.json')['seeds'] if s['review_status'] == 'reviewed']
        self.trees = {t['card_refs'][0]: t for t in _read(sf + 'inquiry_pilot.json')['trees'] if t['review_status'] == 'reviewed'}
        self.contras = [c for c in _read(sf + 'contradictions_pilot.json')['contradictions'] if c['review_status'] == 'reviewed']
        self.waite = {c['card_id']: c for c in _read('ai/sources/waite_pkt_major.json')['cards']}
        sr = os.path.join(ROOT, 'ai/knowledge_base/symbol_readings_pilot.json')   # 意象的传统读法（审查后的）
        self.symbol_readings = _read('ai/knowledge_base/symbol_readings_pilot.json')['cards'] if os.path.exists(sr) else {}

    def position(self, spread_id, position_id):
        sp = self.spreads[spread_id]
        for p in sp['positions']:
            if p['id'] == position_id:
                return p
        raise KeyError(f'{spread_id} 没有位置 {position_id}')

    def card_context(self, card_id, orientation, lang='zh'):
        """一张牌在当前方向下的检索结果（结构化，给状态与提示词用）"""
        c = self.cards[card_id]
        o = 'rev' if orientation == 'reversed' else 'up'
        ctx = {
            'card_id': card_id,
            'name': c['name'][lang],
            'orientation': orientation,
            'keywords': c['keys'][lang],
            'meaning': c[o][lang],
            'facets': {k: v[lang] for k, v in c['facets'][o].items()},
            'enhanced': card_id in self.kb,   # 是否属于语义增强的试点牌
        }
        kb = self.kb.get(card_id)
        if kb:
            # 画面用传统意象的名称（来自对照表），不用牌面标注里带哥特修饰的描述
            ctx['visible_traditional'] = [t['zh'] for t in kb['imagery_compare'] if t['status'] != 'absent']
            ctx['naiwa_specific'] = [x['zh'] for x in self.naiwa_kept.get(card_id, [])]
            ctx['traditional_not_in_picture'] = [t['zh'] for t in kb['imagery_compare'] if t['status'] == 'absent']
            ctx['propositions'] = [
                {'id': p['proposition_id'], 'text': p['text'][lang], 'counterexamples': p['counterexamples']}
                for p in self.props if card_id in p['card_refs']
            ]
            tr = kb.get('traditional') or {}
            ctx['correspondence'] = explain_correspondence((tr.get('correspondence') or {}).get(lang, ''))
            ctx['archetype'] = (tr.get('archetype') or {}).get(lang, '')
            w = self.waite.get(card_id)
            ctx['waite_divinatory'] = w['divinatory']['reversed' if orientation == 'reversed' else 'upright'] if w else ''
            ctx['imagery_readings'] = [
                {'imagery': k, **v} for k, v in (self.symbol_readings.get(card_id) or {}).items() if v.get('basis') != 'none'
            ]
            ctx['contradictions'] = [
                {'poles': '／'.join(p[lang] for p in x['poles']), 'text': x['description'][lang]}
                for x in self.contras if card_id in x['card_refs']
            ]
            ctx['whispers'] = [
                {'id': s['seed_id'], 'text': s['aphorism'][lang], 'avoid_when': s['counterexamples']}
                for s in self.seeds if card_id in s['card_refs']
            ]
        return ctx

    def tree_node(self, card_id, node_id, lang='zh'):
        t = self.trees.get(card_id)
        if not t:
            return None
        for n in t['nodes']:
            if n['id'] == node_id:
                return n['text'][lang]
        return None
