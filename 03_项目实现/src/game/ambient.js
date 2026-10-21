// 环境浮尘（纯表现层）
//
// 每层飘的东西不一样：一层骨屑、三层孢子、四层酸雾、五层结晶微光、六层灰烬。
// 只在 render 里跑，不参与任何数值，也不抽种子流（用 fxRandom 生成一次后按时间漂移）。

import { fxRandom } from '../core/fx.js';

const COUNT_PER_100K = 1.0; // 每 10 万像素的粒子数，按视口面积缩放

function build(w, h, pal) {
  const area = (w * h) / 100000;
  const n = Math.max(8, Math.round(pal.ambient.count * area));
  const list = [];
  for (let i = 0; i < n; i++) {
    list.push({
      x: fxRandom() * w,
      y: fxRandom() * h,
      r: pal.ambient.size * (0.6 + fxRandom() * 0.9),
      spd: pal.ambient.drift * (0.4 + fxRandom() * 1.2),
      sway: 0.4 + fxRandom() * 1.6,
      phase: fxRandom() * Math.PI * 2,
      a: 0.25 + fxRandom() * 0.6
    });
  }
  return { w, h, id: pal.id, list };
}

/**
 * 画该层的浮尘。位置由 g.time 推算（暂停时也停住，和世界一致）。
 * 视口尺寸变了会自动重建。
 */
export function drawAmbient(ctx, g, w, h) {
  const pal = g.palette;
  if (!pal || !pal.ambient) return;
  if (g.state === 'menu') return;

  let amb = g._ambient;
  if (!amb || amb.id !== pal.id || Math.abs(amb.w - w) > 1 || Math.abs(amb.h - h) > 1) {
    amb = build(w, h, pal);
    g._ambient = amb;
  }

  const t = g.time;
  ctx.save();
  ctx.fillStyle = pal.ambient.color;
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < amb.list.length; i++) {
    const p = amb.list[i];
    // 缓慢上飘 + 横向摆动，出屏后从底部回收
    const y = ((p.y - t * p.spd) % (h + 40) + h + 40) % (h + 40) - 20;
    const x = p.x + Math.sin(t * p.sway + p.phase) * 14;
    ctx.globalAlpha = p.a * 0.55;
    ctx.beginPath();
    ctx.arc(x, y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
