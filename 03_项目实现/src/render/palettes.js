// 六层视觉配色（STORY §10 配色分区的代码化）
//
// 一层一套：地面基色/斑驳、血迹底色、雾与暗角、环境浮尘、材质风格。
// 目的不是"换颜色"，而是让玩家一眼知道自己下潜到哪儿了 —— 越深越红、越不像人待的地方。
//
// style 决定地面纹理的画法（见 render/sprites.js 的 makeGroundTile）：
//   flesh   肉膜与血管（一层、二层）
//   web     蛛网与黏膜反光（三层）
//   acid    酸池与蚀痕（四层）
//   crystal 结晶与冷光（五层）
//   plate   砖缝与铆钉（六层 / 竞技场）

export const LAYER_PALETTES = [
  {
    id: 'digest',
    name: '消化场',
    style: 'flesh',
    ground: {
      base: '#271811',
      blotch: 'rgba(122,54,34,0.34)',
      dark: 'rgba(10,5,4,0.50)',
      grain: ['rgba(196,140,96,0.16)', 'rgba(70,44,32,0.50)', 'rgba(6,4,4,0.70)'],
      crack: 'rgba(150,96,64,0.14)',
      accent: 'rgba(63,107,42,0.20)'   // 腐绿点缀（STORY：锈红 + 腐绿）
    },
    blood: '#8f2a1c',
    glow: 'rgba(236,126,92,0.55)',
    fog: 'rgba(70,22,14,0.28)',
    ambient: { color: 'rgba(226,206,170,0.45)', count: 26, size: 1.6, drift: 9 }
  },
  {
    id: 'corridor',
    name: '疾走回廊',
    style: 'flesh',
    ground: {
      base: '#241310',
      blotch: 'rgba(150,22,34,0.30)',
      dark: 'rgba(8,3,4,0.55)',
      grain: ['rgba(210,120,110,0.15)', 'rgba(96,26,30,0.50)', 'rgba(4,2,3,0.72)'],
      crack: 'rgba(190,60,60,0.16)',
      accent: 'rgba(201,214,229,0.10)'  // 骨白点缀
    },
    blood: '#a51622',
    glow: 'rgba(255,96,86,0.50)',
    fog: 'rgba(96,16,24,0.27)',
    ambient: { color: 'rgba(255,150,120,0.35)', count: 30, size: 1.5, drift: 14 }
  },
  {
    id: 'web',
    name: '织网窟',
    style: 'web',
    ground: {
      base: '#1a1d16',
      blotch: 'rgba(63,107,42,0.32)',
      dark: 'rgba(5,8,4,0.55)',
      grain: ['rgba(180,200,160,0.13)', 'rgba(52,70,40,0.45)', 'rgba(4,6,3,0.70)'],
      crack: 'rgba(200,215,190,0.12)',
      accent: 'rgba(124,231,255,0.08)'
    },
    blood: '#4c7a26',
    glow: 'rgba(220,240,200,0.42)',
    fog: 'rgba(30,60,30,0.26)',
    ambient: { color: 'rgba(190,230,150,0.40)', count: 34, size: 1.4, drift: 6 }
  },
  {
    id: 'acid',
    name: '酸池哨塔',
    style: 'acid',
    ground: {
      base: '#1e2218',
      blotch: 'rgba(120,140,40,0.28)',
      dark: 'rgba(6,8,4,0.50)',
      grain: ['rgba(220,230,140,0.13)', 'rgba(70,80,40,0.48)', 'rgba(4,6,3,0.70)'],
      crack: 'rgba(210,255,120,0.16)',
      accent: 'rgba(210,255,120,0.22)'
    },
    blood: '#4c7a26',
    glow: 'rgba(224,255,132,0.60)',
    fog: 'rgba(56,66,18,0.24)',
    ambient: { color: 'rgba(210,255,130,0.40)', count: 24, size: 1.8, drift: 5 }
  },
  {
    id: 'marrow',
    name: '融生腔',
    style: 'crystal',
    ground: {
      base: '#1d1524',
      blotch: 'rgba(107,43,147,0.32)',
      dark: 'rgba(6,3,10,0.55)',
      grain: ['rgba(190,140,240,0.15)', 'rgba(60,24,84,0.48)', 'rgba(4,2,7,0.72)'],
      crack: 'rgba(124,231,255,0.16)',
      accent: 'rgba(124,231,255,0.20)'
    },
    blood: '#6b2b93',
    glow: 'rgba(150,235,255,0.55)',
    fog: 'rgba(48,16,76,0.28)',
    ambient: { color: 'rgba(140,230,255,0.45)', count: 28, size: 1.6, drift: 4 }
  },
  {
    id: 'warden',
    name: '守层者之厅',
    style: 'plate',
    ground: {
      base: '#221417',
      blotch: 'rgba(200,32,43,0.22)',
      dark: 'rgba(6,2,3,0.55)',
      grain: ['rgba(255,120,110,0.11)', 'rgba(90,18,24,0.48)', 'rgba(4,1,2,0.72)'],
      crack: 'rgba(255,45,63,0.16)',
      accent: 'rgba(255,45,63,0.22)'
    },
    blood: '#c8202b',
    glow: 'rgba(255,70,80,0.58)',
    fog: 'rgba(80,10,18,0.30)',
    ambient: { color: 'rgba(255,90,90,0.40)', count: 22, size: 1.6, drift: 7 }
  }
];

/** 竞技场：地渊的胃底，比第六层更红、更闷 */
export const ARENA_PALETTE = {
  id: 'arena',
  name: '竞技场',
  style: 'plate',
  ground: {
    base: '#241015',
    blotch: 'rgba(200,32,43,0.26)',
    dark: 'rgba(7,2,3,0.58)',
    grain: ['rgba(255,110,100,0.12)', 'rgba(100,16,22,0.50)', 'rgba(4,1,2,0.74)'],
    crack: 'rgba(255,45,63,0.18)',
    accent: 'rgba(255,45,63,0.26)'
  },
  blood: '#c8202b',
  glow: 'rgba(255,64,74,0.55)',
  fog: 'rgba(92,8,18,0.31)',
  ambient: { color: 'rgba(255,80,80,0.42)', count: 24, size: 1.7, drift: 8 }
};

export const PALETTE_COUNT = LAYER_PALETTES.length;

/** 按层索引取配色（越界自动夹到最近一层） */
export function paletteForLayer(i) {
  if (!Number.isFinite(i)) return ARENA_PALETTE;
  const k = Math.max(0, Math.min(LAYER_PALETTES.length - 1, Math.round(i)));
  return LAYER_PALETTES[k];
}

/** 把两个 #rrggbb 混色（a 占比 t），用于"敌人血色"叠一层该层底色 */
export function mixHex(a, b, t) {
  const pa = parseInt(a.replace('#', ''), 16);
  const pb = parseInt(b.replace('#', ''), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgba(${r},${g},${bl},0.5)`;
}
