// 基础数学工具
export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const lerp = (a, b, t) => a + (b - a) * t;

/** rand(1) => 0..1 ; rand(5,10) => 5..10 */
export function rand(a = 1, b) {
  if (b === undefined) { b = a; a = 0; }
  return a + Math.random() * (b - a);
}

export const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));

export const pick = (arr) => arr[(Math.random() * arr.length) | 0];

export const chance = (p) => Math.random() < p;

export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  return dx * dx + dy * dy;
}

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/** 与帧率无关的平滑插值 */
export const damp = (speed, dt) => 1 - Math.exp(-speed * dt);

export function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * t;
}

/** 归一化角度到 -PI..PI */
export function normAngle(a) {
  return ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
}
