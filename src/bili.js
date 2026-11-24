// B 站 Toy 专用适配（只在 `npm run build:bili` / `vite --mode bili` 时启用）
// 文档：https://www.bilibili.com/toy/publish/sdk
//   · 安全区：App 内 Toy 全屏展示，状态栏 / 底部导航 / 右上角胶囊按钮会压住页面边缘。
//     safeArea 由 SDK 给出（CSS px），右上角胶囊不计入 safeArea，需要自己留白；方向和尺寸会变，要持续监听。
//   · 分享：App 内用 sharePicture / saveImageToAlbum 代替浏览器下载；二维码用 getQrCode 指向 Toy 本身。
//   · 文本安全：分享图里会出现玩家输入的问题，先用 checkInputSafety 过一遍。

export const BILI = import.meta.env.MODE === 'bili';

// 布局用的额外内边距（JS 计算牌位时使用）；网页版恒为 0
export const INSET = { t: 0, r: 0, b: 0, l: 0 };

// 右上角胶囊按钮预留高度：胶囊大约 32px 高，再留一点间距
const CAPSULE = 44;

let toy = null;
let inApp = false;
const subs = new Set();
export const onInsetChange = (fn) => subs.add(fn);

function loadSdk() {
  return new Promise((resolve) => {
    if (window.toy) return resolve(window.toy);
    const s = document.createElement('script');
    s.src = 'https://s1.hdslb.com/bfs/seed/toy/app/sdk/toy-sdk.js';
    s.async = true;
    s.onload = () => resolve(window.toy || null);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
    setTimeout(() => resolve(window.toy || null), 5000);   // SDK 加载不到也不能卡住页面
  });
}

function applySafeArea(state) {
  const sa = state?.safeArea || { top: 0, right: 0, bottom: 0, left: 0 };
  const root = document.documentElement.style;
  root.setProperty('--sa-t', `${sa.top}px`);
  root.setProperty('--sa-r', `${sa.right}px`);
  root.setProperty('--sa-b', `${sa.bottom}px`);
  root.setProperty('--sa-l', `${sa.left}px`);
  root.setProperty('--cap', `${CAPSULE}px`);
  Object.assign(INSET, { t: sa.top + CAPSULE + 6, r: sa.right, b: sa.bottom, l: sa.left });   // +6：和两行顶栏之间再留点缝
  subs.forEach((fn) => fn(INSET));
}

/** 启动：加载 SDK，App 内接管安全区 */
export const ready = BILI ? (async () => {
  toy = await loadSdk();
  if (!toy) return null;
  document.documentElement.classList.add('bili');
  try { inApp = await toy.isSupport('getContainerState'); } catch { inApp = false; }
  if (inApp) {
    document.documentElement.classList.add('bili-app');
    try { applySafeArea(await toy.getContainerState()); } catch { applySafeArea(null); }
    try { toy.onContainerChange(applySafeArea); } catch { /* 旧客户端 */ }
  }
  return toy;
})() : Promise.resolve(null);

export const isApp = () => inApp;

const can = async (ability) => {
  if (!toy) return false;
  try { return await toy.isSupport(ability); } catch { return false; }
};

/** 分享图二维码：指向当前 Toy 首页（网页 / App 都支持）。拿不到返回 null，调用方用自带二维码兜底 */
export async function toyQr(size = 264) {
  if (!(await can('getQrCode'))) return null;
  try { return await toy.getQrCode({ size }); } catch { return null; }
}

/** 玩家输入是否可以出现在会被分享出去的图片里：只有明确通过才返回 true */
export async function textIsSafe(text) {
  if (!text) return true;
  if (!(await can('checkInputSafety'))) return true;   // 非 B 站环境：沿用原逻辑
  try {
    const r = await toy.checkInputSafety({ text, scene: 'question' });
    return !!r.passed;
  } catch { return false; }
}

/** App 内保存图片到相册 */
export async function saveToAlbum(base64Data, hintMsg) {
  if (!(await can('saveImageToAlbum'))) return false;
  await toy.saveImageToAlbum({ base64Data, hintMsg });
  return true;
}

/** App 内分享图片本身（≤2MB） */
export async function sharePic(base64Data) {
  if (!(await can('sharePicture'))) return false;
  await toy.sharePicture({ base64Data });
  return true;
}

export async function canAppShare() { return can('sharePicture'); }
export async function canAppSave() { return can('saveImageToAlbum'); }

// 开发调试：在普通浏览器里模拟 App 内的安全区，例如 __toyMock({ safeArea: { top: 47, right: 0, bottom: 34, left: 0 } })
if (import.meta.env.DEV && BILI) {
  window.__toyMock = (state) => {
    inApp = true;
    document.documentElement.classList.add('bili', 'bili-app');
    applySafeArea(state);
  };
}
