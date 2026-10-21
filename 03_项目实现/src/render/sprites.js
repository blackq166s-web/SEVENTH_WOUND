// 程序化生成的精灵缓存（无图片资源）。约定：绘制方向为 +X（朝右）
//
// 随机用 fxRandom（core/fx.js）而不是 math.js 的种子流：
// 精灵是"美术生成"，一次生成完就缓存；如果它抽种子流，同 seed 的玩法结果
// 会随"第一次构建精灵的时机"漂移。玩法随机与表现随机必须分开。
import { TAU } from '../core/math.js';
import { fxRandom } from '../core/fx.js';
import { LAYER_PALETTES, ARENA_PALETTE } from './palettes.js';

const CACHE = new Map();
const GROUND_CACHE = new Map();

function cv(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function radial(ctx, x, y, r0, r1, c0, c1) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  return g;
}

/** 不规则有机体轮廓 */
function blobPath(ctx, cx, cy, r, n, seed, wob) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (1 + Math.sin(a * 3 + seed) * wob + Math.sin(a * 5 + seed * 2.3) * wob * 0.55);
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function eyes(ctx, cx, cy, spread, r, color) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = r * 3;
  ctx.fillStyle = color;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(cx, cy + s * spread, r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function build(key, size, draw) {
  if (CACHE.has(key)) return CACHE.get(key);
  const c = cv(size);
  const ctx = c.getContext('2d');
  draw(ctx, size);
  const s = { canvas: c, size };
  CACHE.set(key, s);
  return s;
}

// ---------------- 玩家 ----------------
function drawPlayer(ctx, S) {
  const c = S / 2;
  // 背包
  ctx.fillStyle = '#16202c';
  ctx.beginPath();
  ctx.ellipse(c - 6, c, 10, 11, 0, 0, TAU);
  ctx.fill();

  // 身体
  const g = radial(ctx, c - 3, c - 4, 2, 16, '#5b7594', '#26323f');
  ctx.fillStyle = g;
  blobPath(ctx, c, c, 14, 16, 1.2, 0.05);
  ctx.fill();

  // 装甲边缘
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(150,196,236,0.85)';
  ctx.stroke();

  // 胸甲
  ctx.fillStyle = 'rgba(18,26,36,0.75)';
  ctx.beginPath();
  ctx.ellipse(c + 1, c, 7.5, 9, 0, 0, TAU);
  ctx.fill();

  // 面朝方向的头盔高光
  ctx.fillStyle = '#9fe6ff';
  ctx.save();
  ctx.shadowColor = '#4fd4ff';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.ellipse(c + 7, c, 4.2, 5.6, 0, 0, TAU);
  ctx.fill();
  ctx.restore();

  // 肩甲
  ctx.fillStyle = '#3b4d64';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(c + 1, c + s * 12, 5.5, 4, 0, 0, TAU);
    ctx.fill();
  }
}

// ---------------- 僵尸 ----------------
function drawZombie(ctx, S, seed) {
  const c = S / 2;
  const g = radial(ctx, c - 3, c - 5, 2, 17, '#8fae5e', '#33461f');
  ctx.fillStyle = g;
  blobPath(ctx, c, c, 13.5, 15, seed, 0.07);
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(12,20,8,0.9)';
  ctx.stroke();

  // 腐烂斑块
  ctx.fillStyle = 'rgba(80,30,30,0.5)';
  ctx.beginPath();
  ctx.arc(c - 4, c + 5, 3.4, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(c + 2, c - 6, 2.2, 0, TAU);
  ctx.fill();

  // 前伸的双臂
  ctx.strokeStyle = '#6d8a45';
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(c + 4, c + s * 7);
    ctx.lineTo(c + 14, c + s * 5);
    ctx.stroke();
  }

  eyes(ctx, c + 6, c, 4.4, 2.1, '#ffe066');
}

