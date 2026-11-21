// 屏幕边缘威胁指示器：把视野外的敌人映射到屏幕内缩矩形的边上
// 纯计算与绘制分离，offscreenThreats() 可在无渲染环境下断言（见 tools/smoke.mjs）
import { clamp } from '../core/math.js';

const PAD = 26;      // 指示器距屏幕边缘的内缩
const MAX = 8;       // 同屏最多显示数量
const FADE_FAR = 2200; // 超过这个距离完全淡出（仍保留最小可见度）

/**
 * 计算当前应显示的边缘指示器。
 * @param {object} g Game 实例
 * @param {number} w 视口宽（CSS 像素）
 * @param {number} h 视口高（CSS 像素）
 * @param {number} max 最多返回数量
 * @returns {Array<{x:number,y:number,angle:number,dist:number,boss:boolean,color:string,alpha:number}>}
 */
export function offscreenThreats(g, w, h, max = MAX) {
  const cam = g.cam;
  const p = g.player;
  // 只在真正战斗时提示；暂停/升级/死亡/通关都不画
  if (!p || g.state !== 'playing') return [];

  const touch = g.input?.touchMode;
  const padX = touch ? 140 + Math.max(g.ui.safeLeft, g.ui.safeRight) : PAD;
  const padY = touch ? PAD + Math.max(g.ui.safeTop, g.ui.safeBottom) : PAD;
  const halfW = Math.max(40, w / 2 - padX);
  const halfH = Math.max(40, h / 2 - padY);
  const cx = w / 2;
  const cy = h / 2;
  const px = (p.x - cam.x) * cam.zoom + cam.ox;
  const py = (p.y - cam.y) * cam.zoom + cam.oy;
  const out = [];

  for (const e of g.enemies) {
    if (e.dead) continue;

    // 世界 -> 屏幕
    const sx = (e.x - cam.x) * cam.zoom + cam.ox;
    const sy = (e.y - cam.y) * cam.zoom + cam.oy;
    // 已在视野内（含少量边距）就不用提示
    if (sx > -8 && sx < w + 8 && sy > -8 && sy < h + 8) continue;

    let dx = sx - px;
    let dy = sy - py;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    dx /= len;
    dy /= len;

    // 沿方向投射到内缩矩形边界
    const tx = Math.abs(dx) > 1e-6 ? halfW / Math.abs(dx) : Infinity;
    const ty = Math.abs(dy) > 1e-6 ? halfH / Math.abs(dy) : Infinity;
    const t = Math.min(tx, ty);

    const dist = Math.hypot(e.x - p.x, e.y - p.y);
    const y = cy + dy * t;
    let x = cx + dx * t;
    if (touch && y < g.ui.safeTop + 164) {
      // 上半屏让出两边的生命、弹药信息和武器按钮。
      const left = Math.min(w * 0.42, g.ui.safeLeft + 186);
      const right = Math.min(w * 0.42, g.ui.safeRight + (g.ui.shortViewport ? 230 : 192));
      x = clamp(x, left, w - right);
    }
    out.push({
      x,
      y,
      angle: Math.atan2(dy, dx),
      dist,
      boss: !!(e.def && e.def.isBoss),
      alpha: clamp(1.15 - dist / FADE_FAR, 0.3, 0.95)
    });
  }

  // 近的优先：先按距离排序再截断
  out.sort((a, b) => a.dist - b.dist);
  return out.slice(0, Math.max(0, max));
}

/**
 * 绘制边缘指示器（屏幕空间调用，必须在 ctx.restore() 之后）
 * 颜色固定为威胁色而非敌人血液色——毒蛛/蜥蜴的绿血在暗背景上几乎不可见
 */
export function drawThreatIndicators(ctx, g, w, h) {
  const list = offscreenThreats(g, w, h);
  if (!list.length) return;

  const pulse = 0.82 + Math.sin(g.time * 5) * 0.18;

  for (const it of list) {
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.rotate(it.angle);
    ctx.globalAlpha = it.alpha * (it.boss ? pulse : 1);

    const s = it.boss ? 18 : 11;
    ctx.beginPath();
    ctx.moveTo(s, 0);
    ctx.lineTo(-s * 0.62, s * 0.8);
    ctx.lineTo(-s * 0.24, 0);
    ctx.lineTo(-s * 0.62, -s * 0.8);
    ctx.closePath();

    // 先描深色轮廓再填充，保证在血迹/地面上都能看清
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(12,6,8,0.85)';
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.fillStyle = it.boss ? '#ff2d3f' : '#ff8a3d';
    ctx.fill();

    if (it.boss) {
      ctx.globalAlpha = it.alpha * 0.55;
      ctx.strokeStyle = '#ffb0b8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, s * 1.4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
}
