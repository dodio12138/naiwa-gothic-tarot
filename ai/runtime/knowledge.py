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
