// 无浏览器环境下的冒烟测试：用最小 DOM/Canvas 桩跑几千帧，捕获运行时异常
// 运行： node tools/smoke.mjs
const noop = () => {};

function makeCtx(canvas) {
  const target = {
    canvas,
    measureText: () => ({ width: 12 }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    createPattern: () => ({ setTransform: noop }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    save: noop,
    restore: noop
  };
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      return noop;
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

function makeCanvas(w = 300, h = 150) {
  const c = { width: w, height: h, style: {} };
  c.getContext = () => (c._ctx || (c._ctx = makeCtx(c)));
  return c;
}

class El {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.style = { setProperty: noop };
    this._cls = new Set();
    this.classList = {
      add: (c) => this._cls.add(c),
      remove: (c) => this._cls.delete(c),
      toggle: (c, on) => { if (on) this._cls.add(c); else this._cls.delete(c); },
      contains: (c) => this._cls.has(c)
    };
    this.innerHTML = '';
    this.textContent = '';
  }
  addEventListener() {}
  removeEventListener() {}
  appendChild(c) { this.children.push(c); return c; }
  setAttribute() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 1280, height: 720 }; }
  focus() {}
}

const elements = new Map();
globalThis.document = {
  createElement: (tag) => (tag === 'canvas' ? makeCanvas() : new El(tag)),
  getElementById: (id) => {
    if (!elements.has(id)) elements.set(id, new El());
    return elements.get(id);
  },
  addEventListener: noop,
  hidden: false,
  body: new El('body')
};

globalThis.window = {
  innerWidth: 1280,
  innerHeight: 720,
  devicePixelRatio: 1,
  addEventListener: noop,
  removeEventListener: noop
};

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v))
};
globalThis.performance = { now: () => Date.now() };
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 16);

const { Game } = await import('../src/game/game.js');
const { Input } = await import('../src/core/input.js');
const { Audio } = await import('../src/core/audio.js');
const { UI } = await import('../src/ui.js');

const canvas = makeCanvas(1280, 720);
const ctx = canvas.getContext('2d');
const input = new Input();
const audio = new Audio();
const game = new Game(canvas, ctx, input, audio, null);
game.ui = new UI(game);
game.setViewport(1280, 720, 1);

const STEP = 1 / 60;
let errors = 0;

function simulate(mode, frames, opts = {}) {
  game.start(mode);
  if (opts.invincible) {
    game.player.maxHp = 1e9;
    game.player.hp = 1e9;
  }
  input.mouse.down = true;
  let levelUps = 0;
  let maxEnemies = 0;
  let maxParticles = 0;

  for (let i = 0; i < frames; i++) {
    // 简易 AI：瞄准最近的敌人，并向远离最近敌人的方向移动（风筝）
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
      if (l < 340) {
        if (dx / l > 0.3) input.keys.add('KeyD');
        if (dx / l < -0.3) input.keys.add('KeyA');
        if (dy / l > 0.3) input.keys.add('KeyS');
        if (dy / l < -0.3) input.keys.add('KeyW');
      } else {
        const cx = game.W / 2 - p.x, cy = game.H / 2 - p.y;
        const cl = Math.hypot(cx, cy) || 1;
        if (cx / cl > 0.3) input.keys.add('KeyD');
        if (cx / cl < -0.3) input.keys.add('KeyA');
        if (cy / cl > 0.3) input.keys.add('KeyS');
        if (cy / cl < -0.3) input.keys.add('KeyW');
      }
    } else {
      input.mouse.x = 640 + Math.cos(i * 0.02) * 320;
      input.mouse.y = 360 + Math.sin(i * 0.02) * 220;
    }

    try {
      game.update(STEP);
      if (i % 3 === 0) game.render();
    } catch (e) {
      errors++;
      console.error(`[${mode}] frame ${i} 异常:`, e.message);
      console.error(e.stack.split('\n').slice(0, 4).join('\n'));
      if (errors > 3) break;
    }
    input.endFrame();
    maxEnemies = Math.max(maxEnemies, game.enemies.length);
    maxParticles = Math.max(maxParticles, game.particles.list.length);

    // 自动选技能
    if (game.state === 'levelup') {
      levelUps++;
      const perk = game.perkChoices[0];
      try {
        game.ui.hide();
        game.pickPerk(perk);
      } catch (e) {
        errors++;
        console.error('选技能异常:', e.message);
      }
    }
    if (game.state === 'dead' && !opts.invincible) break;
    if (game.state === 'clear') {
      try { game.ui.nextLevel(); } catch (e) { errors++; console.error('下一关异常:', e.message); }
    }
  }

  return {
    mode,
    time: +game.time.toFixed(1),
    kills: game.kills,
    score: game.score,
    level: game.player.level,
    wave: game.wave,
    hp: Math.round(game.player.hp),
    state: game.state,
    levelUps,
    maxEnemies,
    maxParticles,
    bullets: game.bullets.length,
    enemies: game.enemies.length,
    pickups: game.pickups.length,
    particles: game.particles.list.length
  };
}

