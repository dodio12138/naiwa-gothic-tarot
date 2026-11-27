import './style.css';
import { gsap } from 'gsap';
import { CARDS, CARDS_EN, SPREADS, SPREADS_EN, GRID, artSrc, cardById, loreOf } from './cards.js';
import { createParticles } from './particles.js';
import { createAudio } from './audio.js';
import { lightsHTML } from './lights.js';
import { BILI, INSET, onInsetChange, toyQr, textIsSafe, saveToAlbum, sharePic, canAppShare, canAppSave } from './bili.js';
import { Q, onQuality, setQualityPick, tickFps } from './perf.js';
import { renderShare } from './share.js';
import { dailyFate, recordDaily, streak, drawnToday, collect, collected } from './journal.js';
import { t, getLang, setLang, titleCase } from './i18n.js';

/* ════════ 语言 ════════ */
const isEn = () => getLang() === 'en';
const spreadText = (key) => (isEn() ? SPREADS_EN[key] : SPREADS[key]);
const posName = (i) => spreadText(S.key).positions[i];
const cardName = (d) => (isEn() ? titleCase(d.en) : d.zh);
const cardText = (d) => (isEn() ? { ...d, ...CARDS_EN[d.id] } : d);
const lore = (d) => loreOf(d.id, isEn());
// 奶蛙的低语：原有一句 + lore.js 里的三句，每张抽到的牌固定随机一句（解读、详情、分享图保持一致）
function whisperOf(c) {
  if (c.wi == null) c.wi = Math.floor(rand() * 4);
  const pool = [cardText(c.data).whisper, ...(lore(c.data)?.whispers || [])];
  return pool[c.wi % pool.length];
}

/* ════════ 基础 ════════ */
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// 牌的基准尺寸：GPU 按这个尺寸 × 设备像素比生成图层纹理，再缩放显示。
// 22 张牌同时在场，尺寸过大会吃掉几百 MB 显存（iOS 超限会直接杀掉页面）。
// 取「画质档位上限」和「这块屏幕上牌最大会显示多宽」中较小的那个；每次开新一轮抽牌时重算。
// 桌面上没被选中的牌另用一个小尺寸 DECK：它们在牌堆 / 扇形里最大也只有一百多像素宽，
// 按揭示尺寸生成图层纯属浪费。被选中的那张才切换成 BASE（见 pick 里的 grow）。
let BASE = 360, DECK = 170;
function updateBase() {
  const small = Math.min(innerWidth, innerHeight) <= 760;
  BASE = Math.min(Q.p.base, small ? 260 : 360);
  DECK = Math.min(BASE, small ? 110 : 170);
  document.documentElement.style.setProperty('--card-w', `${BASE}px`);
  document.documentElement.style.setProperty('--deck-w', `${DECK}px`);
}
const baseOf = (c) => (c.el.classList.contains('deck') ? DECK : BASE);
updateBase();
const TAU = Math.PI * 2;
const BACK = `${import.meta.env.BASE_URL}back.webp`;
const UI = (f) => `${import.meta.env.BASE_URL}ui/${f}`;
const touch = matchMedia('(pointer: coarse)').matches;

// 图片素材通过 CSS 变量注入，保证相对路径部署时也正确
{
  // 必须转成绝对地址：CSS 变量里的相对 url() 会按“使用它的样式表”解析，
  // 线上样式表在 assets/ 下，相对路径会指到 assets/ui/… 而 404。
  const abs = (u) => new URL(u, document.baseURI).href;
  const r = document.documentElement.style;
  r.setProperty('--plate-img', `url("${abs(UI('plate.webp'))}")`);
  r.setProperty('--divider-img', `url("${abs(UI('divider.webp'))}")`);
  r.setProperty('--back-img', `url("${abs(BACK)}")`);
}

const $ = (s) => document.querySelector(s);
const stage = $('#stage');
const hint = $('#hint');
const intro = $('#intro');
const introFit = $('.intro-fit');
const introKids = () => [...introFit.querySelectorAll('.intro-a > *, .intro-b > *')];
const flash = $('#flash');
const reading = $('#reading');
const readingInner = $('#reading-inner');
const modal = $('#modal');
const btnRestart = $('#restart');
const btnRevealAll = $('#reveal-all');

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
// mobile：窄屏手机布局；sheet：解读面板从底部升起（手机 + 竖屏平板），否则从右侧滑入
const SHEET_MQ = matchMedia('(max-width: 760px), (orientation: portrait) and (max-width: 1100px)');
const vp = () => ({ W: innerWidth, H: innerHeight, mobile: innerWidth < 760, sheet: SHEET_MQ.matches });
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;


const fx = createParticles($('#fx'), { reduced, density: Q.p.dust, dprCap: Q.p.dpr });
const audio = createAudio();

/* ════════ 设置（本地记忆） ════════ */
const CFG_KEY = 'naiwa-tarot-settings';
const CFG = {
  autoDraw: false, autoReveal: false, skipIntro: false, reversed: true, revProb: 40,   // revProb：逆位概率（%）
  deck: 'full',   // full：完整 78 张；major：只用 22 张大阿卡纳
  parallax: true, lights: true, calm: false, sound: !audio.muted, ambient: true,
};
try { Object.assign(CFG, JSON.parse(localStorage.getItem(CFG_KEY) || '{}')); } catch { /* 无存储时用默认值 */ }
// 当前牌组
const deckCards = () => (CFG.deck === 'major' ? CARDS.filter((c) => c.arcana === 'major') : CARDS);
// 摆在桌上供选择的牌数：大屏摆满整副，平板 / 横屏 56 张，手机 44 张，低画质 33 张。
// 牌组先整体洗乱，再取最上面的若干张——每一张被选中的概率仍然相同
function fanCount(total) {
  const { W, H } = vp();
  let n = W >= 1100 && H >= 600 ? 78 : W >= 760 ? 56 : 44;
  if (Q.tier === 'low') n = Math.min(n, 33);
  return Math.min(total, n);
}
const revChance = () => (CFG.reversed ? clamp(+CFG.revProb || 0, 0, 100) / 100 : 0);
const saveCfg = () => { try { localStorage.setItem(CFG_KEY, JSON.stringify(CFG)); } catch { /* 忽略 */ } };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
addEventListener('pointerdown', audio.unlock, { passive: true });
addEventListener('keydown', audio.unlock);
if (import.meta.env.DEV) Object.assign(window, { __audio: audio, __gsap: gsap });

const S = {
  phase: 'intro',     // intro → dealing → pick → gather → reveal → done
  key: null,
  spread: null,
  question: '',
  cards: [],          // 全部 22 张（洗好顺序）
  picked: [],
  slots: [],
  readingOpen: false,
  busy: false,
  modalCard: null,
  auto: false,       // 一键抽牌进行中
  skipping: false,   // 快进洗牌中
};

function applySpeed() {
  gsap.globalTimeline.timeScale(S.skipping ? 8 : (reduced || CFG.calm ? 1.6 : 1));
}
applySpeed();

/* ════════ 预加载牌面 ════════
   首页先把带宽让给字体与首屏；入场动画结束、浏览器空闲时再后台预载 22 张牌面。
   翻牌前 reveal() 会再确认该张已解码，所以即使没预载完也不会翻出空白。 */
function preload(srcs) {
  srcs.forEach((src) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
  });
}
const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 300));
setTimeout(() => idle(() => preload([UI('frame-sm.webp')]), { timeout: 3000 }), 1800);

/* ════════ 背景法阵 ════════ */
function buildSigil() {
  $('#sigil').innerHTML = `<img src="${UI('starchart.webp')}" alt="" draggable="false">`;
  const spin = gsap.to('#sigil img', { rotation: 360, duration: 240, repeat: -1, ease: 'none' });
  return {
    spin,
    speed(v, d = 1) { gsap.to(spin, { timeScale: v, duration: d, ease: 'power2.inOut', overwrite: true }); },
  };
}
const sigil = buildSigil();

/* ════════ 画质档位（见 perf.js） ════════ */
onQuality(() => {
  fx.setQuality(Q.p.dust, Q.p.dpr);
  sigil.spin.paused(!Q.p.spin);
  if (S.phase !== 'intro' && !Q.p.mb) motionBlur(false);
  syncQualityUI();
});
gsap.ticker.add(() => tickFps(performance.now()));
{
  const sx = gsap.quickTo('#sigil', 'x', { duration: 1.6, ease: 'power3' });
  const sy = gsap.quickTo('#sigil', 'y', { duration: 1.6, ease: 'power3' });
  addEventListener('pointermove', (e) => {
    sx((e.clientX / innerWidth - 0.5) * -24);
    sy((e.clientY / innerHeight - 0.5) * -24);
  }, { passive: true });
}

