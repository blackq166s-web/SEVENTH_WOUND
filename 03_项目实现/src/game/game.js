import * as M from '../core/math.js';
import { Camera } from '../core/camera.js';
import { Decals } from './decals.js';
import { Particles } from './particles.js';
import { createPlayer, updatePlayer, hurtPlayer, giveWeapon, healPlayer } from './player.js';
import { WEAPONS, magSize, randomWeaponDrop } from './weapons.js';
import { spawnEnemy, updateEnemy, damageEnemy, ENEMY_TYPES } from './enemies.js';
import { rollPerks, applyPerk } from './perks.js';
import { drawHud } from './hud.js';
import { Voice, drawVoice } from './voice.js';
import { drawThreatIndicators } from './threats.js';
import { QUESTS, buildQuestQueue } from './quests.js';
import { getSprites, makeGroundTile, makeGroundMacro, GROUND_MACRO_SCALE } from '../render/sprites.js';
import { paletteForLayer, ARENA_PALETTE, mixHex } from '../render/palettes.js';
import { drawAmbient } from './ambient.js';
import { fxRandom, fxRand } from '../core/fx.js';

const WORLD_W = 2600;
const WORLD_H = 2000;

// 左臂布条颜色 = 该层主色（STORY §10 配色分区），最多 4 条
const STRIPE_COLORS = ['#8f2a1c', '#a51622', '#4c7a26', '#6b2b93'];

