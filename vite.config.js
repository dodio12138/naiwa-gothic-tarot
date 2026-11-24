import { defineConfig } from 'vite';

// 两个版本：
//   npm run build        → dist/       网页版（GitHub Pages）
//   npm run build:bili   → dist-bili/  B 站 Toy 版（接入 Toy SDK：安全区、相册 / 分享、Toy 二维码）

// B 站版内容收敛：Toy 的自动审核会扫描 JS 包里的全部文字。
// 构建时从牌数据里去掉「传统原型」与「占星对应」两段（涉及宗教人物、神秘学术语），只在网页版保留
function biliContent() {
  return {
    name: 'naiwa-bili-content',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('/data/cards.json')) return null;
      const data = JSON.parse(code);
      for (const c of data.cards) { delete c.origin; delete c.astro; }
      return { code: JSON.stringify(data), map: null };   // 仍返回 JSON，交给 Vite 自带的 JSON 插件
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: './',
  server: { host: true, port: 5188 },
  plugins: mode === 'bili' ? [biliContent()] : [],
  build: { outDir: mode === 'bili' ? 'dist-bili' : 'dist' },
}));
