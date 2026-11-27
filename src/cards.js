// 牌与牌阵：数据在 data/*.json（中英文同表），这里整理成运行时用的结构
//   CARDS     中文视图（id / num / en / zh / keys / up / rev / whisper / dark …）
//   CARDS_EN  英文覆盖层（keys / up / rev / whisper），切到英文时叠在 CARDS 上
//   loreOf    扩充语料：画面、原型、对应、正逆位分项、低语池
//   SPREADS / SPREADS_EN / GRID  牌阵文案与揭示格位
import CARDS_DATA from '../data/cards.json';
import SPREADS_DATA from '../data/spreads.json';

const RAW = CARDS_DATA.cards;

export const CARDS = RAW.map((c) => ({
  id: c.id, arcana: c.arcana, suit: c.suit, rank: c.rank, num: c.num,
  en: c.name.en, zh: c.name.zh,
  keys: c.keys.zh, up: c.up.zh, rev: c.rev.zh, whisper: c.whispers[0].zh,
  dark: !!c.dark,
}));

export const CARDS_EN = Object.fromEntries(RAW.map((c) => [c.id, {
  keys: c.keys.en, up: c.up.en, rev: c.rev.en, whisper: c.whispers[0].en,
}]));

const BY_ID = Object.fromEntries(RAW.map((c) => [c.id, c]));
export const cardById = (id) => CARDS.find((c) => c.id === id);

/** 扩充语料（当前语言）；whispers 为额外的几句（不含第一句） */
export function loreOf(id, en) {
  const c = BY_ID[id];
  if (!c) return null;
  const k = en ? 'en' : 'zh';
  const pick = (o) => ({ love: o.love[k], work: o.work[k], advice: o.advice[k] });
  return {
    scene: c.scene[k], origin: c.origin?.[k] || '', astro: c.astro?.[k] || '',
    up: pick(c.facets.up), rev: pick(c.facets.rev),
    whispers: c.whispers.slice(1).map((w) => w[k]),
  };
}

const spreadView = (s, k) => {
  const idx = Object.fromEntries(s.positions.map((p, i) => [p.id, i]));
  return {
    name: s.name[k], sub: s.sub[k],
    positions: s.positions.map((p) => p.name[k]),
    meanings: s.positions.map((p) => p.meaning[k]),
    home: s.home !== false,
    menu: s.menu !== false,
    category: s.category || 'traditional',
    note: s.note?.[k] || '',
    // 「牌与牌之间」：按位置下标给出要对照看的两张牌
    links: (s.links || []).map((l) => ({ a: idx[l.from], b: idx[l.to], text: l.text[k] })),
    questions: (s.questions || []).map((q) => q[k]),
  };
};
export const SPREADS = Object.fromEntries(SPREADS_DATA.spreads.map((s) => [s.id, spreadView(s, 'zh')]));
export const SPREADS_EN = Object.fromEntries(SPREADS_DATA.spreads.map((s) => [s.id, spreadView(s, 'en')]));
// 揭示格位：[x, y, 横放]；横放只是摆法（凯尔特十字第 2 张），与逆位无关
export const GRID = Object.fromEntries(SPREADS_DATA.spreads.map((s) => [s.id, s.positions.map((p) => [p.x, p.y, !!p.cross])]));

// 画面层：ChatGPT 去掉边框并向外补全的全幅插画（边框统一用 public/ui/frame.webp 叠加）
export const artSrc = (id, size = 'sm') => `${import.meta.env.BASE_URL}cards/art-${size}/${id}.webp`;