// ---------------- 疾行者 ----------------
function drawRunner(ctx, S, seed) {
  const c = S / 2;
  const g = radial(ctx, c - 2, c - 4, 2, 15, '#c98a6a', '#5a2a24');
  ctx.fillStyle = g;
  blobPath(ctx, c, c, 11.5, 13, seed, 0.1);
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(30,10,8,0.9)';
  ctx.stroke();

  // 爪子
  ctx.strokeStyle = '#e8d8c0';
  ctx.lineWidth = 2;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(c + 6, c + s * 5);
    ctx.lineTo(c + 14, c + s * 9);
    ctx.stroke();
  }
  eyes(ctx, c + 5, c, 3.8, 1.9, '#ff5b3d');
}

// ---------------- 蜘蛛 ----------------
function drawSpider(ctx, S, seed) {
  const c = S / 2;
  ctx.strokeStyle = '#1b1b24';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) {
      const base = c + (i - 1.5) * 3;
      const swing = Math.sin(seed + i * 1.7) * 3;
      ctx.beginPath();
      ctx.moveTo(base, c + s * 4);
      ctx.quadraticCurveTo(base - 6, c + s * 13, base + 7 + swing, c + s * 15);
      ctx.stroke();
    }
  }
  const g = radial(ctx, c, c - 2, 1, 12, '#4a4a5e', '#14141c');
  ctx.fillStyle = g;
  blobPath(ctx, c, c, 9, 12, seed * 2, 0.12);
  ctx.fill();
  ctx.strokeStyle = '#0a0a10';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.save();
  ctx.shadowColor = '#ff2b3d';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#ff3b4d';
  for (const s of [-1, 0, 1]) {
    ctx.beginPath();
    ctx.arc(c + 5, c + s * 2.6, 1.5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// ---------------- 蜥蜴射手 ----------------
function drawLizard(ctx, S, seed) {
  const c = S / 2;
  // 尾巴
  ctx.strokeStyle = '#4d6b34';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(c - 4, c);
  ctx.quadraticCurveTo(c - 14, c + Math.sin(seed) * 6, c - 22, c + Math.sin(seed) * 10);
  ctx.stroke();

  const g = radial(ctx, c, c - 4, 2, 18, '#9dc25a', '#3e5a24');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(c, c, 15, 11, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(16,26,10,0.9)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // 背刺
  ctx.fillStyle = '#d7e88a';
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(c + i * 5 - 2, c - 9);
    ctx.lineTo(c + i * 5, c - 15);
    ctx.lineTo(c + i * 5 + 2, c - 9);
    ctx.fill();
  }
  eyes(ctx, c + 10, c, 4.6, 2, '#ffb03a');
}

// ---------------- 异形 ----------------
function drawAlien(ctx, S, seed) {
  const c = S / 2;
  const g = radial(ctx, c - 3, c - 6, 2, 22, '#b183d8', '#3a1f57');
  ctx.fillStyle = g;
  blobPath(ctx, c, c, 17, 14, seed, 0.08);
  ctx.fill();
  ctx.strokeStyle = 'rgba(18,6,28,0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 触须
  ctx.strokeStyle = '#8a5fbe';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(c + 10, c + s * 8);
    ctx.quadraticCurveTo(c + 18, c + s * 12 + Math.sin(seed + s) * 4, c + 21, c + s * 5);
    ctx.stroke();
  }
  eyes(ctx, c + 8, c, 6, 2.2, '#c8ff4d');
  ctx.save();
  ctx.shadowColor = '#9dff2b';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#c8ff4d';
  ctx.beginPath();
  ctx.arc(c + 8, c, 2.2, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---------------- 巨兽 ----------------
function drawBrute(ctx, S, seed) {
  const c = S / 2;
  const g = radial(ctx, c - 4, c - 8, 3, 32, '#c0604a', '#4a1712');
  ctx.fillStyle = g;
  blobPath(ctx, c, c, 26, 18, seed, 0.06);
  ctx.fill();
  ctx.strokeStyle = 'rgba(24,6,4,0.95)';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // 骨刺
  ctx.fillStyle = '#efe3cf';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.4;
    const r0 = 24, r1 = 33;
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(a - 0.14) * r0, c + Math.sin(a - 0.14) * r0);
    ctx.lineTo(c + Math.cos(a) * r1, c + Math.sin(a) * r1);
    ctx.lineTo(c + Math.cos(a + 0.14) * r0, c + Math.sin(a + 0.14) * r0);
    ctx.fill();
  }
  eyes(ctx, c + 14, c, 7, 3, '#ff3b2b');
}

// ---------------- 拾取物 ----------------
function drawOrb(ctx, S) {
  const c = S / 2;
  const g = radial(ctx, c, c, 0, 10, 'rgba(120,255,220,1)', 'rgba(20,120,110,0.15)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, 9, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#d8fff6';
  ctx.beginPath();
  ctx.arc(c, c, 3.2, 0, TAU);
  ctx.fill();
}

function drawHealth(ctx, S) {
  const c = S / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(90,255,140,0.9)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#133126';
  ctx.beginPath();
  ctx.roundRect(c - 11, c - 11, 22, 22, 5);
  ctx.fill();
  ctx.strokeStyle = '#5dff9b';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#eafff2';
  ctx.fillRect(c - 6.5, c - 2, 13, 4);
  ctx.fillRect(c - 2, c - 6.5, 4, 13);
  ctx.restore();
}

function drawCrate(ctx, S) {
  const c = S / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(255,180,60,0.85)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#2a2318';
  ctx.beginPath();
  ctx.roundRect(c - 12, c - 12, 24, 24, 4);
  ctx.fill();
  ctx.strokeStyle = '#ffb43c';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,180,60,0.9)';
  ctx.fillRect(c - 12, c - 2, 24, 4);
  ctx.fillRect(c - 2, c - 12, 4, 24);
  ctx.restore();
}

export function getSprites() {
  return {
    player: build('player', 56, drawPlayer),
    zombie: [
      build('zombie0', 52, (c, s) => drawZombie(c, s, 0.7)),
      build('zombie1', 52, (c, s) => drawZombie(c, s, 2.1))
    ],
    runner: [
      build('runner0', 48, (c, s) => drawRunner(c, s, 1.3)),
      build('runner1', 48, (c, s) => drawRunner(c, s, 3.4))
    ],
    spider: [
      build('spider0', 46, (c, s) => drawSpider(c, s, 0.4)),
      build('spider1', 46, (c, s) => drawSpider(c, s, 2.8))
    ],
    lizard: [
      build('lizard0', 60, (c, s) => drawLizard(c, s, 0.9)),
      build('lizard1', 60, (c, s) => drawLizard(c, s, 2.2))
    ],
    alien: [
      build('alien0', 62, (c, s) => drawAlien(c, s, 1.1)),
      build('alien1', 62, (c, s) => drawAlien(c, s, 3.0))
    ],
    brute: [
      build('brute0', 88, (c, s) => drawBrute(c, s, 0.5)),
      build('brute1', 88, (c, s) => drawBrute(c, s, 2.6))
    ],
    orb: build('orb', 24, drawOrb),
    health: build('health', 34, drawHealth),
    crate: build('crate', 36, drawCrate)
  };
}

// ================= 地面（按层配色 + 按层材质） =================
//
// 分两层绘制，用来藏住"平铺感"：
//   1) 主瓦片 512px，repeat：材质主体（肉膜 / 蛛网 / 酸池 / 结晶 / 砖缝）
//   2) 宏观叠层 512px，按 2.7 倍放大再叠一次，半透明：大块污渍，周期变成 ~1380px
// 只做一层 256px 瓦片的时代，酸池会明显"每 256px 重复一次"，一眼假。
//
// 无缝：跨边界元素用 wrapPaint 画 9 次（±S 偏移）；砖缝按 S 的约数排版，天然无缝。
// 随机一律 fxRandom（表现层），不碰 math.js 的种子流。

const GROUND_S = 512;
const MACRO_K = 2.7;   // 宏观叠层放大倍数（与 game.js 的绘制保持一致）

/** 在瓦片 3x3 邻域重复绘制，保证跨边界元素无缝 */
function wrapPaint(ctx, S, x, y, r, paint) {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const cx = x + dx * S;
      const cy = y + dy * S;
      if (cx + r < 0 || cy + r < 0 || cx - r > S || cy - r > S) continue;
      paint(cx, cy);
    }
  }
}

