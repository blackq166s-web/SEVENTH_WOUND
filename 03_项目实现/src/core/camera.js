import { clamp, damp, random } from './math.js';

export class Camera {
  constructor(worldW, worldH, zoom = 1.3) {
    this.ww = worldW;
    this.wh = worldH;
    this.x = 0;
    this.y = 0;
    this.vw = 1280;
    this.vh = 720;
    this.defaultZoom = zoom;
    this.zoom = zoom;
    this.pad = 56; // 允许镜头略越过边界，避免贴墙时人卡在屏幕边缘
    this.shakeAmt = 0;
    this.ox = 0;
    this.oy = 0;
  }

  setViewport(w, h, zoom = this.defaultZoom) {
    if (w === this.vw && h === this.vh && zoom === this.zoom) return;
    const x = this.cx, y = this.cy;
    this.vw = w;
    this.vh = h;
    this.zoom = zoom;
    this.snapTo(x, y);
  }

  /** 可视区域的世界尺寸（受缩放影响） */
  get vmw() { return this.vw / this.zoom; }
  get vmh() { return this.vh / this.zoom; }

  /** 视口中心的世界坐标 */
  get cx() { return this.x + this.vmw / 2; }
  get cy() { return this.y + this.vmh / 2; }

  snapTo(tx, ty) {
    this.x = this._clampX(tx - this.vmw / 2);
    this.y = this._clampY(ty - this.vmh / 2);
  }

  follow(tx, ty, dt, instant = false) {
    const gx = this._clampX(tx - this.vmw / 2);
    const gy = this._clampY(ty - this.vmh / 2);
    if (instant) {
      this.x = gx; this.y = gy;
    } else {
      const k = damp(7, dt);
      this.x += (gx - this.x) * k;
      this.y += (gy - this.y) * k;
    }
  }

  _clampX(v) {
    if (this.ww <= this.vmw) return (this.ww - this.vmw) / 2;
    return clamp(v, -this.pad, this.ww - this.vmw + this.pad);
  }

  _clampY(v) {
    if (this.wh <= this.vmh) return (this.wh - this.vmh) / 2;
    return clamp(v, -this.pad, this.wh - this.vmh + this.pad);
  }

  kick(amount) {
    this.shakeAmt = Math.min(this.shakeAmt + amount, 30);
  }

  update(dt) {
    if (this.shakeAmt > 0.05) {
      this.ox = (random() * 2 - 1) * this.shakeAmt;
      this.oy = (random() * 2 - 1) * this.shakeAmt;
      this.shakeAmt *= Math.pow(0.0008, dt);
    } else {
      this.shakeAmt = 0;
      this.ox = 0;
      this.oy = 0;
    }
  }
}
