"""留出测试集 v2（新任务）：40 条，覆盖第三版新增的知识问答、寓言、低语、压缩、渐进展开、多轮反馈。问法不进训练语料。

用法：python3 ai/eval/build_heldout_new.py → ai/eval/heldout_v2_new.jsonl
跑：python3 ai/eval/run_eval.py <模型> 2 heldout_v2_new
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'ai', 'runtime'))
from policy import decide  # noqa: E402


def one(cid, ori='upright', spread='one', pos='message'):
    return {'spread_id': spread, 'cards': [{'card_id': cid, 'orientation': ori, 'position_id': pos}]}


THREE = lambda a, b, c: {'spread_id': 'three', 'cards': [  # noqa: E731
    {'card_id': a[0], 'orientation': a[1], 'position_id': 'past'},
    {'card_id': b[0], 'orientation': b[1], 'position_id': 'present'},
    {'card_id': c[0], 'orientation': c[1], 'position_id': 'future'}]}

# 多轮用的「上一轮回答」（按奶蛙的写法写好的）
PREV = {
    'strength': '此刻的启示·力量：双手轻轻合上狮子的嘴，没有用蛮力。最近事情多、心里急的时候，这张牌说的是耐心也是一种力气。手放上去很轻。狮子低下了头。',
    'hermit': '此刻的启示·隐者：提灯的人站在雪峰顶上，灯照得不远，刚好够看清脚下这一段。想换方向的时候，也许先不用看清整条路，看清下一步就好。',
    'star': '此刻的启示·星星：八芒大星下，一壶水倒进池里，一壶倒在地上。分开之后的这段时间，像是在慢慢把自己补回来，不用急着好。',
    'tower': '此刻的启示·高塔：闪电劈在山顶的高塔上，王冠被掀飞。工作里突然的变动，像是旧的结构松动了；塔倒之后，天空还在。',
    'chariot': '过去·战车：一黑一白两只狮身兽，各望一边，那时候的力气常常互相拉扯。现在·月亮：两座塔之间有一条弯路，看不太清。未来·太阳：可能的方向里，带人脸的大太阳照着墙后的向日葵，事情也许会慢慢清楚。',
    'wheel': '此刻的启示·命运之轮：轮盘一直在转，蛇沿着一侧往下，阿努比斯从另一侧往上。被裁之后的这一格，只是轮上的其中一格。',
}

CASES = [
    # 知识问答
    ('explain', one('major_08'), '这张牌里那只狮子代表什么？', None),
    ('explain', one('major_00', 'reversed'), '愚者对应什么元素？', None),
    ('explain', one('major_13'), '死神这张牌是什么意思，是指真的死亡吗？', None),
    ('explain', one('major_15'), '恶魔牌里那两个人身上的锁链象征什么？', None),
    ('explain', one('major_17'), '星星牌在韦特原典里怎么说？', None),
    ('explain', one('major_06'), '恋人和节制这两张牌有什么不同？', None),
    ('explain', one('major_12'), '倒吊人里的自由和束缚怎么理解？', None),
    ('explain', one('major_21'), '世界牌四个角的动物代表什么？', None),
    # 寓言
    ('parable', one('major_09'), '最近工作很累，用这张牌讲个小故事吧', None),
    ('parable', one('major_18', 'reversed'), '给我讲个寓言', None),
    ('parable', one('major_07'), '能用这张牌打个比方吗？我总是想两头都顾', None),
    ('parable', one('major_03'), '讲个小故事就好', None),
    ('parable', one('major_16'), '用个比喻说说这张牌', None),
    ('parable', one('major_14', 'reversed'), '讲个童话给我听', None),
    # 低语（程序调用）
    *[('whisper', dict(one(c, o), mode='whisper'), '', None) for c, o in
      [('major_02', 'upright'), ('major_10', 'reversed'), ('major_19', 'upright'), ('major_04', 'reversed')]],
    ('whisper', dict(THREE(('major_05', 'upright'), ('major_11', 'reversed'), ('major_20', 'upright')), mode='whisper', focus_index=1), '最近很纠结', None),
    ('whisper', dict(THREE(('major_01', 'upright'), ('major_12', 'upright'), ('major_17', 'reversed')), mode='whisper', focus_index=2), '', None),
    # 压缩（程序调用）
    ('compress', dict(one('major_08'), mode='compress', text=PREV['strength']), '', None),
    ('compress', dict(one('major_09'), mode='compress', text=PREV['hermit']), '', None),
    ('compress', dict(one('major_16'), mode='compress', text=PREV['tower']), '', None),
    ('compress', dict(THREE(('major_07', 'upright'), ('major_18', 'upright'), ('major_19', 'upright')), mode='compress', text=PREV['chariot']), '', None),
    # 渐进展开（多轮）
    ('expand', dict(one('major_08'), history=[{'role': 'assistant', 'content': PREV['strength']}, {'role': 'user', 'content': '再说说'}]), '最近事情太多，心里很急', None),
    ('expand', dict(one('major_09'), history=[{'role': 'assistant', 'content': PREV['hermit']}, {'role': 'user', 'content': '说短一点'}]), '想换个方向', None),
    ('expand', dict(one('major_17'), history=[{'role': 'assistant', 'content': PREV['star']}, {'role': 'user', 'content': '换个角度说说'}]), '分手以后怎么办', None),
    ('expand', dict(one('major_16'), history=[{'role': 'assistant', 'content': PREV['tower']}, {'role': 'user', 'content': '如果是逆位呢？'}]), '工作上突然有变动', None),
    ('expand', dict(THREE(('major_07', 'upright'), ('major_18', 'upright'), ('major_19', 'upright')), history=[{'role': 'assistant', 'content': PREV['chariot']}, {'role': 'user', 'content': '月亮那张具体点'}]), '这几年的感情', None),
    ('expand', dict(one('major_10'), history=[{'role': 'assistant', 'content': PREV['wheel']}, {'role': 'user', 'content': '展开讲讲'}]), '刚被裁员', None),
    # 用户不认同（多轮）
    ('revise', dict(one('major_08'), history=[{'role': 'assistant', 'content': PREV['strength']}, {'role': 'user', 'content': '不对，我不是急，是没人帮我'}]), '最近事情太多', None),
    ('revise', dict(one('major_17'), history=[{'role': 'assistant', 'content': PREV['star']}, {'role': 'user', 'content': '说错了，我早就不难过了'}]), '分手以后怎么办', None),
    ('revise', dict(one('major_16'), history=[{'role': 'assistant', 'content': PREV['tower']}, {'role': 'user', 'content': '我不同意，这变动是我自己选的'}]), '工作上突然有变动', None),
    ('revise', dict(THREE(('major_07', 'upright'), ('major_18', 'upright'), ('major_19', 'upright')), history=[{'role': 'assistant', 'content': PREV['chariot']}, {'role': 'user', 'content': '不太像我，我们以前很合拍'}]), '这几年的感情', None),
    # 其他反馈（多轮）
    ('ack', dict(one('major_09'), history=[{'role': 'assistant', 'content': PREV['hermit']}, {'role': 'user', 'content': '说中了，我确实想一步到位'}]), '想换个方向', None),
    ('ack', dict(one('major_10'), history=[{'role': 'assistant', 'content': PREV['wheel']}, {'role': 'user', 'content': '不知道，说不清'}]), '刚被裁员', None),
    ('ack', dict(one('major_17'), history=[{'role': 'assistant', 'content': PREV['star']}, {'role': 'user', 'content': '没什么感觉'}]), '分手以后怎么办', None),
    ('ack', dict(one('major_16'), history=[{'role': 'assistant', 'content': PREV['tower']}, {'role': 'user', 'content': '其实是公司被收购了，整个部门都没了'}]), '工作上突然有变动', None),
    ('ack', dict(one('major_08'), history=[{'role': 'assistant', 'content': PREV['strength']}, {'role': 'user', 'content': '听着有点难受'}]), '最近事情太多', None),
    ('ack', dict(one('major_09'), history=[{'role': 'assistant', 'content': PREV['hermit']}, {'role': 'user', 'content': '那我现在应该先做什么'}]), '想换个方向', None),
]

EXPECT = {'explain': 'EXPLAIN', 'parable': 'PARABLE', 'whisper': 'WHISPER', 'compress': 'COMPRESS', 'expand': 'EXPAND', 'revise': 'REVISE', 'ack': 'ACK'}


def main():
    out = []
    for i, (cat, inp, q, turn) in enumerate(CASES):
        inp = dict(inp, question=q, user_turns=[turn] if turn else [])
        action, why = decide(q, inp['user_turns'], inp.get('history'), inp.get('mode'))
        assert action == EXPECT[cat], (cat, q, inp.get('history', [{}])[-1:], action, why)
        out.append({'case_id': f'heldout2.{i + 1:03d}', 'category': cat, 'expected_action': action, 'input': inp})
    with open(os.path.join(HERE, 'heldout_v2_new.jsonl'), 'w', encoding='utf-8') as f:
        for c in out:
            f.write(json.dumps(c, ensure_ascii=False) + '\n')
    from collections import Counter
    print(len(out), dict(Counter(c['category'] for c in out)))


if __name__ == '__main__':
    main()
