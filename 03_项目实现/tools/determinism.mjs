// 同 seed 复现校验（P4-4）：同一 seed 跑三遍，逐项数据必须完全一致。
// 运行： node tools/determinism.mjs [seed] [frames]
// 退出码 0 = 三遍一致；1 = 有漂移（会打印第一处差异）
import { createHash } from 'node:crypto';
import { installDom, makeCanvas } from './dom-stub.mjs';

installDom();

const STEP = 1 / 60;
const { Game } = await import('../src/game/game.js');
const { Input } = await import('../src/core/input.js');
const { Audio } = await import('../src/core/audio.js');
const { UI } = await import('../src/ui.js');
const M = await import('../src/core/math.js');

const SEED = process.argv[2] || 'balance-2026';
const FRAMES = Number(process.argv[3] || 3600); // 默认 60 秒

/** 固定机器人：瞄准最近敌人 + 风筝走位，每次只选第一张刻印（与 smoke 同款策略） */
function botStep(game) {
  const p = game.player;
  const input = game.input;
  let nearest = null;
  let nd = Infinity;
  for (const e of game.enemies) {
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d < nd) { nd = d; nearest = e; }
  }
  if (nearest) {
    input.mouse.x = (nearest.x - game.cam.x) * game.cam.zoom + game.cam.ox;
    input.mouse.y = (nearest.y - game.cam.y) * game.cam.zoom + game.cam.oy;
    const dx = p.x - nearest.x;
    const dy = p.y - nearest.y;
    const l = Math.hypot(dx, dy) || 1;
    input.keys.clear();
    if (l < 340) {
      if (dx / l > 0.3) input.keys.add('KeyD');
      if (dx / l < -0.3) input.keys.add('KeyA');
      if (dy / l > 0.3) input.keys.add('KeyS');
      if (dy / l < -0.3) input.keys.add('KeyW');
    } else {
      const cx = game.W / 2 - p.x;
      const cy = game.H / 2 - p.y;
      const cl = Math.hypot(cx, cy) || 1;
      if (cx / cl > 0.3) input.keys.add('KeyD');
      if (cx / cl < -0.3) input.keys.add('KeyA');
      if (cy / cl > 0.3) input.keys.add('KeyS');
      if (cy / cl < -0.3) input.keys.add('KeyW');
    }
  } else {
    input.mouse.x = 640;
    input.mouse.y = 360;
  }
}

function runOnce(seed, mode = 'survival') {
  const canvas = makeCanvas(1280, 720);
  const game = new Game(canvas, canvas.getContext('2d'), new Input(), new Audio(), null);
  game.ui = new UI(game);
  game.setViewport(1280, 720, 1);
  game.setSeed(seed);
  game.start(mode);
  game.input.mouse.down = true;

  for (let i = 0; i < FRAMES; i++) {
    botStep(game);
    game.update(STEP);
    game.input.endFrame();
    if (game.state === 'levelup') {
      const perk = game.perkChoices[0];
      game.ui.hide();
      game.pickPerk(perk);
    }
    if (game.state === 'dead') break;
    if (game.state === 'clear') game.ui.nextLevel();
  }

  // 场上敌人位置做一个指纹，防止"总分一样但过程不同"漏过去
  let posSum = 0;
  for (const e of game.enemies) posSum += e.x * 1.7 + e.y * 3.1 + e.hp * 0.013;

  return {
    state: game.state,
    time: +game.time.toFixed(5),
    kills: game.kills,
    score: game.score,
    level: game.player.level,
    wave: game.wave,
    hp: +game.player.hp.toFixed(5),
    shots: game.stats.shots,
    damage: +game.stats.damage.toFixed(5),
    enemies: game.enemies.length,
    bullets: game.bullets.length,
    pickups: game.pickups.length,
    erosion: game.player.erosion,
    maxErosion: game.maxErosion,
    posHash: +posSum.toFixed(3)
  };
}

const runs = [runOnce(SEED), runOnce(SEED), runOnce(SEED)];
const json = runs.map((r) => JSON.stringify(r));
const hash = createHash('sha256').update(json[0]).digest('hex').slice(0, 16);

console.log(`seed=${SEED}  frames=${FRAMES}`);
console.log('第一遍:', runs[0]);
console.log('指纹  :', hash);

let fails = 0;
for (let i = 1; i < runs.length; i++) {
  if (json[i] !== json[0]) {
    fails++;
    console.error(`\n第 ${i + 1} 遍与第 1 遍不一致：`);
    for (const k of Object.keys(runs[0])) {
      if (runs[i][k] !== runs[0][k]) console.error(`  ${k}: ${runs[0][k]} → ${runs[i][k]}`);
    }
  }
}

// 反证：换 seed 必须变（否则说明 seed 根本没接上）
const other = runOnce(SEED + '-x');
if (JSON.stringify(other) === json[0]) {
  fails++;
  console.error('\nFAIL  换 seed 后结果相同 —— 种子没有真正接入');
} else {
  console.log('反证  : 换 seed 后结果不同 ✓');
}

// 反证：不传 seed 时应恢复 Math.random
const g0 = new Game(makeCanvas(1280, 720), makeCanvas(1280, 720).getContext('2d'), new Input(), new Audio(), null);
g0.setSeed(null);
if (M.usingSeed()) {
  fails++;
  console.error('FAIL  setSeed(null) 应恢复 Math.random');
} else {
  console.log('反证  : setSeed(null) 恢复 Math.random ✓');
}

console.log(fails === 0 ? '\nDETERMINISM_OK 同 seed 三遍完全一致' : `\nDETERMINISM_FAIL ${fails} 处`);
process.exit(fails === 0 ? 0 : 1);
