import { rand, TAU, clamp } from '../core/math.js';

const MAX = 1400;

export class Particles {
  constructor() {
    this.list = [];
  }

  clear() { this.list.length = 0; }

  add(p) {
    if (this.list.length >= MAX) this.list.shift();
    p.age = 0;
    this.list.push(p);
    return p;
  }

  blood(x, y, angle, count, color = '#b11a24', power = 1) {
    for (let i = 0; i < count; i++) {
      const a = angle + rand(-0.7, 0.7);
      const sp = rand(60, 320) * power;
      this.add({
        type: 'dot',
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.25, 0.6),
        size: rand(1.2, 3.4),
        color,
        drag: 3.2,
        glow: 0
      });
    }
  }

  sparks(x, y, angle, count, color = '#ffd27a') {
    for (let i = 0; i < count; i++) {
      const a = angle + rand(-0.9, 0.9);
      const sp = rand(120, 520);
      this.add({
        type: 'line',
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.08, 0.22),
        size: rand(1, 2.2),
        color,
        drag: 6
      });
    }
  }

  gore(x, y, angle, count, color = '#8f1220') {
    for (let i = 0; i < count; i++) {
      const a = angle + rand(-1.4, 1.4);
      const sp = rand(80, 420);
      this.add({
        type: 'chunk',
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(0.35, 0.8),
        size: rand(2, 5.5),
        color,
        drag: 2.6,
        rot: rand(0, TAU),
        spin: rand(-12, 12)
      });
    }
  }

  smoke(x, y, count = 4, color = 'rgba(90,90,95,0.5)') {
    for (let i = 0; i < count; i++) {
      this.add({
        type: 'smoke',
        x: x + rand(-6, 6),
        y: y + rand(-6, 6),
        vx: rand(-40, 40),
        vy: rand(-60, -10),
        life: rand(0.4, 0.9),
        size: rand(6, 16),
        color,
        drag: 1.2
      });
    }
  }

  flash(x, y, radius, color = 'rgba(255,200,120,0.85)') {
    this.add({
      type: 'flash',
      x, y,
      vx: 0, vy: 0,
      life: 0.09,
      size: radius,
      color
    });
  }

  ring(x, y, radius, color = 'rgba(255,120,90,0.9)', life = 0.35) {
    this.add({ type: 'ring', x, y, vx: 0, vy: 0, life, size: radius, color });
  }

  /** 残响外溢：击杀时从尸体上升起的细丝（比血块更"魂"） */
  wisp(x, y, color = 'rgba(190,240,255,0.85)', count = 5) {
    for (let i = 0; i < count; i++) {
      this.add({
        type: 'wisp',
        x: x + rand(-8, 8),
        y: y + rand(-6, 6),
        vx: rand(-16, 16),
        vy: rand(-70, -30),
        life: rand(0.5, 1.1),
        size: rand(1.2, 2.6),
        color,
        drag: 0.6
      });
    }
  }

  text(x, y, str, color = '#fff', size = 14) {
    this.add({
      type: 'text', x, y,
      vx: rand(-24, 24), vy: -70,
      life: 0.75, size, color, str, drag: 1.5
    });
  }

  update(dt) {
    const list = this.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.age += dt;
      if (p.age >= p.life) {
        list.splice(i, 1);
        continue;
      }
      if (p.drag) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.spin) p.rot += p.spin * dt;
      if (p.type === 'smoke') p.size += dt * 14;
    }
  }

  draw(ctx) {
    const list = this.list;
    for (let i = 0; i < list.length; i++) {
      const p = list[i];
      const t = p.age / p.life;
      const alpha = 1 - t;
      ctx.globalAlpha = Math.max(0, alpha);
      switch (p.type) {
        case 'dot':
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 - t * 0.35), 0, TAU);
          ctx.fill();
          break;
        case 'line':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.016, p.y - p.vy * 0.016);
          ctx.stroke();
          break;
        case 'chunk':
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
          ctx.restore();
          break;
        case 'smoke':
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, TAU);
          ctx.fill();
          break;
        case 'ghost':
          // 冲刺残影（S1-D2）：淡出的虚影圆
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1 - t * 0.3), 0, TAU);
          ctx.fill();
          break;
        case 'flash': {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          g.addColorStop(0, p.color);
          g.addColorStop(1, 'rgba(255,160,60,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, TAU);
          ctx.fill();
          break;
        }
        case 'ring':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3 * (1 - t) + 0.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (0.3 + t * 0.9), 0, TAU);
          ctx.stroke();
          break;
        case 'wisp':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(0.4, p.size * (1 - t * 0.6));
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
          ctx.stroke();
          break;
        case 'text':
          ctx.globalAlpha = clamp(alpha * 1.6, 0, 1);
          ctx.fillStyle = p.color;
          ctx.font = `700 ${p.size}px "Segoe UI", system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(p.str, p.x, p.y);
          break;
        default:
          break;
      }
    }
    ctx.globalAlpha = 1;
  }
}
