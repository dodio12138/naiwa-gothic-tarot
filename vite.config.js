import { defineConfig } from 'vite';

// 两个版本：
//   npm run build        → dist/       网页版（GitHub Pages）
//   npm run build:bili   → dist-bili/  B 站 Toy 版（接入 Toy SDK：安全区、相册 / 分享、Toy 二维码）
export default defineConfig(({ mode }) => ({
  base: './',
  server: { host: true, port: 5188 },
  build: { outDir: mode === 'bili' ? 'dist-bili' : 'dist' },
}));
