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

// ================= 绘制工具 =================
//
// 统一做法（就是"不再糙"的关键）：
//   1) 先定路径 → 2) 填基色 → 3) 裁剪后叠"左上高光 / 右下暗部" → 4) 最后描黑边
// 这样每只怪都有体积感和**统一的光源方向**（左上），比原来"径向渐变球 + 眼睛"像实物。
//
// 形状语言（STORY §10）：地渊造物一律不对称（歪重心 / 肢体不等 / 轮廓有破口），
// 人类遗留物一律对称（直角 / 分模线 / 铆钉）。玩家能靠剪影分辨"这东西是谁做的"。

function pathPoly(ctx, pts) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
  }
  ctx.closePath();
}

function pathEllipse(ctx, cx, cy, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, rot, 0, TAU);
}

/** 胶囊形路径（圆头长条）：画手臂/肢体，天生没有直角 */
function capsulePath(ctx, x1, y1, x2, y2, r) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.arc(x1, y1, r, a + Math.PI / 2, a - Math.PI / 2);
  ctx.arc(x2, y2, r, a - Math.PI / 2, a + Math.PI / 2);
  ctx.closePath();
}

/** 三色调 + 左上定向光 + 黑边 */
function shadeBody(ctx, pathFn, cx, cy, r, base, hi, lo, outline = 'rgba(0,0,0,0.62)', lw = 1.8) {
  // S7-C 卡通化：描边统一加粗加深（在调用点传值的基础上再强化），
  // 改在函数内部做，所有精灵一次受益，不用逐个调用点改参数。
  const olw = Math.max(2.8, lw * 1.6);
  const ocol = 'rgba(0,0,0,0.88)';

  pathFn();
  ctx.fillStyle = base;
  ctx.fill();

  ctx.save();
  pathFn();
  ctx.clip();

  let g = ctx.createRadialGradient(cx - r * 0.42, cy - r * 0.5, r * 0.06, cx - r * 0.42, cy - r * 0.5, r * 1.15);
  g.addColorStop(0, hi);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - r * 2.2, cy - r * 2.2, r * 4.4, r * 4.4);

  g = ctx.createRadialGradient(cx + r * 0.55, cy + r * 0.6, r * 0.1, cx + r * 0.55, cy + r * 0.6, r * 1.55);
  g.addColorStop(0, lo);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(cx - r * 2.2, cy - r * 2.2, r * 4.4, r * 4.4);

  // 左上轮廓光：在裁剪区内沿路径描一道亮边并整体左上偏移，做出'被光打亮'的边缘
  ctx.globalAlpha = 0.8;
  ctx.translate(-1.2, -1.2);
  pathFn();
  ctx.strokeStyle = hi;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.translate(1.2, 1.2);
  ctx.globalAlpha = 1;
  ctx.restore();

  if (outline) {
    pathFn();
    ctx.strokeStyle = ocol;
    ctx.lineWidth = olw;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

/** 锥形肢体：起点宽 w1，终点宽 w2 */
function limb(ctx, x1, y1, x2, y2, w1, w2, fill, outline = 'rgba(0,0,0,0.5)') {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  pathPoly(ctx, [
    [x1 + (nx * w1) / 2, y1 + (ny * w1) / 2],
    [x2 + (nx * w2) / 2, y2 + (ny * w2) / 2],
    [x2 - (nx * w2) / 2, y2 - (ny * w2) / 2],
    [x1 - (nx * w1) / 2, y1 - (ny * w1) / 2]
  ]);
  ctx.fillStyle = fill;
  ctx.fill();
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }
}

/** 折线肢（带关节），用于蜘蛛/疾行者的细腿 */
function jointLimb(ctx, pts, w, fill, outline = 'rgba(0,0,0,0.5)') {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.strokeStyle = outline;
  ctx.lineWidth = w + 1.4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.strokeStyle = fill;
  ctx.lineWidth = w;
  ctx.stroke();
}