/** 圆形软斑（大量复用） */
function softBlob(ctx, S, x, y, r, color, paintRadius) {
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  wrapPaint(ctx, S, x, y, r, (cx, cy) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = grad;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  });
  if (paintRadius) paintRadius();
}

/** 肉膜：大片斑驳 + 血管（一层 / 二层） */
function groundFlesh(ctx, S, g) {
  for (let i = 0; i < 20; i++) {
    softBlob(ctx, S, fxRandom() * S, fxRandom() * S, S * (0.06 + fxRandom() * 0.16),
      fxRandom() > 0.45 ? g.blotch : g.dark);
  }

  // 血管：深色管壁 + 内侧亮点，暗示"这层是活的"
  for (let i = 0; i < 5; i++) {
    const x0 = fxRandom() * S;
    const y0 = fxRandom() * S;
    let ang = fxRandom() * TAU;
    const step = S * (0.05 + fxRandom() * 0.04);
    const pts = [[0, 0]];
    let x = 0;
    let y = 0;
    for (let k = 0; k < 7; k++) {
      ang += (fxRandom() - 0.5) * 1.0;
      x += Math.cos(ang) * step;
      y += Math.sin(ang) * step;
      pts.push([x, y]);
    }
    wrapPaint(ctx, S, x0, y0, S * 0.8, (cx, cy) => {
      ctx.beginPath();
      for (let k = 0; k < pts.length; k++) {
        const px = cx + pts[k][0];
        const py = cy + pts[k][1];
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = 'rgba(8,2,2,0.50)';
      ctx.lineWidth = S * 0.012;
      ctx.stroke();
      ctx.strokeStyle = g.glow;
      ctx.lineWidth = S * 0.0035;
      ctx.stroke();
    });
  }
}

/** 蛛网：几个结点放射出丝，加黏膜反光（三层） */
function groundWeb(ctx, S, g) {
  for (let i = 0; i < 14; i++) {
    softBlob(ctx, S, fxRandom() * S, fxRandom() * S, S * (0.05 + fxRandom() * 0.13), g.dark);
  }

  // 网的密度要高、单张要小：几张大网会立刻暴露平铺网格
  for (let i = 0; i < 9; i++) {
    const hx = fxRandom() * S;
    const hy = fxRandom() * S;
    const spokes = 6 + Math.floor(fxRandom() * 6);
    const reach = S * (0.06 + fxRandom() * 0.11);
    wrapPaint(ctx, S, hx, hy, reach * 1.2, (cx, cy) => {
      ctx.strokeStyle = g.crack;
      ctx.lineWidth = S * 0.0022;
      ctx.beginPath();
      for (let k = 0; k < spokes; k++) {
        const a = (k / spokes) * TAU + fxRandom() * 0.12;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * reach, cy + Math.sin(a) * reach);
      }
      ctx.stroke();
      for (let ring = 1; ring <= 3; ring++) {
        const rr = (reach / 3.4) * ring;
        ctx.beginPath();
        for (let k = 0; k <= spokes; k++) {
          const a = (k / spokes) * TAU;
          const px = cx + Math.cos(a) * rr;
          const py = cy + Math.sin(a) * rr;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    });
  }

  // 黏膜反光点
  for (let i = 0; i < 40; i++) {
    const x = fxRandom() * S;
    const y = fxRandom() * S;
    const r = S * (0.004 + fxRandom() * 0.008);
    ctx.fillStyle = g.grain[0];
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.6, fxRandom() * 3, 0, TAU);
    ctx.fill();
  }
}

/** 酸池：一摊摊亮边液体 + 蚀痕（四层） */
function groundAcid(ctx, S, g) {
  for (let i = 0; i < 12; i++) {
    softBlob(ctx, S, fxRandom() * S, fxRandom() * S, S * (0.05 + fxRandom() * 0.12), g.dark);
  }

  // 酸池：暗芯 + 亮边，像"正在冒泡的坑"
  for (let i = 0; i < 5; i++) {
    const x = fxRandom() * S;
    const y = fxRandom() * S;
    const r = S * (0.04 + fxRandom() * 0.075);
    const wob = fxRandom() * TAU;   // 每摊形状各不相同，否则一眼就是复制粘贴
    wrapPaint(ctx, S, x, y, r + 6, (cx, cy) => {
      ctx.beginPath();
      const n = 11;
      for (let k = 0; k <= n; k++) {
        const a = (k / n) * TAU;
        const rr = r * (1 + Math.sin(a * 3 + wob) * 0.18 + Math.sin(a * 5 + wob * 2.1) * 0.1);
        const px = cx + Math.cos(a) * rr;
        const py = cy + Math.sin(a) * rr * 0.82;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(6,8,3,0.55)';
      ctx.fill();
      ctx.strokeStyle = g.glow;
      ctx.lineWidth = S * 0.006;
      ctx.stroke();
      ctx.fillStyle = 'rgba(210,255,120,0.10)';
      ctx.fill();
      // 池面气泡与浮渣，让酸池不是一块纯色
      for (let b = 0; b < 5; b++) {
        const ba = fxRandom() * TAU;
        const bd = Math.sqrt(fxRandom()) * r * 0.6;
        ctx.fillStyle = b % 2 ? 'rgba(210,255,130,0.22)' : 'rgba(8,14,4,0.5)';
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ba) * bd, cy + Math.sin(ba) * bd * 0.8, r * (0.05 + fxRandom() * 0.12), 0, TAU);
        ctx.fill();
      }
    });
  }

  // 蚀痕：短促的斜划
  for (let i = 0; i < 30; i++) {
    const x = fxRandom() * S;
    const y = fxRandom() * S;
    const a = fxRandom() * TAU;
    const len = S * (0.02 + fxRandom() * 0.05);
    ctx.strokeStyle = g.crack;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
}

/** 结晶：棱角碎片 + 冷光（五层） */
function groundCrystal(ctx, S, g) {
  for (let i = 0; i < 10; i++) {
    softBlob(ctx, S, fxRandom() * S, fxRandom() * S, S * (0.08 + fxRandom() * 0.16), g.blotch);
  }

  // 棱柱：不规则三角/四边，带一条高光棱
  for (let i = 0; i < 14; i++) {
    const x = fxRandom() * S;
    const y = fxRandom() * S;
    const r = S * (0.014 + fxRandom() * 0.032);
    const n = 3 + Math.floor(fxRandom() * 2);
    const a0 = fxRandom() * TAU;
    wrapPaint(ctx, S, x, y, r + 4, (cx, cy) => {
      ctx.beginPath();
      for (let k = 0; k < n; k++) {
        const a = a0 + (k / n) * TAU + (fxRandom() - 0.5) * 0.5;
        const rr = r * (0.7 + fxRandom() * 0.6);
        const px = cx + Math.cos(a) * rr;
        const py = cy + Math.sin(a) * rr;
        if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(26,12,36,0.75)';
      ctx.fill();
      ctx.strokeStyle = g.crack;
      ctx.lineWidth = S * 0.003;
      ctx.stroke();
      ctx.strokeStyle = g.glow;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.3, cy);
      ctx.lineTo(cx + r * 0.4, cy - r * 0.5);
      ctx.stroke();
    });
  }
}

/** 砖缝：128px 分块 + 铆钉 + 血渍（六层 / 竞技场） */
function groundPlate(ctx, S, g) {
  const T = S / 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= S; i += T) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, S);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(S, i);
    ctx.stroke();
  }
  // 每块砖亮度随机：不要棋盘格，棋盘格一眼就是图案
  for (let gx = 0; gx < S; gx += T) {
    for (let gy = 0; gy < S; gy += T) {
      ctx.fillStyle = fxRandom() > 0.5 ? g.blotch : g.dark;
      ctx.globalAlpha = 0.08 + fxRandom() * 0.30;
      ctx.fillRect(gx + 3, gy + 3, T - 6, T - 6);
      ctx.globalAlpha = 1;
    }
  }
  for (let gx = 0; gx <= S; gx += T) {
    for (let gy = 0; gy <= S; gy += T) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.beginPath();
      ctx.arc(gx, gy, 5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = g.grain[0];
      ctx.beginPath();
      ctx.arc(gx - 1.2, gy - 1.2, 2.4, 0, TAU);
      ctx.fill();
    }
  }
  for (let i = 0; i < 9; i++) {
    softBlob(ctx, S, fxRandom() * S, fxRandom() * S, S * (0.05 + fxRandom() * 0.13), g.accent);
  }
}

