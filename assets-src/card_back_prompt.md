# 牌背生成提示词 · 奶蛋蛋形徽章

## 上传参考图（两张一起上传）

1. `naiwa_refs/egg/naidan-reference.png` —— 奶蛋标准参考（没有手脚的蛋形），锁定蛋形、颜色、眼睛和嘴巴
   （现在的牌背是当初用 `naiwa_juvenile_turnaround.jpg`，也就是原来的 `naidan_turnaround.jpg` 出的，那张其实是有手脚的幼体）
2. 任意一张已完成的正面牌（推荐 `Naiwa_Tarot_21_THE_WORLD.png`，或总览图 `Naiwa_Tarot_overview.jpg`）—— **只用来锁定边框和画风**

## 主提示词（直接复制）

```text
Design the BACK side of a premium dark gothic tarot card, portrait 2:3 (1024×1536), as a perfectly symmetrical, flat, front-facing graphic.

STYLE MATCH: Use the second uploaded image (a finished front card) as the strict style reference. Match its ornate antique-gold gothic frame exactly: matte old-gold filigree, pointed gothic arches, thin thorny vines, small black roses, tiny crescent-moon and eight-pointed-star emblems, fine engraved detail, the same thin dark outer margin and border thickness, the same cinematic soft lighting and painterly texture.

BACKGROUND: deep charcoal-violet (#17141F) fading to near-black at the edges, with a very subtle dark burgundy (#45203A) glow behind the center. A faint gold engraved lattice / rose-window pattern in the background, low contrast and quiet. The back must feel calmer and emptier than the front cards.

CENTER EMBLEM: a large circular gold medallion in the exact center, ringed by fine concentric circles, small star points, thin radiating rays and two mirrored crescent moons above and below. Inside the medallion sits the logo:

LOGO: use the first uploaded image (the limbless egg character "Naidan") as the identity reference. Keep it a pure EGG: a smooth upright egg shape, slightly wider at the bottom, matte soft-touch 3D surface, warm butter yellow (#F6D94F), lighter cream tone on the lower belly area. Near the top, two slightly protruding round eyes with pale green irises and glossy black pupils, set wide apart, looking straight at the viewer. Between them, a tiny thin gently curved dark-brown line mouth, calm and deadpan. NO arms, NO hands, NO legs, NO feet, NO tail — just the egg with eyes and mouth. The egg is the brightest element of the card and must read clearly even when the card is shown very small (60 px wide).

COMPOSITION: mirror-symmetric left/right, and the frame ornaments also symmetric top/bottom. Generous dark negative space between the medallion and the frame. Frame fills the canvas edge to edge like the front cards.

NO text, no letters, no numbers, no title banners, no card name plates, no watermark, no signature.
```

## 负面提示词（平台支持时填入）

```text
text, letters, numbers, title banner, nameplate, watermark, arms, hands, fingers, legs, feet, tail, full-body character, human face, frog, chick, cartoon outline, glossy plastic, neon colors, purple-tinted yellow, asymmetrical layout, cluttered background, busy scenery, landscape, perspective tilt, 3D card mockup, table surface, drop shadow outside the card, cropped frame
```

## 生成后检查

- [ ] 中间的蛋**没有手脚、没有尾巴**，只有两只绿眼睛 + 一条弧线小嘴
- [ ] 蛋是亮黄色，没有被紫光染色
- [ ] 边框粗细、金色质感和正面牌一致（并排放在一起看）
- [ ] 画面里**没有任何文字**
- [ ] 左右对称；缩到很小时仍能一眼认出中间的黄色蛋
- [ ] 是平面正视图，不是"桌上的一张卡"的样机图

## 常见问题的追加指令

- 长出了小手小脚 → `Remove all limbs. The logo is only an egg with two eyes and a mouth.`
- 背景太花，抢了正面牌的风头 → `Make the background much darker and quieter; keep detail only in the frame and the medallion.`
- 生成了倾斜的卡片样机 → `Flat orthographic front view filling the whole canvas, no perspective, no table, no shadow.`
- 边框和正面牌不一致 → 再上传一张正面牌，加 `Copy the border from this card exactly; only the interior changes.`