// localStorage 在 file:// 或隐私模式下可能直接抛异常（单文件发布版就是 file://）。
// 存档只是"最高分"，丢了不影响玩，所以一律吞掉异常。
function loadSave(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function saveBest(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch (e) {
    /* 存档不可用：忽略 */
  }
}

export class Game {
  constructor(canvas, ctx, input, audio, ui) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.input = input;
    this.audio = audio;
    this.ui = ui;

    this.W = WORLD_W;
    this.H = WORLD_H;
    this.dpr = 1;
    this.vw = 1280;
    this.vh = 720;

    this.sprites = getSprites();
    // 分层视觉：地面瓦片 / 雾色 / 血迹 / 浮尘全部按层取（render/palettes.js）
    this.palette = ARENA_PALETTE;
    this.ground = null;
    this.groundPattern = null;
    this.macroPattern = null;
    this.setPalette(ARENA_PALETTE);

    this.cam = new Camera(this.W, this.H);
    this.decals = new Decals(this.W, this.H);
    this.particles = new Particles();

    this.state = 'menu';
    this.mode = 'survival';
    this.player = null;
    this.enemies = [];
    this.bullets = [];
    this.pickups = [];
    this.mouseWorld = { x: 0, y: 0 };

    this.time = 0;
    this.wave = 1;
    this.waveTimer = 0;
    this.spawnTimer = 0;
    this.kills = 0;
    this.score = 0;
    // 存档键于 2026-10-21 改名（CRIMSON ARENA → SEVENTH WOUND）。
    // 必须保留旧键回退：改名当天已有的玩家最高分写在 crimson_best 里。
    const savedBest = loadSave('seventhwound_best') ?? loadSave('crimson_best');
    this.best = Number(savedBest || 0);
    this.banner = { text: '', sub: '', t: 0 };
    this.hitstop = 0;
    this.voice = new Voice();
    this.intro = null;       // 守层者登场演出（只影响镜头取景，不改任何数值）
    this.perkChoices = [];
    this.stats = { shots: 0, damage: 0 };
    this.questIndex = 0;
    this.questDef = null;
    this.questQueue = [];
    this.questTimer = 0;
    this.questDone = false;
    this.questName = '';
    this.timeScale = 1;

    // 种子 RNG（P4-0）：null = 用 Math.random，行为与改动前一致
    this.seed = null;
    // 侵蚀值（P4-1）：本局峰值，死亡面板用
    this.maxErosion = 0;
    this.heartTimer = 0;
  }

  /** 传 null/'' 恢复 Math.random；返回实际生效的种子（null 表示未启用） */
  setSeed(seed) {
    const s = seed === null || seed === undefined || seed === '' ? null : String(seed);
    this.seed = s;
    M.setRng(s === null ? null : M.makeRng(s));
    return s;
  }

  /** 切换该层的视觉配色：地面瓦片、雾、血迹、浮尘（缓存按 palette.id 复用） */
  setPalette(pal) {
    if (!pal || pal === this.palette && this.groundPattern) return;
    this.palette = pal;
    this.ground = makeGroundTile(pal);
    this.groundPattern = this.ctx.createPattern(this.ground, 'repeat');
    this.macroPattern = this.ctx.createPattern(makeGroundMacro(pal), 'repeat');
    this._ambient = null; // 浮尘按层重建
  }

  setViewport(w, h, dpr) {
    this.vw = w;
    this.vh = h;
    this.dpr = dpr;
    this.cam.setViewport(w, h);
  }

  // ================= 生命周期 =================

  start(mode) {
    this.mode = mode;
    // 同一 seed 每局从头播同一条序列：重开即复现，不看上一局跑了多久
    if (this.seed) this.setSeed(this.seed);
    this.reset();
    this.state = 'playing';
    this.ui.hide();
    this.banner = { text: mode === 'quest' ? '第一章 · 苏醒' : '第 1 波', sub: mode === 'quest' ? '消灭所有敌人' : '生存下去', t: 2.6, total: 2.6 };
    // 开局独白：不暂停、不挡输入，只是屏幕底部多两行字
    this.voice.say('start');
    if (mode === 'quest') this.loadQuest(0);
    else {
      this.setPalette(ARENA_PALETTE);
      // 开场先给一小波敌人，避免开局空场
      for (let i = 0; i < 5; i++) this.spawn('zombie', { hpMul: 1, dmgMul: 1, speedMul: 1 });
    }
  }

  reset() {
    this.player = createPlayer(this.W / 2, this.H / 2);
    this.enemies.length = 0;
    this.bullets.length = 0;
    this.pickups.length = 0;
    this.particles.clear();
    this.decals.clear();
    this.time = 0;
    this.wave = 1;
    this.waveTimer = 0;
    this.spawnTimer = 0.6;
    this.kills = 0;
    this.score = 0;
    this.hitstop = 0;
    this.perkChoices = [];
    this.stats = { shots: 0, damage: 0 };
    this.questIndex = 0;
    this.questQueue = [];
    this.questDone = false;
    this.questName = '';
    this.intro = null;
    this.maxErosion = 0;
    this.heartTimer = 0;
    this.voice.reset();
    this.cam.snapTo(this.player.x, this.player.y);
    this.cam.shakeAmt = 0;
  }

  loadQuest(i) {
    this.questIndex = i;
    this.questDef = QUESTS[i];
    this.questName = this.questDef.name;
    // 每下一层，左臂多一条布条（设定 → 可见的进度标记）
    if (this.player) this.player.stripes = i + 1;
    // 每层的视觉身份：地面材质 / 雾色 / 血迹 / 浮尘
    this.setPalette(paletteForLayer(i));
    this.questQueue = buildQuestQueue(this.questDef);
    this.questTimer = 0.4;
    this.questDone = false;
    this.questTotal = this.questQueue.length;
    // 层间文本卡：复用 banner 通道，把「第一章 · 消化场」拆成眉批 + 主标题 + 副题
    // 生命周期 2.0s = 0.28 淡入 + 1.2 停留 + 0.5 淡出（hud.js 按 total 算透明度）
    const cut = this.questName.indexOf(' · ');
    const kicker = cut > 0 ? this.questName.slice(0, cut) : '';
    const title = cut > 0 ? this.questName.slice(cut + 3) : this.questName;
    this.banner = { kicker, text: title, sub: this.questDef.brief, t: 2.0, total: 2.0 };
  }

  // ================= 更新 =================

  update(dt) {
    // 升级选择（数字键）
    if (this.state === 'levelup') {
      for (let i = 0; i < this.perkChoices.length; i++) {
        if (this.input.tap('Digit' + (i + 1))) {
          this.ui.hide();
          this.pickPerk(this.perkChoices[i]);
          break;
        }
      }
    }

    // 暂停切换
    if (this.input.tap('Escape') || this.input.tap('KeyP')) {
      if (this.state === 'playing') { this.setState('paused'); this.ui.showPause(); }
      else if (this.state === 'paused') { this.setState('playing'); this.ui.hide(); }
    }
    if (this.input.tap('KeyM')) {
      const muted = this.audio.toggleMute();
      if (this.player) {
        this.particles.text(this.player.x, this.player.y - 40, muted ? '静音' : '音效开', '#fff', 14);
      }
    }

    // 世界鼠标坐标
    if (this.player) {
      this.mouseWorld.x = this.cam.x + (this.input.mouse.x - this.cam.ox) / this.cam.zoom;
      this.mouseWorld.y = this.cam.y + (this.input.mouse.y - this.cam.oy) / this.cam.zoom;
    }

    if (this.state === 'playing') {
      let step = dt;
      if (this.hitstop > 0) {
        this.hitstop -= dt;
        step = dt * 0.12;
      }
      this.time += step;
      this.updateWorld(step);
    } else if (this.state === 'paused' || this.state === 'levelup' || this.state === 'clear') {
      // 冻结世界
    } else if (this.state === 'dead') {
      this.particles.update(dt);
      this.cam.update(dt);
    }

    if (this.banner.t > 0) this.banner.t -= dt;
    // 独白只在真正打的时候走字：暂停/升级/结算时冻结，恢复后接着打，不会漏句
    if (this.state === 'playing') this.voice.update(dt);
    this.particles.update(this.state === 'playing' ? dt : dt * 0.4);
    this.decals.fade(dt);
    this.cam.update(dt);
  }

  setState(s) {
    this.state = s;
  }

  updateWorld(dt) {
    const p = this.player;
    updatePlayer(this, p, dt);

    // 镜头轻微朝准星方向前探，扩大前方视野
    let lookX = M.clamp((this.mouseWorld.x - p.x) * 0.16, -110, 110);
    let lookY = M.clamp((this.mouseWorld.y - p.y) * 0.16, -90, 90);

    // 守层者登场：镜头短暂偏向它再回位。只改建帧的取景目标，
    // 不动 cam.zoom，鼠标世界坐标换算因此保持正确（不会打偏）。
    if (this.intro) {
      this.intro.t -= dt;
      const b = this.intro.boss;
      if (this.intro.t <= 0 || !b || b.dead) {
        this.intro = null;
      } else {
        // sin 曲线：推到 0.32 权重再收回，起落都不生硬
        const push = Math.sin(Math.PI * (1 - this.intro.t / this.intro.total)) * 0.32;
        lookX = lookX * (1 - push) + (b.x - p.x) * push;
        lookY = lookY * (1 - push) + (b.y - p.y) * push;
      }
    }

    this.cam.follow(p.x + lookX, p.y + lookY, dt);

    // 首次低血独白（每局一次，靠 voice 的去重）
    if (p.hp > 0 && p.hp / p.maxHp < 0.3) this.voice.say('firstLowHp');

    // 侵蚀值（P4-2）：>=40 心跳开始加快，>=70 台词开始"不像人"
    const er = p.erosion || 0;
    if (er > this.maxErosion) this.maxErosion = er;
    if (er >= 40) {
      this.heartTimer -= dt;
      if (this.heartTimer <= 0) {
        const k = M.clamp((er - 40) / 60, 0, 1); // 40 → 0，100 → 1
        this.heartTimer = 1.15 - 0.6 * k;        // 1.15s 加快到 0.55s
        this.audio.heartbeat(0.7 + k * 0.5);
      }
    } else {
      this.heartTimer = 0;
    }
    if (er >= 70) this.voice.say('erosionHigh');

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead) continue;
      updateEnemy(this, e, dt);
    }
    this.separateEnemies();
    this.enemies = this.enemies.filter((e) => !e.dead);

    this.updateBullets(dt);
    this.updatePickups(dt);

    if (this.mode === 'quest') this.updateQuestSpawner(dt);
    else this.updateWaveSpawner(dt);
  }

  separateEnemies() {
    const es = this.enemies;
    const n = es.length;
    for (let i = 0; i < n; i++) {
      const a = es[i];
      if (a.dead) continue;
      for (let j = i + 1; j < n; j++) {
        const b = es[j];
        if (b.dead) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 > min * min || d2 < 0.0001) continue;
        const d = Math.sqrt(d2);
        const push = ((min - d) / d) * 0.5;
        const ox = dx * push;
        const oy = dy * push;
        if (a.def.isBoss) { b.x += ox * 1.6; b.y += oy * 1.6; }
        else if (b.def.isBoss) { a.x -= ox * 1.6; a.y -= oy * 1.6; }
        else {
          a.x -= ox; a.y -= oy;
          b.x += ox; b.y += oy;
        }
      }
    }
  }

  updateBullets(dt) {
    const bs = this.bullets;
    const p = this.player;
    const es = this.enemies;

    for (let i = bs.length - 1; i >= 0; i--) {
      const b = bs[i];
      let dead = false;

      // 追踪
      if (b.homing > 0 && !b.hostile) {
        let best = null, bestD = 380 * 380;
        for (let k = 0; k < es.length; k++) {
          const e = es[k];
          if (e.dead) continue;
          const d2 = M.dist2(b.x, b.y, e.x, e.y);
          if (d2 < bestD) { bestD = d2; best = e; }
        }
        if (best) {
          const sp = Math.hypot(b.vx, b.vy) || 1;
          const want = Math.atan2(best.y - b.y, best.x - b.x);
          const cur = Math.atan2(b.vy, b.vx);
          const na = M.angleLerp(cur, want, Math.min(1, b.homing * dt));
          b.vx = Math.cos(na) * sp;
          b.vy = Math.sin(na) * sp;
        }
      }

      b.px = b.x;
      b.py = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;

      // 尾迹
      if (b.kind === 'flame') {
        if (M.random() < dt * 55) {
          this.particles.add({
            type: 'smoke',
            x: b.x + M.rand(-4, 4), y: b.y + M.rand(-4, 4),
            vx: b.vx * 0.06 + M.rand(-30, 30),
            vy: b.vy * 0.06 + M.rand(-30, 30),
            life: M.rand(0.12, 0.28), size: M.rand(5, 11),
            color: M.random() < 0.5 ? 'rgba(255,170,60,0.55)' : 'rgba(255,90,30,0.45)',
            drag: 3
          });
        }
      } else if (b.glow && M.random() < dt * 30) {
        this.particles.add({
          type: 'dot', x: b.x, y: b.y, vx: 0, vy: 0,
          life: 0.18, size: b.r * 0.8, color: b.color
        });
      }

      if (b.hostile) {
        // 命中玩家
        const rr = p.r + b.r;
        if (M.dist2(b.x, b.y, p.x, p.y) < rr * rr) {
          hurtPlayer(this, b.dmg);
          this.particles.sparks(b.x, b.y, Math.atan2(b.vy, b.vx) + Math.PI, 4, b.color);
          dead = true;
        }
      } else {
        for (let k = 0; k < es.length; k++) {
          const e = es[k];
          if (e.dead) continue;
          const rr = e.r + b.r;
          if (M.dist2(b.x, b.y, e.x, e.y) > rr * rr) continue;
          if (b.hit.has(e.id)) continue;

          b.hit.add(e.id);
          const idx = e.id;
          const ang = Math.atan2(b.vy, b.vx);
          const kb = b.knockback;
          damageEnemy(this, e, b.dmg, {
            knockback: kb ? { x: Math.cos(ang), y: Math.sin(ang) } : null,
            crit: b.crit,
            source: 'bullet'
          });
          this.stats.damage += b.dmg;

          // 附加效果
          const st = p.stats;
          if (b.burn > 0) {
            e.burn = Math.max(e.burn, 2.2);
            e.burnDps = Math.max(e.burnDps, b.dmg * 0.35 * b.burn);
          }
          if (b.poison > 0) {
            e.poison = Math.max(e.poison, 2.5);
            e.poisonDps = Math.max(e.poisonDps, b.dmg * 0.3);
          }

          if (b.splash) {
            this.explode(b.x, b.y, b.splash.radius, b.splash.dmg, false);
            dead = true;
          } else {
            b.pierce--;
            if (b.pierce < 0) { dead = true; }
          }
          if (dead) break;
        }
      }

      // 出界 / 寿命
      if (!dead && (b.life <= 0 || b.x < -40 || b.y < -40 || b.x > this.W + 40 || b.y > this.H + 40)) {
        if (b.splash) this.explode(b.x, b.y, b.splash.radius, b.splash.dmg, false);
        dead = true;
      }

      if (dead) bs.splice(i, 1);
    }
  }

  updatePickups(dt) {
    const p = this.player;
    const ps = this.pickups;
    for (let i = ps.length - 1; i >= 0; i--) {
      const it = ps[i];
      it.t += dt;

      const d = Math.hypot(p.x - it.x, p.y - it.y);

      if (it.type === 'xp') {
        const nx = (p.x - it.x) / (d || 1);
        const ny = (p.y - it.y) / (d || 1);
        if (d < p.stats.magnet) {
          const k = 1 - d / p.stats.magnet;
          it.vx += nx * (700 + k * 1400) * dt;
          it.vy += ny * (700 + k * 1400) * dt;
          const damp = Math.exp(-3 * dt);
          it.vx *= damp;
          it.vy *= damp;
        } else {
          // 缓慢归巢，避免经验晶体永远留在原地
          const sp = 165;
          const kk = Math.min(1, 2.5 * dt);
          it.vx += (nx * sp - it.vx) * kk;
          it.vy += (ny * sp - it.vy) * kk;
        }
      } else {
        const damp = Math.exp(-4 * dt);
        it.vx *= damp;
        it.vy *= damp;
      }

      it.x += it.vx * dt;
      it.y += it.vy * dt;

      const grab = it.type === 'xp' ? 16 : p.r + 14;
      if (d < grab) {
        this.collect(it);
        ps.splice(i, 1);
      }
    }
  }

  collect(it) {
    const p = this.player;
    if (it.type === 'xp') {
      this.gainXp(it.value);
      this.audio.pickup();
      this.particles.sparks(it.x, it.y, M.rand(0, M.TAU), 3, '#7cf0dd');
    } else if (it.type === 'health') {
      healPlayer(this, 30);
      this.audio.pickup();
      this.particles.ring(it.x, it.y, 26, 'rgba(93,255,155,0.9)', 0.4);
    } else if (it.type === 'weapon') {
      giveWeapon(this, p, it.weapon);
      this.audio.pickup();
      this.particles.ring(it.x, it.y, 30, 'rgba(255,180,60,0.9)', 0.45);
    }
  }

  gainXp(v) {
    const p = this.player;
    p.xp += v * p.stats.xpMul;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      p.pendingLevels++;
      p.xpNext = Math.round(p.xpNext * 1.2 + 5);
      this.audio.levelup();
    }
    if (p.pendingLevels > 0 && this.state === 'playing') this.openLevelUp();
  }

  openLevelUp() {
    const p = this.player;
    this.setState('levelup');
    this.voice.say('firstLevelUp');
    this.perkChoices = rollPerks(p, 3);
    this.cam.kick(3);
    this.particles.ring(p.x, p.y, 90, 'rgba(124,231,255,0.9)', 0.6);
    this.ui.showPerks(this.perkChoices, p);
  }

  pickPerk(perk) {
    const p = this.player;
    applyPerk(p, perk);
    this.audio.click();
    p.pendingLevels--;
    if (p.pendingLevels > 0) {
      this.openLevelUp();
    } else {
      this.ui.hide();
      this.setState('playing');
    }
  }

  // ================= 生成 =================

  spawnPoint() {
    const p = this.player;
    const view = Math.max(this.cam.vmw || this.cam.vw, this.cam.vmh || this.cam.vh);
    const base = view * 0.62 + 60;
    for (let i = 0; i < 16; i++) {
      const a = M.rand(0, M.TAU);
      const d = base * M.rand(0.9, 1.25);
      const x = p.x + Math.cos(a) * d;
      const y = p.y + Math.sin(a) * d;
      if (x > 60 && x < this.W - 60 && y > 60 && y < this.H - 60) return { x, y };
    }
    return { x: M.clamp(p.x + base, 60, this.W - 60), y: M.clamp(p.y + base, 60, this.H - 60) };
  }

  spawn(type, mods) {
    const pos = this.spawnPoint();
    const e = spawnEnemy(this, type, pos.x, pos.y, mods);
    if (e) {
      this.particles.ring(pos.x, pos.y, e.r * 3.2, 'rgba(255,90,90,0.5)', 0.5);
      this.particles.smoke(pos.x, pos.y, 3, 'rgba(60,40,45,0.4)');
      // Boss 出生即演出（竞技场与关卡共用一条路径）
      if (e.def.isBoss) this.bossIntro(e);
    }
    return e;
  }

  /** 守层者登场：名字条 + 镜头轻推 + 降采样音效（不暂停世界） */
  bossIntro(e) {
    this.intro = { t: 1.6, total: 1.6, boss: e };
    this.banner = {
      kicker: '层主',
      text: e.def.name || '守层者',
      sub: '它曾经和你一样',
      t: 2.6,
      total: 2.6
    };
    this.voice.say('firstBoss');
    this.audio.bossIntro();
    this.cam.kick(6);
  }

  pickType() {
    const w = this.wave;
    const pool = [['zombie', 100]];
    if (w >= 2) pool.push(['runner', 55]);
    if (w >= 3) pool.push(['spider', 45]);
    if (w >= 4) pool.push(['lizard', 30]);
    if (w >= 6) pool.push(['alien', 22]);
    if (w >= 9) pool.push(['brute', 4]);

    if (w >= 5) pool[0][1] = 70;
    if (w >= 8) pool[0][1] = 45;

    let total = 0;
    for (const it of pool) total += it[1];
    let r = M.random() * total;
    for (const it of pool) {
      r -= it[1];
      if (r <= 0) return it[0];
    }
    return 'zombie';
  }

  updateWaveSpawner(dt) {
    this.waveTimer += dt;
    this.spawnTimer -= dt;

    const interval = Math.max(0.15, 0.78 - this.wave * 0.042);
    const maxAlive = Math.min(110, 11 + this.wave * 5);

    if (this.spawnTimer <= 0) {
      const deficit = maxAlive - this.enemies.length;
      if (deficit > 0) {
        this.spawnTimer = interval;
        const burst = this.enemies.length < maxAlive * 0.3 ? Math.min(3, 1 + Math.floor(this.wave / 4)) : 1;
        const hpMul = 1 + (this.wave - 1) * 0.13;
        const dmgMul = 1 + (this.wave - 1) * 0.06;
        const speedMul = Math.min(1.35, 1 + (this.wave - 1) * 0.015);
        for (let i = 0; i < burst; i++) this.spawn(this.pickType(), { hpMul, dmgMul, speedMul });
      } else {
        this.spawnTimer = 0.4;
      }
    }

    if (this.waveTimer >= 24) {
      this.waveTimer = 0;
      this.wave++;
      this.audio.wave();
      this.banner = { kicker: '潮汐', text: `第 ${this.wave} 次`, sub: '', t: 2.2, total: 2.2 };

      // 新波次开场：成组涌入
      const hpMul = 1 + (this.wave - 1) * 0.13;
      const dmgMul = 1 + (this.wave - 1) * 0.06;
      const speedMul = Math.min(1.35, 1 + (this.wave - 1) * 0.015);
      const pack = Math.min(8, 2 + Math.floor(this.wave * 0.7));
      for (let i = 0; i < pack; i++) this.spawn(this.pickType(), { hpMul, dmgMul, speedMul });

      if (this.wave % 5 === 0) {
        // 名字条与音效由 bossIntro 统一处理（spawn 内部已调用）
        this.spawn('brute', { hpMul, dmgMul: 1 + this.wave * 0.05, speedMul: 1 });
      }
    }
  }

  updateQuestSpawner(dt) {
    this.questTimer -= dt;
    if (this.questQueue.length > 0 && this.questTimer <= 0) {
      this.questTimer = this.questDef.interval;
      const type = this.questQueue.shift();
      this.spawn(type, this.questDef.mods);
    }
    if (this.questQueue.length === 0 && this.enemies.length === 0 && !this.questDone && this.state === 'playing') {
      this.questDone = true;
      this.setState('clear');
      const isLast = this.questIndex >= QUESTS.length - 1;
      this.ui.showClear(this.questDef, this.questIndex, isLast, this.summary());
    }
  }

  // ================= 战斗事件 =================

  addBullet(b) {
    b.hit = b.hit || new Set();
    b.hostile = false;
    this.bullets.push(b);
  }

  addEnemyBullet(b) {
    b.hit = b.hit || new Set();
    b.hostile = true;
    b.pierce = 0;
    b.kind = b.kind || 'bullet';
    this.bullets.push(b);
  }

  killEnemy(e, source) {
    if (e.dead) return;
    e.dead = true;
    const p = this.player;
    this.kills++;
    this.score += Math.round(e.def.score * (1 + this.wave * 0.05));

    // 尸块与血迹
    const ang = Math.atan2(e.y - p.y, e.x - p.x);
    this.particles.gore(e.x, e.y, ang, e.def.isBoss ? 26 : 10, e.def.blood);
    this.particles.blood(e.x, e.y, ang, e.def.isBoss ? 22 : 8, e.def.blood, 1);
    this.decals.splat(e.x, e.y, e.r * (e.def.isBoss ? 1.6 : 1.1), mixHex(e.def.blood, this.palette.blood, 0.45));

    if (e.def.isBoss) {
      this.cam.kick(16);
      this.hitstop = 0.1;
      this.audio.explosion(1.5);
      this.decals.scorch(e.x, e.y, 80);
      this.banner = { text: '巨兽被击杀', sub: '', t: 2 };
    } else {
      this.cam.kick(1.2);
    }

    // 掉经验
    const value = e.def.xp;
    const orbs = Math.min(4, Math.max(1, Math.round(value / 3)));
    for (let i = 0; i < orbs; i++) {
      this.pickups.push({
        type: 'xp',
        x: e.x + M.rand(-8, 8),
        y: e.y + M.rand(-8, 8),
        vx: M.rand(-70, 70),
        vy: M.rand(-70, 70),
        t: 0,
        value: Math.max(1, Math.round(value / orbs)),
        scale: 0.7 + Math.min(1.2, value / 12)
      });
    }

    // 掉落
    if (M.chance(0.045)) {
      this.pickups.push({ type: 'health', x: e.x, y: e.y, vx: M.rand(-40, 40), vy: M.rand(-40, 40), t: 0 });
    }
    const dropChance = e.def.isBoss ? 1 : 0.032;
    if (M.chance(dropChance)) {
      const maxTier = e.def.isBoss ? 4 : Math.min(4, 1 + Math.floor(this.wave / 3));
      this.pickups.push({
        type: 'weapon',
        weapon: randomWeaponDrop(maxTier, p.weapon),
        x: e.x, y: e.y, vx: M.rand(-40, 40), vy: M.rand(-40, 40), t: 0
      });
    }

    // 死亡时钟
    if (M.chance(p.stats.explodeOnKill)) {
      this.explode(e.x, e.y, 92, 45, false);
    }
  }

  _bloodRgba(hex) {
    // '#a51622' -> 'rgba(165,22,34,0.85)'
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},0.8)`;
  }

  explode(x, y, radius, dmg, hurtSelf = false) {
    this.particles.ring(x, y, radius, 'rgba(255,180,90,0.9)', 0.4);
    this.particles.flash(x, y, radius * 0.8, 'rgba(255,210,140,0.8)');
    this.particles.smoke(x, y, 8, 'rgba(70,62,58,0.55)');
    this.particles.sparks(x, y, 0, 14, '#ffd27a');
    this.decals.scorch(x, y, radius * 0.55);
    this.cam.kick(9);
    this.audio.explosion();

    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = M.dist(x, y, e.x, e.y);
      if (d > radius + e.r) continue;
      const falloff = 1 - M.clamp(d / (radius + e.r), 0, 1) * 0.6;
      const ang = Math.atan2(e.y - y, e.x - x);
      damageEnemy(this, e, dmg * falloff, {
        knockback: { x: Math.cos(ang), y: Math.sin(ang) },
        source: 'explosion'
      });
      e.kx += Math.cos(ang) * 120 / (e.def.mass || 1);
      e.ky += Math.sin(ang) * 120 / (e.def.mass || 1);
    }

    if (hurtSelf) {
      const dp = M.dist(x, y, this.player.x, this.player.y);
      if (dp < radius * 0.75) hurtPlayer(this, dmg * 0.3);
    }
  }

  hurtPlayer(dmg) {
    hurtPlayer(this, dmg);
  }

  onPlayerDeath() {
    this.setState('dead');
    this.audio.die();
    this.cam.kick(20);
    const p = this.player;
    this.particles.gore(p.x, p.y, M.rand(0, M.TAU), 30, '#c8202b');
    this.decals.splat(p.x, p.y, 30, 'rgba(160,20,30,0.85)');
    if (this.score > this.best) {
      this.best = this.score;
      saveBest('seventhwound_best', this.best);
    }
    this.ui.showDead(this.summary());
  }

  summary() {
    const p = this.player;
    return {
      time: this.time,
      kills: this.kills,
      score: this.score,
      level: p ? p.level : 1,
      best: this.best,
      wave: this.wave,
      mode: this.mode,
      erosion: p ? Math.round(p.erosion || 0) : 0,
      maxErosion: this.maxErosion
    };
  }

  // ================= 渲染 =================

  render() {
    const ctx = this.ctx;
    const w = this.vw;
    const h = this.vh;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#08090b';
    ctx.fillRect(0, 0, w, h);

    if (!this.player) return;

    const cam = this.cam;
    const z = cam.zoom;
    ctx.save();
    ctx.translate(cam.ox, cam.oy);
    ctx.scale(z, z);
    ctx.translate(-cam.x, -cam.y);

    // 地面（仅竞技场范围内）
    const gx = Math.max(0, cam.x);
    const gy = Math.max(0, cam.y);
    const gw = Math.min(this.W, cam.x + cam.vmw) - gx;
    const gh = Math.min(this.H, cam.y + cam.vmh) - gy;
    if (gw > 0 && gh > 0) {
      ctx.fillStyle = this.groundPattern;
      ctx.fillRect(gx, gy, gw, gh);
      // 宏观污渍叠层：放大 2.7 倍，把平铺周期从 512 拉到 ~1380
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.translate(gx, gy);
      ctx.scale(GROUND_MACRO_SCALE, GROUND_MACRO_SCALE);
      ctx.fillStyle = this.macroPattern;
      ctx.fillRect(0, 0, gw / GROUND_MACRO_SCALE, gh / GROUND_MACRO_SCALE);
      ctx.restore();
    }

    // 边界：内侧红光渐隐 + 边线
    this.drawArenaEdge(ctx);

    // 血迹
    this.decals.draw(ctx, cam);

    this.drawPickups(ctx);
    this.drawEnemies(ctx);
    this.drawPlayer(ctx);
    this.drawBullets(ctx);
    this.particles.draw(ctx);

    ctx.restore();

    // 屏幕空间
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    drawAmbient(ctx, this, w, h);
    this.drawVignette(ctx, w, h);
    drawThreatIndicators(ctx, this, w, h);
    drawHud(ctx, this, w, h);
    drawVoice(ctx, this, w, h);
    this.drawCrosshair(ctx);
  }

  drawArenaEdge(ctx) {
    if (!this._edge) {
      const W = this.W, H = this.H, e = 80;
      const mk = (x0, y0, x1, y1) => {
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, 'rgba(110,4,20,0.9)');
        g.addColorStop(0.55, 'rgba(70,4,14,0.35)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        return g;
      };
      this._edge = {
        e,
        top: mk(0, 0, 0, e),
        bottom: mk(0, H, 0, H - e),
        left: mk(0, 0, e, 0),
        right: mk(W, 0, W - e, 0)
      };
    }
    const { e, top, bottom, left, right } = this._edge;
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, this.W, e);
    ctx.fillStyle = bottom;
    ctx.fillRect(0, this.H - e, this.W, e);
    ctx.fillStyle = left;
    ctx.fillRect(0, 0, e, this.H);
    ctx.fillStyle = right;
    ctx.fillRect(this.W - e, 0, e, this.H);

    ctx.strokeStyle = 'rgba(255,70,90,0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, this.W - 3, this.H - 3);
  }

  drawVignette(ctx, w, h) {
    const pal = this.palette || ARENA_PALETTE;
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.34, w / 2, h / 2, Math.max(w, h) * 0.76);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.58, 'rgba(0,0,0,0.14)');
    g.addColorStop(1, pal.fog);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const p = this.player;

    // 侵蚀：≥40 画面开始泛红，越接近 100 越重，并按心跳节奏搏动
    // （和低血预警用同一套红，STORY §10"红色不是装饰，是状态"）
    const er = p ? p.erosion || 0 : 0;
    if (er >= 40) {
      const k = M.clamp((er - 40) / 60, 0, 1);
      const beat = 0.5 + Math.sin(this.time * (3 + k * 4)) * 0.5;
      // 40 时约 0.18，100 时约 0.52，搏动幅度随侵蚀加大
      const a = (0.18 + k * 0.34) * (0.78 + beat * 0.22);
      const rg = ctx.createRadialGradient(
        w / 2, h / 2, Math.min(w, h) * 0.20,
        w / 2, h / 2, Math.max(w, h) * 0.72
      );
      rg.addColorStop(0, 'rgba(190,18,46,0)');
      rg.addColorStop(0.30, `rgba(190,18,46,${(a * 0.5).toFixed(3)})`);
      rg.addColorStop(1, `rgba(176,14,40,${a.toFixed(3)})`);
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
    }

    if (p && p.hurtFlash > 0) {
      ctx.fillStyle = `rgba(190,10,30,${p.hurtFlash * 0.22})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  drawPickups(ctx) {
    for (const it of this.pickups) {
      const bob = Math.sin(it.t * 4 + it.x * 0.01) * 3;
      if (it.type === 'xp') {
        const s = this.sprites.orb;
        const sc = it.scale || 1;
        ctx.globalAlpha = 0.9;
        ctx.drawImage(s.canvas, it.x - s.size / 2 * sc, it.y - s.size / 2 * sc + bob * 0.5, s.size * sc, s.size * sc);
        ctx.globalAlpha = 1;
      } else if (it.type === 'health') {
        const s = this.sprites.health;
        ctx.drawImage(s.canvas, it.x - s.size / 2, it.y - s.size / 2 + bob, s.size, s.size);
      } else {
        const s = this.sprites.crate;
        ctx.drawImage(s.canvas, it.x - s.size / 2, it.y - s.size / 2 + bob, s.size, s.size);
      }
    }
  }

  drawEnemies(ctx) {
    const t = this.time;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const set = e.sprites;
      const frame = set[Math.floor((t * 6 + e.phase) % set.length)] || set[0];
      const size = frame.size * (e.def.spriteScale || 1);

      // 影子
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(e.x + 2, e.y + e.r * 0.45, e.r * 0.95, e.r * 0.5, 0, 0, M.TAU);
      ctx.fill();

      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.face);
      if (e.born > 0) {
        const s = 1 - e.born / 0.45 * 0.5;
        ctx.scale(s, s);
        ctx.globalAlpha = 1 - e.born / 0.45 * 0.4;
      }
      ctx.drawImage(frame.canvas, -size / 2, -size / 2, size, size);
      ctx.restore();
      ctx.globalAlpha = 1;

      // 命中闪白
      if (e.flash > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.min(0.85, e.flash * 7);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * 1.02, 0, M.TAU);
        ctx.fill();
        ctx.restore();
      }

      // 燃烧
      if (e.burn > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.25 + Math.sin(t * 18) * 0.08;
        ctx.fillStyle = '#ff7a2a';
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * 1.15, 0, M.TAU);
        ctx.fill();
        ctx.restore();
      }

      // Boss 血条
      if (e.def.isBoss) {
        const bw = 90, bh = 6;
        const x = e.x - bw / 2, y = e.y - e.r - 18;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(x, y, bw, bh);
        ctx.fillStyle = '#ff3b4d';
        ctx.fillRect(x, y, bw * Math.max(0, e.hp / e.maxHp), bh);
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, bh - 1);
      }
    }
  }

  drawPlayer(ctx) {
    const p = this.player;
    if (!p || p.hp <= 0) return;
    // 玩家是 4 帧序列：按 walkPhase 走步态（第一帧当作待机）
    const set = this.sprites.player;
    const frame = set[Math.floor(((p.walkPhase * 1.1) % set.length + set.length) % set.length)] || set[0];
    const wDef = WEAPONS[p.weapon];

    // 柔和光晕：保证混战中玩家始终可读
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pg = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 42);
    pg.addColorStop(0, 'rgba(96,196,255,0.20)');
    pg.addColorStop(1, 'rgba(96,196,255,0)');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 42, 0, M.TAU);
    ctx.fill();
    ctx.restore();

    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(p.x + 2, p.y + 7, 17, 8.5, 0, 0, M.TAU);
    ctx.fill();

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.body);
    ctx.drawImage(frame.canvas, -frame.size / 2, -frame.size / 2, frame.size, frame.size);
    ctx.restore();

    // 左臂布条：每下一层多一条，颜色取该层主色（STORY §2.3）
    const stripes = Math.min(p.stripes || 0, 4);
    if (stripes > 0) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.body);
      ctx.lineWidth = 1.5;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.8;
      // 左臂在 -Y 侧（朝右时是屏幕上方），布条沿手臂等分缠上去。
      // 坐标 = 精灵内手臂坐标 × 1.6（drawPlayer 里的整体放大系数 K）。
      const ax = 1.6;
      const ay = -16;
      const bx = 13.6;
      const by = -22.4;
      for (let i = 0; i < stripes; i++) {
        ctx.strokeStyle = STRIPE_COLORS[i];
        const k = 0.34 + i * 0.15;
        const px = ax + (bx - ax) * k;
        const py = ay + (by - ay) * k;
        ctx.beginPath();
        ctx.moveTo(px - 1.4, py - 2.2);
        ctx.lineTo(px + 1.4, py + 2.2);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 武器
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aim);
    const len = p.weapon === 'rocket' ? 26 : p.weapon === 'gauss' ? 28 : p.weapon === 'minigun' ? 24 : 21;
    ctx.fillStyle = '#151d26';
    ctx.beginPath();
    ctx.roundRect(6, -3.6, len, 7.2, 2);
    ctx.fill();
    ctx.fillStyle = wDef.color || '#ffd166';
    ctx.beginPath();
    ctx.roundRect(6 + len * 0.55, -1.6, len * 0.42, 3.2, 1.5);
    ctx.fill();

    // 枪口火焰
    if (p.muzzle > 0) {
      const mx = 6 + len + 3;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(mx, 0, 0, mx, 0, 18);
      g.addColorStop(0, 'rgba(255,245,210,0.95)');
      g.addColorStop(0.4, 'rgba(255,170,60,0.6)');
      g.addColorStop(1, 'rgba(255,120,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(mx, 0, 18, 0, M.TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  drawBullets(ctx) {
    for (const b of this.bullets) {
      const col = b.color || '#fff';
      if (b.kind === 'gauss') {
        ctx.save();
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.4;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, M.TAU);
        ctx.fill();
        continue;
      }

      if (b.kind === 'flame') {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = fxRandom() < 0.5 ? '#ff7a2a' : '#ffbb4d';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * fxRand(0.8, 1.2), 0, M.TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        continue;
      }

      // 光晕
      if (b.glow) {
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 2.6, 0, M.TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, M.TAU);
      ctx.fill();

      if (b.kind === 'plasma' || b.kind === 'rocket') {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 0.42, 0, M.TAU);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawCrosshair(ctx) {
    const m = this.input.mouse;
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.65)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0, M.TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 1.6, 0, M.TAU);
    ctx.fillStyle = 'rgba(255,80,100,0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,80,100,0.55)';
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * M.TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12);
      ctx.lineTo(Math.cos(a) * 17, Math.sin(a) * 17);
      ctx.stroke();
    }
    ctx.restore();
  }
}
