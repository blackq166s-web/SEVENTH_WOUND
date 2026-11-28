// 屏幕边缘威胁指示器：把视野外的敌人映射到屏幕内缩矩形的边上
// 纯计算与绘制分离，offscreenThreats() 可在无渲染环境下断言（见 tools/smoke.mjs）
import { clamp } from '../core/math.js';

const PAD = 26;      // 指示器距屏幕边缘的内缩
const TOUCH_PAD = 20; // 还要容下首领箭头的描边和光环
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
  const left = touch ? g.ui.safeLeft + TOUCH_PAD : PAD;
  const right = w - (touch ? g.ui.safeRight + TOUCH_PAD : PAD);
  const top = touch ? g.ui.safeTop + TOUCH_PAD : PAD;
  const bottom = h - (touch ? g.ui.safeBottom + TOUCH_PAD : PAD);
  const px = (p.x - cam.x) * cam.zoom + cam.ox;
  const py = (p.y - cam.y) * cam.zoom + cam.oy;
  const originX = touch ? clamp(px, left, right) : w / 2;
  const originY = touch ? clamp(py, top, bottom) : h / 2;
  const out = [];

  for (const e of g.enemies) {
    if (e.dead) continue;

    // 世界 -> 屏幕
    const sx = (e.x - cam.x) * cam.zoom + cam.ox;
    const sy = (e.y - cam.y) * cam.zoom + cam.oy;
    // 已在视野内（含少量边距）就不用提示
    if (sx > -8 && sx < w + 8 && sy > -8 && sy < h + 8) continue;

    const dx = sx - px;
    const dy = sy - py;
    if (!dx && !dy) continue;

    // 找朝向敌人的射线与安全区边框的首个交点。
    const tx = dx ? ((dx > 0 ? right : left) - originX) / dx : Infinity;
    const ty = dy ? ((dy > 0 ? bottom : top) - originY) / dy : Infinity;
    const t = Math.min(tx, ty);

    const dist = Math.hypot(e.x - p.x, e.y - p.y);
    let x = originX + dx * t;
    let y = originY + dy * t;
    if (touch && tx <= ty) {
      // 侧边保留原有 x 坐标，沿边向下让出顶部 HUD。
      y = Math.max(y, Math.min(bottom, g.ui.safeTop + 86));
    } else if (touch && dy < 0) {
      const safeWidth = right - left + TOUCH_PAD * 2;
      const leftHud = Math.min(safeWidth / 2, 146);
      const minX = g.ui.safeLeft + leftHud;
      const maxX = w - g.ui.safeRight - Math.min(safeWidth - leftHud, 174);
      x = clamp(x, minX, maxX);
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
  if (!touch) return out.slice(0, Math.max(0, max));

  const spaced = [];
  for (const item of out) {
    if (spaced.length >= max) break;
    if (!spaced.some(other => Math.hypot(item.x - other.x, item.y - other.y) < 24)) spaced.push(item);
  }
  return spaced;
}

/**
 * 绘制边缘指示器（屏幕空间调用，必须在 ctx.restore() 之后）
 * 颜色固定为威胁色而非敌人血液色——毒蛛/蜥蜴的绿血在暗背景上几乎不可见
 */
export function drawThreatIndicators(ctx, g, w, h) {
  const list = offscreenThreats(g, w, h);
  if (!list.length) return;

  const pulse = 0.82 + Math.sin(g.time * 5) * 0.18;
  const touch = g.input?.touchMode;

  for (const it of list) {
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.rotate(it.angle);
    ctx.globalAlpha = it.alpha * (it.boss ? pulse : 1);

    const s = touch ? (it.boss ? 13 : 8) : (it.boss ? 18 : 11);
    ctx.beginPath();
    ctx.moveTo(s, 0);
    ctx.lineTo(-s * 0.62, s * 0.8);
    ctx.lineTo(-s * 0.24, 0);
    ctx.lineTo(-s * 0.62, -s * 0.8);
    ctx.closePath();

    // 先描深色轮廓再填充，保证在血迹/地面上都能看清
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(12,6,8,0.85)';
    ctx.lineWidth = touch ? 2.5 : 3.5;
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
