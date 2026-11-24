// 仪式音效：全部用 WebAudio 实时合成，无音频文件。
// 首次用户手势时创建 AudioContext（浏览器自动播放限制）。

const KEY = 'naiwa-tarot-muted';
const MASTER = 0.4;

// D 小调五声音阶（用于悬停“竖琴”）
const HARP = [587.33, 659.25, 698.46, 880, 987.77, 1174.66, 1318.51, 1396.91, 1760, 1975.53, 2349.32];

export function createAudio() {
  let ctx = null;
  let master, bus, verb, noiseBuf;
  let ambient = null;
  let ambientOn = true;
  let muted = false;
  try { muted = localStorage.getItem(KEY) === '1'; } catch { /* 无存储时默认有声 */ }
  const last = {};

  /* ── 图结构 ── */
  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER;
    master.connect(comp).connect(ctx.destination);

    bus = ctx.createGain();
    bus.connect(master);

    // 大教堂混响：程序生成的指数衰减噪声脉冲
    verb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 3.8);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    verb.buffer = ir;
    const verbOut = ctx.createGain();
    verbOut.gain.value = 0.55;
    verb.connect(verbOut).connect(master);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  }

  function unlock() {
    if (!ctx) {
      try { build(); } catch { return; }
      startAmbient();
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  const ready = () => ctx && ctx.state === 'running' && !muted;
  const now = () => ctx.currentTime;
  const throttle = (k, ms) => {
    const t = performance.now();
    if (last[k] && t - last[k] < ms) return true;
    last[k] = t;
    return false;
  };

  // 一个声部的输出：干声 + 混响发送
  function out(wet = 0.3) {
    const g = ctx.createGain();
    g.connect(bus);
    if (wet > 0) {
      const s = ctx.createGain();
      s.gain.value = wet;
      g.connect(s).connect(verb);
    }
    return g;
  }

  function env(param, t, peak, attack, release, hold = 0) {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
    if (hold) param.setValueAtTime(Math.max(peak, 0.0002), t + attack + hold);
    param.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  }

  function tone(freq, { t = now(), type = 'sine', gain = 0.1, attack = 0.005, release = 0.4, hold = 0, glide, wet = 0.3, detune = 0, pan = 0 } = {}) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + attack + hold + release);
    o.detune.value = detune;
    const g = ctx.createGain();
    env(g.gain, t, gain, attack, release, hold);
    let node = o.connect(g);
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p);
    }
    node.connect(out(wet));
    o.start(t);
    o.stop(t + attack + hold + release + 0.05);
  }

  function noise({ t = now(), dur = 0.2, type = 'bandpass', f0 = 1000, f1, q = 1, gain = 0.1, attack = 0.01, wet = 0.2, pan = 0 } = {}) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    env(g.gain, t, gain, attack, Math.max(0.02, dur - attack));
    let node = src.connect(f).connect(g);
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p);
    }
    node.connect(out(wet));
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  // 管钟：非谐波泛音叠加
  function bell(freq, { t = now(), gain = 0.08, dur = 3, wet = 0.6, pan = 0 } = {}) {
    [[1, 1, 1], [2, 0.5, 0.7], [2.76, 0.35, 0.5], [5.4, 0.18, 0.3], [8.93, 0.08, 0.18]].forEach(([r, g, d]) => {
      tone(freq * r, { t, gain: gain * g, attack: 0.003, release: dur * d, wet, pan });
    });
  }

  /* ── 环境底噪：低沉的五度长音 + 风声 ── */
  function startAmbient() {
    if (ambient) return;
    const t = now();
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(ambientOn ? 0.025 : 0.0001, t + 6);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 2;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.045;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 140;
    lfo.connect(lfoAmt).connect(lp.frequency);
    lp.connect(g);
    const send = ctx.createGain(); send.gain.value = 0.5;
    g.connect(bus); g.connect(send).connect(verb);
    const oscs = [[73.42, 'sawtooth', -6], [73.42, 'sawtooth', 7], [110, 'triangle', 0], [146.83, 'sine', 3]].map(([f, type, det]) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det;
      const og = ctx.createGain(); og.gain.value = type === 'sawtooth' ? 0.35 : 0.5;
      o.connect(og).connect(lp); o.start(t);
      return o;
    });
    // 风
    const wind = ctx.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 500; wf.Q.value = 0.7;
    const wg = ctx.createGain(); wg.gain.value = 0.012;
    const wl = ctx.createOscillator(); wl.frequency.value = 0.07;
    const wla = ctx.createGain(); wla.gain.value = 260;
    wl.connect(wla).connect(wf.frequency);
    wind.connect(wf).connect(wg).connect(g);
    wind.start(t); wl.start(t); lfo.start(t);
    ambient = { g, oscs };
  }

  /* ── 对外音效 ── */
  const api = {
    unlock,
    get muted() { return muted; },
    get state() { return ctx ? ctx.state : 'none'; },
    setAmbient(v) {
      ambientOn = v;
      if (ambient) ambient.g.gain.setTargetAtTime(v ? 0.025 : 0.0001, now(), 0.6);
    },
    setMuted(v) {
      muted = v;
      try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* 忽略 */ }
      if (ctx) master.gain.setTargetAtTime(v ? 0 : MASTER, now(), 0.12);
    },

    click() {
      if (!ready()) return;
      tone(1600, { type: 'triangle', gain: 0.05, release: 0.06, glide: 900, wet: 0.15 });
      bell(1174.66, { gain: 0.025, dur: 1.4, wet: 0.5 });
    },

    hover(i = 0) {
      if (!ready() || throttle('hover', 40)) return;
      const f = HARP[Math.max(0, Math.min(HARP.length - 1, Math.round((i / 21) * (HARP.length - 1))))];
      tone(f, { type: 'triangle', gain: 0.028, attack: 0.003, release: 0.9, wet: 0.5, pan: (i / 21 - 0.5) * 1.2 });
      tone(f * 2, { gain: 0.008, attack: 0.003, release: 0.5, wet: 0.5 });
    },

    deal() {
      if (!ready() || throttle('deal', 30)) return;
      noise({ dur: 0.11, f0: 1600, f1: 4200, q: 1.2, gain: 0.07, attack: 0.008, wet: 0.15, pan: (Math.random() - 0.5) * 0.8 });
    },

    shuffle(dur = 3) {
      if (!ready()) return;
      const t = now();
      // 漩涡风声：带通扫频
      const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5;
      f.frequency.setValueAtTime(260, t);
      f.frequency.exponentialRampToValueAtTime(2400, t + dur * 0.55);
      f.frequency.exponentialRampToValueAtTime(500, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16, t + dur * 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      // 漩涡的忽远忽近
      const trem = ctx.createOscillator(); trem.frequency.setValueAtTime(2, t);
      trem.frequency.linearRampToValueAtTime(7, t + dur * 0.6);
      const tremAmt = ctx.createGain(); tremAmt.gain.value = 0.05;
      trem.connect(tremAmt).connect(g.gain);
      src.connect(f).connect(g).connect(out(0.5));
      src.start(t); trem.start(t);
      src.stop(t + dur + 0.1); trem.stop(t + dur + 0.1);
      // 低音轰鸣
      tone(55, { t, type: 'sawtooth', gain: 0.05, attack: dur * 0.5, release: dur * 0.6, wet: 0.4 });
      tone(36.7, { t, gain: 0.12, attack: dur * 0.5, release: dur * 0.6, wet: 0.2 });
      // 上升的泛音
      [293.66, 440, 587.33].forEach((fr, k) => tone(fr, {
        t: t + k * 0.15, type: 'sine', gain: 0.02, attack: dur * 0.45, release: dur * 0.5, glide: fr * 1.5, wet: 0.8,
      }));
    },

    riffle(n = 18, span = 0.42) {
      if (!ready()) return;
      const t = now();
      for (let i = 0; i < n; i++) {
        noise({ t: t + (i / n) * span + Math.random() * 0.01, dur: 0.035, type: 'highpass', f0: 2500 + Math.random() * 2500, gain: 0.05, attack: 0.002, wet: 0.1, pan: i % 2 ? 0.35 : -0.35 });
      }
    },

    fan() {
      if (!ready()) return;
      const t = now();
      noise({ t, dur: 0.7, f0: 4500, f1: 900, q: 0.8, gain: 0.06, attack: 0.05, wet: 0.3 });
      HARP.forEach((f, i) => tone(f, { t: t + i * 0.045, type: 'triangle', gain: 0.018, release: 1.2, wet: 0.6, pan: i / HARP.length - 0.5 }));
    },

    pick() {
      if (!ready()) return;
      noise({ dur: 0.55, f0: 500, f1: 2600, q: 1.5, gain: 0.09, attack: 0.15, wet: 0.35 });
      tone(880, { gain: 0.02, attack: 0.2, release: 0.5, glide: 1320, wet: 0.6 });
    },

    land() {
      if (!ready()) return;
      tone(150, { gain: 0.14, release: 0.18, glide: 60, wet: 0.2 });
      bell(1760, { gain: 0.03, dur: 1.6 });
    },

    gather() {
      if (!ready()) return;
      noise({ dur: 0.9, f0: 2400, f1: 200, q: 0.9, gain: 0.08, attack: 0.1, wet: 0.4 });
      tone(110, { gain: 0.05, attack: 0.3, release: 0.8, glide: 55, wet: 0.3 });
    },

    charge(dur = 0.5) {
      if (!ready()) return;
      const t = now();
      noise({ t, dur, type: 'highpass', f0: 3000, f1: 8000, gain: 0.05, attack: dur * 0.9, wet: 0.4 });
      [440, 554.37, 659.25].forEach((f, i) => tone(f, { t, type: 'sine', gain: 0.02, attack: dur, release: 0.08, glide: f * 2, wet: 0.5, detune: i * 4 }));
    },

    flip() {
      if (!ready()) return;
      noise({ dur: 0.3, f0: 900, f1: 3800, q: 1.4, gain: 0.08, attack: 0.03, wet: 0.2 });
    },

    reveal(dark = false) {
      if (!ready()) return;
      const t = now();
      // 冲击：次低音 + 噪声
      tone(dark ? 62 : 82, { t, gain: 0.32, attack: 0.004, release: 1.3, glide: dark ? 30 : 40, wet: 0.3 });
      noise({ t, dur: 0.5, type: 'lowpass', f0: 2200, f1: 200, gain: 0.14, attack: 0.004, wet: 0.5 });
      // 钟声和弦：光明的牌用大调加九，暗牌用带小二度与三全音的不和谐和弦
      const chord = dark ? [293.66, 311.13, 415.3, 587.33] : [587.33, 739.99, 880, 1318.51];
      chord.forEach((f, i) => bell(f, { t: t + 0.03 + i * 0.045, gain: dark ? 0.06 : 0.05, dur: 3.6, wet: 0.7, pan: (i - 1.5) * 0.3 }));
      // 闪光的高频颗粒
      for (let i = 0; i < 10; i++) {
        tone(2000 + Math.random() * 3000, { t: t + 0.05 + i * 0.05 + Math.random() * 0.04, gain: 0.012, release: 0.4, wet: 0.8, pan: Math.random() * 2 - 1 });
      }
    },

    pad() {
      if (!ready()) return;
      const t = now();
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const g = ctx.createGain();
      env(g.gain, t, 0.045, 1.4, 3.5, 0.6);
      const o2 = out(0.7);
      lp.connect(g).connect(o2);
      [146.83, 220, 293.66, 349.23, 440].forEach((f, i) => {
        [-8, 8].forEach((det) => {
          const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det + i;
          const og = ctx.createGain(); og.gain.value = 0.12;
          o.connect(og).connect(lp); o.start(t); o.stop(t + 6);
        });
      });
    },

    open() {
      if (!ready()) return;
      noise({ dur: 0.45, f0: 700, f1: 3200, q: 1, gain: 0.06, attack: 0.08, wet: 0.4 });
      bell(1396.91, { gain: 0.03, dur: 2, wet: 0.7 });
    },

    close() {
      if (!ready()) return;
      noise({ dur: 0.35, f0: 3000, f1: 600, q: 1, gain: 0.05, attack: 0.03, wet: 0.3 });
    },

    restart() {
      if (!ready()) return;
      const t = now();
      HARP.slice().reverse().forEach((f, i) => tone(f, { t: t + i * 0.04, type: 'triangle', gain: 0.016, release: 0.9, wet: 0.6 }));
      noise({ t, dur: 0.8, f0: 2000, f1: 250, q: 0.8, gain: 0.07, attack: 0.05, wet: 0.4 });
    },
  };
  return api;
}