/** 所有材质共用的颗粒与裂纹 */
function groundGrain(ctx, S, g) {
  const n = Math.round(S * S * 0.0075);
  for (let i = 0; i < n; i++) {
    const x = fxRandom() * S;
    const y = fxRandom() * S;
    const v = fxRandom();
    ctx.fillStyle = v > 0.7 ? g.grain[0] : v > 0.38 ? g.grain[1] : g.grain[2];
    const w = 1 + fxRandom() * 3.4;
    ctx.fillRect(x, y, w, w);
  }

  for (let i = 0; i < 70; i++) {
    const x = 8 + fxRandom() * (S - 16);
    const y = 8 + fxRandom() * (S - 16);
    const r = S * (0.003 + fxRandom() * 0.006);
    ctx.fillStyle = g.grain[1];
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.75, fxRandom() * 3, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.7, r * 1.05, r * 0.45, 0, 0, TAU);
    ctx.fill();
  }

  ctx.strokeStyle = g.crack;
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 6; i++) {
    let x = fxRandom() * S;
    let y = fxRandom() * S;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (fxRandom() - 0.5) * S * 0.24;
      y += (fxRandom() - 0.5) * S * 0.24;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

/**
 * 某层的主地面瓦片（512px，repeat）。同 palette 只生成一次。
 */
export function makeGroundTile(pal = LAYER_PALETTES[0] || ARENA_PALETTE) {
  const key = `tile:${pal.id || 'default'}`;
  if (GROUND_CACHE.has(key)) return GROUND_CACHE.get(key);

  const S = GROUND_S;
  const c = cv(S);
  const ctx = c.getContext('2d');
  const g = pal.ground;
  ctx.fillStyle = g.base;
  ctx.fillRect(0, 0, S, S);

  if (pal.style === 'flesh') groundFlesh(ctx, S, g);
  else if (pal.style === 'web') groundWeb(ctx, S, g);
  else if (pal.style === 'acid') groundAcid(ctx, S, g);
  else if (pal.style === 'crystal') groundCrystal(ctx, S, g);
  else groundPlate(ctx, S, g);

  groundGrain(ctx, S, g);

  GROUND_CACHE.set(key, c);
  return c;
}

/**
 * 宏观叠层：用同一套材质函数**再随机生成一次**（布局完全不同），绘制时放大 2.7 倍。
 * 两层图案互不对齐，平铺周期被打散，肉眼很难看出网格。
 * 透明底：只画材质特征，不铺基色。
 */
export function makeGroundMacro(pal = LAYER_PALETTES[0] || ARENA_PALETTE) {
  const key = `macro:${pal.id || 'default'}`;
  if (GROUND_CACHE.has(key)) return GROUND_CACHE.get(key);

  const S = GROUND_S;
  const c = cv(S);
  const ctx = c.getContext('2d');
  const g = pal.ground;

  ctx.globalAlpha = 0.55;
  if (pal.style === 'flesh') groundFlesh(ctx, S, g);
  else if (pal.style === 'web') groundWeb(ctx, S, g);
  else if (pal.style === 'acid') groundAcid(ctx, S, g);
  else if (pal.style === 'crystal') groundCrystal(ctx, S, g);
  else groundPlate(ctx, S, g);

  // 再加几块巨大的软污渍，补上低频层次
  ctx.globalAlpha = 0.7;
  for (let i = 0; i < 5; i++) {
    const x = fxRandom() * S;
    const y = fxRandom() * S;
    const r = S * (0.2 + fxRandom() * 0.32);
    softBlob(ctx, S, x, y, r, i % 2 === 0 ? g.blotch : g.dark);
  }
  ctx.globalAlpha = 1;

  GROUND_CACHE.set(key, c);
  return c;
}

export const GROUND_TILE_SIZE = GROUND_S;
export const GROUND_MACRO_SCALE = MACRO_K;
