// 校验 AI 试点数据：ID 格式与唯一、中英文齐全、引用存在、反例与出口规则齐全
// 不依赖第三方库；格式细节以 ai/schemas/*.schema.json 为准，这里检查最容易出错的部分与跨文件引用
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const exists = (f) => fs.existsSync(path.join(root, f));
const errors = [];
const err = (m) => errors.push(m);
const zhen = (v, w) => { if (!v || !String(v.zh || '').trim() || !String(v.en || '').trim()) err(`${w}：缺少中文或英文`); };
const nonEmpty = (a, w) => { if (!Array.isArray(a) || !a.length) err(`${w}：不能为空`); };
const REVIEW = ['draft', 'reviewed', 'quarantined'];
const FRAMEWORKS = ['traditional_rws', 'hermetic', 'jungian_extension', 'existential_extension', 'dialectical_extension', 'daoist_extension', 'stoic_extension', 'naiwa_original'];

const kb = read('ai/knowledge_base/cards_pilot.json').cards;
const cardIds = new Set(kb.map((c) => c.card_id));
const symbolsOf = Object.fromEntries(kb.map((c) => [c.card_id, new Set([...c.visual_symbol_refs, ...(c.naiwa_symbol_refs || [])])]));
const extraOf = Object.fromEntries(kb.map((c) => [c.card_id, new Set(c.naiwa_symbol_refs || [])]));
const removedOf = Object.fromEntries(kb.map((c) => [c.card_id, new Set(c.style_removed_refs || [])]));
const usesExtra = [];   // 用到奶蛙版特有象征的条目：合法，列出来便于区分「传统依据」与「奶蛙版依据」
const allCards = new Set(read('data/cards.json').cards.map((c) => c.id));
for (const c of kb) if (!allCards.has(c.card_id)) err(`知识库：${c.card_id} 不是站内的牌`);

const uniq = (list, key, w) => {
  const seen = new Set();
  for (const x of list) { if (seen.has(x[key])) err(`${w}：${key} ${x[key]} 重复`); seen.add(x[key]); }
  return seen;
};
const cardRefs = (refs, w) => { nonEmpty(refs, `${w}.card_refs`); (refs || []).forEach((r) => { if (!cardIds.has(r)) err(`${w}：card_refs 里的 ${r} 不在试点知识库`); }); };
// 符号引用必须是所引牌面上真实可见的符号
const symRefs = (refs, cards, w) => (refs || []).forEach((s) => {
  if (cards.some((c) => removedOf[c]?.has(s))) err(`${w}：符号 ${s} 是哥特 / 风格化夜晚元素，已从 AI 数据去掉`);
  else if (!cards.some((c) => symbolsOf[c]?.has(s))) err(`${w}：符号 ${s} 不在 ${cards.join(' / ')} 的画面标注里`);
  else if (cards.some((c) => extraOf[c]?.has(s))) usesExtra.push(`${w} → ${s}`);
});
const review = (x, w) => { if (!REVIEW.includes(x.review_status)) err(`${w}：review_status 只能是 ${REVIEW.join(' / ')}`); };

/* ── 小阿卡纳知识表：56 张、韦特原文、黄金黎明称号 ── */
if (exists('ai/knowledge_base/cards_minor.json')) {
  const minor = read('ai/knowledge_base/cards_minor.json').cards;
  if (minor.length !== 56) err(`小牌知识表应有 56 张，实际 ${minor.length}`);
  for (const c of minor) {
    if (!allCards.has(c.card_id)) err(`小牌知识表：${c.card_id} 不是站内的牌`);
    if (!c.waite_1911?.upright) err(`${c.card_id}：缺韦特原文占卜义`);
    if (c.rank <= 10 && !c.golden_dawn_title) err(`${c.card_id}：缺黄金黎明称号`);
    if (!c.source_refs?.length) err(`${c.card_id}：缺 source_refs`);
  }
}

/* ── 命题 ── */
const props = exists('ai/semantic_framework/propositions_pilot.json') ? read('ai/semantic_framework/propositions_pilot.json').propositions : [];
const propIds = uniq(props, 'proposition_id', '命题');
for (const p of props) {
  const w = p.proposition_id;
  if (!/^prop\.major_\d{2}\.\d{2}$/.test(w)) err(`${w}：ID 格式应为 prop.major_15.01`);
  cardRefs(p.card_refs, w); zhen(p.text, `${w}.text`);
  if (!FRAMEWORKS.includes(p.framework)) err(`${w}：framework 不在允许列表`);
  symRefs(p.symbol_refs, p.card_refs, w);
  nonEmpty(p.applicable_conditions, `${w}.applicable_conditions`); nonEmpty(p.counterexamples, `${w}.counterexamples`);
  if (!['traditional', 'original_interpretation'].includes(p.source_kind)) err(`${w}：source_kind 不对`);
  if (p.framework !== 'traditional_rws' && p.source_kind === 'traditional') err(`${w}：现代扩展框架不能标成 traditional`);
  if (p.framework === 'traditional_rws' && !['waite_divinatory', 'waite_symbolism', 'modern_convention'].includes(p.tradition_basis)) err(`${w}：传统条目要写明依据 tradition_basis（韦特占卜义 / 韦特象征解说 / 通行解读）`);
  review(p, w);
}