/* ════════ 首页 ════════ */
let heroTl;
// 标题逐字拆分（入场动画按字错落）
function renderTitle() {
  const split = (el, txt) => { el.innerHTML = [...txt].map((ch) => `<span class="ch">${ch === ' ' ? '&nbsp;' : ch}</span>`).join(''); };
  split($('.title .t1'), t('titleSmall'));
  split($('.title .t2'), t('titleBig'));
}
function renderSpreads() {
  $('#spreads').innerHTML = Object.keys(SPREADS).filter((k) => SPREADS[k].home).map((k) => {
    const s = spreadText(k);
    return `
    <button class="spread-btn" type="button" data-spread="${k}"><span class="sb-in">
      <span class="pips" style="--n:${s.positions.length}">${s.positions.map((_, i) => `<i style="--i:${i}"></i>`).join('')}</span>
      <b class="plate">${s.name}</b><small>${s.sub.replace(/^(.+?) · /, '<span class="n">$1 · </span>')}</small>
    </span></button>`;
  }).join('');
}
function buildIntro() {
  renderTitle();
  renderSpreads();
  $('#spreads').addEventListener('click', (e) => {
    const b = e.target.closest('[data-spread]');
    if (b) { audio.unlock(); audio.click(); start(b.dataset.spread); }
  });
  $('#question').addEventListener('keydown', (e) => { if (e.key === 'Enter') start('three'); });

  // 悬浮小牌：不断翻面展示不同的牌
  const hc = $('#hero-card');
  hc.innerHTML = `<div class="hc-inner">
    <div class="hc-face hc-back"><img src="${BACK}" alt=""></div>
    <div class="hc-face hc-front"><img alt=""><img class="hc-frame" src="${UI('frame-sm.webp')}" alt=""></div></div>`;
  const inner = hc.querySelector('.hc-inner');
  const front = hc.querySelector('.hc-front img');
  let idx = Math.floor(rand() * CARDS.length);
  front.src = artSrc(CARDS[idx].id);
  // 牌在 -2 ~ -14px 之间浮动；影子固定在原地，牌越高影子越小越淡
  gsap.fromTo(hc, { y: -2 }, { y: -14, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  gsap.fromTo('.hero-shadow', { scaleX: 1, scaleY: 1, opacity: 1 }, { scaleX: 0.66, scaleY: 0.75, opacity: 0.45, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  gsap.to(hc, { rotation: 2, duration: 3.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  heroTl = gsap.timeline({ repeat: -1, delay: 1.6 })
    .to(inner, { rotationY: 180, duration: 1.2, ease: 'power3.inOut' })
    .to(inner, { rotationY: 360, duration: 1.2, ease: 'power3.inOut' }, '+=2.2')
    .add(() => {
      gsap.set(inner, { rotationY: 0 });
      idx = (idx + 1 + Math.floor(rand() * 5)) % CARDS.length;
      front.src = artSrc(CARDS[idx].id);
    }, '+=0.9');
}

function introIn() {
  document.body.classList.add('is-intro');
  intro.style.visibility = 'visible';
  intro.classList.remove('gone');
  const kids = introKids();
  gsap.set(kids, { clearProps: 'all' });
  const tl = gsap.timeline();
  tl.from('.hero-wrap', { y: 40, opacity: 0, scale: 0.8, duration: 1.2, ease: 'expo.out' })
    .from('.eyebrow', { opacity: 0, letterSpacing: '1.2em', duration: 1.2, ease: 'expo.out' }, 0.1)
    .from('.title-rule', { opacity: 0, scaleX: 0.2, duration: 1.2, ease: 'expo.out' }, 0.5)
    .from('.title .ch', {
      yPercent: 70, opacity: 0, filter: 'blur(14px)', rotationX: -60,
      duration: 1.1, ease: 'expo.out', stagger: 0.06,
    }, 0.2)
    .from(['.lede', '.question'], { y: 20, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.1 }, 0.6)
    .from('.spread-btn', { y: 30, opacity: 0, scale: 0.94, duration: 0.9, ease: 'expo.out', stagger: 0.08 }, 0.8)
    .from('.auto-toggle', { y: 30, opacity: 0, duration: 0.9, ease: 'expo.out' }, 0.96);
  heroTl?.play();
  return tl;
}

async function introOut() {
  heroTl?.pause();
  await gsap.to(introKids(), {
    y: -24, opacity: 0, filter: 'blur(10px)', duration: 0.55, ease: 'power2.in', stagger: 0.04,
  });
  intro.classList.add('gone');
  intro.style.visibility = 'hidden';
  document.body.classList.remove('is-intro');
}

/* ════════ 提示文字 ════════ */
let hintText = '';
let hintFn = null;
function hintBy(fn) { hintFn = fn; setHint(fn ? fn() : ''); }
function setHint(t) {
  if (t === hintText) return;
  hintText = t;
  gsap.to(hint, {
    opacity: 0, y: -6, duration: 0.2, ease: 'power1.in', overwrite: true,
    onComplete() {
      hint.textContent = hintText;
      gsap.fromTo(hint, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' });
    },
  });
}

/* ════════ 卡牌 DOM ════════ */
// 正面三层：插画（随视差移动）→ 边框（静止，SVG 蒙版只露出窗口外一圈）→ 编号铭牌（悬停显示）
// 光源数量随画质档位：桌面全部，手机只留最大的几个；大图详情至少保留 4 个
const lightCount = (size) => (size === 'full' ? Math.max(4, Q.p.lights) : Math.max(3, Q.p.lights));
const frontLayers = (id, size = 'sm') => `
  <div class="layers">
    <div class="art-wrap"><img class="art" src="${artSrc(id, size)}" alt="" draggable="false">${lightsHTML(id, lightCount(size))}</div>
    <div class="frame-wrap"><img class="frame" src="${UI(size === 'full' ? 'frame.webp' : 'frame-sm.webp')}" alt="" draggable="false"></div>
    <div class="plates" aria-hidden="true">
      <span class="plate pl-num"><b>${cardById(id).num}</b></span>
      <span class="plate pl-name"><b>${cardById(id).en}</b></span>
    </div>
  </div>`;

if (import.meta.env.DEV) window.__front = (id) => frontLayers(id, 'full');

function makeCard(data) {
  const el = document.createElement('div');
  el.className = 'card deck';   // deck：小尺寸、无 3D 图层，选中时去掉
  el.innerHTML = `
    <div class="aura"></div>
    <div class="lift">
      <div class="tilt"><div class="inner">
        <div class="face back"><img src="${BACK}" alt="" draggable="false"></div>
        <div class="face front"></div>
      </div></div>
      ${Q.p.mb ? `<img class="mb mbx" src="${UI('back-blur-x.webp')}" alt="" draggable="false">
      <img class="mb mby" src="${UI('back-blur-y.webp')}" alt="" draggable="false">` : ''}
    </div>`;
  const c = {
    el, data,
    inner: el.querySelector('.inner'),
    tilt: el.querySelector('.tilt'),
    aura: el.querySelector('.aura'),
    backFace: el.querySelector('.face.back'),
    mbx: el.querySelector('.mbx'),
    mby: el.querySelector('.mby'),
    bx: 0, by: 0, px: null, py: null,
    reversed: false, revealed: false, busy: false, slot: -1, fan: -1,
  };
  el.addEventListener('click', () => onCardClick(c));
  return c;
}

/* ════════ 视差：鼠标悬停 / 手机陀螺仪 ════════ */
const tilts = new Set();
const gyro = { x: 0, y: 0, on: false, base: null };

function attachTilt(host, tiltEl, max = 12) {
  gsap.set(tiltEl, { '--px': 0, '--py': 0 });
  const rx = gsap.quickTo(tiltEl, 'rotationX', { duration: 0.7, ease: 'power3' });
  const ry = gsap.quickTo(tiltEl, 'rotationY', { duration: 0.7, ease: 'power3' });
  const qx = gsap.quickTo(tiltEl, '--px', { duration: 0.7, ease: 'power3' });
  const qy = gsap.quickTo(tiltEl, '--py', { duration: 0.7, ease: 'power3' });
  const t = {
    host, hovering: false,
    set(px, py) {
      if (!CFG.parallax) { px = 0; py = 0; }
      ry(px * max); rx(-py * max); qx(px); qy(py);
    },
  };
  host.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || host.dataset.tilt !== 'on') return;
    t.hovering = true;
    const r = host.getBoundingClientRect();
    t.set(clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1), clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1));
  });
  host.addEventListener('pointerleave', () => { t.hovering = false; t.set(gyro.x, gyro.y); });
  tilts.add(t);
  return t;
}

function onOrient(e) {
  if (e.beta == null || e.gamma == null) return;
  if (!gyro.base) gyro.base = { b: e.beta, g: e.gamma };
  // 基准缓慢跟随，手机换个姿势握也会自动回中
  gyro.base.b += (e.beta - gyro.base.b) * 0.008;
  gyro.base.g += (e.gamma - gyro.base.g) * 0.008;
  gyro.x = clamp((e.gamma - gyro.base.g) / 18, -1, 1);
  gyro.y = clamp((e.beta - gyro.base.b) / 18, -1, 1);
  for (const t of tilts) if (t.host.dataset.tilt === 'on' && !t.hovering) t.set(gyro.x, gyro.y);
}
function enableGyro() {
  if (gyro.on || !touch || !('DeviceOrientationEvent' in window)) return;
  gyro.on = true;
  // 先挂监听（安卓等无需授权的浏览器直接生效），iOS 再弹授权框
  addEventListener('deviceorientation', onOrient);
  const D = window.DeviceOrientationEvent;
  if (typeof D.requestPermission === 'function') D.requestPermission().catch(() => {});
}
addEventListener('pointerdown', enableGyro, { passive: true });
if (import.meta.env.DEV) Object.assign(window, { __S: S, __gyro: gyro, __tilts: tilts });

/* ════════ 运动模糊 ════════
   预烘焙了牌背的横向 / 纵向模糊贴图；每帧根据牌在“自身坐标系”里的速度，
   交叉淡入对应方向的模糊层。只改 opacity，不触发重排，也不用实时滤镜。 */
const MB = { on: false };
function mbTick() {
  if (!MB.on) return;
  const dt = gsap.ticker.deltaRatio(60) || 1;
  for (const c of S.cards) {
    if (c.revealed || c.busy || !c.mbx) continue;
    const x = gsap.getProperty(c.el, 'x'), y = gsap.getProperty(c.el, 'y');
    if (c.px === null) { c.px = x; c.py = y; continue; }
    const dx = (x - c.px) / dt, dy = (y - c.py) / dt;
    c.px = x; c.py = y;
    const th = rad(gsap.getProperty(c.el, 'rotation'));
    const cos = Math.cos(th), sin = Math.sin(th);
    const lx = dx * cos + dy * sin;          // 牌自身的横向速度
    const ly = -dx * sin + dy * cos;         // 牌自身的纵向速度
    const w = baseOf(c) * gsap.getProperty(c.el, 'scale');
    const tx = clamp((Math.abs(lx) / w - 0.04) * 3.4, 0, 1);
    const ty = clamp((Math.abs(ly) / w - 0.04) * 3.4, 0, 1);
    const nbx = c.bx + (tx - c.bx) * 0.45, nby = c.by + (ty - c.by) * 0.45;
    if (Math.abs(nbx - c.bx) + Math.abs(nby - c.by) < 0.004 && tx === 0 && ty === 0 && c.bx < 0.01 && c.by < 0.01) continue;
    c.bx = nbx < 0.01 ? 0 : nbx; c.by = nby < 0.01 ? 0 : nby;
    c.mbx.style.opacity = c.bx.toFixed(3);
    c.mby.style.opacity = c.by.toFixed(3);
    // 牌背只在模糊层接近不透明时才淡出：中间阶段两层都半透明会叠出透明感，透出背后的牌位框
    const m = Math.max(c.bx, c.by);
    c.backFace.style.opacity = (1 - clamp((m - 0.6) / 0.4, 0, 1) * 0.9).toFixed(3);
  }
}
gsap.ticker.add(mbTick);
function motionBlur(on) {
  MB.on = on && !reduced && Q.p.mb;
  if (!MB.on) for (const c of S.cards) {
    c.bx = c.by = 0; c.px = c.py = null;
    if (!c.mbx) continue;
    c.mbx.style.opacity = 0; c.mby.style.opacity = 0; c.backFace.style.opacity = '';
  }
}

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ════════ 布局几何 ════════ */
function deckScale() {
  const { W, H } = vp();
  return clamp(Math.min(W * 0.17, H * 0.16), 96, 170) / DECK;
}

function fanGeom(n) {
  const { W, H, mobile } = vp();
  const fw = mobile ? clamp(W * 0.19, 60, 92) : clamp(Math.min(W * 0.075, H * 0.13), 52, 108);
  const fh = fw * 1.5;
  // 扇形总张角固定，每张牌的角度间隔按张数均分；牌多时桌面版张得更开一些
  const full = mobile ? 76 : (n > 30 ? 82 : 63);
  const step = full / Math.max(n - 1, 1);
  const targetW = Math.min(W * (mobile ? 0.86 : 0.92) - fw, 1150);
  const R = targetW / (2 * Math.sin(rad(full / 2)));
  const sag = R * (1 - Math.cos(rad(full / 2)));
  const pad = (mobile ? Math.max(48, H * 0.08) : 40) + INSET.b;
  // 两端的牌斜着垂下来：横屏手机、矮窗口时要保证最外侧的牌角也留在屏幕里
  const half = rad(full / 2);
  const edgeExt = (fh / 2) * Math.cos(half) + (fw / 2) * Math.sin(half);
  const centerY = Math.min(H - fh * 0.5 - pad - sag * 0.55, H - 10 - INSET.b - sag - edgeExt);
  const cy = centerY + R;
  const spread = step * (n - 1);
  const angle = (i) => -spread / 2 + step * i;
  const posAt = (aDeg, lift = 0, k = 1) => {
    const a = rad(aDeg), r = R + lift;
    return { x: W / 2 + r * Math.sin(a), y: cy - r * Math.cos(a), rotation: aDeg, scale: (fw / DECK) * k };
  };
  return {
    top: centerY - fh * 0.5 - fh * 0.16,
    cx: W / 2, cy, R, fw, fh, step, angle, posAt,
    pos: (i) => posAt(angle(i)),
  };
}

function pickSlotGeom(n) {
  const { W, mobile } = vp();
  const f = fanGeom(22);
  const y0 = (mobile ? 62 : 80) + INSET.t;
  const y1 = f.top - (mobile ? 30 : 46);
  const availH = Math.max(80, y1 - y0);
  const gap = mobile ? 12 : 28;
  let h = Math.min(availH, mobile ? 230 : 340);
  let w = h / 1.5;
  const maxW = (W * 0.92 - gap * (n - 1)) / n;
  if (w > maxW) { w = maxW; h = w * 1.5; }
  const cy = y0 + availH / 2;
  return Array.from({ length: n }, (_, i) => ({ x: W / 2 + (i - (n - 1) / 2) * (w + gap), y: cy, w, h }));
}


// 揭示布局：默认按牌阵的十字 / 横排摆放；若改成一行横排能让牌明显更大
// （横屏手机、手机上解读面板打开时只剩上半屏），就改用横排，牌名标签照常跟着牌位
function revealSlotGeom() {
  const grid = GRID[S.key];
  const a = slotGeomFor(grid);
  if (grid.length < 4) return a;
  const row = grid.map((_, i) => [i - (grid.length - 1) / 2, 0]);
  const b = slotGeomFor(row);
  return b[0].w > a[0].w * 1.25 ? b : a;   // 横排按牌位顺序，和解读面板的顺序一致
}
function slotGeomFor(g) {
  const { W, H, mobile, sheet } = vp();
  const area = { x0: INSET.l, x1: W - INSET.r, y0: (mobile ? 58 : 76) + INSET.t, y1: H - (mobile ? 34 : 44) - INSET.b };
  if (S.readingOpen) {
    if (sheet) area.y1 = H * 0.44 - 4;
    else area.x1 = W - Math.min(440, W * 0.38);
  }
  const cols = Math.max(...g.map(([x]) => Math.abs(x))) * 2 + 1;
  const rows = Math.max(...g.map(([, y]) => Math.abs(y))) * 2 + 1;
  const sx = 1.14;
  const label = mobile ? 40 : 54;   // 标签两行：位置 + 牌名
  const byW = ((area.x1 - area.x0) * 0.92) / ((cols - 1) * sx + 1);
  // 行距至少要容得下牌下方的标签，否则上一排的标签会被下一排的牌盖住
  let sy = 1.16, w = 0;
  for (let k = 0; k < 3; k++) {
    const byH = ((area.y1 - area.y0 - label) * 0.94) / (((rows - 1) * sy + 1) * 1.5);
    w = Math.min(byW, byH, mobile ? 260 : 330);
    if (rows === 1) break;
    sy = Math.max(1.16, 1 + (label + 10) / (w * 1.5));
  }
  const h = w * 1.5;
  const cx = (area.x0 + area.x1) / 2;
  const cy = (area.y0 + area.y1) / 2 - label / 2;
  return g.map(([gx, gy]) => ({ x: cx + gx * w * sx, y: cy + gy * h * sy, w, h }));
}

/* ════════ 流程 ════════ */
async function start(key) {
  if (S.busy || S.phase !== 'intro') return;
  S.busy = true;
  S.key = key;
  S.spread = SPREADS[key];
  S.question = $('#question').value.trim();
  S.phase = 'dealing';
  S.fate = key === 'daily' ? dailyFate(deckCards().map((c) => c.id)) : null;
  S.replay = !!(S.fate && S.fate.drawn);   // 今天已经抽过：快速重放到揭示
  S.auto = CFG.autoDraw || S.replay;
  await introOut();
  hintBy(() => t(S.replay ? 'hDailyAgain' : S.auto ? 'hShuffleAuto' : 'hShuffle'));
  buildDeck();                       // 牌背立即可用；牌面在后台预载，翻牌前再确认
  motionBlur(true);
  if (CFG.skipIntro || S.replay) setSkipping(true);
  else { btnSkip.hidden = false; gsap.fromTo(btnSkip, { opacity: 0 }, { opacity: 1, duration: 0.5 }); }
  await dealIn();
  await shuffleAnim();
  buildSlots();
  await fanOut();
  fanReady(true);
  setSkipping(false);
  S.busy = false;
  btnRestart.hidden = false;
  gsap.fromTo(btnRestart, { opacity: 0 }, { opacity: 1, duration: 0.6 });
  if (S.auto) autoPick();
}

function setSkipping(on) {
  S.skipping = on;
  btnSkip.hidden = true;
  applySpeed();
}

// 一键抽牌：命运之手依次替你抽牌
async function autoPick() {
  hintBy(() => t('hAutoPick'));
  while (S.phase === 'pick' && S.picked.length < S.slots.length) {
    await wait(CFG.calm ? 380 : 700);
    if (S.phase !== 'pick') break;
    const rest = S.cards.filter((c) => c.slot < 0);
    const idx = Math.floor(rand() * rest.length);
    setHot(idx);
    await wait(CFG.calm ? 160 : 340);
    if (S.phase !== 'pick') break;
    pick(rest[idx]);
  }
}

function buildDeck() {
  updateBase();   // 画质可能在上一轮中途被自动下调，新一轮按新档位建牌
  stage.innerHTML = '';
  // 洗牌时就锁定每张牌的顺序与朝向：之后选哪张、何时翻开，都不会改变它本来的正逆
  const p = revChance();
  S.cards = shuffled(deckCards()).slice(0, fanCount(deckCards().length)).map((d) => Object.assign(makeCard(d), { reversed: rand() < p }));
  // 牌面只预载摆出来的这几张（今日一签再加上注定的那张）
  preload([...S.cards.map((c) => artSrc(c.data.id)), ...(S.fate ? [artSrc(S.fate.id)] : [])]);
  S.picked = [];
  const { W, H } = vp();
  const s = deckScale();
  S.cards.forEach((c, i) => {
    stage.appendChild(c.el);
    gsap.set(c.el, {
      x: W / 2 + (rand() - 0.5) * 200, y: H + 300, scale: s, rotation: (rand() - 0.5) * 60, zIndex: i + 1,
    });
    attachTilt(c.el, c.tilt);
  });
}

function stackPos(i) {
  const { W, H } = vp();
  return { x: W / 2, y: H / 2 - i * 0.6, rotation: (rand() - 0.5) * 4 };
}

function dealIn() {
  const tl = gsap.timeline();
  const each = Math.min(0.028, 1.1 / S.cards.length);   // 张数多时总时长封顶
  const every = Math.max(1, Math.round(S.cards.length / 24));
  S.cards.forEach((c, i) => {
    tl.to(c.el, { ...stackPos(i), duration: 0.9, ease: 'expo.out' }, i * each);
    if (i % every === 0) tl.add(() => audio.deal(), i * each + 0.06);
  });
  tl.to(fx.state, { glow: 0.6, duration: 0.6, yoyo: true, repeat: 1 }, 0);
  return tl;
}

function shuffleAnim() {
  const { W, H } = vp();
  const cx = W / 2, cy = H / 2;
  const rx = Math.min(W * 0.36, 440), ry = Math.min(H * 0.24, 230);
  const n = S.cards.length;
  const base = deckScale();
  const tl = gsap.timeline();

  // 1. 漩涡展开
  tl.add(() => sigil.speed(16, 1.2), 0);
  tl.add(() => audio.shuffle(0.05 + n * 0.012 + 0.75 + 1.15 + 0.7), 0);
  tl.to(fx.state, { vortex: 1, duration: 1.1, ease: 'power2.in' }, 0);
  tl.to('#sigil', { opacity: 0.85, duration: 1 }, 0);
  const place = (c, i, t) => {
    const a = (i / n) * TAU + t * TAU * 1.15 - Math.PI / 2;
    const depth = Math.sin(a);                   // -1 远 ~ 1 近
    return {
      x: cx + Math.cos(a) * rx,
      y: cy + depth * ry,
      rotation: deg(a) + 90,
      scale: base * (0.86 + 0.2 * (depth + 1) / 2),
      zIndex: Math.round(100 + depth * 50),
    };
  };
  S.cards.forEach((c, i) => {
    const p = place(c, i, 0);
    tl.to(c.el, { x: p.x, y: p.y, rotation: p.rotation, scale: p.scale, duration: 0.75, ease: 'power3.out' }, 0.05 + i * 0.012);
    tl.set(c.el, { zIndex: p.zIndex }, 0.05 + i * 0.012);
  });
  // 2. 绕轨道旋转
  const orbit = { t: 0 };
  const t0 = 0.05 + n * 0.012 + 0.75;
  tl.to(orbit, {
    t: 1, duration: 1.15, ease: 'power1.inOut',
    onUpdate() { S.cards.forEach((c, i) => gsap.set(c.el, place(c, i, orbit.t))); },
  }, t0);
  // 3. 收拢回牌堆
  const t1 = t0 + 1.15;
  const order = shuffled(S.cards.map((_, i) => i));
  S.cards.forEach((c, i) => {
    const k = order[i];
    tl.to(c.el, { ...stackPos(k), scale: base, duration: 0.6, ease: 'power3.inOut' }, t1 + k * 0.012);
    tl.set(c.el, { zIndex: k + 1 }, t1 + k * 0.012 + 0.3);
  });
  tl.add(() => sigil.speed(1, 1.6), t1);
  tl.to(fx.state, { vortex: 0, duration: 1.2, ease: 'power2.out' }, t1);
  tl.to('#sigil', { opacity: 0.5, duration: 1.4 }, t1);
  // 4. 鸽尾洗牌
  const t2 = t1 + 0.6 + n * 0.012 + 0.05;
  const dw = DECK * base;
  const sorted = S.cards.slice().sort((a, b) => gsap.getProperty(a.el, 'zIndex') - gsap.getProperty(b.el, 'zIndex'));
  for (let r = 0; r < 1; r++) {
    const left = sorted.filter((_, i) => i % 2 === 0);
    const right = sorted.filter((_, i) => i % 2 === 1);
    const tt = t2 + r * 0.9;
    tl.add(() => audio.riffle(8, 0.2), tt);
    tl.add(() => audio.riffle(22, 0.5), tt + 0.38);
    tl.to(left.map((c) => c.el), { x: cx - dw * 0.6, rotation: -10, duration: 0.32, ease: 'power3.out', stagger: 0.004 }, tt);
    tl.to(right.map((c) => c.el), { x: cx + dw * 0.6, rotation: 10, duration: 0.32, ease: 'power3.out', stagger: 0.004 }, tt);
    tl.to(sorted.map((c) => c.el), {
      x: cx, rotation: () => (rand() - 0.5) * 4, duration: 0.42, ease: 'power3.inOut', stagger: { each: 0.012, from: 'end' },
    }, tt + 0.38);
  }
  tl.add(() => fx.burst(cx, cy, { count: 50, power: 0.6 }), '-=0.1');
  return tl;
}

function buildSlots() {
  S.slots = S.spread.positions.map((_, i) => {
    const el = document.createElement('div');
    el.className = 'slot';
    el.innerHTML = `<span class="ghost-frame"></span><span class="label"></span>`;
    stage.insertBefore(el, stage.firstChild);
    const slot = { el, i, card: null };
    renderSlotLabel(slot);
    return slot;
  });
  const geo = pickSlotGeom(S.slots.length);
  S.slots.forEach((s, i) => {
    const g = geo[i];
    gsap.set(s.el, { x: g.x, y: g.y, width: g.w, height: g.h, xPercent: -50, yPercent: -50 });
  });
}

// 牌位标签：位置名；翻开后加上牌名与逆位小标
function renderSlotLabel(slot) {
  const c = slot.card;
  slot.el.querySelector('.label').innerHTML = posName(slot.i)
    + (c ? `<em>${cardName(c.data)}${c.reversed ? `<small>${t('revTag')}</small>` : ''}</em>` : '');
}

function fanOut() {
  const cards = S.cards.slice().sort((a, b) => gsap.getProperty(a.el, 'zIndex') - gsap.getProperty(b.el, 'zIndex'));
  S.cards = cards;
  const f = fanGeom(cards.length);
  const tl = gsap.timeline();
  tl.add(() => audio.fan(), 0);
  cards.forEach((c, i) => {
    c.fan = i;
    gsap.set(c.el, { zIndex: 10 + i });
    tl.to(c.el, { ...f.pos(i), duration: 1.0, ease: 'expo.out' }, Math.abs(i - (cards.length - 1) / 2) * 0.02);
  });
  tl.fromTo(S.slots.map((s) => s.el), { opacity: 0, scale: 0.9 }, {
    opacity: 1, scale: 1, duration: 0.8, ease: 'expo.out', stagger: 0.08,
  }, 0.3);
  tl.add(() => {
    S.phase = 'pick';
    updatePickHint();
    cards.forEach((c) => c.el.classList.add('in-fan'));
  }, 0.6);
  return tl;
}

/* ════════ 磁吸选牌 ════════
   按指针相对扇形圆心的角度直接算出最近的牌（不靠重叠的 DOM 命中，切换稳定），
   高亮牌沿半径抬起放大、两侧像 Dock 一样让开；位置由 quickTo 实时跟随。 */
const FAN = { hot: -1, ready: false, pressed: false, mx: -1, my: -1, mouse: false };
const fanRest = () => S.cards.filter((c) => c.slot < 0);

function fanApply() {
  const rest = fanRest();
  if (!rest.length) return;
  const f = fanGeom(rest.length);
  const h = FAN.hot;
  rest.forEach((c, i) => {
    c.fan = i;
    let a = f.angle(i), lift = 0, k = 1;
    if (h >= 0) {
      const d = i - h;
      if (d === 0) { lift = f.fh * 0.36; k = 1.04; }
      else a += Math.sign(d) * f.step * 0.22;   // 两侧只让出一小块
    }
    const p = f.posAt(a, lift, k);
    if (c.q) { c.q.x(p.x); c.q.y(p.y); c.q.r(p.rotation); c.q.s(p.scale); }
    else gsap.to(c.el, { ...p, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
    c.el.classList.toggle('hot', i === h);
    c.el.style.zIndex = 10 + i;   // 叠放层级保持不变
  });
}
function setHot(i) {
  if (i === FAN.hot) return;
  FAN.hot = i;
  if (i >= 0) audio.hover(i);
  fanApply();
}
function fanReady(on) {
  FAN.ready = on;
  FAN.hot = -1;
  FAN.pressed = false;
  document.body.classList.toggle('picking', on);
  for (const c of fanRest()) {
    if (on) {
      const o = { duration: 0.38, ease: 'power3' };
      c.q = { x: gsap.quickTo(c.el, 'x', o), y: gsap.quickTo(c.el, 'y', o), r: gsap.quickTo(c.el, 'rotation', o), s: gsap.quickTo(c.el, 'scale', o) };
    } else if (c.q) {
      gsap.killTweensOf(c.el, 'x,y,rotation,scale');
      c.q = null;
      c.el.classList.remove('hot');
    }
  }
}
// 指针 → 牌序号；带迟滞，避免在两张牌交界处来回跳
function fanIndexAt(px, py) {
  const rest = fanRest();
  if (!rest.length) return -1;
  const f = fanGeom(rest.length);
  const dx = px - f.cx, dy = f.cy - py;
  const r = Math.hypot(dx, dy);
  if (r < f.R - f.fh * 0.8 || r > f.R + f.fh * 1.2) return -1;   // 上沿放宽，抬高后的牌顶部也算在内
  const th = deg(Math.atan2(dx, dy));
  const a0 = f.angle(0), a1 = f.angle(rest.length - 1);
  if (th < a0 - f.step * 1.6 || th > a1 + f.step * 1.6) return -1;
  if (FAN.hot >= 0 && FAN.hot < rest.length && Math.abs(th - f.angle(FAN.hot)) < f.step * 0.7) return FAN.hot;
  return clamp(Math.round((th - a0) / f.step), 0, rest.length - 1);
}
const fanActive = () => S.phase === 'pick' && FAN.ready && !S.auto && S.picked.length < S.slots.length;
addEventListener('pointermove', (e) => {
  FAN.mx = e.clientX; FAN.my = e.clientY; FAN.mouse = e.pointerType === 'mouse';
  if (!fanActive()) return;
  if (e.pointerType === 'mouse' || FAN.pressed) setHot(fanIndexAt(e.clientX, e.clientY));
}, { passive: true });
addEventListener('pointerdown', (e) => {
  if (!fanActive() || e.button > 0) return;
  const i = fanIndexAt(e.clientX, e.clientY);
  if (i < 0) return;
  FAN.pressed = true;
  setHot(i);
});
addEventListener('pointerup', () => {
  if (!FAN.pressed) return;
  FAN.pressed = false;
  if (fanActive() && FAN.hot >= 0) pick(fanRest()[FAN.hot]);
});
addEventListener('pointercancel', () => { FAN.pressed = false; });
document.addEventListener('pointerleave', () => { if (fanActive() && !FAN.pressed) setHot(-1); });
addEventListener('keydown', (e) => {
  if (!fanActive()) return;
  const n = fanRest().length;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    const base = FAN.hot < 0 ? Math.floor(n / 2) : FAN.hot + (e.key === 'ArrowLeft' ? -1 : 1);
    setHot(clamp(base, 0, n - 1));
  } else if ((e.key === 'Enter' || e.key === ' ') && FAN.hot >= 0 && document.activeElement?.tagName !== 'INPUT') {
    e.preventDefault();
    pick(fanRest()[FAN.hot]);
  }
});

function updatePickHint() {
  hintBy(() => {
    const left = S.slots.length - S.picked.length;
    return left > 0 ? t('hPick')(left, posName(S.picked.length)) : t('hPicked');
  });
}

function onCardClick(c) {
  if (S.phase === 'pick' && c.slot < 0) { if (!FAN.ready) pick(c); return; }
  if (S.phase === 'reveal' && !c.revealed) return reveal(c);
  if (c.revealed && !c.busy) return openModal(c);
}

// 换掉一张牌的正面（每日一签用）
function setFace(card, data) {
  card.data = data;
  const front = card.el.querySelector('.face.front');
  front.setAttribute('aria-label', `${data.zh} · ${titleCase(data.en)}`);
  front.innerHTML = `${frontLayers(data.id)}<div class="sheen"></div><div class="glare"></div>`;
}

function pick(c) {
  if (S.picked.length >= S.slots.length) return;
  c.el.classList.remove('in-fan', 'chosen', 'hot');   // 清掉高亮抬起，否则落位后整张牌会高出牌位
  if (c.q) { gsap.killTweensOf(c.el, 'x,y,rotation,scale'); c.q = null; }
  c.slot = S.picked.length;
  S.picked.push(c);
  if (S.fate) {
    // 今日一签是特例：同一台设备同一天固定同一张牌，所以在选中时把那张牌换到手上
    const fated = S.cards.find((x) => x.data.id === S.fate.id);
    if (fated && fated !== c) [c.data, fated.data] = [fated.data, c.data];
    else if (!fated) c.data = cardById(S.fate.id);   // 注定的牌不在桌面上的 22 张里：直接换到手上
    c.reversed = S.fate.drawn ? S.fate.reversed : S.fate.revRoll < revChance();
  }
  c.el.classList.toggle('reversed', c.reversed);
  // grow：从桌面的小尺寸换成揭示用的大尺寸，同时按比例改 scale，画面上大小不跳
  const sc = gsap.getProperty(c.el, 'scale');
  c.el.classList.remove('deck');
  gsap.set(c.el, { scale: sc * DECK / BASE });
  c.wi = Math.floor(rand() * 4);   // 低语也在此时定下，刷新恢复后保持同一句
  setFace(c, c.data);   // 牌面只给选中的牌生成：没选中的牌永远不会翻开，省掉它们的正面图层

  // 余下的牌合拢；鼠标不动也立刻按当前位置找到下一张最近的牌
  FAN.hot = -1;
  if (FAN.mouse && fanActive()) FAN.hot = fanIndexAt(FAN.mx, FAN.my);
  fanApply();

  // 飞向牌位（x/y 不同缓动 → 弧线轨迹）
  const slot = S.slots[c.slot];
  const g = pickSlotGeom(S.slots.length)[c.slot];
  const s = g.w / BASE;
  gsap.set(c.el, { zIndex: 300 + c.slot });
  // 牌位层在牌之上（为了让标签不被遮住），所以牌飞过去之前先把目标框收掉，否则框会画在飞行中的牌上面
  slot.el.classList.add('incoming');
  audio.pick();
  const tl = gsap.timeline();
  tl.to(c.el, { x: g.x, duration: 0.85, ease: 'power2.inOut' }, 0)
    .to(c.el, { y: g.y, duration: 0.85, ease: 'back.inOut(1.4)' }, 0)
    .to(c.el, { rotation: 0, duration: 0.85, ease: 'power3.inOut' }, 0)
    .to(c.el, { scale: s * 1.12, duration: 0.5, ease: 'power2.out' }, 0)
    .to(c.el, { scale: s, duration: 0.35, ease: 'power2.in' }, 0.5)
    .add(() => {
      slot.el.classList.add('filled');
      audio.land();
      fx.burst(g.x, g.y + g.h / 2, { count: 26, power: 0.45 });
      gsap.fromTo(c.aura, { opacity: 0.8 }, { opacity: 0, duration: 0.8 });
    }, 0.82);

  updatePickHint();
  if (S.picked.length === S.slots.length) {
    S.phase = 'gather';
    tl.add(() => afterPick(), '+=0.15');
  }
}

async function afterPick() {
  fanReady(false);
  const rest = S.cards.filter((c) => c.slot < 0);
  rest.forEach((c) => c.el.classList.remove('in-fan'));
  const { W, H } = vp();
  audio.gather();
  // 剩余牌收拢并沉没
  await gsap.timeline()
    .to(rest.map((c) => c.el), { x: W / 2, rotation: 0, duration: 0.5, ease: 'power3.in', stagger: { each: 0.01, from: 'edges' } })
    .to(rest.map((c) => c.el), { y: H + 300, opacity: 0, duration: 0.6, ease: 'power3.in', stagger: 0.008 }, '-=0.15');
  rest.forEach((c) => c.el.remove());
  S.cards = S.picked.slice();
  motionBlur(false);
  S.phase = 'reveal';
  saveSession();
  await layoutReveal(0.9);
  S.picked.forEach((c) => c.el.classList.add('revealable'));
  hintBy(() => t(S.picked.length > 1 ? 'hRevealMany' : 'hRevealOne'));
  if (S.auto || CFG.autoReveal) {
    hintBy(() => t('hRevealing'));
    gsap.delayedCall(0.5, revealAll);
  } else if (S.picked.length > 1) {
    btnRevealAll.hidden = false;
    gsap.fromTo(btnRevealAll, { opacity: 0, x: 10 }, { opacity: 1, x: 0, duration: 0.5 });
  }
}

function layoutReveal(d = 0.8) {
  const geo = revealSlotGeom();
  const tl = gsap.timeline();
  const compact = geo[0].w < 84;
  tl.to(stage.querySelectorAll('.slot .label'), { opacity: compact ? 0 : 1, duration: 0.3 }, 0);
  S.slots.forEach((s, i) => {
    const g = geo[i];
    tl.to(s.el, { x: g.x, y: g.y, width: g.w, height: g.h, duration: d, ease: 'expo.inOut' }, i * 0.04);
  });
  S.picked.forEach((c) => {
    const g = geo[c.slot];
    tl.to(c.el, { x: g.x, y: g.y, scale: g.w / BASE, rotation: 0, duration: d, ease: 'expo.inOut' }, c.slot * 0.04);
  });
  return tl;
}

function flashAt(x, y, size) {
  gsap.fromTo(flash, { x, y, scale: size / 300, opacity: 0.95 }, { scale: (size / 300) * 3, opacity: 0, duration: 1.1, ease: 'power2.out' });
}

function reveal(c) {
  if (c.busy || c.revealed) return Promise.resolve();
  const art = c.el.querySelector('.art');
  if (!art.complete) {
    c.busy = true;
    art.decode().catch(() => {}).finally(() => { c.busy = false; reveal(c); });
    return Promise.resolve();
  }
  c.busy = true;
  c.el.classList.remove('revealable');
  const g = revealSlotGeom()[c.slot];
  const s = g.w / BASE;
  const dark = c.data.dark;
  const colors = dark ? ['#c2334f', '#7a1d36', '#e9d39a', '#ff7a5c', '#b39963'] : undefined;
  gsap.set(c.el, { zIndex: 400 });

  const tl = gsap.timeline({
    onComplete() {
      c.busy = false;
      c.revealed = true;
      if (!S.replay) collect(c.data.id);
      if (S.key === 'daily' && !S.replay) recordDaily(c.data.id, c.reversed);
      c.el.classList.add('revealed');
      c.el.dataset.tilt = 'on';
      gsap.set(c.el, { zIndex: 300 + c.slot });
      saveSession();
      onRevealed();
    },
  });
  tl.add(() => audio.charge(0.5), 0)
    .add(() => audio.flip(), 0.5)
    .add(() => audio.reveal(dark), 0.9)
    .to(c.aura, { opacity: 1, scale: 1.15, duration: 0.5, ease: 'power2.in' }, 0)
    .to(c.el, { y: g.y - g.h * 0.05, duration: 0.5, ease: 'power2.out' }, 0)
    .fromTo(c.tilt, { rotationZ: -1.5 }, { rotationZ: 1.5, duration: 0.05, repeat: 7, yoyo: true, ease: 'none' }, 0.12)
    .to(c.tilt, { rotationZ: 0, duration: 0.08 }, 0.56)
    .to(c.inner, { rotationY: 180, duration: 0.95, ease: 'power3.inOut' }, 0.5)
    .to(c.el, { scale: s * 1.14, duration: 0.48, ease: 'power2.out' }, 0.5)
    .add(() => {
      flashAt(g.x, g.y, g.w);
      fx.burst(g.x, g.y, { count: 120, power: clamp(g.w / 180, 0.6, 1.6), colors });
      c.el.classList.add('shine', 'show-plates');
      gsap.delayedCall(2.4, () => c.el.classList.remove('show-plates'));
      if (!reduced && !CFG.calm) gsap.fromTo(stage, { x: 0 }, { x: 3, duration: 0.05, repeat: 5, yoyo: true, ease: 'none', clearProps: 'x' });
    }, 0.9)
    .to(c.el, { scale: s, y: g.y, duration: 0.8, ease: 'expo.out' }, 0.98)
    .to(c.aura, { opacity: 0.22, scale: 1, duration: 1.2, ease: 'power2.out' }, 1.0);

  // 牌位标签换成牌名
  const label = S.slots[c.slot].el.querySelector('.label');
  tl.add(() => {
    gsap.to(label, {
      opacity: 0, duration: 0.2,
      onComplete() {
        S.slots[c.slot].card = c;
        renderSlotLabel(S.slots[c.slot]);
        gsap.to(label, { opacity: 1, duration: 0.4 });
      },
    });
  }, 1.0);
  return tl;
}

function onRevealed() {
  const left = S.picked.filter((c) => !c.revealed).length;
  if (left > 0) return;
  btnRevealAll.hidden = true;
  S.phase = 'done';
  hintBy(() => t(S.key === 'daily' ? 'hDailyDone' : 'hDone'));
  gsap.delayedCall(0.7, openReading);
}

async function revealAll() {
  btnRevealAll.hidden = true;
  const list = S.picked.filter((c) => !c.revealed && !c.busy);
  for (const c of list) {
    reveal(c);
    await new Promise((r) => setTimeout(r, 420));
  }
}

function placeSigil(d = 1.1) {
  const { W, H, sheet } = vp();
  let cx = W / 2, cy = H / 2;
  if (S.readingOpen) {
    if (sheet) cy = H * 0.22;
    else cx = (W - Math.min(440, W * 0.38)) / 2;
  }
  gsap.to('#sigil', { left: cx, top: cy, duration: d, ease: 'expo.inOut', overwrite: 'auto' });
}

/* ════════ 解读面板 ════════ */
function readingHTML() {
  return `
    <div class="r-head">
      <div class="r-eyebrow">THE READING</div>
      <h2>${spreadText(S.key).name}</h2>
      ${S.key === 'daily' ? `<p class="r-streak">${t('streak')(Math.max(1, streak()))} · ${t('comeTomorrow')}</p>` : ''}
      ${S.question ? `<p class="r-q">${esc(S.question)}</p>` : ''}
      <i class="rule"></i>
    </div>
    ${S.picked.map((c) => {
      const d = cardText(c.data);
      return `
      <div class="r-item" data-slot="${c.slot}">
        <div class="r-thumb ${c.reversed ? 'rev' : ''}"><img src="${artSrc(d.id)}" alt=""></div>
        <div>
          <div class="r-pos">${posName(c.slot)}</div>
          <div class="r-name">${cardName(d)}<small>${d.num}${isEn() ? '' : ` · ${d.en}`}</small>
            <span class="badge ${c.reversed ? 'rev' : 'up'}">${t(c.reversed ? 'reversed' : 'upright')}</span></div>
          <p class="r-text">${c.reversed ? d.rev : d.up}</p>
          <p class="r-advice"><b>${t('fAdvice')}</b>${lore(d)[c.reversed ? 'rev' : 'up'].advice}</p>
          <p class="r-whisper"><span class="wl">${t('whisper')}</span>${whisperOf(c)}</p>
        </div>
      </div>`;
    }).join('')}
    <div class="r-foot">
      <button class="plate sm" type="button" data-share>${t('share')}</button>
      <button class="plate sm" type="button" data-again>${t('again')}</button>
    </div>
    <p class="r-note">${t('disclaimer')}</p>`;
}

function openReading() {
  if (S.readingOpen) return;
  S.readingOpen = true;
  audio.pad();
  const { sheet } = vp();
  readingInner.innerHTML = readingHTML();
  reading.hidden = false;
  reading.scrollTop = 0;
  const tl = gsap.timeline();
  tl.fromTo(reading, sheet ? { yPercent: 100 } : { xPercent: 100 }, { xPercent: 0, yPercent: 0, duration: 0.9, ease: 'expo.out' }, 0)
    .from(readingInner.children, { y: 24, opacity: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08 }, 0.25);
  tl.add(layoutReveal(0.9), 0);
  placeSigil(0.9);
}

readingInner.addEventListener('click', (e) => {
  if (e.target.closest('[data-again]')) return restart();
  if (e.target.closest('[data-share]')) return openShare();
  const item = e.target.closest('.r-item');
  if (item) {
    const c = S.picked.find((x) => x.slot === +item.dataset.slot);
    if (c) openModal(c);
  }
});

/* ════════ 大图弹窗 ════════ */
const modalCard = $('#modal-card');
const modalText = $('#modal-text');
modalCard.innerHTML = `<div class="tilt"><div class="face"></div></div>`;
const modalTilt = modalCard.querySelector('.tilt');
const modalFace = modalCard.querySelector('.face');
modalCard.addEventListener('click', () => modalCard.classList.toggle('show-plates'));
modalCard.dataset.tilt = 'on';
attachTilt(modalCard, modalTilt, 10);

// 正 / 逆位的分项解读：感情 · 事业 · 建议
const facetsHTML = (f) => `
  <dl class="m-facets">
    <dt>${t('fLove')}</dt><dd>${f.love}</dd>
    <dt>${t('fWork')}</dt><dd>${f.work}</dd>
    <dt>${t('fAdvice')}</dt><dd>${f.advice}</dd>
  </dl>`;

function modalHTML(c) {
  const d = cardText(c.data);
  const L = lore(d);
  const mine = c.reversed ? 'rev' : 'up', other = c.reversed ? 'up' : 'rev';
  return `
    <div class="m-num">${d.num} · ${c.posText ?? posName(c.slot)}</div>
    <h3 class="m-title">${cardName(d)} <span class="badge ${c.reversed ? 'rev' : 'up'}">${t(c.reversed ? 'reversed' : 'upright')}</span></h3>
    <div class="m-en">${isEn() ? d.zh : d.en}</div>
    <div class="m-keys">${d.keys.map((k) => `<span>${k}</span>`).join('')}</div>
    <div class="m-sec"><h4>${c.posText ? t(c.reversed ? 'reversed' : 'upright') : t(c.reversed ? 'drawnRev' : 'drawnUp')}</h4><p>${d[mine]}</p>${facetsHTML(L[mine])}</div>
    <div class="m-whisper">${t('whisper')}${whisperOf(c)}</div>
    <div class="m-sec dim"><h4>${t(c.reversed ? 'upright' : 'reversed')}</h4><p>${d[other]}</p>${facetsHTML(L[other])}</div>
    <div class="m-sec m-lore"><h4>${t('mScene')}</h4><p>${L.scene}</p></div>
    ${L.origin ? `<div class="m-sec m-lore"><h4>${t('mOrigin')}</h4><p>${L.origin}</p>
      <p class="m-astro"><b>${t('mAstro')}</b>${L.astro}</p></div>` : ''}`;
}

function openModal(c) {
  if (S.modalCard) return;
  S.modalCard = c;
  audio.open();
  const d = c.data;
  modalFace.innerHTML = `${frontLayers(d.id)}<div class="glare"></div>`;
  modalCard.classList.remove('show-plates');
  // 先用小图秒开，再无缝换成高清
  const hi = [artSrc(d.id, 'full'), UI('frame.webp')].map((src) => { const i = new Image(); i.src = src; return i; });
  Promise.all(hi.map((i) => i.decode())).then(() => {
    if (S.modalCard !== c) return;
    ['.art', '.frame'].forEach((sel, k) => { modalFace.querySelector(sel).src = hi[k].src; });
  }).catch(() => {});
  modalCard.classList.toggle('reversed', c.reversed);
  modalText.innerHTML = modalHTML(c);
  modal.hidden = false;

  const from = c.el.getBoundingClientRect();
  const to = modalCard.getBoundingClientRect();
  gsap.set(c.el, { opacity: 0 });
  gsap.timeline()
    .fromTo('.modal-backdrop', { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0)
    .fromTo(modalCard, {
      x: from.left + from.width / 2 - (to.left + to.width / 2),
      y: from.top + from.height / 2 - (to.top + to.height / 2),
      scale: from.width / to.width,
    }, { x: 0, y: 0, scale: 1, duration: 0.8, ease: 'expo.out' }, 0)
    .fromTo(modalTilt, { rotationY: -25 }, { rotationY: 0, duration: 1.1, ease: 'expo.out' }, 0)
    .fromTo(modalText.children, { x: 30, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: 'power3.out', stagger: 0.05 }, 0.15)
    .fromTo('.modal-close', { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0.3);
}

function closeModal() {
  const c = S.modalCard;
  if (!c) return;
  audio.close();
  const from = c.el.getBoundingClientRect();
  const to = modalCard.getBoundingClientRect();
  gsap.timeline({
    onComplete() {
      modal.hidden = true;
      gsap.set(c.el, { opacity: 1 });
      gsap.set([modalCard, modalTilt], { clearProps: 'transform' });
      S.modalCard = null;
    },
  })
    .to(modalText.children, { opacity: 0, duration: 0.2 }, 0)
    .to('.modal-backdrop', { opacity: 0, duration: 0.45 }, 0.05)
    .to(modalCard, {
      x: from.left + from.width / 2 - (to.left + to.width / 2),
      y: from.top + from.height / 2 - (to.top + to.height / 2),
      scale: from.width / to.width,
      duration: 0.55, ease: 'expo.inOut',
    }, 0)
    .to(modalTilt, { rotationX: 0, rotationY: 0, duration: 0.4 }, 0);
}

modal.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]') || e.target.classList.contains('modal-body')) closeModal();
});
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (S.modalCard) closeModal();
  else if (!codexEl.hidden) closeCodex();
});

