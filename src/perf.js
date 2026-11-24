// 设备画质分档：high / mid / low
// 1. 启动时按设备信号（内存、核数、系统、屏幕、省流量）估一个档位；
// 2. 运行中监测帧率，持续掉帧就自动降一档，并记住，下次直接用低一档；
// 3. 用户也可以在设置里手动指定（自动 / 高 / 中 / 低）。
// 档位只决定“花多少显存和算力在装饰上”，不影响占卜流程本身。

const PICK_KEY = 'naiwa-tarot-quality';     // 用户选择：auto | high | mid | low
const CAP_KEY = 'naiwa-tarot-perf-cap';     // 自动模式下因掉帧记住的上限
const ORDER = ['low', 'mid', 'high'];

export const TIERS = {
  // base：牌的基准渲染宽度（图层纹理 = base × 设备像素比）
  // dust：背景粒子数量倍率   dpr：粒子画布像素比上限
  // lights：每张牌最多几个光源（0 = 只保留静态微光，不做动画）
  // mb：洗牌运动模糊         spin：背景星图缓慢旋转
  high: { base: 360, dust: 1, dpr: 2, lights: 8, mb: true, spin: true },
  mid: { base: 300, dust: 0.6, dpr: 1.5, lights: 3, mb: true, spin: true },
  low: { base: 230, dust: 0.3, dpr: 1, lights: 0, mb: false, spin: false },
};

const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* 忽略 */ } };

/** 根据设备信号估计档位 */
function detect() {
  const ua = navigator.userAgent;
  const iOS = /iP(hone|od|ad)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const mem = navigator.deviceMemory;                 // 仅 Chromium 提供（GB，取整到 0.25~8）
  const cores = navigator.hardwareConcurrency || 4;
  const saveData = !!(navigator.connection && navigator.connection.saveData);
  const minSide = Math.min(screen.width, screen.height);
  const coarse = matchMedia('(pointer: coarse)').matches;

  let t = 2;                                           // 默认 high
  // 手机 / 平板：浏览器给单个页面的显存很紧（iOS 超限会直接杀掉页面），默认中档
  if (iOS || android || coarse) t = 1;
  if ((mem && mem <= 4) || cores <= 4) t = Math.min(t, 1);
  if ((mem && mem <= 2) || cores <= 2 || saveData) t = 0;
  if (iOS && minSide < 375) t = 0;                     // iPhone SE 一代等老小屏机型
  return ORDER[t];
}

const detected = detect();
let pick = read(PICK_KEY) || 'auto';
if (!(pick in TIERS) && pick !== 'auto') pick = 'auto';
let cap = read(CAP_KEY);

function resolve() {
  if (pick !== 'auto') return pick;
  if (cap in TIERS && ORDER.indexOf(cap) < ORDER.indexOf(detected)) return cap;
  return detected;
}

export const Q = {
  pick,                 // 用户选择
  detected,             // 设备估计
  tier: resolve(),      // 实际生效
  get p() { return TIERS[this.tier]; },
};

const subs = new Set();
export const onQuality = (fn) => { subs.add(fn); fn(Q.tier); };
function emit() {
  document.documentElement.dataset.q = Q.tier;
  subs.forEach((fn) => fn(Q.tier));
}
document.documentElement.dataset.q = Q.tier;

/** 用户在设置里切换 */
export function setQualityPick(v) {
  Q.pick = pick = v;
  write(PICK_KEY, v === 'auto' ? null : v);
  if (v === 'auto') { cap = null; write(CAP_KEY, null); }   // 回到自动时清掉以前的掉帧记录，重新评估
  Q.tier = resolve();
  emit();
}

/* ════════ 帧率监测：自动模式下持续掉帧就降一档 ════════
   每 90 帧算一次平均帧率；单帧超过 250ms 视为页面被挂起 / 后台节流，不计入。 */
let samples = [];
let lastT = 0;
let bad = 0;
let cooldown = performance.now() + 4000;   // 首屏解码图片、加载字体时的卡顿不算

export function tickFps(now) {
  if (pick !== 'auto' || document.hidden) { lastT = 0; return; }
  if (lastT) {
    const dt = now - lastT;
    if (dt < 250) samples.push(dt);
  }
  lastT = now;
  if (samples.length < 90) return;
  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  samples = [];
  if (now < cooldown) return;
  const fps = 1000 / avg;
  const i = ORDER.indexOf(Q.tier);
  // 门槛 28 帧：iPhone 低电量模式会把动画锁在 30 帧，不能把它误判成卡顿
  bad = fps < 28 ? bad + 1 : 0;
  if (bad >= 2 && i > 0) {              // 连续两段都低于门槛才降档，偶发卡顿不算
    bad = 0;
    Q.tier = ORDER[i - 1];
    cap = Q.tier;
    write(CAP_KEY, cap);
    cooldown = now + 4000;              // 降档后给 4 秒稳定，避免连降两档
    emit();
  }
}
