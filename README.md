# 奶蛙的暗黑命运 · Naiwa Gothic Tarot

在线体验：https://dodio12138.github.io/naiwa-gothic-tarot/

22 张大阿尔卡那的塔罗抽卡网站。Vite + GSAP + Canvas 粒子，无框架。

```bash
npm install
npm run dev      # http://localhost:5188
npm run build    # 输出到 dist/，相对路径，可直接丢到任意静态托管
```

## 功能

- 牌组：完整 78 张（22 大阿卡纳 + 56 小阿卡纳）或仅大阿卡纳，设置里切换；牌义在 data/cards.json
- 牌阵：今日一签（1）/ 单牌指引（1）/ 时间之流（3）/ 十字指引（5），配置在 data/spreads.json
- 设备画质分档：按内存 / 核数 / 系统 / 屏幕自动选高、中、低三档，运行中持续掉帧会自动降档；设置里可手动切换
- 多尺寸适配：首页一屏放下（手机紧凑排版、横屏左右两栏、兜底整体等比缩小）；竖屏平板解读面板从底部升起；揭示时若横排能让牌更大则改横排
- 每日一签：每台设备每天固定一张牌（种子 + 日期哈希），当天再点进入快速回看；记录连续天数
- 图鉴：翻开过的牌自动收录，显示收集进度、抽到次数，未收集的牌为暗影剪影
- 解读面板「生成分享图」：浏览器内 Canvas 合成 1080×1920 竖版结果图（牌阵、解读、奶蛙的低语、网址二维码），可保存或调用系统分享
- 首页「一键抽牌」：自动洗牌、抽牌、依次揭示
- 洗牌时右上角「跳过」快进到选牌
- 右上角「EN / 中」中英文切换（界面、牌义、奶蛙的低语都有英文版，选择会记住；首次跟随浏览器语言）
- 右上角齿轮设置（存在浏览器本地）：一键抽牌、自动翻牌、跳过洗牌动画、逆位、视差/陀螺仪、牌面光效、弱化动效、音效、背景音

## 规划文档

- [docs/roadmap.md](docs/roadmap.md) — 开发路线、现状对照与待决事项
- [docs/design-cosmos.md](docs/design-cosmos.md) — 象征宇宙设计稿（原型、天体、知识图谱）
- [docs/design-spreads.md](docs/design-spreads.md) — 抽牌仪式与牌阵系统设计稿
- [docs/naiwa.md](docs/naiwa.md) — 奶蛙角色资料卡：迷因来源、外形、参考图、IP 风险
- [docs/tarot_slm_technical_design_v0.6.md](docs/tarot_slm_technical_design_v0.6.md) — AI 解读（神经符号混合 SLM）技术设计，v0.4 为旧版

## 结构

