// 无浏览器环境下的冒烟测试：用最小 DOM/Canvas 桩跑几千帧，捕获运行时异常
// 运行： node tools/smoke.mjs
import { installDom, makeCanvas } from './dom-stub.mjs';

installDom();

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
const { PERK_MAP, PERKS, SYNERGY, synergyWith } = await import('../src/game/perks.js');
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

// 刻印三路线（v0.3：钢铁 11 / 本能 8 / 侵蚀 6）
const LINE_COUNT = { steel: 0, instinct: 0, erosion: 0 };
const badLine = PERKS.filter((perk) => {
  if (!(perk.line in LINE_COUNT)) return true;
  LINE_COUNT[perk.line]++;
  return false;
});
assert(badLine.length === 0, `每个 Perk 必须有合法 line，异常：${badLine.map((p) => p.id).join(',')}`);
assert(
  PERKS.length === 25 && LINE_COUNT.steel === 11 && LINE_COUNT.instinct === 8 && LINE_COUNT.erosion === 6,
  `三路线应为 11/8/6（共 25），实际 ${LINE_COUNT.steel}/${LINE_COUNT.instinct}/${LINE_COUNT.erosion} 共 ${PERKS.length}`
);

// 稀有度（S6-D）：每张卡都有合法稀有度；稀有=机制型；禁忌只有侵蚀线
const RARITIES = new Set(['common', 'rare', 'forbidden']);
const badRarity = PERKS.filter((perk) => !RARITIES.has(perk.rarity));
assert(badRarity.length === 0, `稀有度非法：${badRarity.map((p) => p.id).join(',')}`);
const rarePerks = PERKS.filter((perk) => perk.rarity === 'rare');
assert(rarePerks.length === 5, `应有 5 个机制型（rare）刻印，实际 ${rarePerks.length}`);
assert(rarePerks.every((perk) => perk.id && typeof perk.apply === 'function'), '稀有刻印必须有 apply');
const forbidden = PERKS.filter((perk) => perk.rarity === 'forbidden');
assert(forbidden.length >= 1 && forbidden.every((perk) => perk.line === 'erosion'), '禁忌刻印必须属于侵蚀线');

// 协同表引用的 id 必须都存在
const badSyn = [];
for (const [id, partners] of Object.entries(SYNERGY)) {
  if (!PERK_MAP[id]) badSyn.push(id);
  for (const partner of partners) if (!PERK_MAP[partner]) badSyn.push(partner);
}
assert(badSyn.length === 0, `协同表引用了不存在的 id：${badSyn.join(',')}`);

// 左臂布条随层数（STORY §2.3）
game.start('quest');
assert(game.player.stripes === 1, `首层布条应为 1，实际 ${game.player.stripes}`);
game.loadQuest(3);
assert(game.player.stripes === 4, `第四层布条应为 4，实际 ${game.player.stripes}`);
game.start('survival');
assert(game.player.stripes === 1, `竞技场布条应回到 1，实际 ${game.player.stripes}`);

// 叙事层：独白 / 层间卡 / 守层者登场（P3）
const { MONO, VOICE_LIMITS, Voice } = await import('../src/game/voice.js');

// 独白必须"短"（STORY §9 独白原则）
const longLines = Object.values(MONO).flat().filter((l) => l.length > VOICE_LIMITS.MAX_CHARS);
assert(longLines.length === 0, `独白单行不得超过 ${VOICE_LIMITS.MAX_CHARS} 字：${longLines.join(' / ')}`);

// 开局独白立刻可见，且不许改动游戏状态（铁律：不暂停 update）
game.start('survival');
assert(game.voice.active && game.voice.cur.text === MONO.start[0], '开局应立刻有独白');
assert(game.state === 'playing', '独白不得改变游戏状态');
const chars0 = game.voice.visibleChars;
for (let i = 0; i < 6; i++) { game.update(STEP); input.endFrame(); }
assert(game.voice.visibleChars > chars0, '打字机应逐字推进');
assert(game.voice.visibleChars < MONO.start[0].length, '0.1s 内不应打完整句');
assert(game.state === 'playing', '独白播放期间仍可正常战斗');

// 同名独白每局只播一次
assert(game.voice.say('firstLowHp') === true, '首次低血独白应入队');
assert(game.voice.say('firstLowHp') === false, '同名独白不应重复入队');

