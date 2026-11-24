// 分享结果图：在浏览器里用 Canvas 合成 1080×1920 竖版图，不需要服务器
import QRCode from 'qrcode';

const W = 1080, H = 1920;
const GOLD = ['#fff1cf', '#f2c77e', '#c88a45', '#7a4216'];
const COL = { gold: '#c88a45', goldHi: '#ecc98a', text: '#efe3cf', muted: '#a99a8d', yellow: '#f6d94f', rev: '#d58aa0', iris: '#a9c77a' };
const FONT_ZH = '"Noto Serif SC", "Songti SC", serif';
const FONT_EN = 'Cinzel, "Times New Roman", serif';

const loadImg = (src) => new Promise((res, rej) => {
  const i = new Image();
  i.crossOrigin = 'anonymous';
  i.onload = () => res(i);
  i.onerror = rej;
  i.src = src;
});

function goldFill(ctx, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, GOLD[0]); g.addColorStop(0.35, GOLD[1]); g.addColorStop(0.7, GOLD[2]); g.addColorStop(1, GOLD[3]);
  return g;
}

// 带字距的文字（canvas 原生 letterSpacing 兼容性不一，手动排）
function spaced(ctx, text, x, y, spacing, align = 'center') {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += widths[i] + spacing; });
  ctx.textAlign = prev;
  return total;
}