/* ════════ 每日一签入口 / 图鉴 ════════ */
const codexEl = $('#codex');
/* 首页一屏放下：内容比可用高度高时整体等比缩小（CSS zoom 会参与排版，居中不受影响）。
   先靠各尺寸的紧凑样式尽量放下，这里只兜底；缩到 0.62 还放不下才允许滚动 */
function fitIntro() {
  introFit.style.zoom = '';
  const cs = getComputedStyle(intro);
  const avail = intro.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const h = introFit.scrollHeight;
  const z = clamp(avail / h, 0.62, 1);
  if (z < 0.995) introFit.style.zoom = z.toFixed(3);
}
addEventListener('resize', () => requestAnimationFrame(fitIntro));
document.fonts?.ready.then(fitIntro);

function renderHomeExtras() {
  const n = streak(), done = drawnToday();
  $('#daily-name').textContent = t('daily');
  $('#daily-sub').textContent = (done ? t('dailySubDone') : t('dailySubNew')) + (n ? ` · ${t('streak')(n)}` : '');
  $('#daily-btn').classList.toggle('done', done);
  const got = Object.keys(collected()).length;
  $('#codex-link').textContent = t('codexLink')(got, CARDS.length);
  fitIntro();   // 文案长度变了（换语言、连续天数）会影响高度
}
$('#daily-btn').addEventListener('click', () => { audio.unlock(); audio.click(); start('daily'); });

