import { Game } from './game/game.js';
import { Input } from './core/input.js';
import { Audio } from './core/audio.js';
import { UI } from './ui.js';

const viewport = document.getElementById('viewport');
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });

const input = new Input();
const audio = new Audio();

// ?seed=xxx → 固定随机序列（复现/调平衡用）；不传则用 Math.random，与旧版行为一致
const params = new URLSearchParams(location.search);

const game = new Game(canvas, ctx, input, audio, null);
game.ui = new UI(game);
game.setSeed(params.get('seed'));
window.__game = game; // 调试入口

let viewportTouchMode;
function resize() {
  const { width: w, height: h } = viewport.getBoundingClientRect();
  if (!w || !h) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.round(w * dpr);
  const height = Math.round(h * dpr);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  game.setViewport(w, h, dpr);
  game.ui.setViewport(w, h);
  viewportTouchMode = input.touchMode;
}

let viewportDirty = false;
const requestResize = () => { viewportDirty = true; };
window.addEventListener('resize', requestResize);
window.visualViewport?.addEventListener('resize', requestResize);
document.addEventListener('fullscreenchange', requestResize);
new ResizeObserver(requestResize).observe(viewport);
resize();
game.cam.snapTo(game.W / 2, game.H / 2);

// 首次交互解锁音频
const unlock = () => {
  audio.init();
  audio.resume();
};
window.addEventListener('pointerdown', unlock, { once: true });
window.addEventListener('keydown', unlock, { once: true });

// 切出窗口自动暂停
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  input.clear();
  game.ui.releaseTouch();
  game.pause();
});
window.addEventListener('blur', () => {
  if (!input.touchMode) return;
  game.ui.releaseTouch();
});

const STEP = 1 / 60;
let last = performance.now();
let acc = 0;

function frame(now) {
  if (viewportDirty || viewportTouchMode !== input.touchMode) {
    viewportDirty = false;
    resize();
  }
  const raw = Math.min((now - last) / 1000, 0.1);
  last = now;
  acc += raw;

  let guard = 0;
  while (acc >= STEP && guard++ < 6) {
    game.update(STEP);
    input.endFrame();
    acc -= STEP;
  }

  game.render();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// 开发用快捷入口： ?auto=survival&warm=600&bot=1
// （自动开局并快进若干帧，便于截图/自动化测试；bot=1 时用简易机器人瞄准射击）
if (params.get('auto')) {
  const warm = Number(params.get('warm') || 0);
  const bot = params.get('bot') === '1';
  setTimeout(() => {
    audio.init();
    game.start(params.get('auto'));
    input.mouse.down = bot;
    for (let i = 0; i < warm; i++) {
      if (bot) {
        const p = game.player;
        let nearest = null, nd = Infinity;
        for (const e of game.enemies) {
          const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
          if (d < nd) { nd = d; nearest = e; }
        }
        if (nearest) {
          input.mouse.x = (nearest.x - game.cam.x) * game.cam.zoom + game.cam.ox;
          input.mouse.y = (nearest.y - game.cam.y) * game.cam.zoom + game.cam.oy;
          const dx = p.x - nearest.x, dy = p.y - nearest.y;
          const l = Math.hypot(dx, dy) || 1;
          input.keys.clear();
          if (l < 320) {
            // 太近就后退
            if (dx / l > 0.3) input.keys.add('KeyD');
            if (dx / l < -0.3) input.keys.add('KeyA');
            if (dy / l > 0.3) input.keys.add('KeyS');
            if (dy / l < -0.3) input.keys.add('KeyW');
          } else {
            // 否则回场地中心附近
            const cx = game.W / 2 - p.x, cy = game.H / 2 - p.y;
            const cl = Math.hypot(cx, cy) || 1;
            if (cx / cl > 0.3) input.keys.add('KeyD');
            if (cx / cl < -0.3) input.keys.add('KeyA');
            if (cy / cl > 0.3) input.keys.add('KeyS');
            if (cy / cl < -0.3) input.keys.add('KeyW');
          }
        }
      }
      game.update(1 / 60);
      input.endFrame();
      if (game.state === 'levelup') {
        game.pickPerk(game.perkChoices[0]);
      }
      if (game.state === 'dead') break;
    }
  }, 80);
}