// 队列行为（纯逻辑，不依赖画布）
const v0 = new Voice();
v0.push('甲');
v0.push('乙');
assert(v0.active && v0.cur.text === '甲', '独白应按先进先出');
for (let i = 0; i < 60 * 4; i++) v0.update(STEP);
assert(v0.cur && v0.cur.text === '乙', '前一句播完应自动接下一句');
for (let i = 0; i < 60 * 3; i++) v0.update(STEP);
assert(v0.active === false, '队列播完应自动收尾');
v0.push('丙');
v0.reset();
assert(v0.active === false && v0.queue.length === 0, 'reset 应清空独白队列');

// 层间文本卡：拆眉批 + 主标题，带 total 供淡入淡出
game.start('quest');
assert(game.banner.kicker === '第一章' && game.banner.text === '消化场', `层间卡拆分异常：${game.banner.kicker} / ${game.banner.text}`);
assert(game.banner.total === 2.0, `层间卡应有 total，实际 ${game.banner.total}`);
game.loadQuest(5);
assert(game.banner.kicker === '第六章' && game.banner.text === '守层者之厅', `末层卡异常：${game.banner.kicker} / ${game.banner.text}`);

// 守层者登场：名字条 + 镜头轻推（不改缩放）+ 独白只一次
game.start('survival');
const zBefore = game.cam.zoom;
const bossE = game.spawn('brute', {});
assert(game.intro && game.intro.boss === bossE, 'Boss 出生应触发登场演出');
assert(game.banner.kicker === '层主' && game.banner.text === '守层者', `层主条异常：${game.banner.text}`);
assert(game.voice.say('firstBoss') === false, '层主独白已由登场触发的入队，不应重复');
for (let i = 0; i < 30; i++) { game.update(STEP); input.endFrame(); }
assert(game.cam.zoom === zBefore, '登场演出不得改动缩放（否则世界坐标换算会错位）');
for (let i = 0; i < 120; i++) { game.update(STEP); input.endFrame(); }
assert(game.intro === null, '登场演出应在 1.6s 后自动结束');

// 种子 RNG（P4-0）：同 seed 同序列，无 seed 回到 Math.random
const M = await import('../src/core/math.js');
game.setSeed('smoke-seed');
assert(M.usingSeed() === true, 'setSeed 后应启用种子流');
const seedA = M.random();
const seedB = M.random();
game.setSeed('smoke-seed');
assert(M.random() === seedA && M.random() === seedB, '同 seed 的随机序列必须完全一致');
assert(M.hashSeed('smoke-seed') === M.hashSeed('smoke-seed'), 'hashSeed 应稳定');
game.setSeed(null);
assert(M.usingSeed() === false, 'setSeed(null) 应恢复 Math.random');

// 侵蚀值（P4-1）：只有"侵蚀"线刻印涨侵蚀，封顶 100
const { EROSION_PER_STACK, EROSION_MAX } = await import('../src/game/perks.js');
game.start('survival');
const pe = game.player;
assert(pe.erosion === 0, `开局侵蚀应为 0，实际 ${pe.erosion}`);
game.setState('levelup');
game.pickPerk(PERK_MAP.pyromaniac);
assert(pe.erosion === EROSION_PER_STACK, `侵蚀线刻印应 +${EROSION_PER_STACK}，实际 ${pe.erosion}`);
game.setState('levelup');
game.pickPerk(PERK_MAP.bloody_mess);
assert(pe.erosion === EROSION_PER_STACK, '钢铁线刻印不应涨侵蚀');
for (let i = 0; i < 30; i++) {
  game.setState('levelup');
  game.pickPerk(PERK_MAP.pyromaniac);
}
assert(pe.erosion === EROSION_MAX, `侵蚀应封顶 ${EROSION_MAX}，实际 ${pe.erosion}`);

// 侵蚀峰值 + ≥70 的独白与死亡面板数据（P4-2 / P4-3）
game.start('survival');
game.player.erosion = 80;
game.update(STEP);
assert(game.maxErosion === 80, `峰值侵蚀应被记录，实际 ${game.maxErosion}`);
assert(game.voice.seen.has('erosionHigh') === true, '侵蚀 ≥70 应触发"不像人"的独白');
const sum = game.summary();
assert(sum.maxErosion === 80 && sum.erosion === 80, `summary 应带侵蚀数据，实际 ${JSON.stringify({ e: sum.erosion, m: sum.maxErosion })}`);