/* ── 矛盾 ── */
const contras = exists('ai/semantic_framework/contradictions_pilot.json') ? read('ai/semantic_framework/contradictions_pilot.json').contradictions : [];
uniq(contras, 'contradiction_id', '矛盾');
for (const c of contras) {
  const w = c.contradiction_id;
  cardRefs(c.card_refs, w);
  if (!Array.isArray(c.poles) || c.poles.length !== 2) err(`${w}：poles 必须是两极`); else c.poles.forEach((p, i) => zhen(p, `${w}.poles[${i}]`));
  zhen(c.description, `${w}.description`);
  (c.proposition_refs || []).forEach((r) => { if (!propIds.has(r)) err(`${w}：命题 ${r} 不存在`); });
  review(c, w);
}

/* ── 语义种子 ── */
const seeds = exists('ai/semantic_framework/seeds_pilot.json') ? read('ai/semantic_framework/seeds_pilot.json').seeds : [];
const seedIds = uniq(seeds, 'seed_id', '种子');
for (const s of seeds) {
  const w = s.seed_id;
  cardRefs(s.card_refs, w); symRefs(s.symbol_refs, s.card_refs, w);
  if (!propIds.has(s.proposition_ref)) err(`${w}：命题 ${s.proposition_ref} 不存在`);
  if (!FRAMEWORKS.includes(s.framework)) err(`${w}：framework 不在允许列表`);
  zhen(s.aphorism, `${w}.aphorism`);
  if (s.framework === 'traditional_rws' && !['waite_divinatory', 'waite_symbolism', 'modern_convention'].includes(s.tradition_basis)) err(`${w}：传统条目要写明依据 tradition_basis`);
  nonEmpty(s.expansion_topics, `${w}.expansion_topics`); nonEmpty(s.counterexamples, `${w}.counterexamples`);
  review(s, w);
}

/* ── 追问树：节点可达、分支指向存在的节点、必须有拒绝 / 只要牌义 / 不适的出口 ── */
const trees = exists('ai/semantic_framework/inquiry_pilot.json') ? read('ai/semantic_framework/inquiry_pilot.json').trees : [];
uniq(trees, 'tree_id', '追问树');
for (const t of trees) {
  const w = t.tree_id;
  cardRefs(t.card_refs, w);
  const ids = new Set(t.nodes.map((n) => n.id));
  if (!ids.has(t.root)) err(`${w}：root ${t.root} 不存在`);
  const whens = new Set();
  for (const n of t.nodes) {
    zhen(n.text, `${w}.${n.id}.text`);
    (n.seed_refs || []).forEach((r) => { if (!seedIds.has(r)) err(`${w}.${n.id}：种子 ${r} 不存在`); });
    (n.branches || []).forEach((b) => { whens.add(b.when); if (!ids.has(b.to)) err(`${w}.${n.id}：分支指向不存在的节点 ${b.to}`); });
  }
  for (const must of ['declines', 'wants_meaning', 'distress']) if (!whens.has(must)) err(`${w}：缺少「${must}」的出口分支`);
  if (!t.nodes.some((n) => n.action === 'CLOSE')) err(`${w}：缺少 CLOSE 节点`);
  if (!t.nodes.some((n) => n.action === 'SAFETY_REDIRECT')) err(`${w}：缺少 SAFETY_REDIRECT 节点`);
  nonEmpty(t.stop_rules, `${w}.stop_rules`);
  review(t, w);
}

/* ── 测试集 ── */
const benchFile = 'ai/benchmark/cases_pilot.jsonl';
const cases = exists(benchFile) ? fs.readFileSync(path.join(root, benchFile), 'utf8').split('\n').filter(Boolean).map((l, i) => {
  try { return JSON.parse(l); } catch { err(`测试集第 ${i + 1} 行不是合法 JSON`); return null; }
}).filter(Boolean) : [];
uniq(cases, 'case_id', '测试集');
const spreads = Object.fromEntries(read('data/spreads.json').spreads.map((s) => [s.id, new Set(s.positions.map((p) => p.id))]));
for (const c of cases) {
  const w = c.case_id;
  const sp = spreads[c.input?.spread_id];
  if (!sp) { err(`${w}：牌阵 ${c.input?.spread_id} 不存在`); continue; }
  if (c.input.cards.length !== sp.size) err(`${w}：牌数与牌阵不符（应为 ${sp.size}）`);
  const used = new Set();
  for (const k of c.input.cards) {
    if (!allCards.has(k.card_id)) err(`${w}：牌 ${k.card_id} 不存在`);
    if (!sp.has(k.position_id)) err(`${w}：位置 ${k.position_id} 不属于 ${c.input.spread_id}`);
    if (used.has(k.card_id)) err(`${w}：同一张牌重复出现`);
    used.add(k.card_id);
  }
  review(c, w);
}

if (errors.length) {
  console.error(`AI 数据校验失败（${errors.length} 项）：\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}
if (usesExtra.length) console.log(`用到奶蛙版特有象征的引用（${usesExtra.length}）：\n  - ${usesExtra.join('\n  - ')}`);
console.log(`AI 数据校验通过：知识库 ${kb.length} 张、命题 ${props.length}、矛盾 ${contras.length}、种子 ${seeds.length}、追问树 ${trees.length}、测试样例 ${cases.length}`);
