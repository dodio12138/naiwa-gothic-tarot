// 由站内数据生成试点知识侧表 ai/knowledge_base/cards_pilot.json（不要手改生成结果）
//   牌义、关键词、对应：data/cards.json（站内静态解读，作为「传统牌义」的现阶段来源，待人工核对原典）
//   画面符号：data/visual_symbols.json（实际牌面可见的符号 ID）
//   与传统意象的对照：ai/knowledge_base/imagery_compare_pilot.json（人工整理）
//     · 只有对应传统意象的符号进入 visual_symbol_refs
//     · 哥特与风格化夜晚元素（style_removed）完全不进入 AI 数据
//     · 传统没有、我们多出的其它元素（用户已决定保留）放在 naiwa_symbol_refs，作为奶蛙版特有的象征，与传统意象分开
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
// 全部 22 张大阿卡纳（试点 7 张起步，2026-11-27 扩到 22 张）；只处理已有对照表的牌
const compareAll = JSON.parse(fs.readFileSync(path.join(root, 'ai/knowledge_base/imagery_compare_pilot.json'), 'utf8')).cards;
export const PILOT = Array.from({ length: 22 }, (_, i) => `major_${String(i).padStart(2, '0')}`).filter((id) => compareAll[id]);

const { cards } = read('data/cards.json');
const { artworks } = read('data/visual_symbols.json');
const compare = read('ai/knowledge_base/imagery_compare_pilot.json').cards;
const waite = Object.fromEntries(read('ai/sources/waite_pkt_major.json').cards.map((c) => [c.card_id, c]));

const out = PILOT.map((id) => {
  const c = cards.find((x) => x.id === id);
  const a = artworks.find((x) => x.card_id === id);
  if (!c || !a) throw new Error(`缺少 ${id} 的牌数据或画面标注`);
  return {
    card_id: id,
    tradition_card_ref: `rws.major.${String(c.rank).padStart(2, '0')}`,
    tradition_id: 'rws',
    name: { zh: c.name.zh, en: c.name.en },
    traditional: {
      keywords: c.keys,
      upright: c.up,
      reversed: c.rev,
      correspondence: c.astro,
      correspondence_basis: 'golden_dawn（《777》Table I 已核实）' + (c.astro.zh.includes('现代') ? '；括注的外行星为现代后加' : ''),
      archetype: c.origin,
    },
    artwork_ref: a.artwork_id,
    visual_symbol_refs: compare[id].traditional.filter((t) => t.symbol_ref && t.status !== 'absent').map((t) => t.symbol_ref),
    naiwa_symbol_refs: compare[id].naiwa_kept.map((x) => x.id),
    style_removed_refs: compare[id].style_removed.map((x) => x.id),
    rws_absent: compare[id].traditional.filter((t) => t.status === 'absent').map((t) => t.rws),
    imagery_compare: compare[id].traditional,
    // 原典：韦特 1911 原文的占卜义（英文原文）与出处；对应关系出自黄金黎明体系，已对照《777》Table I 核实（只记位置，不收原文）
    waite_1911: waite[id] ? { upright: waite[id].divinatory.upright, reversed: waite[id].divinatory.reversed } : undefined,
    source_refs: [
      ...(waite[id] ? [waite[id].divinatory.ref, waite[id].symbolism.ref].map((r) => `${r.source}#${r.section} · ${r.locator}`) : []),
      `crowley_777#table1 · Path ${c.rank + 11}（Col. XIV 塔罗 · Col. VI/VII 天体）`,
    ],
    review_status: 'draft',
  };
});

const dst = path.join(root, 'ai/knowledge_base/cards_pilot.json');
fs.writeFileSync(dst, JSON.stringify({
  $comment: '由 ai/scripts/build_kb.mjs 生成，请勿手改。traditional 是站内的通行解读；waite_1911 是韦特 1911 原文的占卜义（英文），二者常有出入；source_refs 指向 ai/sources/。',
  generated_from: ['data/cards.json', 'data/visual_symbols.json', 'ai/knowledge_base/imagery_compare_pilot.json', 'ai/sources/waite_pkt_major.json'],
  cards: out,
}, null, 2) + '\n');
console.log(`已生成 ${path.relative(root, dst)}：${out.length} 张`);