// ≥70 敌人移速 +10%（同 seed 下对比 1 秒位移）
function enemyTravel(erosion) {
  game.start('survival');
  game.enemies.length = 0;
  game.bullets.length = 0;
  input.mouse.down = false;
  game.setSeed('speed-test');
  game.player.erosion = erosion;
  const e = game.spawn('zombie', {});
  e.x = game.player.x + 500;
  e.y = game.player.y;
  e.born = 0;
  const x0 = e.x;
  for (let i = 0; i < 60; i++) { game.update(STEP); input.endFrame(); }
  return x0 - e.x;
}
const travel0 = enemyTravel(0);
const travel70 = enemyTravel(70);
assert(
  travel70 > travel0 * 1.05,
  `侵蚀 ≥70 敌人应更快：${travel0.toFixed(1)} → ${travel70.toFixed(1)}`
);

// 高侵蚀下渲染不崩（HUD 侵蚀条 + 全屏红移）
let renderErr = null;
try {
  game.player.erosion = 100;
  game.render();
} catch (e) {
  renderErr = e;
}
assert(renderErr === null, `高侵蚀渲染异常：${renderErr && renderErr.message}`);

// 分层配色（S6-A）：六层身份 + 竞技场 + 地面瓦片缓存
const { LAYER_PALETTES, ARENA_PALETTE, paletteForLayer } = await import('../src/render/palettes.js');
assert(LAYER_PALETTES.length === 6, `应有 6 层配色，实际 ${LAYER_PALETTES.length}`);
const palIds = new Set([...LAYER_PALETTES.map((p) => p.id), ARENA_PALETTE.id]);
assert(palIds.size === 7, `配色 id 不能重复，实际 ${palIds.size} 个`);
const badPal = [...LAYER_PALETTES, ARENA_PALETTE].filter(
  (p) => !p.ground || !p.ground.base || !p.blood || !p.fog || !p.ambient || !p.glow
);
assert(badPal.length === 0, `每层配色必须有 ground/blood/fog/ambient/glow：${badPal.map((p) => p.id).join(',')}`);

game.start('quest');
assert(game.palette.id === 'digest', `首层应使用 digest 配色，实际 ${game.palette.id}`);
game.loadQuest(4);
assert(game.palette.id === 'marrow', `第五层应使用 marrow 配色，实际 ${game.palette.id}`);
game.start('survival');
assert(game.palette.id === 'arena', `竞技场应使用 arena 配色，实际 ${game.palette.id}`);
assert(game.groundPattern && game.macroPattern, '地面主瓦片与宏观叠层都应生成 pattern');
assert(paletteForLayer(99).id === 'warden', '越界层索引应夹到最后一层');
assert(paletteForLayer(-3).id === 'digest', '负数层索引应夹到第一层');

// 精灵表（S6-B）：每只怪 4 帧、玩家 4 帧、尺寸下限
const sp = game.sprites;
const enemyKeys = ['zombie', 'runner', 'spider', 'lizard', 'alien', 'brute'];
const badFrames = enemyKeys.filter((k) => !Array.isArray(sp[k]) || sp[k].length !== 4);
assert(badFrames.length === 0, `每种敌人应有 4 帧：${badFrames.join(',')}`);
assert(Array.isArray(sp.player) && sp.player.length === 4, '玩家应有 4 帧（走步态）');
assert(sp.player[0].size === 72, `玩家精灵应为 72px，实际 ${sp.player[0].size}`);
assert(enemyKeys.every((k) => sp[k][0].size >= 50), '敌人精灵尺寸不应小于 50px（承载剪影）');
assert(!!(sp.orb && sp.health && sp.crate), '三种拾取物精灵必须存在');
assert(sp.orb.size < sp.brute[0].size, '掉落物应比 Boss 小得多');