/** 发光的眼睛（S7-C 卡通化）：眼径 ×1.4、辉光更强，并加黑色瞳孔做出"在看" */
function glowEyes(ctx, pts, r, color, blur = 7) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur * 1.5;
  ctx.fillStyle = color;
  for (const p of pts) {
    const pr = (p[2] || r) * 1.4;
    ctx.beginPath();
    ctx.arc(p[0], p[1], pr, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  // 黑瞳孔：偏向前方（+X 朝向），让"在看"有方向感
  ctx.fillStyle = 'rgba(12,8,10,0.85)';
  for (const p of pts) {
    const pr = (p[2] || r) * 1.4;
    ctx.beginPath();
    ctx.arc(p[0] + pr * 0.2, p[1], pr * 0.42, 0, TAU);
    ctx.fill();
  }
}

// ================= 玩家（72px，S7-B 极简版）=================
//
// 俯视角 + 单色剪影：整个身体只有一个主色 + 描边，可读要素只有三个——
//   头（发光眼）、肩背（一个大椭圆）、持枪手（枪是游戏另画的）。
// 删掉的：背脊线、双肩圆、领口、头发分层、护胸——俯视里全是噪音。
// 左臂胶囊保留：game.js 要在它上面画层数布条。
function drawPlayer(ctx, S, t = 0) {
  const c = S / 2;
  const swing = Math.sin(t * TAU) * 1.4;
  const K = 1.6;

  ctx.save();
  ctx.translate(c, c);
  ctx.scale(K, K);
  ctx.translate(-c, -c);

  // 肩背：一个圆角胶囊（比椭圆更卡通），主色 + 粗描边
  shadeBody(ctx, () => capsulePath(ctx, c - 8, c, c + 4, c, 11), c - 2, c, 12,
    '#39485e', '#8ea8c2', 'rgba(4,6,10,0.55)', 'rgba(0,0,0,0.85)', 3);

  // 持枪手：一个小圆（枪由 game.js 另画，从手的位置延伸）
  ctx.fillStyle = '#c9d6e5';
  ctx.beginPath();
  ctx.arc(c + 9, c + 4, 3.4, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // 左臂（缠布条）：game.js 在这条手臂上叠层数布条
  capsulePath(ctx, c + 2, c - 9, c + 8.5, c - 13 + swing, 3.4);
  ctx.fillStyle = '#6b6054';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // 头：单色圆 + 发光眼（卡通化的核心：眼睛要大、要亮）
  shadeBody(ctx, () => pathEllipse(ctx, c + 8, c - 1, 6.6, 7), c + 8, c - 2, 7,
    '#8a6a52', '#c9a184', 'rgba(30,18,12,0.5)', 'rgba(0,0,0,0.85)', 3);

  // 发光眼：俯视里唯一需要亮的东西
  glowEyes(ctx, [[c + 11, c - 2.4, 1.9], [c + 12.4, c + 0.6, 1.5]], 1.7, '#ffd166', 9);

  ctx.restore();
}

// ================= 腐化者（56px）=================
function drawZombie(ctx, S, t = 0) {
  const c = S / 2;
  const drag = Math.sin(t * TAU) * 1.4;

  // 背后拖出的菌丝（俯视时唯一能"看见"的背面信息）
  ctx.strokeStyle = 'rgba(190,210,160,0.45)';
  for (let i = 0; i < 5; i++) {
    ctx.lineWidth = 1.3 - i * 0.16;
    ctx.beginPath();
    ctx.moveTo(c - 10, c - 3 + i * 1.6);
    ctx.quadraticCurveTo(c - 18 - i * 3, c - 9 + i * 3.2, c - 25 - i * 4, c - 6 + i * 4.4);
    ctx.stroke();
  }

  // 肩背：歪的椭圆（不对称 = 重铸时没对齐）
  shadeBody(ctx, () => pathEllipse(ctx, c - 1, c + 0.5, 11, 12.5, -0.1), c - 1, c, 12.5,
    '#6b7f47', '#a8bd72', 'rgba(14,22,8,0.68)', 'rgba(0,0,0,0.7)', 1.8);

  // 背上一排骨节（俯视能看到的就是这些）
  ctx.fillStyle = 'rgba(226,214,190,0.8)';
  for (let i = 0; i < 5; i++) {
    const x = c - 8 + i * 3;
    ctx.beginPath();
    ctx.ellipse(x, c + 0.5, 1.4, 2, 0, 0, TAU);
    ctx.fill();
  }

  // 两条前伸的手臂：一条长、一条被折断
  capsulePath(ctx, c + 5, c - 8, c + 16, c - 10 + drag, 3.2);
  ctx.fillStyle = '#63783f';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  capsulePath(ctx, c + 5, c + 8, c + 12, c + 13 - drag, 3.2);
  ctx.fillStyle = '#4f6236';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(120,30,30,0.85)';
  ctx.beginPath();
  ctx.arc(c + 12.5, c + 13 - drag, 2.2, 0, TAU);
  ctx.fill();

  // 头：歪向前侧
  shadeBody(ctx, () => pathEllipse(ctx, c + 9.5, c - 1.5, 6.2, 6.6, 0.2), c + 9.5, c - 2.5, 6.6,
    '#7d9152', '#b8cc82', 'rgba(16,24,10,0.62)', 'rgba(0,0,0,0.64)', 1.5);
  glowEyes(ctx, [[c + 11.5, c - 3.4, 1.9], [c + 14.4, c - 0.8, 1.4]], 1.6, '#ffe066', 6);
}

// ================= 疾行者（52px）=================
function drawRunner(ctx, S, t = 0) {
  const c = S / 2;
  const gait = Math.sin(t * TAU) * 2;

  // 细长的身体，前倾
  shadeBody(ctx, () => pathEllipse(ctx, c - 2, c, 13.5, 8.5, -0.06), c - 2, c, 11,
    '#b5674f', '#e0a084', 'rgba(52,20,14,0.66)', 'rgba(0,0,0,0.7)', 1.7);

  // 背刺：只长在中轴一侧（俯视看到的就是"一排骨刺"），别两侧都长成虾
  ctx.fillStyle = 'rgba(240,228,206,0.92)';
  for (let i = 0; i < 4; i++) {
    const x = c - 9 + i * 4.4;
    const h = 2.6 + (i % 3) * 1.2;
    pathPoly(ctx, [[x, c - 1], [x + 2.2, c - 2.4 - h], [x + 4, c - 1]]);
    ctx.fill();
  }

  // 两条长臂：从体侧伸出去前伸，细一点，别和身体糊成一块
  for (const s of [-1, 1]) {
    capsulePath(ctx, c + 4, c + s * 8.5, c + 17, c + s * (11 + gait * 0.4), 2.6);
    ctx.fillStyle = s > 0 ? '#a55f47' : '#c07358';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 头：低伏前伸
  shadeBody(ctx, () => pathEllipse(ctx, c + 13, c, 6, 5.4, 0.05), c + 13, c, 6,
    '#c07358', '#e8ac8c', 'rgba(60,22,16,0.6)', 'rgba(0,0,0,0.64)', 1.4);
  ctx.fillStyle = 'rgba(24,8,6,0.9)';
  pathPoly(ctx, [[c + 15, c - 2.2], [c + 19, c - 0.6], [c + 17.6, c + 2], [c + 14.6, c + 1.6]]);
  ctx.fill();
  glowEyes(ctx, [[c + 14, c - 2.2, 1.6], [c + 15.6, c + 1, 1.2]], 1.4, '#ff5b3d', 6);
}

// ================= 织网者（50px，腿就是它的精髓，保留）=================
function drawSpider(ctx, S, t = 0) {
  const c = S / 2;
  const step = Math.sin(t * TAU) * 1.8;

  // 8 条细腿，上侧 5 下侧 3（不对称），放射状
  const legs = [
    [-3, -6, 13, 3], [-1, -8, 9, 6], [1, -8, 3, 8], [3, -7, -3, 7], [5, -5, -8, 5],
    [-1, 8, 10, 4], [2, 8, 2, 7], [5, 6, -6, 5]
  ];
  for (const [ox, oy, ex, mid] of legs) {
    const side = Math.sign(oy);
    jointLimb(ctx, [
      [c - 1 + ox * 0.5, c + oy * 0.5],
      [c + mid * 0.4 + ox * 0.3, c + oy * 1.55],
      [c + ex * 1.05 + step * side * 0.7, c + oy * 1.8 + Math.abs(ex) * 0.18]
    ], 2.2, '#282838');
  }

  // 腹部 + 头胸部：两个椭圆，都是圆的（没有直角）
  shadeBody(ctx, () => pathEllipse(ctx, c - 7, c + 1, 9.5, 8.2, -0.12), c - 9, c - 1, 8,
    '#33334a', '#6a6a86', 'rgba(4,4,8,0.72)', 'rgba(0,0,0,0.72)', 1.6);
  shadeBody(ctx, () => pathEllipse(ctx, c + 6, c - 1, 6, 5.2, 0.08), c + 5, c - 2, 5.5,
    '#3d3d58', '#7a7a9c', 'rgba(6,6,12,0.7)', 'rgba(0,0,0,0.7)', 1.4);

  // 卵囊：暗色小椭圆 + 一圈微光
  ctx.fillStyle = 'rgba(40,48,30,0.92)';
  ctx.beginPath();
  ctx.ellipse(c - 10, c + 5, 4.4, 3.4, 0.35, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(190,220,150,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();

  glowEyes(ctx, [[c + 8.5, c - 2.6, 1.4], [c + 9.8, c + 0.6, 1.1], [c + 7.4, c + 1.6, 1]], 1.3, '#ff3b4d', 7);
}

// ================= 哨眼（64px）=================
function drawLizard(ctx, S, t = 0) {
  const c = S / 2;
  const breathe = Math.sin(t * TAU) * 1.1;
  const charge = t > 0.5;

  // 四条短腿：放射状，藏在身体下面只露爪尖（不是"四肢站立"）
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.5;
    jointLimb(ctx, [
      [c + Math.cos(a) * 6, c + Math.sin(a) * 6],
      [c + Math.cos(a) * 11, c + Math.sin(a) * 11]
    ], 3, '#3d5628');
  }

  // 身体：一个圆润的椭圆，前端隆起
  shadeBody(ctx, () => pathEllipse(ctx, c - 1, c + 0.5, 12.5, 11, -0.05), c - 1, c - 1, 12,
    '#77944a', '#b4cd76', 'rgba(22,36,12,0.64)', 'rgba(0,0,0,0.68)', 1.7);

  // 背甲：三块小三角，间距不等
  ctx.fillStyle = '#d7e88a';
  for (let i = 0; i < 3; i++) {
    const x = c - 8 + i * 5.4;
    pathPoly(ctx, [[x, c - 4 + i * 0.4], [x + 2.4, c - 8 - i * 0.6], [x + 5, c - 4 + i * 0.4]]);
    ctx.fill();
  }

  // 背部骨管（射口）
  ctx.save();
  shadeBody(ctx, () => pathEllipse(ctx, c + 2, c - 8, 5.4, 3.2, -0.5), c + 2, c - 9, 4,
    '#33452a', '#5f7a4a', 'rgba(8,14,6,0.6)', 'rgba(0,0,0,0.6)', 1.2);
  if (charge) {
    ctx.shadowColor = '#b6ff5c';
    ctx.shadowBlur = 9;
    ctx.fillStyle = 'rgba(182,255,92,0.9)';
    ctx.beginPath();
    ctx.arc(c + 4.8, c - 9.6, 2.2, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // 头：与身体连成一体（不画成"贴上去的楔子"）
  shadeBody(ctx, () => pathEllipse(ctx, c + 11, c - 0.5, 7.2, 7, 0.05), c + 11, c - 1.5, 7,
    '#8aa955', '#c6dd8a', 'rgba(26,40,16,0.6)', 'rgba(0,0,0,0.66)', 1.5);

  // 独眼：大、偏前
  ctx.save();
  ctx.shadowColor = '#ffd166';
  ctx.shadowBlur = charge ? 15 : 8;
  ctx.fillStyle = '#ffe27a';
  ctx.beginPath();
  ctx.ellipse(c + 12.6, c - 1, 4.4, 3.9, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  // 一圈暗边，让眼睛从绿色身体上"陷"进去
  ctx.strokeStyle = 'rgba(20,28,10,0.75)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(c + 12.6, c - 1, 4.4, 3.9, 0, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = '#160f04';
  ctx.beginPath();
  ctx.ellipse(c + 13.4, c - 1, 1.3, 2.4, 0, 0, TAU);
  ctx.fill();
}

// ================= 融生体（68px）=================
function drawAlien(ctx, S, t = 0) {
  const c = S / 2;
  const wob = Math.sin(t * TAU) * 1.5;

  // 三团大小不同的圆块粘在一起（全是圆，没有一条直线）
  shadeBody(ctx, () => pathEllipse(ctx, c - 8 + wob * 0.3, c + 6, 10.5, 9, 0.35), c - 10, c + 4, 9.5,
    '#4a2666', '#8b57b0', 'rgba(14,4,24,0.66)', 'rgba(0,0,0,0.64)', 1.5);
  shadeBody(ctx, () => pathEllipse(ctx, c + 4, c - 9 - wob * 0.25, 8.6, 7.2, -0.3), c + 3, c - 11, 8,
    '#542c74', '#9a63c2', 'rgba(16,4,28,0.66)', 'rgba(0,0,0,0.64)', 1.5);
  shadeBody(ctx, () => pathEllipse(ctx, c - 0.5, c + 0.5, 12.5, 11, 0.08), c - 1, c, 12,
    '#5c3080', '#a86fd0', 'rgba(18,6,30,0.62)', 'rgba(0,0,0,0.68)', 1.7);

  // 融进去的人手：朝身体前方伸出来（掌 + 三指），位置压在体块上而不是飘在外面
  ctx.fillStyle = 'rgba(206,178,150,0.95)';
  ctx.beginPath();
  ctx.ellipse(c + 7, c - 6, 4.4, 4.8, -0.35, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(60,36,24,0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const a = -0.75 + i * 0.34;
    capsulePath(ctx, c + 9, c - 4, c + 9 + Math.cos(a) * 9, c - 4 + Math.sin(a) * 9, 1.35);
    ctx.fillStyle = 'rgba(214,188,160,0.95)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,36,24,0.45)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // 兽爪：两根弯钩
  ctx.strokeStyle = 'rgba(238,226,204,0.85)';
  ctx.lineWidth = 1.8;
  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    ctx.moveTo(c + 8 + i * 3.4, c + 6);
    ctx.quadraticCurveTo(c + 14 + i * 3, c + 9, c + 12 + i * 3, c + 14);
    ctx.stroke();
  }

  // 冷青管路
  ctx.strokeStyle = 'rgba(124,231,255,0.4)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(c - 13, c - 1);
  ctx.quadraticCurveTo(c - 4, c + 3 + wob, c + 3, c - 6);
  ctx.stroke();

  glowEyes(ctx, [[c + 7, c - 12, 1.8], [c + 10.4, c - 9.4, 1.2], [c + 4, c - 8.4, 1.4], [c - 3, c - 9.6, 1]], 1.3, '#7ce7ff', 8);
}

// ================= 守层者（96px）=================
function drawBrute(ctx, S, t = 0) {
  const c = S / 2;
  const breathe = Math.sin(t * TAU) * 2;

  // 肩膀：一个极宽的椭圆，重心偏后
  shadeBody(ctx, () => pathEllipse(ctx, c - 2, c - 1, 17, 21, -0.04), c - 2, c - 2, 21,
    '#7d1520', '#c0303c', 'rgba(30,4,8,0.64)', 'rgba(0,0,0,0.74)', 2.2);

  // 胸前的束带（人类装备长在怪物身上）
  ctx.strokeStyle = 'rgba(46,50,58,0.85)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(c - 14, c - 14);
  ctx.lineTo(c + 8, c + 8);
  ctx.stroke();

  // 七道旧枪伤：结痂先画、伤口后画
  ctx.strokeStyle = 'rgba(58,8,14,0.6)';
  ctx.lineWidth = 2.2;
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.moveTo(c - 10, c - 13.5 + i * 4.2);
    ctx.lineTo(c + 6, c - 15 + i * 4.2);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,96,104,0.9)';
  for (let i = 0; i < 7; i++) {
    ctx.lineWidth = i % 2 ? 1.2 : 1.8;
    const inset = (i % 3) * 1.8;
    ctx.beginPath();
    ctx.moveTo(c - 9 + inset, c - 13.9 + i * 4.2);
    ctx.lineTo(c + 5 - inset * 0.5, c - 15.4 + i * 4.2);
    ctx.stroke();
  }

  // 左臂：粗，握拳
  capsulePath(ctx, c - 13, c - 10, c - 22, c + 4 + breathe, 6.4);
  ctx.fillStyle = '#6d121c';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = '#8e1c26';
  ctx.beginPath();
  ctx.arc(c - 23, c + 7 + breathe, 6, 0, TAU);
  ctx.fill();
  ctx.stroke();

  // 右臂：前臂就是炮管
  capsulePath(ctx, c + 11, c - 9, c + 19, c + 1, 6.2);
  ctx.fillStyle = '#6d121c';
  ctx.fill();
  ctx.stroke();
  ctx.save();
  ctx.translate(c + 19, c + 1);
  ctx.fillStyle = '#20232a';
  ctx.beginPath();
  ctx.roundRect(0, -5.5, 15, 11, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.fillStyle = '#33383f';
  ctx.beginPath();
  ctx.roundRect(12, -7, 5, 14, 2);
  ctx.fill();
  ctx.fillStyle = '#07080a';
  ctx.beginPath();
  ctx.ellipse(17.5, 0, 2.2, 4.6, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(206,196,176,0.45)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(6, -5.6);
  ctx.lineTo(7, 5.6);
  ctx.stroke();
  ctx.restore();

  // 头：直接落在肩上（没有脖子，比例错乱但要连着）
  shadeBody(ctx, () => pathEllipse(ctx, c + 10, c - 13, 9.4, 8.8, 0.1), c + 10, c - 14, 9,
    '#2a2f36', '#5b646f', 'rgba(4,6,8,0.6)', 'rgba(0,0,0,0.72)', 1.7);
  ctx.strokeStyle = 'rgba(10,12,16,0.9)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(c + 5, c - 13);
  ctx.lineTo(c + 16, c - 12.2);
  ctx.stroke();
  glowEyes(ctx, [[c + 10.6, c - 14.4, 1.7], [c + 13.6, c - 10.6, 1.4]], 1.5, '#ff3b4d', 9);
}

// ================= 拾取物（人类遗留物：严格对称 + 工业配色） =================
function drawOrb(ctx, S) {
  const c = S / 2;
  const r = S * 0.3;
  // 光晕
  const g = ctx.createRadialGradient(c, c, 0, c, c, S * 0.5);
  g.addColorStop(0, 'rgba(124,231,255,0.55)');
  g.addColorStop(1, 'rgba(124,231,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  // 晶体：六边形，带一条内部高光
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2;
    const x = c + Math.cos(a) * r;
    const y = c + Math.sin(a) * r * 1.08;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const gg = ctx.createLinearGradient(c - r, c - r, c + r, c + r);
  gg.addColorStop(0, '#e8fdff');
  gg.addColorStop(0.5, '#7ce7ff');
  gg.addColorStop(1, '#1d7f96');
  ctx.fillStyle = gg;
  ctx.fill();
  ctx.strokeStyle = 'rgba(6,24,30,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(c - r * 0.4, c - r * 0.1);
  ctx.lineTo(c + r * 0.15, c - r * 0.55);
  ctx.stroke();
}

function drawHealth(ctx, S) {
  const c = S / 2;
  const w = S * 0.34;
  const h = S * 0.28;
  // 金属盒
  ctx.fillStyle = '#3d4652';
  ctx.beginPath();
  ctx.roundRect(c - w, c - h, w * 2, h * 2, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // 顶盖高光（左上）
  ctx.fillStyle = 'rgba(190,205,220,0.35)';
  ctx.fillRect(c - w + 1.5, c - h + 1.5, w * 2 - 3, 3);
  // 药剂窗（绿色）+ 液面
  ctx.fillStyle = '#0d1a12';
  ctx.fillRect(c - w * 0.45, c - h * 0.5, w * 0.9, h * 1.1);
  ctx.fillStyle = '#5dff9b';
  ctx.fillRect(c - w * 0.45, c - h * 0.1, w * 0.9, h * 0.7);
  // 十字
  ctx.fillStyle = '#e9f4ff';
  ctx.fillRect(c - 1.6, c - h - 5, 3.2, 8);
  ctx.fillRect(c - 4, c - h - 1.8, 8, 3.2);
}

function drawCrate(ctx, S) {
  const c = S / 2;
  const w = S * 0.36;
  const h = S * 0.3;
  // 军械箱
  ctx.fillStyle = '#4a4038';
  ctx.beginPath();
  ctx.roundRect(c - w, c - h, w * 2, h * 2, 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // 束带（对称，两条）
  ctx.fillStyle = '#26201b';
  ctx.fillRect(c - w * 0.55, c - h, 4, h * 2);
  ctx.fillRect(c + w * 0.55 - 4, c - h, 4, h * 2);
  // 顶盖高光
  ctx.fillStyle = 'rgba(220,200,160,0.28)';
  ctx.fillRect(c - w + 1.5, c - h + 1.5, w * 2 - 3, 2.5);
  // 露出的枪管
  ctx.fillStyle = '#15181d';
  ctx.fillRect(c + w * 0.2, c + h * 0.15, w * 0.9, 4);
  // 军械标记（一小块褪色漆）
  ctx.fillStyle = 'rgba(255,209,102,0.75)';
  ctx.fillRect(c - w * 0.35, c - h * 0.55, 7, 4);
}

// ================= 新增掉落物（v0.3.3） =================

/** 护盾：淡蓝圆盾 */
function drawShield(ctx, S) {
  const c = S / 2;
  const r = S * 0.34;
  const g = ctx.createRadialGradient(c, c, r * 0.2, c, c, r);
  g.addColorStop(0, 'rgba(150,220,255,0.5)');
  g.addColorStop(1, 'rgba(90,170,230,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, TAU);
  ctx.fill();

  ctx.fillStyle = '#4a7fae';
  ctx.beginPath();
  ctx.arc(c, c, r * 0.62, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = 'rgba(210,240,255,0.9)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = 'rgba(210,240,255,0.35)';
  ctx.beginPath();
  ctx.arc(c - r * 0.18, c - r * 0.18, r * 0.18, 0, TAU);
  ctx.fill();
}

/** 加速：黄色闪电 */
function drawBoost(ctx, S) {
  const c = S / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, S * 0.5);
  g.addColorStop(0, 'rgba(255,209,102,0.5)');
  g.addColorStop(1, 'rgba(255,180,60,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, S * 0.5, 0, TAU);
  ctx.fill();

  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.moveTo(c + S * 0.12, c - S * 0.3);
  ctx.lineTo(c - S * 0.16, c + S * 0.04);
  ctx.lineTo(c - S * 0.02, c + S * 0.04);
  ctx.lineTo(c - S * 0.12, c + S * 0.3);
  ctx.lineTo(c + S * 0.16, c - S * 0.04);
  ctx.lineTo(c + S * 0.02, c - S * 0.04);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,80,10,0.7)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** 磁吸：青色吸铁石（拾取后吸走全场经验） */
function drawMagnet(ctx, S) {
  const c = S / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, S * 0.5);
  g.addColorStop(0, 'rgba(124,231,255,0.5)');
  g.addColorStop(1, 'rgba(60,180,220,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, S * 0.5, 0, TAU);
  ctx.fill();

  // U 形磁铁
  ctx.fillStyle = '#7ce7ff';
  ctx.beginPath();
  ctx.arc(c, c - S * 0.04, S * 0.22, Math.PI, 0);
  ctx.lineTo(c + S * 0.22, c + S * 0.1);
  ctx.lineTo(c + S * 0.12, c + S * 0.1);
  ctx.lineTo(c + S * 0.12, c - S * 0.02);
  ctx.lineTo(c - S * 0.12, c - S * 0.02);
  ctx.lineTo(c - S * 0.12, c + S * 0.1);
  ctx.lineTo(c - S * 0.22, c + S * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,60,80,0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // 两端磁极（红/蓝）
  ctx.fillStyle = '#ff5f6d';
  ctx.fillRect(c - S * 0.22, c + S * 0.08, S * 0.1, S * 0.1);
  ctx.fillStyle = '#5aa7ff';
  ctx.fillRect(c + S * 0.12, c + S * 0.08, S * 0.1, S * 0.1);
}

const ANIM_STEPS = [0, 0.25, 0.5, 0.75];

/** 生成一组动画帧（4 帧：呼吸 / 步态 / 蓄能） */
function frames(key, size, draw) {
  return ANIM_STEPS.map((t, i) => build(`${key}${i}`, size, (c, s) => draw(c, s, t)));
}

export function getSprites() {
  return {
    player: frames('player', 72, drawPlayer),
    zombie: frames('zombie', 56, drawZombie),
    runner: frames('runner', 52, drawRunner),
    spider: frames('spider', 50, drawSpider),
    lizard: frames('lizard', 64, drawLizard),
    alien: frames('alien', 68, drawAlien),
    brute: frames('brute', 96, drawBrute),
    orb: build('orb', 26, drawOrb),
    health: build('health', 34, drawHealth),
    crate: build('crate', 38, drawCrate),
    shield: build('shield', 36, drawShield),
    boost: build('boost', 36, drawBoost),
    magnet: build('magnet', 36, drawMagnet)
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