// 无敌模式跑满帧，验证长期稳定性与内存增长
const r1 = simulate('survival', 5400);
console.log('生存模式 90s:', r1);

const r2 = simulate('survival', 18000, { invincible: true });
console.log('生存模式 300s (不死):', r2);

const r3 = simulate('quest', 12000);
console.log('关卡模式:', r3);

// Perk 全量压测：连续升级并把所有可叠能力拿满
game.start('survival');
let perkErrors = 0;
for (let round = 0; round < 40; round++) {
  game.gainXp(60);
  let guard = 0;
  while (game.state === 'levelup' && guard++ < 20) {
    const perk = game.perkChoices[0];
    if (!perk) break;
    try {
      game.ui.hide();
      game.pickPerk(perk);
    } catch (e) {
      perkErrors++;
      console.error('Perk 压测异常:', e.message);
    }
  }
}
const p = game.player;
console.log('Perk 压测:', {
  等级: p.level,
  已选Perk: Object.keys(p.perkCounts).length,
  总层数: Object.values(p.perkCounts).reduce((a, b) => a + b, 0),
  伤害倍率: +p.stats.dmgMul.toFixed(2),
  弹匣倍率: +p.stats.magBonus.toFixed(2),
  错误: perkErrors
});

// 功能点校验
const { PERK_MAP } = await import('../src/game/perks.js');
const { giveWeapon, swapWeapon } = await import('../src/game/player.js');
const { damageEnemy } = await import('../src/game/enemies.js');

let fnErrors = 0;
const assert = (cond, msg) => {
  if (!cond) { fnErrors++; console.error('断言失败:', msg); }
};

game.start('survival');
const pl = game.player;

// 副武器槽
game.setState('levelup');
game.pickPerk(PERK_MAP.alternate);
assert(pl.secondaryUnlocked === true, '备用武器应解锁副武器槽');
giveWeapon(game, pl, 'rifle');
assert(pl.secondary === 'rifle', '拾取武器应进入副武器槽');
const cur = pl.weapon;
swapWeapon(game, pl);
assert(pl.weapon === 'rifle' && pl.secondary === cur, 'Q 切换应交换主副武器');

// 开火 -> 弹药减少 -> 自动装填
game.setState('playing');
input.mouse.down = true;
const before = pl.ammo;
for (let i = 0; i < 12; i++) { game.update(STEP); input.endFrame(); }
assert(pl.ammo < before || pl.reloading > 0, '开火应消耗弹药');

// 爆炸
const e0 = game.spawn('zombie', {});
const hp0 = e0.hp;
game.explode(e0.x, e0.y, 120, 50, false);
assert(e0.dead || e0.hp < hp0, '爆炸应对范围内敌人造成伤害');

// Boss 击杀流程
const boss = game.spawn('brute', {});
boss.hp = 1;
damageEnemy(game, boss, 999, {});
assert(boss.dead === true, 'Boss 应可被击杀');
assert(game.pickups.some((it) => it.type === 'weapon'), 'Boss 必掉武器');

// 边缘威胁指示器
const { offscreenThreats } = await import('../src/game/threats.js');
game.start('survival');
game.setState('playing');
for (let i = 0; i < 24; i++) game.spawn('zombie', {});
const threats = offscreenThreats(game, 1280, 720);
assert(threats.length === 8, `视野外敌人过多时应截断到 8 个，实际 ${threats.length}`);
assert(
  threats.every((t) => t.x >= 0 && t.x <= 1280 && t.y >= 0 && t.y <= 720),
  '指示器坐标应落在视口内'
);
assert(
  threats.every((t, i) => i === 0 || threats[i - 1].dist <= t.dist),
  '指示器应按距离升序（近的优先保留）'
);
// 视野内的敌人不该出现提示
game.enemies.length = 0;
const near = game.spawn('zombie', {});
near.x = game.player.x + 8;
near.y = game.player.y;
assert(offscreenThreats(game, 1280, 720).length === 0, '视野内敌人不应产生边缘指示器');
// 非战斗状态不提示
for (let i = 0; i < 4; i++) game.spawn('zombie', {});
game.setState('paused');
assert(offscreenThreats(game, 1280, 720).length === 0, '暂停时不应显示边缘指示器');
game.setState('playing');

// 关卡推进
game.start('quest');
game.questQueue.length = 0;
game.enemies.length = 0;
game.update(STEP);
assert(game.state === 'clear', '关卡清空后应进入 clear 状态');

console.log('功能校验:', fnErrors === 0 ? 'PASS' : `${fnErrors} 项失败`);

console.log(errors === 0 && perkErrors === 0 && fnErrors === 0 ? '\nSMOKE_OK 无运行时异常' : `\nSMOKE_FAIL 捕获 ${errors + perkErrors + fnErrors} 个问题`);
process.exit(errors === 0 && perkErrors === 0 && fnErrors === 0 ? 0 : 1);
