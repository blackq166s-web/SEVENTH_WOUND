// 基础数学工具
export const TAU = Math.PI * 2;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const lerp = (a, b, t) => a + (b - a) * t;

// ================= 随机源（P4-0） =================
// 默认就是 Math.random：不传 seed 时行为与改动前完全一致，一个数都不会变。
// 传了 seed（?seed=xxx）就换成 mulberry32，同一 seed 的序列固定，平衡数据才可复现。
// 唯一例外是 core/audio.js：它在首次交互时初始化，时机不可控，走 Math.random，
// 但音效不参与任何数值计算，所以不影响复现。

let _rng = Math.random;

export function random() {
  return _rng();
}

/** 传函数则替换，传 null/undefined 则恢复 Math.random */
export function setRng(fn) {
  _rng = typeof fn === 'function' ? fn : Math.random;
}

export function usingSeed() {
  return _rng !== Math.random;
}

/** 任意字符串/数字 → 32 位种子（FNV-1a） */
export function hashSeed(seed) {
  if (typeof seed === 'number' && Number.isFinite(seed)) return (seed >>> 0) || 1;
  const s = String(seed);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) || 1;
}

/** mulberry32：小、快、序列足够散 */
export function makeRng(seed) {
  let a = hashSeed(seed);
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** rand(1) => 0..1 ; rand(5,10) => 5..10 */
export function rand(a = 1, b) {
  if (b === undefined) { b = a; a = 0; }
  return a + random() * (b - a);
}

export const randInt = (a, b) => Math.floor(a + random() * (b - a + 1));

export const pick = (arr) => arr[(random() * arr.length) | 0];

export const chance = (p) => random() < p;

export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  return dx * dx + dy * dy;
}

export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (random() * (i + 1)) | 0;
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
