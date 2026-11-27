// 由站内数据生成试点知识侧表 ai/knowledge_base/cards_pilot.json（不要手改生成结果）
//   牌义、关键词、对应：data/cards.json（站内静态解读，作为「传统牌义」的现阶段来源，待人工核对原典）
//   画面符号：data/visual_symbols.json（实际牌面可见的符号 ID）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
export const PILOT = ['major_00', 'major_04', 'major_12', 'major_15', 'major_16', 'major_17', 'major_18'];

const { cards } = read('data/cards.json');
const { artworks } = read('data/visual_symbols.json');

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
      archetype: c.origin,
    },
    artwork_ref: a.artwork_id,
    visual_symbol_refs: a.visual_symbols.map((s) => s.id),
    rws_absent: a.rws_absent,
    source_refs: [],
    review_status: 'draft',
  };
});

const dst = path.join(root, 'ai/knowledge_base/cards_pilot.json');
fs.writeFileSync(dst, JSON.stringify({
  $comment: '由 ai/scripts/build_kb.mjs 生成，请勿手改。传统牌义暂取站内文案，原典出处待补（source_refs）。',
  generated_from: ['data/cards.json', 'data/visual_symbols.json'],
  cards: out,
}, null, 2) + '\n');
console.log(`已生成 ${path.relative(root, dst)}：${out.length} 张`);
