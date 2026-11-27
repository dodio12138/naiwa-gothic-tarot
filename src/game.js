// 奶蛙牌局 · 小猫钓鱼（纯前端，规则见 docs/roadmap.md）
//   52 张小牌当扑克（侍从 J / 王后 Q / 国王 K，去掉骑士）+ 4 张大牌功能牌，两人各 28 张。
//   轮流翻一张接到「牌河」末尾；与河里同点数的牌相遇，就把两张之间的牌全部收走，放到自己牌堆底。
//   输赢只是游戏，不解释为运势；牌局不分正逆位。
import { gsap } from 'gsap';
import { CARDS, artSrc } from './cards.js';
import { getLang } from './i18n.js';
import { sayStage, hush } from './naiwa.js';

const FUNC = { major_00: 'fool', major_10: 'wheel', major_13: 'death', major_16: 'tower' };
const RANK = { 1: 'A', 11: 'J', 13: 'Q', 14: 'K' };
const LIMIT = 80;   // 双方合计翻满这么多张仍未分出胜负，就比剩余牌数
const YOU = 0, NAIWA = 1;

const TXT = {
  zh: {
    title: '小猫钓鱼', sub: '奶蛙牌局', you: '你', naiwa: '奶蛙',
    yourTurn: '轮到你 · 点你的牌堆翻一张', naiwaTurn: '奶蛙在翻牌……', count: (n) => `已翻 ${n} / ${LIMIT}`,
    again: '再来一局', exit: '返回', rules: '规则', close: '收起',
    win: '你赢了', lose: '奶蛙赢了', draw: '平局',
    winBy: (a, b) => `翻满 ${LIMIT} 张 · 你 ${a} 张 : 奶蛙 ${b} 张`,
    suit: { wands: '杖', cups: '杯', swords: '剑', pentacles: '币' },
    func: { fool: ['愚者', '再来一张'], wheel: ['命运之轮', '交换牌堆'], death: ['死神', '清空牌河'], tower: ['高塔', '收走整条牌河'] },
    rulesHTML: `<h3>小猫钓鱼 · 奶蛙版</h3><ul>
      <li>52 张小牌当扑克用：侍从 J、王后 Q、国王 K，去掉骑士；再加 4 张大牌当功能牌。两人各 28 张。</li>
      <li>轮流从自己牌堆翻一张，接到牌河末尾。翻出的牌和河里某张<b>点数相同</b>，就把这两张之间的牌全部收走，放到自己牌堆底。</li>
      <li><b>愚者</b>再翻一张 · <b>命运之轮</b>双方交换牌堆 · <b>死神</b>清空牌河 · <b>高塔</b>收走整条牌河。</li>
      <li>谁的牌先翻完谁输；合计翻满 ${LIMIT} 张时比剩余牌数。</li>
      <li>输赢只是游戏，不代表任何运势。</li></ul>`,
  },
  en: {
    title: 'Fishing', sub: "Naiwa's Card Table", you: 'You', naiwa: 'Naiwa',
    yourTurn: 'Your turn · tap your pile to flip a card', naiwaTurn: 'Naiwa is flipping…', count: (n) => `Flipped ${n} / ${LIMIT}`,
    again: 'Play again', exit: 'Back', rules: 'Rules', close: 'Close',
    win: 'You win', lose: 'Naiwa wins', draw: 'Draw',
    winBy: (a, b) => `${LIMIT} cards flipped · you ${a} : Naiwa ${b}`,
    suit: { wands: 'W', cups: 'C', swords: 'S', pentacles: 'P' },
    func: { fool: ['The Fool', 'Flip again'], wheel: ['Wheel of Fortune', 'Swap piles'], death: ['Death', 'Clear the river'], tower: ['The Tower', 'Take the whole river'] },
    rulesHTML: `<h3>Fishing · Naiwa Edition</h3><ul>
      <li>The 52 minor cards play as a poker deck (Page = J, Queen = Q, King = K, Knights removed), plus 4 Major Arcana as action cards. 28 cards each.</li>
      <li>Take turns flipping your top card onto the end of the river. If it <b>matches the rank</b> of a card already there, take every card from that one to yours and put them under your pile.</li>
      <li><b>The Fool</b> flip again · <b>Wheel of Fortune</b> swap piles · <b>Death</b> clear the river · <b>The Tower</b> take the whole river.</li>
      <li>Run out of cards and you lose; after ${LIMIT} flips, the bigger pile wins.</li>
      <li>It's only a game — it says nothing about your fortune.</li></ul>`,
  },
};
const tx = (k) => TXT[getLang() === 'en' ? 'en' : 'zh'][k];

const rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const deck = () => [
  ...CARDS.filter((c) => c.arcana === 'minor' && c.rank !== 12),
  ...CARDS.filter((c) => FUNC[c.id]),
];

/* ── DOM ── */
let root, river, piles, counts, statusEl, bannerEl, rulesEl, deps;
function build(BACK) {
  root = document.createElement('section');
  root.id = 'game';
  root.hidden = true;
  root.innerHTML = `
    <div class="g-side g-them">
      <div class="g-pile" data-who="${NAIWA}"><img src="${BACK}" alt="" draggable="false"><b class="g-count"></b></div>
      <span class="g-name" data-t="naiwa"></span>
    </div>
    <div class="g-river" aria-live="polite"></div>
    <div class="g-side g-you">
      <div class="g-pile" data-who="${YOU}" role="button" tabindex="0"><img src="${BACK}" alt="" draggable="false"><b class="g-count"></b></div>
      <span class="g-name" data-t="you"></span>
    </div>
    <p class="g-status"></p>
    <div class="g-actions">
      <button class="plate sm" type="button" data-act="rules"></button>
      <button class="plate sm" type="button" data-act="again"></button>
      <button class="plate sm" type="button" data-act="exit"></button>
    </div>
    <div class="g-banner" aria-hidden="true"></div>
    <div class="g-rules" hidden><div class="g-rules-body"></div><button class="plate sm" type="button" data-act="rules-close"></button></div>`;
  document.body.appendChild(root);
  river = root.querySelector('.g-river');
  piles = [...root.querySelectorAll('.g-pile')].sort((a, b) => a.dataset.who - b.dataset.who);
  counts = piles.map((p) => p.querySelector('.g-count'));
  statusEl = root.querySelector('.g-status');
  bannerEl = root.querySelector('.g-banner');
  rulesEl = root.querySelector('.g-rules');

  const yourPile = piles[YOU];
  yourPile.addEventListener('click', () => playerFlip());
  yourPile.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playerFlip(); } });
  root.addEventListener('click', (e) => {
    const a = e.target.closest('[data-act]')?.dataset.act;
    if (!a) return;
    deps.audio.click();
    if (a === 'again') newGame();
    else if (a === 'exit') closeGame();
    else if (a === 'rules') rulesEl.hidden = !rulesEl.hidden;
    else if (a === 'rules-close') rulesEl.hidden = true;
  });
  addEventListener('resize', () => { if (!root.hidden) sizeCards(); });
}

function applyText() {
  root.setAttribute('aria-label', `${tx('sub')} · ${tx('title')}`);
  root.querySelectorAll('[data-t]').forEach((el) => { el.textContent = tx(el.dataset.t); });
  root.querySelector('[data-act="rules"]').textContent = tx('rules');
  root.querySelector('[data-act="again"]').textContent = tx('again');
  root.querySelector('[data-act="exit"]').textContent = tx('exit');
  root.querySelector('[data-act="rules-close"]').textContent = tx('close');
  root.querySelector('.g-rules-body').innerHTML = tx('rulesHTML');
}

// 牌宽：手机约 44px，桌面最大 70px；牌河放不下时可以滚动
function sizeCards() {
  const w = innerWidth, h = innerHeight;
  // 行与行重叠三分之一，每行实际只占 1 个牌宽的高度，所以纵向可以放得更大
  const cw = Math.round(Math.max(42, Math.min(76, (w - 40) / 8, (h - 330) / 5.5)));
  root.style.setProperty('--gw', `${cw}px`);
}