// 自动换行：中文按字，英文按词
function wrap(ctx, text, maxW) {
  const tokens = /[一-鿿]/.test(text) ? [...text] : text.split(/(\s+)/);
  const lines = [];
  let line = '';
  for (const tk of tokens) {
    const test = line + tk;
    if (ctx.measureText(test).width > maxW && line.trim()) { lines.push(line.trim()); line = tk.trimStart(); }
    else line = test;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

// 铭牌九宫格：两端尖角保持比例，中段横向拉伸（与网页里的按钮同一张切图）
function drawPlate(ctx, img, x, y, w, h) {
  const sH = img.height, cap = 66 * (img.height / 120);
  const k = h / sH, capW = cap * k;
  ctx.drawImage(img, 0, 0, cap, sH, x, y, capW, h);
  ctx.drawImage(img, cap, 0, img.width - cap * 2, sH, x + capW, y, Math.max(0, w - capW * 2), h);
  ctx.drawImage(img, img.width - cap, 0, cap, sH, x + w - capW, y, capW, h);
}

function plateLabel(ctx, plate, text, cx, y, h, en) {
  ctx.font = `800 ${Math.round(h * 0.46)}px ${FONT_EN}`;
  const sp = h * 0.07;
  const tw = [...text].reduce((a, c) => a + ctx.measureText(c).width, 0) + sp * (text.length - 1);
  const w = tw + h * 1.1;
  drawPlate(ctx, plate, cx - w / 2, y, w, h);
  ctx.fillStyle = goldFill(ctx, y + h * 0.25, y + h * 0.75);
  ctx.textBaseline = 'middle';
  spaced(ctx, text, cx, y + h * 0.53, sp);
  ctx.textBaseline = 'alphabetic';
}

// 一张牌：画面 + 统一边框（逆位整体倒置）+ 正向的编号 / 牌名铭牌
function drawCard(ctx, A, c, x, y, w, h) {
  const r = w * 0.012;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.7)'; ctx.shadowBlur = w * 0.12; ctx.shadowOffsetY = w * 0.04;
  ctx.fillStyle = '#0c0809';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
  ctx.translate(x + w / 2, y + h / 2);
  if (c.reversed) ctx.rotate(Math.PI);
  ctx.drawImage(A.arts[c.id], -w / 2, -h / 2, w, h);
  ctx.drawImage(A.frame, -w / 2, -h / 2, w, h);
  ctx.restore();
  plateLabel(ctx, A.plate, c.num, x + w / 2, y + w * 0.024, w * 0.084);
  plateLabel(ctx, A.plate, c.en.toUpperCase(), x + w / 2, y + h - w * 0.036 - w * 0.096, w * 0.096);
}

/**
 * @param o.lang      'zh' | 'en'
 * @param o.head      { eyebrow, small, big, spread, date, question }
 * @param o.cards     [{ id, num, en, name, pos, reversed, badge, keys, text, whisper }]
 * @param o.layout    'one' | 'three' | 'five'
 * @param o.footer    { cta, url }
 * @param o.assets    { art(id), frame, plate, divider, starchart }
 */
export async function renderShare(o) {
  const en = o.lang === 'en';
  const FT = en ? FONT_EN : FONT_ZH;
  const allText = [o.head.small, o.head.big, o.head.spread, o.head.question, o.footer.cta,
    ...o.cards.flatMap((c) => [c.name, c.pos, c.badge, c.text, c.whisper, ...c.keys])].join('');
  await Promise.all([
    document.fonts.load(`900 80px ${FONT_ZH}`, allText),
    document.fonts.load(`400 30px ${FONT_ZH}`, allText),
    document.fonts.load(`600 30px ${FONT_ZH}`, allText),
    document.fonts.load(`800 40px ${FONT_EN}`, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·'),
    document.fonts.load(`600 40px ${FONT_EN}`, allText),
  ]).catch(() => {});

  const A = {
    frame: await loadImg(o.assets.frame), plate: await loadImg(o.assets.plate),
    divider: await loadImg(o.assets.divider), star: await loadImg(o.assets.starchart), arts: {},
  };
  await Promise.all(o.cards.map(async (c) => { A.arts[c.id] = await loadImg(o.assets.art(c.id)); }));

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  /* ── 背景 ── */
  ctx.fillStyle = '#0d090c'; ctx.fillRect(0, 0, W, H);
  let g = ctx.createRadialGradient(W / 2, H * 0.42, 50, W / 2, H * 0.42, H * 0.7);
  g.addColorStop(0, '#2c1626'); g.addColorStop(1, 'rgba(13,9,12,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.45; ctx.drawImage(A.star, W / 2 - 700, H * 0.42 - 700, 1400, 1400); ctx.globalAlpha = 1;
  g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.65)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // 外框细线
  ctx.strokeStyle = 'rgba(200,138,69,.45)'; ctx.lineWidth = 2; ctx.strokeRect(30, 30, W - 60, H - 60);
  ctx.strokeStyle = 'rgba(200,138,69,.2)'; ctx.lineWidth = 1; ctx.strokeRect(42, 42, W - 84, H - 84);

  /* ── 标题 ── */
  ctx.textAlign = 'center';
  ctx.fillStyle = COL.gold; ctx.font = `600 24px ${FONT_EN}`;
  spaced(ctx, o.head.eyebrow, W / 2, 116, 12);
  const bigSize = en ? 84 : 104, smallSize = en ? 46 : 56;
  ctx.font = `${en ? 800 : 900} ${bigSize}px ${FT}`;
  const bigW = ctx.measureText(o.head.big).width;
  ctx.font = `${en ? 800 : 900} ${smallSize}px ${FT}`;
  const smallW = ctx.measureText(o.head.small).width;
  const dotW = 40, total = smallW + dotW + bigW, tx = W / 2 - total / 2, ty = 236;
  ctx.textAlign = 'left';
  ctx.fillStyle = COL.yellow; ctx.shadowColor = 'rgba(246,217,79,.45)'; ctx.shadowBlur = 24;
  ctx.fillText(o.head.small, tx, ty - (bigSize - smallSize) * 0.45);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COL.gold; ctx.font = `600 40px ${FT}`; ctx.fillText('·', tx + smallW + 10, ty - 22);
  ctx.font = `${en ? 800 : 900} ${bigSize}px ${FT}`;
  ctx.shadowColor = 'rgba(200,138,69,.4)'; ctx.shadowBlur = 30;
  ctx.fillStyle = goldFill(ctx, ty - bigSize * 0.85, ty + 6);
  ctx.fillText(o.head.big, tx + smallW + dotW, ty);
  ctx.shadowBlur = 0;
  ctx.drawImage(A.divider, W / 2 - 260, ty + 24, 520, 520 * (A.divider.height / A.divider.width));

  let y = ty + 120;
  ctx.textAlign = 'center';
  ctx.fillStyle = COL.goldHi; ctx.font = `${en ? 600 : 900} 40px ${FT}`;
  spaced(ctx, o.head.spread, W / 2, y, en ? 6 : 12);
  y += 46;
  ctx.fillStyle = COL.muted; ctx.font = `400 24px ${FT}`;
  spaced(ctx, o.head.date, W / 2, y, 3);
  if (o.head.question) {
    y += 52;
    ctx.font = `400 30px ${FONT_ZH}`; ctx.fillStyle = COL.text;
    const ql = wrap(ctx, en ? `“${o.head.question}”` : `「${o.head.question}」`, 860).slice(0, 2);
    ql.forEach((l, i) => ctx.fillText(l, W / 2, y + i * 42));
    y += (ql.length - 1) * 42;
  }
  const headBottom = y + 40;

  /* ── 先排文字、量高度，再定牌的大小，最后把剩余空间分到上下间隔 ── */
  const footerTop = H - 200;
  const contentBottom = footerTop - 48;   // 文字和页脚之间留出呼吸空间
  const textW = 860;
  const items = [];
  if (o.layout === 'one') {
    const c = o.cards[0];
    const f1 = `400 ${en ? 29 : 32}px ${FONT_ZH}`, f2 = `400 ${en ? 26 : 28}px ${FONT_ZH}`;
    ctx.font = f1; const l1 = wrap(ctx, c.text, textW);
    ctx.font = f2; const l2 = wrap(ctx, c.whisper, textW - 40);
    items.push({ type: 'name', c, h: 74 });
    items.push({ type: 'text', lines: l1, lh: 48, font: f1, color: COL.text, h: l1.length * 48 });
    items.push({ type: 'text', lines: l2, lh: 42, font: f2, color: COL.iris, h: l2.length * 42 + 20, gap: 20 });
  } else {
    const five = o.layout === 'five';
    const fT = `400 ${five ? 25 : 27}px ${FONT_ZH}`, fW = `400 ${five ? 22 : 24}px ${FONT_ZH}`;
    o.cards.forEach((c) => {
      ctx.font = fT; const lt = wrap(ctx, c.text, textW).slice(0, 2);
      ctx.font = fW; const lw = five ? [] : wrap(ctx, c.whisper, textW).slice(0, 1);
      const lhT = five ? 36 : 40, lhW = 36;
      items.push({ type: 'card', c, lt, lw, lhT, lhW, fT, fW, h: 46 + lt.length * lhT + lw.length * lhW + 22 });
    });
  }
  const textH = items.reduce((a, it) => a + it.h, 0);

  // 牌区尺寸
  const labelH = o.layout === 'one' ? 0 : 64;
  let cw, ch, cols;
  if (o.layout === 'one') { cols = 1; ch = Math.min(820, contentBottom - headBottom - textH - 90); cw = ch / 1.5; }
  else if (o.layout === 'three') { cols = 3; cw = (W - 140 - 2 * 22) / 3; ch = cw * 1.5; }
  else { cols = 5; cw = 232; ch = cw * 1.5; }   // 五张：略微重叠的扇形，牌更大
  const fanDrop = 76;   // 扇形两端下沉 + 旋转后牌角伸出的高度
  const cardsH = ch + labelH + (o.layout === 'five' ? fanDrop : 0);
  const leftover = Math.max(60, contentBottom - headBottom - cardsH - textH);
  const gapTop = leftover * 0.42, gapMid = leftover * 0.58;
  const cardsTop = headBottom + gapTop;
  const gx = o.layout === 'five' ? 14 : 22;
  const rowW = cols * cw + (cols - 1) * gx;

  /* ── 牌面 ── */
  const fan = o.layout === 'five';
  const fanStep = (W - 150 - cw) / 4;
  const place = (i) => {
    if (!fan) return { x: W / 2 - rowW / 2 + i * (cw + gx), y: cardsTop, rot: 0 };
    const d = i - 2;
    return { x: W / 2 - cw / 2 + d * fanStep, y: cardsTop + d * d * 11, rot: d * 5 * Math.PI / 180 };
  };
  // 扇形时从两边往中间画，中间那张压在最上面
  const order = fan ? [0, 4, 1, 3, 2] : o.cards.map((_, i) => i);
  for (const i of order) {
    const p = place(i);
    ctx.save();
    ctx.translate(p.x + cw / 2, p.y + ch / 2);
    ctx.rotate(p.rot);
    drawCard(ctx, A, o.cards[i], -cw / 2, -ch / 2, cw, ch);
    ctx.restore();
  }
  o.cards.forEach((c, i) => {
    const p = place(i);
    const x = p.x, yy = fan ? cardsTop + fanDrop : p.y;
    if (o.layout !== 'one') {
      ctx.textAlign = 'center';
      ctx.fillStyle = COL.gold; ctx.font = `400 ${en ? 18 : 21}px ${FT}`;
      spaced(ctx, c.pos, x + cw / 2, yy + ch + 28, en ? 2 : 6);
      ctx.font = `600 ${o.layout === 'five' ? (en ? 17 : 22) : (en ? 21 : 25)}px ${FT}`;
      ctx.fillStyle = c.reversed ? COL.rev : COL.goldHi;
      const label = o.layout === 'five' || en ? c.name : (c.reversed ? `${c.name} · ${c.badge}` : c.name);
      spaced(ctx, label, x + cw / 2, yy + ch + 58, en ? 0.5 : 3);
    }
  });

  /* ── 解读文字 ── */
  let ty2 = cardsTop + cardsH + gapMid;
  const x0 = 110;
  for (const it of items) {
    ty2 += it.gap || 0;
    if (it.type === 'name') {
      const c = it.c;
      ctx.textAlign = 'center';
      ctx.font = `900 42px ${FT}`; ctx.fillStyle = COL.goldHi;
      const hw = spaced(ctx, c.name, W / 2 - 50, ty2 + 44, en ? 3 : 8);
      ctx.textAlign = 'left';
      ctx.font = `600 26px ${FT}`; ctx.fillStyle = c.reversed ? COL.rev : COL.yellow;
      ctx.fillText(`◆ ${c.badge}`, W / 2 - 50 + hw / 2 + 24, ty2 + 40);
      ty2 += it.h;
    } else if (it.type === 'text') {
      ctx.textAlign = 'center';
      ctx.font = it.font; ctx.fillStyle = it.color;
      it.lines.forEach((l, k) => ctx.fillText(l, W / 2, ty2 + (k + 1) * it.lh - 12));
      ty2 += it.h - (it.gap || 0);
    } else {
      const c = it.c;
      ctx.textAlign = 'left';
      let yy = ty2 + 34;
      ctx.font = `400 22px ${FT}`; ctx.fillStyle = COL.gold;
      ctx.fillText(c.pos, x0, yy);
      const pw = ctx.measureText(c.pos).width;
      ctx.font = `600 31px ${FT}`; ctx.fillStyle = COL.goldHi;
      ctx.fillText(c.name, x0 + pw + 18, yy + 2);
      const nw = ctx.measureText(c.name).width;
      ctx.font = `600 22px ${FT}`; ctx.fillStyle = c.reversed ? COL.rev : COL.yellow;
      ctx.fillText(`◆ ${c.badge}`, x0 + pw + nw + 36, yy);
      ctx.font = it.fT; ctx.fillStyle = '#ddd0c4';
      it.lt.forEach((l) => { yy += it.lhT; ctx.fillText(l, x0, yy); });
      ctx.font = it.fW; ctx.fillStyle = COL.iris;
      it.lw.forEach((l) => { yy += it.lhW; ctx.fillText(l, x0, yy); });
      ty2 += it.h;
    }
  }
  ctx.textAlign = 'center';

  /* ── 页脚：二维码 + 网址 ── */
  // o.footer.qrImage：外部提供的二维码图片（B 站版用 Toy SDK 生成，指向 Toy 本身）；否则用 url 本地生成
  let qr = null;
  if (o.footer.qrImage) qr = await loadImg(o.footer.qrImage).catch(() => null);
  if (!qr) {
    qr = document.createElement('canvas');
    await QRCode.toCanvas(qr, o.footer.url, { margin: 1, width: 132, color: { dark: '#1a1018', light: '#ecc98a' } });
  }
  const qx = W - 110 - 132, qy = H - 82 - 132;
  ctx.fillStyle = '#ecc98a'; ctx.beginPath(); ctx.roundRect(qx - 8, qy - 8, 148, 148, 6); ctx.fill();
  ctx.drawImage(qr, qx, qy, 132, 132);
  ctx.textAlign = 'left';
  ctx.fillStyle = COL.goldHi; ctx.font = `600 28px ${FT}`;
  ctx.fillText(o.footer.cta, 110, H - 146);
  ctx.fillStyle = COL.muted; ctx.font = `400 22px ${FONT_EN}`;
  ctx.fillText(o.footer.url.replace(/^https?:\/\//, '').replace(/\/$/, ''), 110, H - 104);
  ctx.strokeStyle = 'rgba(200,138,69,.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(110, H - 200); ctx.lineTo(W - 110, H - 200); ctx.stroke();

  return cv;
}
