// 背景粒子：金色尘埃 + 漩涡模式 + 翻牌爆发
// 只用一个 canvas、一次 rAF；标签页隐藏时自动暂停。

const TAU = Math.PI * 2;

export function createParticles(canvas, { reduced = false, density = 1, dprCap = 2 } = {}) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const dust = [];
  const sparks = [];
  let vortex = 0;          // 0~1 漩涡强度（由外部 tween）
  const state = { vortex: 0, glow: 0 };
  let px = 0, py = 0, tx = 0, ty = 0; // 指针视差
  let running = true;
  let halo = density >= 0.5;
  let last = performance.now();

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const target = Math.round((reduced ? 40 : Math.min(170, (W * H) / 9000)) * density);
    while (dust.length < target) dust.push(makeDust(true));
    dust.length = target;
  }

  function makeDust(anywhere) {
    const depth = Math.random();
    return {
      x: Math.random() * W,
      y: anywhere ? Math.random() * H : H + 10,
      z: depth,                                   // 0 远 ~ 1 近
      r: 0.4 + depth * 1.6,
      vy: -(0.08 + depth * 0.35),
      vx: (Math.random() - 0.5) * 0.12,
      tw: Math.random() * TAU,
      tws: 0.6 + Math.random() * 1.8,
      hue: Math.random() < 0.18 ? 52 : 40,        // 少量奶蛙黄，其余古金
      ang: Math.random() * TAU,
      rad: 0,
    };
  }

  function burst(x, y, { count = 90, power = 1, colors } = {}) {
    if (reduced) count = Math.round(count / 3);
    count = Math.round(count * Math.max(0.4, density));
    const palette = colors || ['#f6d94f', '#f9e77f', '#e9d39a', '#b39963', '#ffffff'];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const sp = (1.5 + Math.random() * 7) * power;
      sparks.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 1,
        decay: 0.008 + Math.random() * 0.02,
        r: 0.8 + Math.random() * 2.4,
        c: palette[(Math.random() * palette.length) | 0],
        streak: Math.random() < 0.5,
      });
    }
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(3, (now - last) / 16.667);
    last = now;
    px += (tx - px) * 0.04; py += (ty - py) * 0.04;
    vortex = state.vortex;

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';

    const cx = W / 2, cy = H / 2;
    for (const p of dust) {
      p.tw += 0.02 * p.tws * dt;
      if (vortex > 0.001) {
        // 围绕中心旋转并向内收拢
        const dx = p.x - cx, dy = p.y - cy;
        const d = Math.hypot(dx, dy) || 1;
        const sw = (0.012 + p.z * 0.02) * vortex * dt * (300 / Math.max(120, d)) * 6;
        const cos = Math.cos(sw), sin = Math.sin(sw);
        p.x = cx + dx * cos - dy * sin - dx * 0.004 * vortex * dt;
        p.y = cy + dx * sin + dy * cos - dy * 0.004 * vortex * dt;
      }
      p.x += p.vx * dt * (1 - vortex);
      p.y += p.vy * dt * (1 - vortex);
      if (p.y < -10 || p.x < -20 || p.x > W + 20) Object.assign(p, makeDust(false));
      if (Math.hypot(p.x - cx, p.y - cy) < 8) Object.assign(p, makeDust(false));

      const tw = 0.45 + 0.55 * Math.sin(p.tw);
      const a = (0.15 + p.z * 0.55) * tw * (1 + state.glow);
      const ox = px * (p.z * 18), oy = py * (p.z * 18);
      const r = p.r * (1 + vortex * 0.6);
      ctx.fillStyle = `hsla(${p.hue}, 80%, ${60 + p.z * 15}%, ${a})`;
      ctx.beginPath();
      ctx.arc(p.x + ox, p.y + oy, r, 0, TAU);
      ctx.fill();
      if (p.z > 0.82 && halo) {   // 近处粒子的柔光圈（低画质省掉，填充面积是粒子本身的 25 倍）
        ctx.fillStyle = `hsla(${p.hue}, 90%, 70%, ${a * 0.12})`;
        ctx.beginPath(); ctx.arc(p.x + ox, p.y + oy, r * 5, 0, TAU); ctx.fill();
      }
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.vx *= Math.pow(0.95, dt); s.vy *= Math.pow(0.95, dt);
      s.vy += 0.03 * dt;
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.life -= s.decay * dt;
      if (s.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, s.life * 1.4);
      if (s.streak) {
        ctx.strokeStyle = s.c; ctx.lineWidth = s.r * 0.7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 3, s.y - s.vy * 3); ctx.stroke();
      } else {
        ctx.fillStyle = s.c;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * s.life, 0, TAU); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (e) => {
    tx = (e.clientX / W - 0.5) * 2; ty = (e.clientY / H - 0.5) * 2;
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) running = false;
    else if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
  });

  resize();
  requestAnimationFrame(frame);
  /** 画质档位变化：粒子数量、画布像素比、柔光圈 */
  function setQuality(d, cap) {
    density = d; dprCap = cap; halo = d >= 0.5;
    resize();
  }

  return { burst, state, setQuality };
}