function renderCodex() {
  const col = collected();
  const got = CARDS.filter((c) => col[c.id]).length;
  $('#codex-title').textContent = t('codex');
  $('#codex-progress').textContent = t('codexProgress')(got, CARDS.length);
  $('#codex-streak').textContent = t('codexStreak')(streak());
  $('#codex-hint').textContent = t('codexHint');
  $('#codex-grid').innerHTML = CARDS.map((c) => {
    const n = col[c.id] || 0;
    return `
      <button class="cx-card ${n ? 'got' : 'locked'}" type="button" data-id="${c.id}" ${n ? '' : 'tabindex="-1" aria-disabled="true"'}>
        <span class="cx-thumb">
          <img class="cx-art" src="${artSrc(c.id)}" alt="" loading="lazy">
          <img class="cx-frame" src="${UI('frame-sm.webp')}" alt="" loading="lazy">
          ${n ? `<span class="cx-count">×${n}</span>` : '<span class="cx-q">?</span>'}
        </span>
        <span class="cx-num">${c.num}</span>
        <span class="cx-name">${n ? cardName(c) : '？？？'}</span>
      </button>`;
  }).join('');
  requestAnimationFrame(() => { $('#codex-bar').style.width = `${(got / CARDS.length) * 100}%`; });
}
function openCodex() {
  if (!codexEl.hidden) return;
  audio.unlock(); audio.open();
  if (!panel.hidden) toggleSettings(false);
  renderCodex();
  $('#codex-bar').style.width = '0';
  codexEl.hidden = false;
  codexEl.scrollTop = 0;
  gsap.fromTo(codexEl, { opacity: 0 }, { opacity: 1, duration: 0.4 });
  gsap.fromTo('.codex-head > *', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.05, ease: 'power3.out' });
  gsap.fromTo('.cx-card', { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.025, ease: 'power3.out', delay: 0.1 });
}
function closeCodex() {
  audio.close();
  gsap.to(codexEl, { opacity: 0, duration: 0.25, onComplete() { codexEl.hidden = true; gsap.set(codexEl, { clearProps: 'opacity' }); } });
  renderHomeExtras();
}
$('#codex-btn').addEventListener('click', openCodex);
$('#codex-link').addEventListener('click', openCodex);
codexEl.addEventListener('click', (e) => {
  if (e.target.closest('[data-close-codex]')) return closeCodex();
  const b = e.target.closest('.cx-card.got');
  if (!b) return;
  const data = CARDS.find((c) => c.id === b.dataset.id);
  openModal({ data, reversed: false, el: b.querySelector('.cx-thumb'), posText: t('drawnTimes')(collected()[data.id] || 0) });
});

