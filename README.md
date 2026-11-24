# 奶蛙的暗黑命运 · Naiwa Gothic Tarot

在线体验：https://dodio12138.github.io/naiwa-gothic-tarot/

22 张大阿尔卡那的塔罗抽卡网站。Vite + GSAP + Canvas 粒子，无框架。

```bash
npm install
npm run dev      # http://localhost:5188
npm run build    # 输出到 dist/，相对路径，可直接丢到任意静态托管
```

## 功能

- 三种牌阵：今日指引（1）/ 时间之流（3）/ 命运十字（5）
- 解读面板「生成分享图」：浏览器内 Canvas 合成 1080×1920 竖版结果图（牌阵、解读、奶蛙的低语、网址二维码），可保存或调用系统分享
- 首页「一键占卜」：自动洗牌、抽牌、依次揭示
- 洗牌时右上角「跳过」快进到选牌
- 右上角「EN / 中」中英文切换（界面、牌义、奶蛙的低语都有英文版，选择会记住；首次跟随浏览器语言）
- 右上角齿轮设置（存在浏览器本地）：一键占卜、自动翻牌、跳过洗牌动画、逆位、视差/陀螺仪、牌面光效、弱化动效、音效、背景音

## 结构

- `src/cards.js` — 22 张牌数据（正位 / 逆位 / 奶蛙的低语）与牌阵定义
- `src/main.js` — 流程与动效：首页 → 洗牌漩涡 → 扇形选牌 → 翻牌揭示 → 解读 / 大图；视差（鼠标 / 陀螺仪）；运动模糊
- `src/particles.js` — 背景金尘、洗牌漩涡、翻牌爆发粒子
- `src/share.js` — 分享结果图的 Canvas 绘制（单张 / 三张 / 五张扇形三种版式，中英文）
- `src/lights.js` — 22 张牌面的光源清单（月光 / 烛火 / 圣光 / 光环 / 星芒 / 闪电，位置与牌面绑定的动态光效）
- `src/i18n.js` — 中英文界面文案与 22 张牌的英文牌义
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

## 部署

推送到 `main` 分支后，GitHub Actions（`.github/workflows/deploy.yml`）会自动构建并发布到 GitHub Pages。

`assets-src/` 保存全部制作素材：设计文档、提示词、导入脚本，以及 ChatGPT 生成的原图（`chatgpt_art/`）、无字插画 JPG（`illustrations_jpg/`）、边框 / 牌背 / UI 素材原图。网站构建只用 `public/` 里压缩后的版本。
