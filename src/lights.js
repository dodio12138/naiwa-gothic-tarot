// 牌面光源清单（人工对照 22 张画面标注）
// [类型, x, y, 大小, 颜色]：x / y 为画面内的相对位置（0~1），大小为相对牌宽的直径
//   moon  冷色月光，缓慢呼吸        flame 暖色烛火，不规则摇曳
//   holy  圣光，脉动 + 缓慢旋转的光芒  spark 星芒闪烁
//   glow  通用柔光呼吸              flash 闪电，偶尔骤亮
//   halo  光环：中心透明、只有一圈发光（用在头顶，避免盖住奶蛙的脸）
const C = {
  cool: '#d6e4ff', silver: '#eef2ff', warm: '#ffc66e', gold: '#ffd77e',
  white: '#fff3d8', red: '#ff5a48', violet: '#c9a2ff', amber: '#ff9a3c',
};

export const LIGHTS = {
  '00': [['moon', 0.32, 0.15, 0.30, C.cool]],
  '01': [['spark', 0.37, 0.10, 0.12, C.white], ['glow', 0.46, 0.15, 0.22, C.gold],
         ['flame', 0.12, 0.37, 0.12, C.warm], ['flame', 0.87, 0.38, 0.12, C.warm], ['moon', 0.82, 0.21, 0.12, C.cool]],
  '02': [['moon', 0.44, 0.07, 0.30, C.cool], ['spark', 0.42, 0.24, 0.10, C.silver],
         ['moon', 0.45, 0.81, 0.18, C.silver], ['glow', 0.45, 0.90, 0.16, C.cool]],
  '03': [['holy', 0.75, 0.04, 0.50, C.warm], ['spark', 0.58, 0.20, 0.12, C.gold]],
  '04': [['glow', 0.20, 0.05, 0.50, C.red], ['spark', 0.73, 0.35, 0.10, C.gold], ['spark', 0.51, 0.21, 0.10, C.gold]],
  '05': [['glow', 0.55, 0.08, 0.36, C.violet], ['flame', 0.13, 0.44, 0.16, C.warm],
         ['flame', 0.85, 0.41, 0.16, C.warm], ['spark', 0.50, 0.12, 0.10, C.gold]],
  '06': [['holy', 0.50, 0.16, 0.55, C.white], ['spark', 0.50, 0.08, 0.14, C.white]],
  '07': [['spark', 0.30, 0.13, 0.08, C.silver], ['spark', 0.50, 0.08, 0.08, C.silver], ['spark', 0.68, 0.14, 0.08, C.silver],
         ['flame', 0.95, 0.52, 0.10, C.warm], ['spark', 0.50, 0.84, 0.12, C.gold]],
  '08': [['moon', 0.71, 0.13, 0.20, C.cool], ['glow', 0.20, 0.26, 0.16, C.gold]],
  '09': [['flame', 0.26, 0.60, 0.26, C.warm], ['moon', 0.67, 0.13, 0.20, C.cool]],
  '10': [['holy', 0.50, 0.32, 0.50, C.gold], ['spark', 0.50, 0.33, 0.14, C.white], ['moon', 0.83, 0.27, 0.16, C.violet]],
  '11': [['moon', 0.50, 0.10, 0.16, C.cool], ['spark', 0.23, 0.30, 0.12, C.white],
         ['flame', 0.08, 0.50, 0.14, C.warm], ['halo', 0.50, 0.29, 0.42, C.gold], ['spark', 0.83, 0.50, 0.08, C.gold]],
  '12': [['moon', 0.60, 0.07, 0.16, C.cool], ['halo', 0.50, 0.68, 0.36, C.gold], ['glow', 0.52, 0.17, 0.18, C.warm],
         ['flame', 0.08, 0.65, 0.10, C.warm], ['flame', 0.90, 0.65, 0.10, C.warm]],
  '13': [['moon', 0.25, 0.10, 0.18, C.cool], ['glow', 0.81, 0.37, 0.24, C.amber], ['spark', 0.66, 0.18, 0.10, C.white]],
  '14': [['moon', 0.33, 0.07, 0.16, C.cool], ['glow', 0.42, 0.42, 0.18, C.silver],
         ['glow', 0.66, 0.24, 0.16, C.warm], ['glow', 0.50, 0.85, 0.26, C.cool]],
  '15': [['glow', 0.48, 0.09, 0.22, C.red], ['flame', 0.07, 0.38, 0.10, C.red], ['flame', 0.12, 0.42, 0.10, C.amber],
         ['flame', 0.90, 0.42, 0.10, C.red], ['flame', 0.95, 0.48, 0.10, C.amber], ['flame', 0.20, 0.55, 0.18, C.amber]],
  '16': [['flash', 0.78, 0.10, 0.40, C.silver], ['flame', 0.60, 0.30, 0.34, C.amber], ['spark', 0.60, 0.08, 0.12, C.gold]],
  '17': [['spark', 0.47, 0.15, 0.30, C.white], ['spark', 0.37, 0.09, 0.08, C.silver], ['spark', 0.58, 0.08, 0.08, C.silver],
         ['spark', 0.32, 0.17, 0.07, C.silver], ['spark', 0.65, 0.20, 0.07, C.silver],
         ['glow', 0.33, 0.66, 0.14, C.silver], ['glow', 0.33, 0.85, 0.22, C.cool], ['glow', 0.75, 0.52, 0.10, C.silver]],
  '18': [['moon', 0.50, 0.15, 0.42, C.silver], ['moon', 0.50, 0.86, 0.26, C.cool]],
  '19': [['holy', 0.67, 0.15, 0.62, C.warm], ['spark', 0.24, 0.23, 0.12, C.gold]],
  '20': [['holy', 0.42, 0.12, 0.44, C.white], ['spark', 0.85, 0.16, 0.14, C.gold], ['glow', 0.45, 0.60, 0.50, C.white],
         ['flame', 0.20, 0.78, 0.14, C.gold], ['flame', 0.55, 0.78, 0.14, C.gold], ['flame', 0.85, 0.78, 0.14, C.gold]],
  '21': [['spark', 0.22, 0.33, 0.14, C.gold], ['spark', 0.78, 0.33, 0.14, C.gold], ['spark', 0.35, 0.05, 0.08, C.white],
         ['spark', 0.70, 0.18, 0.08, C.white], ['spark', 0.30, 0.60, 0.08, C.white], ['spark', 0.72, 0.62, 0.08, C.white]],
};

// 生成某张牌的光效层 HTML；延迟按序号错开，避免同步闪烁
export function lightsHTML(id) {
  const list = LIGHTS[id] || [];
  return `<div class="lights" aria-hidden="true">${list.map(([type, x, y, r, c], i) => {
    const d = ((i * 0.618 + Number(id) * 0.37) % 1).toFixed(2);
    return `<i class="lt lt-${type}" style="--x:${x};--y:${y};--r:${r};--c:${c};--d:${d}"></i>`;
  }).join('')}</div>`;
}