/* ════════ 分享图 ════════ */
const shareEl = $('#share');
const shareImg = $('#share-img');
const shareMaking = $('#share-making');
const shareSend = $('#share-send');
let shareBlob = null, shareUrl = null, shareData = null;
const shareName = () => `naiwa-tarot-${new Date().toISOString().slice(0, 10)}.jpg`;

async function openShare() {
  if (!shareEl.hidden) return;
  audio.click();
  shareEl.hidden = false;
  $('#share-save').textContent = t('shareSave');
  shareSend.textContent = t('shareSend');
  $('#share-close').textContent = t('shareClose');
  $('#share-tip').textContent = t('shareTip');
  shareImg.removeAttribute('src');
  shareMaking.textContent = t('shareMaking');
  shareSend.hidden = true;
  gsap.fromTo('.share-backdrop', { opacity: 0 }, { opacity: 1, duration: 0.4 });
  gsap.fromTo('.share-frame', { y: 30, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.6, ease: 'expo.out' });
  try {
    const now = new Date();
    const date = isEn()
      ? now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日`;
    const cards = S.picked.slice().sort((a, b) => a.slot - b.slot).map((c) => {
      const d = cardText(c.data);
      return {
        id: d.id, num: d.num, en: d.en, name: cardName(d), pos: posName(c.slot), reversed: c.reversed,
        badge: t(c.reversed ? 'reversed' : 'upright'), keys: d.keys,
        text: c.reversed ? d.rev : d.up, whisper: t('whisper') + whisperOf(c),
      };
    });
    const abs = (u) => new URL(u, document.baseURI).href;
    // B 站版：玩家问题先过内容安全检测（不通过就不印在图上）；二维码指向 Toy 本身
    const question = S.question && (await textIsSafe(S.question)) ? S.question : '';
    const qr = BILI ? await toyQr(264) : null;
    const cv = await renderShare({
      lang: getLang(), layout: S.key === 'daily' ? 'one' : S.key, cards,
      head: { eyebrow: 'NAIWA · GOTHIC · TAROT', small: t('titleSmall'), big: t('titleBig'), spread: spreadText(S.key).name, date, question },
      footer: { cta: t('shareCta'), url: qr?.url || location.origin + location.pathname, qrImage: qr?.base64 },
      assets: {
        art: (id) => abs(artSrc(id, 'full')), frame: abs(UI('frame.webp')), plate: abs(UI('plate.webp')),
        divider: abs(UI('divider.webp')), starchart: abs(UI('starchart.webp')),
      },
    });
    shareBlob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', 0.92));
    if (shareUrl) URL.revokeObjectURL(shareUrl);
    shareUrl = URL.createObjectURL(shareBlob);
    shareImg.src = shareUrl;
    shareMaking.textContent = '';
    const file = new File([shareBlob], shareName(), { type: 'image/jpeg' });
    shareData = null;
    if (BILI && (await canAppSave() || await canAppShare())) {
      // B 站 App 内：浏览器下载不可用，改用 SDK 存相册 / 拉起分享面板（图片 base64 需 ≤2MB）
      shareData = cv.toDataURL('image/jpeg', 0.86);
      if (shareData.length > 1.9e6) shareData = cv.toDataURL('image/jpeg', 0.7);
      shareSend.hidden = !(await canAppShare());
    } else {
      shareSend.hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    }
  } catch (err) {
    console.error(err);
    shareMaking.textContent = t('shareFail');
  }
}
function closeShare() {
  gsap.to('#share', { opacity: 0, duration: 0.25, onComplete() { shareEl.hidden = true; gsap.set('#share', { clearProps: 'opacity' }); } });
}
$('#share-save').addEventListener('click', async () => {
  if (!shareUrl) return;
  audio.click();
  if (shareData) {
    try { if (await saveToAlbum(shareData, t('shareAlbumHint'))) { shareMaking.textContent = t('shareSaved'); return; } } catch { /* 用户拒绝相册权限等 */ }
  }
  const a = document.createElement('a');
  a.href = shareUrl; a.download = shareName();
  document.body.appendChild(a); a.click(); a.remove();
});
shareSend.addEventListener('click', async () => {
  if (shareData) { try { await sharePic(shareData); } catch { /* 用户取消 */ } return; }
  try { await navigator.share({ files: [new File([shareBlob], shareName(), { type: 'image/jpeg' })], title: t('pageTitle') }); } catch { /* 用户取消 */ }
});
shareEl.addEventListener('click', (e) => { if (e.target.closest('[data-close-share]')) closeShare(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !shareEl.hidden) closeShare(); });
if (import.meta.env.DEV) window.__openShare = openShare;

/* ════════ 重新开始 ════════ */
async function restart() {
  if (S.busy || S.phase === 'intro') return;
  S.busy = true;
  audio.restart();
  if (S.modalCard) closeModal();
  const { H } = vp();
  btnRestart.hidden = true;
  btnRevealAll.hidden = true;
  btnSkip.hidden = true;
  hintBy(null);
  const tl = gsap.timeline();
  if (S.readingOpen) {
    const { sheet } = vp();
    tl.to(reading, { ...(sheet ? { yPercent: 100 } : { xPercent: 100 }), duration: 0.6, ease: 'expo.in' }, 0);
  }
  const els = [...stage.querySelectorAll('.card')];
  tl.to(els, {
    y: H + 400, rotation: () => (rand() - 0.5) * 50, opacity: 0, duration: 0.75, ease: 'power3.in', stagger: 0.03,
  }, 0);
  tl.to(stage.querySelectorAll('.slot'), { opacity: 0, scale: 0.9, duration: 0.4, stagger: 0.04 }, 0);
  await tl;
  reading.hidden = true;
  gsap.set(reading, { clearProps: 'transform' });
  stage.innerHTML = '';
  Object.assign(S, { phase: 'intro', key: null, spread: null, cards: [], picked: [], slots: [], readingOpen: false, auto: false, fate: null, replay: false });
  clearSession();
  renderHomeExtras();
  setSkipping(false);
  FAN.ready = false; FAN.hot = -1; FAN.pressed = false;
  document.body.classList.remove('picking');
  placeSigil(1);
  $('#question').value = '';
  await introIn();
  S.busy = false;
}

btnRestart.addEventListener('click', restart);

// 静音开关
const btnSound = $('#sound');
const syncSound = () => {
  btnSound.classList.toggle('off', audio.muted);
  btnSound.setAttribute('aria-pressed', String(!audio.muted));
  btnSound.setAttribute('aria-label', t(audio.muted ? 'soundOn' : 'soundOff'));
};
btnSound.addEventListener('click', () => {
  audio.unlock();
  CFG.sound = !CFG.sound;
  saveCfg(); applyCfg();
  audio.click();
});

/* ════════ 设置面板 ════════ */
const btnSkip = $('#skip');
const btnSettings = $('#settings-btn');
const panel = $('#settings');
function applyCfg() {
  audio.setMuted(!CFG.sound);
  audio.setAmbient(CFG.ambient);
  syncSound();
  applySpeed();
  document.body.classList.toggle('calm', CFG.calm);
  document.body.classList.toggle('no-lights', !CFG.lights);
  if (!CFG.parallax) for (const t of tilts) t.set(0, 0);
  document.querySelectorAll('input[data-k]').forEach((i) => { i.checked = !!CFG[i.dataset.k]; });
  syncRevUI();
  syncDeckUI();
}
document.addEventListener('change', (e) => {
  const k = e.target.dataset && e.target.dataset.k;
  if (!k) return;
  CFG[k] = e.target.checked;
  saveCfg(); applyCfg();
  audio.unlock(); audio.click();
});
// 牌组：大阿卡纳 22 张 / 完整 78 张
function syncDeckUI() {
  document.getElementById('st-deck-title').textContent = t('deckTitle');
  document.getElementById('st-deck-desc').textContent = t('deckDesc');
  document.querySelectorAll('#st-deck [data-deck]').forEach((b) => {
    b.textContent = t(b.dataset.deck === 'major' ? 'deckMajor' : 'deckFull');
    b.setAttribute('aria-checked', String(b.dataset.deck === CFG.deck));
  });
}
document.getElementById('st-deck').addEventListener('click', (e) => {
  const b = e.target.closest('[data-deck]');
  if (!b || b.dataset.deck === CFG.deck) return;
  CFG.deck = b.dataset.deck;
  saveCfg(); syncDeckUI();
  audio.unlock(); audio.click();
});
// 逆位概率滑杆：只在开启逆位时可调
function syncRevUI() {
  const r = document.querySelector('input[data-r="revProb"]');
  r.value = CFG.revProb;
  document.getElementById('st-rev-val').textContent = `${CFG.revProb}%`;
  document.getElementById('st-rev').classList.toggle('off', !CFG.reversed);
  r.disabled = !CFG.reversed;
  document.getElementById('st-rev-title').textContent = t('revTitle');
  document.getElementById('st-rev-desc').textContent = t('revDesc');
}
document.querySelector('input[data-r="revProb"]').addEventListener('input', (e) => {
  CFG.revProb = +e.target.value;
  document.getElementById('st-rev-val').textContent = `${CFG.revProb}%`;
});
document.querySelector('input[data-r="revProb"]').addEventListener('change', () => { saveCfg(); audio.click(); });

// 画质：自动 / 高 / 中 / 低（用 getElementById，避免启动时还没取到 panel）
function syncQualityUI() {
  const names = t('qNames');
  document.getElementById('st-q-title').textContent = t('qTitle');
  document.getElementById('st-q-desc').textContent = Q.pick === 'auto' ? t('qAutoNow') + names[Q.tier] : t('qFixed');
  document.querySelectorAll('#settings [data-q]').forEach((b) => {
    b.textContent = names[b.dataset.q];
    b.setAttribute('aria-checked', String(b.dataset.q === Q.pick));
  });
}
document.getElementById('st-quality').addEventListener('click', (e) => {
  const b = e.target.closest('[data-q]');
  if (!b || b.dataset.q === Q.pick) return;
  setQualityPick(b.dataset.q);
  audio.unlock(); audio.click();
});
function toggleSettings(open = panel.hidden) {
  if (open === !panel.hidden) return;
  btnSettings.setAttribute('aria-expanded', String(open));
  if (open) {
    panel.hidden = false;
    gsap.fromTo(panel, { opacity: 0, scale: 0.94, y: -8 }, { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: 'expo.out' });
    gsap.fromTo(panel.children, { opacity: 0, x: 8 }, { opacity: 1, x: 0, duration: 0.4, stagger: 0.025, ease: 'power3.out' });
  } else {
    gsap.to(panel, { opacity: 0, scale: 0.96, duration: 0.2, ease: 'power2.in', onComplete: () => { panel.hidden = true; } });
  }
}
btnSettings.addEventListener('click', () => { audio.unlock(); audio.click(); toggleSettings(); });
addEventListener('pointerdown', (e) => {
  if (!panel.hidden && !panel.contains(e.target) && !btnSettings.contains(e.target)) toggleSettings(false);
});
addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleSettings(false); });
btnSkip.addEventListener('click', () => { audio.click(); setSkipping(true); });
applyCfg();

/* ════════ 中英文切换 ════════ */
const btnLang = $('#lang');
function applyLang(rerender = true) {
  const en = isEn();
  document.documentElement.lang = en ? 'en' : 'zh-CN';
  document.body.classList.toggle('lang-en', en);
  document.title = t('pageTitle');
  $('.lede').innerHTML = t('lede');
  $('#question').placeholder = t('question');
  $('.auto-toggle span').textContent = t('autoToggle');
  btnRevealAll.textContent = t('revealAll');
  btnRestart.textContent = t('restart');
  btnSkip.textContent = t('skip');
  btnLang.textContent = t('langBtn');
  btnLang.setAttribute('aria-label', t('langAria'));
  $('#brand').setAttribute('aria-label', t('home'));
  btnSettings.setAttribute('aria-label', t('settings'));
  $('.modal-close').setAttribute('aria-label', t('close'));
  $('.st-head b').textContent = t('stHead');
  $('#st-g-read').textContent = t('stGroupRead');
  $('#st-g-show').textContent = t('stGroupShow');
  panel.querySelectorAll('.st-row input[data-k]').forEach((input) => {
    const row = input.closest('.st-row');
    const [title, desc] = t('st')[input.dataset.k];
    row.querySelector('b').textContent = title;
    row.querySelector('small').textContent = desc;
  });
  syncSound();
  syncQualityUI();
  syncRevUI();
  syncDeckUI();
  if (!rerender) return;
  renderTitle();
  renderSpreads();
  renderHomeExtras();
  if (!codexEl.hidden) renderCodex();
  S.slots.forEach(renderSlotLabel);
  if (S.readingOpen) readingInner.innerHTML = readingHTML();
  if (S.modalCard) modalText.innerHTML = modalHTML(S.modalCard);
  if (hintFn) setHint(hintFn());
}
btnLang.addEventListener('click', () => {
  audio.unlock(); audio.click();
  setLang(isEn() ? 'zh' : 'en');
  gsap.fromTo(['#intro', '#reading', '#modal-text', '#hint'], { opacity: 0.25 }, { opacity: 1, duration: 0.5, ease: 'power2.out' });
  applyLang();
});
applyLang(false);
renderHomeExtras();
$('#brand').addEventListener('click', restart);
btnRevealAll.addEventListener('click', revealAll);

/* ════════ 窗口变化 ════════ */
let rT;
function relayout() {
  if (S.phase === 'pick') {
    fanApply();
    const geo = pickSlotGeom(S.slots.length);
    S.slots.forEach((s, i) => gsap.to(s.el, { x: geo[i].x, y: geo[i].y, width: geo[i].w, height: geo[i].h, duration: 0.4 }));
    S.picked.forEach((c) => gsap.to(c.el, { x: geo[c.slot].x, y: geo[c.slot].y, scale: geo[c.slot].w / BASE, duration: 0.4 }));
  } else if (S.phase === 'reveal' || S.phase === 'done') {
    layoutReveal(0.4);
  }
  placeSigil(0.4);
}
addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(relayout, 120); });
// B 站 App：安全区 / 胶囊留白变化（转屏、沉浸切换）后重新排版
onInsetChange(() => { clearTimeout(rT); rT = setTimeout(() => { relayout(); fitIntro(); }, 60); });

/* ════════ 启动 ════════ */
buildIntro();

/* ════════ 会话：牌一旦布好阵就记下来，刷新页面后原样恢复 ════════
   存在 sessionStorage（只对当前标签页有效，关掉就没了）；只在牌全部落位之后保存，
   洗牌、选牌途中刷新则重新开始——此时牌还没定，不存在「改变结果」的问题。 */
const SESSION_KEY = 'naiwa-tarot-session';
function saveSession() {
  if (!S.key || !S.picked.length) return;
  const data = {
    v: 1, key: S.key, question: S.question,
    cards: S.picked.map((c) => ({ id: c.data.id, reversed: c.reversed, slot: c.slot, revealed: !!c.revealed, wi: c.wi })),
  };
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch { /* 忽略 */ }
}
function clearSession() { try { sessionStorage.removeItem(SESSION_KEY); } catch { /* 忽略 */ } }
function loadSession() {
  try {
    const d = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (!d || d.v !== 1 || !SPREADS[d.key]) return null;
    if (d.cards.length !== SPREADS[d.key].positions.length || d.cards.some((c) => !cardById(c.id))) return null;
    return d;
  } catch { return null; }
}

function restoreSession(d) {
  S.key = d.key;
  S.spread = SPREADS[d.key];
  S.question = d.question || '';
  $('#question').value = S.question;
  intro.classList.add('gone');
  intro.style.visibility = 'hidden';
  document.body.classList.remove('is-intro');
  heroTl?.pause();
  updateBase();
  stage.innerHTML = '';
  buildSlots();
  S.picked = d.cards.slice().sort((a, b) => a.slot - b.slot).map((s) => {
    const c = makeCard(cardById(s.id));
    c.el.classList.remove('deck');
    Object.assign(c, { slot: s.slot, reversed: s.reversed, wi: s.wi });
    c.el.classList.toggle('reversed', c.reversed);
    setFace(c, c.data);
    stage.appendChild(c.el);
    attachTilt(c.el, c.tilt);
    if (s.revealed) {
      c.revealed = true;
      gsap.set(c.inner, { rotationY: 180 });
      c.el.classList.add('revealed');
      c.el.dataset.tilt = 'on';
      S.slots[c.slot].card = c;
      renderSlotLabel(S.slots[c.slot]);
    } else {
      c.el.classList.add('revealable');
    }
    return c;
  });
  S.cards = S.picked.slice();
  const geo = revealSlotGeom();
  S.slots.forEach((s, i) => gsap.set(s.el, { x: geo[i].x, y: geo[i].y, width: geo[i].w, height: geo[i].h, xPercent: -50, yPercent: -50 }));
  S.picked.forEach((c) => gsap.set(c.el, { x: geo[c.slot].x, y: geo[c.slot].y, scale: geo[c.slot].w / BASE, rotation: 0, zIndex: 300 + c.slot }));
  if (geo[0].w < 84) gsap.set(stage.querySelectorAll('.slot .label'), { opacity: 0 });
  gsap.from(stage.children, { opacity: 0, duration: 0.6, stagger: 0.05 });
  btnRestart.hidden = false;
  if (S.picked.every((c) => c.revealed)) {
    S.phase = 'done';
    hintBy(() => t(S.key === 'daily' ? 'hDailyDone' : 'hDone'));
    gsap.delayedCall(0.4, openReading);
  } else {
    S.phase = 'reveal';
    hintBy(() => t(S.picked.length > 1 ? 'hRevealMany' : 'hRevealOne'));
    if (S.picked.filter((c) => !c.revealed).length > 1) btnRevealAll.hidden = false;
  }
}

{
  const saved = loadSession();
  if (saved) restoreSession(saved);
  else introIn();
}
