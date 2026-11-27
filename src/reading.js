// 分层解读（模板化，不依赖 AI）：单牌 → 牌与牌之间 → 整体 → 留给你的问题
// 见 docs/design-spreads.md 第 9 节。这里只根据牌面的客观组合给出观察，不做预测。

const ELEMENT = {
  zh: {
    wands: ['权杖', '火', '行动、热情与意志'], cups: ['圣杯', '水', '情感、关系与直觉'],
    swords: ['宝剑', '风', '思考、沟通与冲突'], pentacles: ['星币', '土', '现实、身体与资源'],
  },
  en: {
    wands: ['Wands', 'fire', 'action, passion and will'], cups: ['Cups', 'water', 'feeling, relationships and intuition'],
    swords: ['Swords', 'air', 'thought, words and conflict'], pentacles: ['Pentacles', 'earth', 'the practical, the body and resources'],
  },
};
const NUMBER = {
  zh: { 1: '开始与种子', 2: '平衡与选择', 3: '成长与合作', 4: '稳定与停顿', 5: '变动与摩擦', 6: '调和与交换', 7: '考验与评估', 8: '推进与重复', 9: '将近完成', 10: '完成与转折', 11: '学习与消息', 12: '行动与追寻', 13: '内在的掌握', 14: '外在的掌控' },
  en: { 1: 'beginnings', 2: 'balance and choice', 3: 'growth and cooperation', 4: 'stability and pause', 5: 'change and friction', 6: 'harmony and exchange', 7: 'testing and weighing', 8: 'momentum and repetition', 9: 'nearing completion', 10: 'completion and turning', 11: 'learning and messages', 12: 'action and pursuit', 13: 'inner mastery', 14: 'outer command' },
};
const RANK_NAME = {
  zh: { 1: '王牌', 11: '侍从', 12: '骑士', 13: '王后', 14: '国王' },
  en: { 1: 'Aces', 11: 'Pages', 12: 'Knights', 13: 'Queens', 14: 'Kings' },
};

/**
 * @param cards  [{ data: {arcana, suit, rank}, reversed, slot }]，按牌位排好
 * @param spread 当前语言的牌阵视图（links / questions / positions）
 * @param en     是否英文
 * @param label  (card) => 「位置 · 牌名」的 HTML，用在牌与牌之间
 */
export function layers(cards, spread, en, label) {
  const L = en ? 'en' : 'zh';
  const bySlot = Object.fromEntries(cards.map((c) => [c.slot, c]));

  /* ── 牌与牌之间：牌阵定义的对照位置 + 这两张牌本身的组合特点 ── */
  const links = spread.links.filter((l) => bySlot[l.a] && bySlot[l.b]).map((l) => {
    const a = bySlot[l.a], b = bySlot[l.b];
    return { a: label(a), b: label(b), text: l.text, notes: pairNotes(a, b, L) };
  });

  /* ── 整体：大牌比例、主导元素、宫廷牌、逆位、重复的数字 ── */
  const overall = cards.length >= 3 ? overallNotes(cards, L) : [];

  return { links, overall, questions: spread.questions, note: spread.note };
}

function pairNotes(a, b, L) {
  const zh = L === 'zh';
  const out = [];
  const A = a.data, B = b.data;
  if (A.arcana === 'major' && B.arcana === 'major') out.push(zh ? '两张都是大阿卡纳：这里说的是更大的人生主题。' : 'Both are Major Arcana: a larger life theme is at play here.');
  else if (A.arcana === 'minor' && B.arcana === 'minor' && A.suit === B.suit) {
    const [suit, el, theme] = ELEMENT[L][A.suit];
    out.push(zh ? `同为${suit}（${el}）：${theme}贯穿这两个位置。` : `Both ${suit} (${el}): ${theme} runs through both positions.`);
  }
  if (A.arcana === 'minor' && B.arcana === 'minor' && A.rank === B.rank) {
    out.push(zh ? `数字相同（${NUMBER.zh[A.rank]}）：同一种节奏在两处出现。` : `Same number (${NUMBER.en[A.rank]}): the same rhythm appears in both places.`);
  }
  if (a.reversed !== b.reversed) out.push(zh ? '一正一逆：一边的力量在外显，另一边还在内收或受阻。' : 'One upright, one reversed: one force is outward, the other held in or blocked.');
  else if (a.reversed && b.reversed) out.push(zh ? '两张都是逆位：这一组关系里，能量都还没有顺畅地流动。' : 'Both reversed: energy in this pairing is not yet flowing freely.');
  return out;
}

