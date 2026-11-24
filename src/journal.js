// 本地记录：每日一签、连续天数、图鉴收集（只存在本机浏览器）
const KEY = 'naiwa-tarot-journal';
const J = { seed: '', daily: {}, collected: {}, streak: 0, last: '' };
try { Object.assign(J, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* 无存储时只在本次会话内有效 */ }
// 旧版本用两位数字做牌 ID（'21'），现在统一为 'major_21'
{
  const up = (id) => (/^\d\d$/.test(id) ? `major_${id}` : id);
  let changed = false;
  for (const id of Object.keys(J.collected)) {
    const n = up(id);
    if (n !== id) { J.collected[n] = (J.collected[n] || 0) + J.collected[id]; delete J.collected[id]; changed = true; }
  }
  for (const d of Object.values(J.daily)) { const n = up(d.id); if (n !== d.id) { d.id = n; changed = true; } }
  if (changed) setTimeout(save);
}
if (!J.seed) {
  J.seed = Array.from(crypto.getRandomValues(new Uint32Array(2)), (n) => n.toString(36)).join('');
  save();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(J)); } catch { /* 忽略 */ } }

const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => keyOf(new Date());
const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return keyOf(d); };

// FNV-1a：同一台设备、同一天得到同一个结果
function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** 今天的那张牌（ids 为可抽的牌 ID 列表）；已经抽过则返回记录。
 *  revRoll 是 0~1 的固定值，由调用方按当前逆位概率判断正逆 */
export function dailyFate(ids) {
  const k = todayKey();
  if (J.daily[k]) return { ...J.daily[k], drawn: true };
  const h = hash(`${J.seed}|${k}`);
  return { id: ids[h % ids.length], revRoll: (Math.floor(h / ids.length) % 1000) / 1000, drawn: false };
}

/** 记下今天的签并更新连续天数（同一天只记一次） */
export function recordDaily(id, reversed) {
  const k = todayKey();
  if (J.daily[k]) return;
  J.daily[k] = { id, reversed };
  J.streak = J.last === yesterdayKey() ? J.streak + 1 : 1;
  J.last = k;
  save();
}

/** 当前连续天数：昨天或今天抽过才算延续，否则归零 */
export function streak() {
  return J.last === todayKey() || J.last === yesterdayKey() ? J.streak : 0;
}
export const drawnToday = () => !!J.daily[todayKey()];

/** 图鉴：翻开过的牌计数 */
export function collect(id) {
  J.collected[id] = (J.collected[id] || 0) + 1;
  save();
}
export const collected = () => J.collected;
