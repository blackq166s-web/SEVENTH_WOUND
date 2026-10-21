import { rand, TAU } from '../core/math.js';

/**
 * 血迹图层：世界尺寸的离屏 canvas（内部按 0.5 分辨率存储以省带宽），
 * 只在可视区域 blit，并用 destination-out 定期淡出。
 */
export class Decals {
  constructor(w, h, scale = 0.5) {
    this.w = w;
    this.h = h;
    this.scale = scale;
    this.cw = Math.ceil(w * scale);
    this.ch = Math.ceil(h * scale);
    const c = document.createElement('canvas');
    c.width = this.cw;
    c.height = this.ch;
    this.canvas = c;
    this.ctx = c.getContext('2d');
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.fadeTimer = 0;
  }

  clear() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.cw, this.ch);
    this.ctx.restore();
  }

  /** 血溅 */
  splat(x, y, radius, color = 'rgba(150,16,26,0.85)', count = 7) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = color;
    // 主斑
    ctx.beginPath();
    ctx.ellipse(x, y, radius * rand(0.8, 1.2), radius * rand(0.65, 1.1), rand(0, TAU), 0, TAU);
    ctx.fill();
    // 飞溅小点
    for (let i = 0; i < count; i++) {
      const a = rand(0, TAU);
      const d = rand(radius * 0.4, radius * 3.2);
      const r = rand(0.8, radius * 0.35);
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  scorch(x, y, radius) {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.55, 'rgba(8,6,6,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
  }

  fade(dt) {
    this.fadeTimer += dt;
    if (this.fadeTimer < 0.35) return;
    this.fadeTimer = 0;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.045)';
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.restore();
  }

  draw(ctx, cam) {
    const vw = cam.vmw || cam.vw;
    const vh = cam.vmh || cam.vh;
    const s = this.scale;
    const x = Math.max(0, cam.x - 24);
    const y = Math.max(0, cam.y - 24);
    const w = Math.min(this.w - x, vw + 48);
    const h = Math.min(this.h - y, vh + 48);
    if (w <= 0 || h <= 0) return;
    ctx.drawImage(this.canvas, x * s, y * s, w * s, h * s, x, y, w, h);
  }
}
