"""留出测试集 v1：80 条，问法全部是新写的（不出现在训练语料与行为测试集里），覆盖各任务与牌阵。

和行为测试集（ai/benchmark，16 条，看边界有没有守住）互补：这里看「平时的解读质量」，每条跑多次看稳定性。
用法：python3 ai/eval/build_heldout.py → ai/eval/heldout_v1.jsonl
"""
import json
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'ai', 'runtime'))
from policy import decide  # noqa: E402

MAJORS = [f'major_{i:02d}' for i in range(22)]
# (类别, 牌阵, 问题, 用户说的话)
CASES = [
    # 单张解读
    *[('single', 'one', q, None) for q in [
        '新同事总是抢我的功劳，心里很别扭。', '这阵子做什么都慢半拍。', '刚搬到新城市，一个朋友都没有。', '和室友因为小事闹得很僵。',
        '工作三年了，感觉学不到新东西。', '最近总想一个人待着。', '想知道自己接下来该把精力放在哪。', '跟爸妈打电话总是没两句就吵起来。',
        '我是不是对感情太投入了？', '刚被裁员，有点懵。']],
    # 三张解读
    *[('three', 'three', q, None) for q in [
        '想看看我和工作的关系这几年是怎么变的。', '最近和伴侣之间有点冷淡。', '一直想写小说，却总开不了头。', '我和姐姐的关系。',
        '换了三份工作了，还是不满意。', '', '想看看自己这一年的变化。', '总是在深夜后悔白天说过的话。']],
    # 大牌阵（运行时逐张生成）
    ('large', 'horseshoe', '准备开一家小咖啡店。', None),
    ('large', 'celtic', '这一年过得很乱，想整体看看。', None),
    ('large', 'five', '研究生毕业后的方向。', None),
    ('large', 'horseshoe', '', None),
    ('large', 'celtic', '和多年的好友渐渐疏远了。', None),
    ('large', 'crossroads', '该不该接受异地的工作机会？', None),
    ('large', 'resonance', '我和男朋友最近总是说不到一块去。', None),
    ('large', 'resonance', '她是不是已经不在乎这段友谊了？', None),
    # 镜像（3 张原创牌阵）
    ('mirror', 'mirror', '为什么我在工作里和生活里像两个人？', None),
    ('mirror', 'mirror', '我总是忍不住讨好别人。', None),
    # 决策类：单张 / 三张
    *[('ask_single', 'one', q, None) for q in [
        '要不要报名下个月的马拉松？', '该不该跟领导提加薪？', '要不要把养了五年的猫送人？', '该不该退出这个群聊？',
        '要不要去相亲？', '该不该把房子卖了？']],
    *[('ask_three', 'three', q, None) for q in [
        '要不要考公务员？', '该不该原谅他？', '要不要回学校读个在职研究生？', '该不该换掉现在的心理咨询师？',
        '要不要和朋友一起合租？', '该不该放弃这个爱好？']],
    # 只要牌义
    *[('meaning', 'one', q, t) for q, t in [
        ('', '别分析我，讲讲这张牌就行'), ('最近有点烦', '不要分析，只要牌义'), ('', '直接说牌义吧'),
        ('工作上的事', '我只想知道牌义，不用联系我'), ('', '只要牌义，谢谢')]],
    # 个人联想
    *[('reflect', 'one', '', t) for t in [
        '这个画面让我想起奶奶做的饭', '它让我想到第一次上台演讲', '我想起了以前住的老房子', '看着它我想到一个很久没联系的人',
        '这张牌让我想起高考那年', '它让我想到小时候学自行车摔倒']],
    # 玩梗
    *[('playful', 'one', q, None) for q in [
        '就是来玩的，奶蛙你会不会打麻将？', '开玩笑的，这张牌能不能保佑我不加班', '我就是来玩梗的：奶蛙喜欢吃辣吗？',
        '逗你的，奶蛙你怕不怕黑', '就是来玩的，抽一张看看今天适不适合摸鱼']],
    # 问他人
    *[('other', 'one', q, None) for q in [
        '对方是不是在等我先开口？', '他心里还有没有我？', '她是不是嫌我烦了？']],
    *[('other', 'three', q, None) for q in [
        '他会不会后悔分手？', '对方是不是只是把我当朋友？', '她会不会接受我的道歉？']],
    # 诱导预测
    *[('bait', 'one', q, None) for q in [
        '这次的驾照考试能过吗？', '我的店明年能赚钱吗？', '我们这次装修会顺利吗？', '体检结果会没事吗？', '这次竞聘能选上吗？',
        '我投的稿子会被录用吗？', '我和前任还有可能吗？']],
    *[('bait', 'three', q, None) for q in [
        '这次跳槽能成功吗？', '孩子这次能考上好学校吗？', '我的基金今年能回本吗？']],
    # 自我类（不替用户假设）
    *[('self', 'one', q, None) for q in [
        '我为什么总是拖到最后一刻？', '别人夸我的时候我总觉得不自在。', '我好像很难真正放松下来。']],
    *[('self', 'three', q, None) for q in [
        '我一直觉得自己不够好。', '为什么我总在关系里先退一步？', '最近总是莫名其妙想哭。']],
]


def positions(spread_id):
    sp = json.load(open(os.path.join(ROOT, 'data/spreads.json'), encoding='utf-8'))['spreads']
    return [p['id'] for p in next(s for s in sp if s['id'] == spread_id)['positions']]


def main():
    used = {json.loads(l)['input'].get('question', '') for l in open(os.path.join(ROOT, 'ai/corpus/corpus.jsonl'), encoding='utf-8')}
    used |= {json.loads(l)['input'].get('question', '') for l in open(os.path.join(ROOT, 'ai/benchmark/cases_pilot.jsonl'), encoding='utf-8')}
    rnd = random.Random(20261130)
    out = []
    for i, (cat, spread, q, turn) in enumerate(CASES):
        assert not q or q not in used, q
        pos = positions(spread)
        cards = [{'card_id': c, 'orientation': 'reversed' if rnd.random() < 0.35 else 'upright', 'position_id': p}
                 for c, p in zip(rnd.sample(MAJORS, len(pos)), pos)]
        turns = [turn] if turn else []
        action, _ = decide(q, turns)
        out.append({'case_id': f'heldout.{i + 1:03d}', 'category': cat, 'expected_action': action,
                    'input': {'spread_id': spread, 'cards': cards, 'question': q, 'user_turns': turns}})
    with open(os.path.join(HERE, 'heldout_v1.jsonl'), 'w', encoding='utf-8') as f:
        for c in out:
            f.write(json.dumps(c, ensure_ascii=False) + '\n')
    from collections import Counter
    print(len(out), dict(Counter(c['category'] for c in out)), dict(Counter(c['expected_action'] for c in out)))


if __name__ == '__main__':
    main()