function overallNotes(cards, L) {
  const zh = L === 'zh';
  const n = cards.length;
  const out = [];
  const majors = cards.filter((c) => c.data.arcana === 'major').length;
  if (majors / n >= 0.5) out.push(zh ? `大阿卡纳占 ${majors} / ${n}：这次的问题更像人生阶段的大主题，而不只是日常琐事。` : `${majors} of ${n} are Major Arcana: this is more a chapter of life than a daily detail.`);
  else if (majors === 0) out.push(zh ? '没有大阿卡纳：事情多在日常层面，可以从具体的小处着手。' : 'No Major Arcana: this lives at the everyday level — start with something small and concrete.');

  const minors = cards.filter((c) => c.data.arcana === 'minor');
  const count = {};
  for (const c of minors) count[c.data.suit] = (count[c.data.suit] || 0) + 1;
  const ranked = Object.entries(count).sort((x, y) => y[1] - x[1]);
  if (ranked.length && ranked[0][1] >= Math.max(2, Math.ceil(n / 3)) && (ranked.length === 1 || ranked[0][1] > ranked[1][1])) {
    const [suit, el, theme] = ELEMENT[L][ranked[0][0]];
    out.push(zh ? `${suit}最多（${ranked[0][1]} 张，${el}）：${theme}是这次的重心。` : `${suit} lead (${ranked[0][1]} cards, ${el}): ${theme} is the centre of gravity.`);
  }
  if (n >= 7) {
    const missing = Object.keys(ELEMENT[L]).filter((s) => !count[s]);
    if (missing.length === 1) {
      const [suit, , theme] = ELEMENT[L][missing[0]];
      out.push(zh ? `没有出现${suit}：${theme}这次不是焦点——或者正是被忽略的部分。` : `No ${suit} appear: ${theme} is not in focus — or is exactly what is being overlooked.`);
    }
  }

  const courts = minors.filter((c) => c.data.rank >= 11).length;
  if (courts >= 2) out.push(zh ? `宫廷牌有 ${courts} 张：人，或者你在其中扮演的角色，是这件事的关键。` : `${courts} court cards: people — or the roles you play — are key here.`);

  const ranks = {};
  for (const c of minors) ranks[c.data.rank] = (ranks[c.data.rank] || 0) + 1;
  for (const [r, k] of Object.entries(ranks)) {
    if (k < 2) continue;
    const what = RANK_NAME[L][r] || (zh ? `数字 ${r}` : `${r}s`);
    out.push(zh ? `出现了 ${k} 张${what}：「${NUMBER.zh[r]}」的主题在重复。` : `${k} ${what} appear: the theme of ${NUMBER.en[r]} repeats.`);
  }

  const rev = cards.filter((c) => c.reversed).length;
  if (rev / n > 0.5) out.push(zh ? `逆位占了 ${rev} / ${n}：不少力量处在受阻、内收或还没表达出来的状态。逆位不等于坏，只是方向向内。` : `${rev} of ${n} are reversed: much of the energy is blocked, turned inward or not yet expressed. Reversed is not bad — just inward.`);
  else if (rev === 0) out.push(zh ? '全部是正位：能量大多是外显、流动的。' : 'All upright: most of the energy is outward and moving.');

  if (!out.length) out.push(zh ? '牌面比较分散，没有某一种力量特别突出——也许答案不止一个方向。' : 'The cards are evenly spread, with no single force dominating — perhaps there is more than one way forward.');
  return out;
}
