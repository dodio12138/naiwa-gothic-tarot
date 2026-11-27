// 奶蛙气泡：画面角落的奶蛋头像 + 对话气泡。
// 仪式各阶段的短句来自 data/ritual.json；牌局（game.js）也通过 say() 说话。
import { gsap } from 'gsap';
import ritual from '../data/ritual.json';
import { getLang } from './i18n.js';

const UI = (f) => `${import.meta.env.BASE_URL}ui/${f}`;
const rand = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

const el = document.createElement('div');
el.id = 'naiwa';
el.hidden = true;
el.innerHTML = `
  <button class="nw-av" type="button" aria-label="奶蛙"><img src="${UI('naidan-avatar.webp')}" alt="" draggable="false"></button>
  <div class="nw-bubble" role="status" aria-live="polite"><p></p></div>`;
document.body.appendChild(el);
const bubble = el.querySelector('.nw-bubble');
const textEl = bubble.querySelector('p');
const av = el.querySelector('.nw-av');

let enabled = true;
let hideCall = null;
const last = {};   // 每个阶段上一次说的句子下标，避免连说同一句

const lineText = (l) => (getLang() === 'en' ? l.en : l.zh);

function pickLine(stage) {
  const pool = ritual.stages[stage];
  if (!pool?.length) return null;
  let i = Math.floor(rand() * pool.length);
  if (pool.length > 1 && i === last[stage]) i = (i + 1) % pool.length;
  last[stage] = i;
  return pool[i];
}

/** 让奶蛙说一句话。text 可以是字符串或 {zh, en}。 */
export function say(text, { hold } = {}) {
  if (!enabled) return;
  const s = typeof text === 'string' ? text : lineText(text);
  if (!s) return;
  hideCall?.kill();
  const wasHidden = el.hidden;
  el.hidden = false;
  textEl.textContent = s;
  if (wasHidden) {
    gsap.fromTo(av, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)' });
  } else {
    gsap.fromTo(av, { y: 0 }, { y: -6, duration: 0.14, yoyo: true, repeat: 1, ease: 'power1.out' });
  }
  gsap.fromTo(bubble, { opacity: 0, x: -8, scale: 0.92 }, { opacity: 1, x: 0, scale: 1, duration: 0.45, ease: 'back.out(1.6)', overwrite: true });
  const ms = hold ?? Math.min(7000, 2600 + s.length * (getLang() === 'en' ? 45 : 140));
  hideCall = gsap.delayedCall(ms / 1000, hush);
}

/** 从低语库里按阶段随机说一句。 */
export function sayStage(stage, opts) {
  const l = pickLine(stage);
  if (l) say(l, opts);
}

/** 收起气泡。 */
export function hush() {
  hideCall?.kill();
  hideCall = null;
  if (el.hidden) return;
  gsap.to(el, {
    opacity: 0, duration: 0.3, ease: 'power1.in', overwrite: true,
    onComplete() { el.hidden = true; gsap.set(el, { clearProps: 'opacity' }); },
  });
}

/** 设置里的开关：关掉后奶蛙不再说话。 */
export function setEnabled(on) {
  enabled = on;
  if (!on) hush();
}

// 点奶蛙：随口回一句；小概率笑出声（致敬奶蛙原本「点一下就狂笑」）
av.addEventListener('click', () => {
  if (rand() < 0.08) {
    sayStage('laugh');
    gsap.fromTo(av, { rotation: -10 }, { rotation: 10, duration: 0.06, repeat: 9, yoyo: true, ease: 'none', clearProps: 'rotation' });
  } else sayStage('poke');
});