function badge(card) {
  const f = FUNC[card.id];
  if (f) return `<span class="gc-badge func">${card.num}<small>${tx('func')[f][0]}</small></span>`;
  return `<span class="gc-badge">${RANK[card.rank] || card.rank}<small>${tx('suit')[card.suit]}</small></span>`;
}
function cardEl(card) {
  const el = document.createElement('div');
  el.className = `g-card${FUNC[card.id] ? ' is-func' : ''}`;
  el.innerHTML = `<div class="gc-in">
    <div class="gc-front"><img src="${artSrc(card.id)}" alt="${getLang() === 'en' ? card.en : card.zh}" draggable="false">${badge(card)}</div>
    <div class="gc-back"><img src="${deps.BACK}" alt="" draggable="false"></div></div>`;
  return el;
}

/* ── 状态 ── */
const G = { id: 0, piles: [[], []], river: [], turn: YOU, flips: 0, over: true, waiting: false };

function updateCounts() {
  counts.forEach((c, i) => { c.textContent = G.piles[i].length; });
  piles.forEach((p, i) => p.classList.toggle('empty', !G.piles[i].length));
}
function status(s) { statusEl.textContent = s; }
function banner(main, sub = '') {
  bannerEl.innerHTML = `<b>${main}</b>${sub ? `<small>${sub}</small>` : ''}`;
  gsap.killTweensOf(bannerEl);
  return gsap.timeline()
    .fromTo(bannerEl, { opacity: 0, scale: 0.8, xPercent: -50, yPercent: -50 }, { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(2)' })
    .to(bannerEl, { opacity: 0, scale: 1.05, duration: 0.4, ease: 'power1.in' }, '+=0.9');
}
function center(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; }

/* ── 动画 ── */
function flyIn(el, who) {
  river.appendChild(el);
  el.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  const to = center(el), from = center(piles[who]);
  gsap.set(el.querySelector('.gc-in'), { rotationY: 180 });
  return gsap.timeline()
    .from(el, { x: from.x - to.x, y: from.y - to.y, scale: from.w / to.w, duration: 0.45, ease: 'power3.out' }, 0)
    .to(el.querySelector('.gc-in'), { rotationY: 0, duration: 0.4, ease: 'power2.inOut' }, 0.12);
}
async function capture(who, from) {
  const got = G.river.splice(from);
  const target = center(piles[who]);
  await gsap.to(got.map((g) => g.el), {
    x: (i, el) => target.x - center(el).x, y: (i, el) => target.y - center(el).y,
    scale: 0.5, opacity: 0, duration: 0.5, ease: 'power3.in', stagger: 0.04,
  });
  got.forEach((g) => g.el.remove());
  G.piles[who].push(...got.map((g) => g.card));
  deps.fx?.burst(target.x, target.y, { count: 30, power: 0.45 });
  deps.audio.land();
  gsap.fromTo(piles[who], { scale: 1.08 }, { scale: 1, duration: 0.4, ease: 'back.out(2)' });
  updateCounts();
}
async function clearRiver() {
  const els = G.river.map((g) => g.el);
  G.river = [];
  await gsap.to(els, { opacity: 0, scale: 0.6, y: -20, filter: 'grayscale(1)', duration: 0.5, ease: 'power2.in', stagger: 0.02 });
  els.forEach((e) => e.remove());
}

/* ── 回合 ── */
async function flip(who) {
  const id = G.id;
  G.waiting = false;
  piles[YOU].classList.remove('ready');
  const card = G.piles[who].shift();
  G.flips++;
  updateCounts();
  const el = cardEl(card);
  deps.audio.flip();
  await flyIn(el, who);
  if (id !== G.id) return;
  const f = FUNC[card.id];
  let again = false;
  G.river.push({ card, el });
  if (f) {
    banner(tx('func')[f][0], tx('func')[f][1]);
    sayStage(`game_${f}`);
    await wait(700);
    if (id !== G.id) return;
    if (f === 'fool') again = true;
    else if (f === 'wheel') {
      [G.piles[YOU], G.piles[NAIWA]] = [G.piles[NAIWA], G.piles[YOU]];
      await gsap.timeline()
        .to(piles, { rotation: 180, scale: 0.85, duration: 0.35, ease: 'power2.in' })
        .add(updateCounts)
        .to(piles, { rotation: 360, scale: 1, duration: 0.35, ease: 'power2.out' })
        .set(piles, { rotation: 0 });
    } else if (f === 'death') await clearRiver();
    else if (f === 'tower') await capture(who, 0);
  } else {
    const idx = G.river.findIndex((g, i) => i < G.river.length - 1 && !FUNC[g.card.id] && g.card.rank === card.rank);
    if (idx >= 0) {
      G.river[idx].el.classList.add('match');
      el.classList.add('match');
      await wait(550);
      if (id !== G.id) return;
      const n = G.river.length - idx;
      await capture(who, idx);
      if (n >= 4 || rand() < 0.45) sayStage(who === YOU ? 'game_you' : 'game_naiwa');
    }
  }
  if (id !== G.id) return;
  G.turn = again ? who : 1 - who;
  status(tx('count')(G.flips));
  await wait(250);
  if (id === G.id) nextTurn();
}

function nextTurn() {
  if (G.over) return;
  if (!G.piles[G.turn].length) return finish(G.turn === YOU ? 'lose' : 'win');
  if (G.flips >= LIMIT) {
    const a = G.piles[YOU].length, b = G.piles[NAIWA].length;
    return finish(a > b ? 'win' : a < b ? 'lose' : 'draw', tx('winBy')(a, b));
  }
  if (G.turn === YOU) {
    G.waiting = true;
    piles[YOU].classList.add('ready');
    status(tx('yourTurn'));
  } else {
    status(tx('naiwaTurn'));
    const id = G.id;
    setTimeout(() => { if (id === G.id && !G.over) flip(NAIWA); }, 650);
  }
}

function playerFlip() {
  if (G.over || !G.waiting || G.turn !== YOU) return;
  deps.audio.unlock?.();
  flip(YOU);
}

function finish(result, sub = '') {
  G.over = true;
  G.waiting = false;
  piles[YOU].classList.remove('ready');
  status(sub || tx(result));
  banner(tx(result), sub).eventCallback('onComplete', null);
  gsap.to(bannerEl, { opacity: 1, duration: 0.01, delay: 1.3 });   // 结局横幅留在画面上
  sayStage(`game_${result}`);
  if (result === 'win') deps.fx?.burst(innerWidth / 2, innerHeight / 2, { count: 90, power: 1 });
}

function newGame() {
  G.id++;
  G.over = false;
  G.flips = 0;
  G.turn = YOU;
  G.river = [];
  river.innerHTML = '';
  gsap.set(bannerEl, { opacity: 0 });
  const d = shuffled(deck());
  G.piles = [d.slice(0, d.length / 2), d.slice(d.length / 2)];
  updateCounts();
  deps.audio.deal?.();
  gsap.fromTo(piles, { y: (i) => (i === YOU ? 60 : -60), opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'expo.out' });
  sayStage('game_start');
  nextTurn();
}

/* ── 对外 ── */
let onExit = null;
export function isGameOpen() { return !!root && !root.hidden; }

/** 打开牌局。deps：{ BACK, audio, fx }；onExit 在返回首页时调用。 */
export function openGame(d, exitFn) {
  deps = d;
  onExit = exitFn;
  if (!root) build(d.BACK);
  applyText();
  sizeCards();
  rulesEl.hidden = true;
  root.hidden = false;
  document.body.classList.add('in-game');
  gsap.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.5 });
  newGame();
}

export function closeGame() {
  if (!isGameOpen()) return;
  G.id++;
  G.over = true;
  hush();
  gsap.to(root, {
    opacity: 0, duration: 0.35,
    onComplete() {
      root.hidden = true;
      river.innerHTML = '';
      document.body.classList.remove('in-game');
      onExit?.();
    },
  });
}

/** 切换语言时刷新牌局里的文字。 */
export function relabelGame() { if (root) applyText(); }
