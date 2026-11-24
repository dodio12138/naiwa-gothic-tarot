// 数据校验：构建前自动运行（npm run check）。任何一项不通过都会让构建失败
//   · 牌：ID 唯一且格式正确、中英文字段齐全、牌面图片存在
//   · 光效：只能引用存在的牌
//   · 牌阵：ID 唯一、位置 ID 与格位不重复、中英文齐全
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const errors = [];
const err = (msg) => errors.push(msg);
const zhen = (v, where) => {
  if (!v || typeof v.zh !== 'string' || !v.zh.trim() || typeof v.en !== 'string' || !v.en.trim()) err(`${where}：缺少中文或英文`);
};

/* ── 牌 ── */
const { cards } = read('data/cards.json');
const ID = /^(major_\d{2}|(wands|cups|swords|pentacles)_\d{2})$/;
const seen = new Set();
for (const c of cards) {
  const w = c.id || '(无 ID)';
  if (!ID.test(c.id)) err(`${w}：ID 格式应为 major_00 或 wands_01 这类`);
  if (seen.has(c.id)) err(`${w}：ID 重复`);
  seen.add(c.id);
  if (!['major', 'minor'].includes(c.arcana)) err(`${w}：arcana 只能是 major / minor`);
  if (c.arcana === 'minor' && !['wands', 'cups', 'swords', 'pentacles'].includes(c.suit)) err(`${w}：小阿卡纳缺少花色`);
  if (typeof c.num !== 'string' || !c.num) err(`${w}：缺少牌号 num`);
  zhen(c.name, `${w}.name`);
  if (!Array.isArray(c.keys?.zh) || !c.keys.zh.length || !Array.isArray(c.keys?.en) || c.keys.zh.length !== c.keys.en.length) err(`${w}.keys：中英文关键词数量不一致或为空`);
  zhen(c.up, `${w}.up`); zhen(c.rev, `${w}.rev`);
  if (!Array.isArray(c.whispers) || !c.whispers.length) err(`${w}：至少要有一句低语`);
  else c.whispers.forEach((x, i) => zhen(x, `${w}.whispers[${i}]`));
  zhen(c.scene, `${w}.scene`); zhen(c.origin, `${w}.origin`); zhen(c.astro, `${w}.astro`);
  for (const o of ['up', 'rev']) for (const f of ['love', 'work', 'advice']) zhen(c.facets?.[o]?.[f], `${w}.facets.${o}.${f}`);
  for (const size of ['sm', 'full']) {
    if (!fs.existsSync(path.join(root, `public/cards/art-${size}/${c.id}.webp`))) err(`${w}：缺少牌面图片 art-${size}/${c.id}.webp`);
  }
}

/* ── 光效 ── */
const { LIGHTS } = await import(path.join(root, 'src/lights.js'));
for (const id of Object.keys(LIGHTS)) if (!seen.has(id)) err(`lights.js：${id} 不是存在的牌`);

/* ── 牌阵 ── */
const { spreads } = read('data/spreads.json');
const sIds = new Set();
for (const s of spreads) {
  const w = `牌阵 ${s.id}`;
  if (sIds.has(s.id)) err(`${w}：ID 重复`);
  sIds.add(s.id);
  zhen(s.name, `${w}.name`); zhen(s.sub, `${w}.sub`);
  if (!s.positions?.length) { err(`${w}：没有牌位`); continue; }
  const pIds = new Set(), cells = new Set();
  s.positions.forEach((p, i) => {
    if (pIds.has(p.id)) err(`${w}：位置 ID ${p.id} 重复`);
    pIds.add(p.id);
    const cell = `${p.x},${p.y}`;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) err(`${w}.positions[${i}]：缺少格位坐标`);
    if (cells.has(cell)) err(`${w}：格位 ${cell} 重复`);
    cells.add(cell);
    zhen(p.name, `${w}.positions[${i}].name`); zhen(p.meaning, `${w}.positions[${i}].meaning`);
  });
}
for (const need of ['daily', 'one', 'three', 'five']) if (!sIds.has(need)) err(`缺少牌阵 ${need}（代码里直接用到）`);

if (errors.length) {
  console.error(`数据校验失败（${errors.length} 项）：\n  - ${errors.join('\n  - ')}`);
  process.exit(1);
}
console.log(`数据校验通过：${cards.length} 张牌，${spreads.length} 个牌阵`);
