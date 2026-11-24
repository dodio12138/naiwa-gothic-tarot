// 本地记录：每日一签、连续天数、图鉴收集（只存在本机浏览器）
const KEY = 'naiwa-tarot-journal';
const J = { seed: '', daily: {}, collected: {}, streak: 0, last: '' };
try { Object.assign(J, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* 无存储时只在本次会话内有效 */ }
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

/** 今天命中注定的那张牌；已经抽过则返回记录 */
export function dailyFate(total = 22) {
  const k = todayKey();
  if (J.daily[k]) return { ...J.daily[k], drawn: true };
  const h = hash(`${J.seed}|${k}`);
  return { id: pad(h % total), reversed: (Math.floor(h / total) % 100) < 40, drawn: false };
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