- `src/cards.js` — 22 张牌数据（正位 / 逆位 / 奶蛙的低语）与牌阵定义
- `src/main.js` — 流程与动效：首页 → 洗牌漩涡 → 扇形选牌 → 翻牌揭示 → 解读 / 大图；视差（鼠标 / 陀螺仪）；运动模糊
- `src/particles.js` — 背景金尘、洗牌漩涡、翻牌爆发粒子
- `src/perf.js` — 画质分档与帧率监测
- `src/lore.js` — 牌义扩充语料（中英）：画面解读、传统原型与占星对应、正逆位的感情 / 事业 / 建议、奶蛙的多句低语
- `src/journal.js` — 本地记录（localStorage）：每日一签、连续天数、图鉴收集
- `src/share.js` — 分享结果图的 Canvas 绘制（单张 / 三张 / 五张扇形三种版式，中英文）
- `src/lights.js` — 22 张牌面的光源清单（月光 / 烛火 / 圣光 / 光环 / 星芒 / 闪电，位置与牌面绑定的动态光效）
- `src/i18n.js` — 中英文界面文案与 22 张牌的英文牌义
- `src/naiwa.js` — 奶蛙气泡（奶蛋头像 + 对话气泡），台词在 `data/ritual.json`
- `src/game.js` — 奶蛙牌局 · 小猫钓鱼（52 张小牌 + 4 张大牌功能牌）
- `data/visual_symbols.json` — 22 张大牌实际画面的可见符号标注（供以后 AI 解读）
- `src/audio.js` — WebAudio 实时合成的仪式音效与环境底噪（右上角可静音）
- `public/cards/art-{sm,full}/NN.webp` — **画面层**：ChatGPT 去掉原边框并向外补全的全幅插画（原图 `assets-src/chatgpt_art/`，导入脚本 `assets-src/import_art.sh`）
- `public/ui/frame.webp` / `frame-sm.webp` — **统一边框层**：ChatGPT 生成的空边框，绿幕与花窗黑洞抠成透明，所有牌共用、静止不动
- 编号 / 牌名：ChatGPT 生成的空白铭牌 `ui/plate.webp` + 网页文字（Cinzel），悬停显示
- 视差：画面层随鼠标 / 陀螺仪反向移动，边框静止，透过花窗镂空能看到画面在动
- `public/back.webp` — 牌背（ChatGPT 生成，原图 `assets-src/card_back_original.png`）
- `public/ui/` — ChatGPT 生成的 UI 素材：铭牌九宫格 `plate.webp`、分隔花纹 `divider.webp`、徽记 `emblem.webp`、背景星图 `starchart.webp`（透明底）；
  以及预烘焙的牌背方向模糊 `back-blur-{x,y}.webp`（洗牌运动模糊用）
- `assets-src/` — 设定文档、角色参考、各素材原图与提示词

## 更新牌面

原图在 `~/Downloads/Naiwa_Gothic_Tarot/titled/`，重新导出：

```bash
for f in ~/Downloads/Naiwa_Gothic_Tarot/titled/*.png; do
  n=$(basename "$f" | sed -E 's/Naiwa_Tarot_([0-9]+)_.*/\1/')
  cwebp -quiet -q 82 -resize 1024 0 "$f" -o public/cards/full/$n.webp
  cwebp -quiet -q 80 -resize 512 0 "$f" -o public/cards/sm/$n.webp
done
```

## B 站 Toy 版

```bash
npm run toy        # 构建 B 站版到 dist-bili/，并打包成 release/naiwa-tarot-toy.zip
npm run dev:bili   # 本地调试 B 站版（控制台可用 __toyMock({ safeArea: { top: 44, right: 0, bottom: 80, left: 0 } }) 模拟 App 安全区）
```

B 站版（`src/bili.js`，只在 `--mode bili` 时启用）额外接入了 Toy JS SDK：

- 安全区：App 内读取 `safeArea` 并持续监听容器变化，顶栏、首页、牌位、解读面板、详情、图鉴、分享都避开状态栏、底部互动条和右上角胶囊按钮
- 发布平台预览（`/toy/preview/`）拿不到容器状态，按实测尺寸兜底：状态栏 44px、胶囊行约 56～86px、底部互动条 80px
- 分享图：二维码用 `getQrCode` 指向 Toy 本身；App 内「保存图片」走 `saveImageToAlbum`，「分享」走 `sharePicture`
- 玩家输入的问题先经 `checkInputSafety` 检测，未明确通过时不印在分享图上

## 部署

推送到 `main` 分支后，GitHub Actions（`.github/workflows/deploy.yml`）会自动构建并发布到 GitHub Pages。

`assets-src/` 保存全部制作素材：设计文档、提示词、导入脚本，以及 ChatGPT 生成的原图（`chatgpt_art/`）、无字插画 JPG（`illustrations_jpg/`）、边框 / 牌背 / UI 素材原图。网站构建只用 `public/` 里压缩后的版本。

> **出图规则**：要改某张牌面时，从头重新生成（只上传角色身份参考图，必要时加一张风格参考牌），不要把已生成的牌面图上传给 ChatGPT 做二次修改——整张会被重绘，画面发油、涂抹感重。
