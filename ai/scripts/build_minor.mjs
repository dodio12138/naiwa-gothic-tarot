// 由站内数据 + 原典生成小阿卡纳知识表 ai/knowledge_base/cards_minor.json（不要手改生成结果）
//   站内牌义与对应：data/cards.json
//   韦特 1911 原文：ai/sources/waite_pkt_minor.json（画面描述、占卜义）
//   黄金黎明称号：ai/sources/golden_dawn_minor_titles.json（《777》Col. CXXXIII–CXXXVI）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const { cards } = read('data/cards.json');
const waite = Object.fromEntries(read('ai/sources/waite_pkt_minor.json').cards.map((c) => [c.card_id, c]));
const gd = read('ai/sources/golden_dawn_minor_titles.json');

const out = cards.filter((c) => c.arcana === 'minor').map((c) => {
  const w = waite[c.id];
  const court = c.rank >= 11;
  return {
    card_id: c.id,
    suit: c.suit,
    rank: c.rank,
    name: { zh: c.name.zh, en: c.name.en },
    traditional: {
      keywords: c.keys, upright: c.up, reversed: c.rev, correspondence: c.astro,
      correspondence_basis: court
        ? 'modern_convention：宫廷牌元素为现代常用对应（与黄金黎明的骑士火 / 王子风不同）'
        : c.rank === 1 ? 'golden_dawn：元素力量之根（《777》已核对）' : 'golden_dawn：旬星（按黄金黎明规则逐张验证，并见《777》）',
    },
    golden_dawn_title: gd.titles[c.id] || null,
    waite_1911: { upright: w.divinatory.upright, reversed: w.divinatory.reversed || null, picture: w.symbolism.text },
    source_refs: [
      `${w.divinatory.ref.source}#${w.divinatory.ref.section} · ${w.divinatory.ref.locator}`,
      ...(court ? [] : [`crowley_777 · Col. ${gd.col[c.suit]}（${c.rank === 1 ? '元素之根' : '称号与旬星'}）`]),
    ],
    review_status: 'draft',
  };
});
fs.writeFileSync(path.join(root, 'ai/knowledge_base/cards_minor.json'), JSON.stringify({
  $comment: '由 ai/scripts/build_minor.mjs 生成，请勿手改。traditional 是站内的通行解读；waite_1911 是韦特原文（英文）；golden_dawn_title 是黄金黎明称号。',
  generated_from: ['data/cards.json', 'ai/sources/waite_pkt_minor.json', 'ai/sources/golden_dawn_minor_titles.json'],
  cards: out,
}, null, 2) + '\n');
console.log(`已生成 ai/knowledge_base/cards_minor.json：${out.length} 张`);
