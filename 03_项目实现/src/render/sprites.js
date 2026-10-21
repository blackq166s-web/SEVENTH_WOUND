// 程序化生成的精灵缓存（无图片资源）。约定：绘制方向为 +X（朝右）
import { TAU, random } from '../core/math.js';

const CACHE = new Map();

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

/** 地面瓦片（暗色，带颗粒与裂纹） */
export function makeGroundTile() {
  const S = 256;
  const c = cv(S);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1e222a';
  ctx.fillRect(0, 0, S, S);

  // 大尺度斑驳，避免地面死板（9 次绘制保证瓦片无缝）
  for (let i = 0; i < 34; i++) {
    const x = random() * S;
    const y = random() * S;
    const r = 18 + random() * 52;
    const bright = random() > 0.45;
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0, bright ? 'rgba(72,82,98,0.34)' : 'rgba(8,9,12,0.40)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cx = x + dx * S;
        const cy = y + dy * S;
        if (cx + r < 0 || cy + r < 0 || cx - r > S || cy - r > S) continue;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.fillRect(-r, -r, r * 2, r * 2);
        ctx.restore();
      }
    }
  }

  for (let i = 0; i < 850; i++) {
    const x = random() * S;
    const y = random() * S;
    const v = random();
    ctx.fillStyle = v > 0.7
      ? 'rgba(118,132,152,0.26)'
      : v > 0.38 ? 'rgba(52,60,72,0.6)' : 'rgba(6,7,9,0.7)';
    ctx.fillRect(x, y, 1 + random() * 2.6, 1 + random() * 2.6);
  }

  // 碎石
  for (let i = 0; i < 46; i++) {
    const x = 6 + random() * (S - 12);
    const y = 6 + random() * (S - 12);
    const r = 1.4 + random() * 2.6;
    ctx.fillStyle = 'rgba(96,108,126,0.16)';
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.75, random() * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.7, r * 1.05, r * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 细裂纹
  ctx.strokeStyle = 'rgba(130,144,166,0.16)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    let x = random() * S, y = random() * S;
    ctx.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += (random() - 0.5) * 60;
      y += (random() - 0.5) * 60;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return c;
}
