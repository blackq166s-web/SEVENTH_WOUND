// 表现层随机（不参与玩法数值）
//
// 为什么单独一个：玩法随机必须走 math.js 的种子流（?seed= 才能复现），
// 而"每帧画几颗灰尘""火焰半径抖多少"这类随机，如果在 render 里抽种子流，
// 同 seed 的结果就会随"这一帧渲染没渲染"而变化 —— 复现直接失效。
// 所以渲染/美术生成一律用这里的 fxRandom()，它不影响任何玩法数值。

let _s = 0x9e3779b9;

/** xorshift32：够快够散，不碰种子流 */
export function fxRandom() {
  _s ^= _s << 13;
  _s ^= _s >>> 17;
  _s ^= _s << 5;
  return ((_s >>> 0) / 4294967296);
}

export const fxRand = (a = 1, b) => {
  if (b === undefined) { b = a; a = 0; }
  return a + fxRandom() * (b - a);
};