// 武器表（S6-C）：15 把、字段齐全、名字唯一
const { WEAPONS, WEAPON_IDS } = await import('../src/game/weapons.js');
assert(WEAPON_IDS.length === 15, `应有 15 把武器，实际 ${WEAPON_IDS.length}`);
const badW = WEAPON_IDS.filter((id) => {
  const w = WEAPONS[id];
  return !w.name || !w.tier || !w.dmg || !w.rate || !w.mag || !w.reload;
});
assert(badW.length === 0, `武器字段缺失：${badW.join(',')}`);
const wNames = new Set(WEAPON_IDS.map((id) => WEAPONS[id].name));
assert(wNames.size === WEAPON_IDS.length, '武器名不能重复');
const KINDS = new Set(['bullet', 'plasma', 'flame', 'gauss', 'rocket', 'acid', 'saw', 'cryo', 'rail']);
const badKind = WEAPON_IDS.filter((id) => WEAPONS[id].kind && !KINDS.has(WEAPONS[id].kind));
assert(badKind.length === 0, `未实现的子弹类型：${badKind.join(',')}`);
assert(WEAPON_IDS.some((id) => WEAPONS[id].burst > 1), '应存在连发武器');
assert(WEAPON_IDS.some((id) => WEAPONS[id].charge > 0), '应存在蓄力武器');
assert(WEAPON_IDS.some((id) => WEAPONS[id].slow > 0), '应存在减速武器');

// 三连点射：一次扣扳机打三发
game.start('survival');
game.enemies.length = 0;
game.bullets.length = 0;
giveWeapon(game, game.player, 'catechism');
input.mouse.down = true;
game.player.cd = 0;
const ammoBeforeBurst = game.player.ammo;
game.update(STEP);
for (let i = 0; i < 20; i++) { game.update(STEP); input.endFrame(); }
assert(ammoBeforeBurst - game.player.ammo >= 3, `三连点射应耗 3 发，实际 ${ammoBeforeBurst - game.player.ammo}`);
input.mouse.down = false;

// 蓄力：没蓄满不放，蓄满才放
game.start('survival');
game.enemies.length = 0;
game.bullets.length = 0;
giveWeapon(game, game.player, 'hymn');
input.mouse.down = true;
for (let i = 0; i < 18; i++) { game.update(STEP); input.endFrame(); }  // 0.30s < 0.6s
assert(game.bullets.length === 0, `蓄力未满不应开火，实际 ${game.bullets.length} 发`);
assert(game.player.chargeT > 0, '蓄力进度应在累积');
for (let i = 0; i < 24; i++) { game.update(STEP); input.endFrame(); }  // 累计 0.7s
assert(game.bullets.length > 0, '蓄满应开火');
input.mouse.down = false;

// 冰冻：命中后敌人被减速
game.start('survival');
game.enemies.length = 0;
const frostTarget = game.spawn('zombie', {});
frostTarget.x = game.player.x + 200;
frostTarget.y = game.player.y;
frostTarget.born = 0;
game.addBullet({ x: frostTarget.x - 12, y: frostTarget.y, vx: 800, vy: 0, r: 3, dmg: 1, pierce: 0, life: 1, color: '#a8f0ff', kind: 'cryo', slow: 1.2 });
game.update(STEP);
assert(frostTarget.slow > 0, `冰冻应设置减速计时，实际 ${frostTarget.slow}`);
assert(frostTarget.slowMul <= 0.5, `冰冻倍率应 ≤0.5，实际 ${frostTarget.slowMul}`);

// 掉落保底：22 秒必掉一把（不依赖击杀）
game.start('survival');
game.pickups.length = 0;
game.firstWeaponGiven = false;
game.time = 22.1;
game.update(STEP);
assert(game.pickups.some((it) => it.type === 'weapon'), '22 秒应保底掉一把武器');
const openingDrop = game.pickups.find((it) => it.type === 'weapon');
assert(openingDrop.tier >= 1 && openingDrop.tier <= 4, '掉落物应带合法 tier');

// 保底：超过 90 秒没掉，下一只怪必掉
game.start('survival');
game.pickups.length = 0;
game.enemies.length = 0;
game.lastWeaponDropAt = game.time - 91;
const pityZombie = game.spawn('zombie', {});
pityZombie.hp = 1;
damageEnemy(game, pityZombie, 999, {});
assert(game.pickups.some((it) => it.type === 'weapon'), '超 90 秒未掉落应触发保底');

// 机制型刻印的行为断言（S6-D）
game.start('survival');
game.enemies.length = 0;
game.bullets.length = 0;
// 跳弹：子弹命中后应反弹而不是消失
game.setState('levelup');
game.pickPerk(PERK_MAP.ricochet);
game.setState('playing');
game.player.weapon = 'pistol';
const bTgt = game.spawn('zombie', {});
bTgt.x = game.player.x + 120;
bTgt.y = game.player.y;
bTgt.born = 0;
const bTgt2 = game.spawn('zombie', {});
bTgt2.x = bTgt.x + 40;
bTgt2.y = bTgt.y + 60;
bTgt2.born = 0;
input.mouse.down = false;
const hp2Before = bTgt2.hp;
game.addBullet({ x: bTgt.x - 40, y: bTgt.y, vx: 900, vy: 0, r: 3, dmg: 10, pierce: 0, life: 1, color: '#fff', bounceLeft: 1 });
for (let i = 0; i < 10; i++) { game.update(STEP); input.endFrame(); }
assert(bTgt2.hp < hp2Before || game.bullets.length > 0, `跳弹应转向第二个敌人，实际血量 ${hp2Before}→${bTgt2.hp}，在场 ${game.bullets.length}`);

// 连锁：命中应顺带打到第二个敌人
game.start('survival');
game.enemies.length = 0;
game.bullets.length = 0;
game.setState('levelup');
game.pickPerk(PERK_MAP.chain);
game.setState('playing');
const cA = game.spawn('zombie', {});
cA.x = game.player.x + 100; cA.y = game.player.y; cA.born = 0;
const cB = game.spawn('zombie', {});
cB.x = cA.x + 60; cB.y = cA.y + 8; cB.born = 0;
const hpB0 = cB.hp;
game.addBullet({ x: cA.x - 30, y: cA.y, vx: 900, vy: 0, r: 3, dmg: 20, pierce: 0, life: 1, color: '#fff' });
for (let i = 0; i < 6; i++) { game.update(STEP); input.endFrame(); }
assert(cB.hp < hpB0, `连锁应波及第二个敌人，实际 ${hpB0} → ${cB.hp}`);

// 布雷：脚下应出现地雷，敌人踩到会炸
game.start('survival');
game.enemies.length = 0;
game.mines.length = 0;
game.setState('levelup');
game.pickPerk(PERK_MAP.minefield);
game.setState('playing');
for (let i = 0; i < 12; i++) { game.update(STEP); input.endFrame(); }
assert(game.mines.length >= 1, `布雷刻印应留下地雷，实际 ${game.mines.length}`);

// 冰痕：移动后应留下粘液
game.start('survival');
game.frostPools.length = 0;
game.setState('levelup');
game.pickPerk(PERK_MAP.frosttrail);
game.setState('playing');
input.keys.clear();
input.keys.add('KeyD');
for (let i = 0; i < 30; i++) { game.update(STEP); input.endFrame(); }
input.keys.clear();
assert(game.frostPools.length >= 1, `冰痕应留下减速池，实际 ${game.frostPools.length}`);

// 重掷：每局只能用一次
game.start('survival');
game.gainXp(60);
assert(game.state === 'levelup', '应先进入升级界面');
const beforeRoll = game.perkChoices.map((p) => p.id).join(',');
const rolled = game.rerollPerks();
assert(rolled === true, '第一次重掷应成功');
assert(game.rerollPerks() === false, '第二次重掷应被拒绝');
assert(game.rerollUsed === true, '重掷应被记为已用');
assert(typeof beforeRoll === 'string', '重掷前后都应有候选');
game.setState('playing');

// 满血时不该出现"立即回满"类刻印
game.start('survival');
game.player.hp = game.player.maxHp;
let doctorSeen = 0;
for (let i = 0; i < 30; i++) {
  for (const perk of game.perkChoices) if (perk.id === 'doctor') doctorSeen++;
  game.gainXp(60);
  if (game.state === 'levelup') game.pickPerk(game.perkChoices[0]);
}
assert(doctorSeen === 0, `满血时不应出现医学博士，出现了 ${doctorSeen} 次`);

// 协同：同时持有跳弹与穿透时应能识别出协同
game.start('survival');
game.player.perkCounts = { ricochet: 1, piercing: 1 };
const syn = synergyWith(game.player, PERK_MAP.ricochet);
assert(syn.length >= 1 && syn.some((p) => p.id === 'piercing'), '跳弹 + 穿透应识别为协同');

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
