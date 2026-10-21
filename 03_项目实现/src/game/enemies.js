import { rand, random, TAU, clamp, angleLerp, damp } from '../core/math.js';

let nextId = 1;

/**
 * 敌人定义（数据驱动）。behavior: chase | erratic | ranged
 */
export const ENEMY_TYPES = {
  zombie: {
    name: '腐化者', hp: 24, speed: 70, dmg: 8, r: 13, xp: 1, score: 10,
    spriteSet: 'zombie', spriteScale: 1, blood: '#a51622', mass: 1,
    behavior: 'chase', attackCd: 0.8
  },
  runner: {
    name: '疾行者', hp: 16, speed: 150, dmg: 6, r: 11, xp: 1, score: 14,
    spriteSet: 'runner', spriteScale: 1, blood: '#8f2a1c', mass: 0.8,
    behavior: 'chase', attackCd: 0.65
  },
  spider: {
    name: '织网者', hp: 13, speed: 158, dmg: 5, r: 9, xp: 1, score: 16,
    spriteSet: 'spider', spriteScale: 1, blood: '#3f6b2a', mass: 0.6,
    behavior: 'erratic', attackCd: 0.6
  },
  lizard: {
    name: '哨眼', hp: 38, speed: 82, dmg: 7, r: 13, xp: 2, score: 28,
    spriteSet: 'lizard', spriteScale: 1, blood: '#4c7a26', mass: 1,
    behavior: 'ranged', attackCd: 0.8, keepDist: 250, shootCd: 1.9, projSpeed: 480, projDmg: 9
  },
  alien: {
    name: '融生体', hp: 100, speed: 66, dmg: 14, r: 17, xp: 4, score: 55,
    spriteSet: 'alien', spriteScale: 1, blood: '#6b2b93', mass: 2.2,
    behavior: 'chase', attackCd: 0.85
  },
  brute: {
    name: '守层者', hp: 850, speed: 54, dmg: 26, r: 27, xp: 16, score: 400,
    spriteSet: 'brute', spriteScale: 1, blood: '#8f1220', mass: 6,
    behavior: 'chase', attackCd: 1.0, isBoss: true
  }
};

export function spawnEnemy(g, type, x, y, mods = {}) {
  const t = ENEMY_TYPES[type];
  if (!t) return null;
  const hpMul = mods.hpMul || 1;
  const e = {
    id: nextId++,
    type,
    def: t,
    x, y,
    vx: 0, vy: 0,
    kx: 0, ky: 0,
    hp: t.hp * hpMul,
    maxHp: t.hp * hpMul,
    r: t.r,
    dmg: t.dmg * (mods.dmgMul || 1),
    speed: t.speed * (mods.speedMul || 1),
    face: rand(0, TAU),
    atkCd: rand(0, 0.3),
    shootCd: rand(0.4, 1.4),
    flash: 0,
    burn: 0,
    burnDps: 0,
    poison: 0,
    poisonDps: 0,
    phase: rand(0, TAU),
    born: 0.45,
    sprites: g.sprites[t.spriteSet],
    sprite: g.sprites[t.spriteSet][0]
  };
  g.enemies.push(e);
  return e;
}

export function updateEnemy(g, e, dt) {
  const p = g.player;
  const d = e.def;
  e.born = Math.max(0, e.born - dt);
  e.flash = Math.max(0, e.flash - dt);
  e.atkCd = Math.max(0, e.atkCd - dt);

  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const distToPlayer = Math.hypot(dx, dy) || 1;
  const nx = dx / distToPlayer;
  const ny = dy / distToPlayer;

  e.face = angleLerp(e.face, Math.atan2(dy, dx), damp(7, dt));

  let tx = 0, ty = 0;
  const wob = Math.sin(g.time * 2.4 + e.phase);

  if (d.behavior === 'chase') {
    tx = nx;
    ty = ny;
    // 略微摆动的追击路径，避免全挤成一条直线
    tx += -ny * wob * 0.22;
    ty += nx * wob * 0.22;
  } else if (d.behavior === 'erratic') {
    const strafe = Math.sin(g.time * 6 + e.phase) * 1.1;
    tx = nx * 0.75 - ny * strafe;
    ty = ny * 0.75 + nx * strafe;
  } else if (d.behavior === 'ranged') {
    const keep = d.keepDist;
    if (distToPlayer > keep * 1.15) { tx = nx; ty = ny; }
    else if (distToPlayer < keep * 0.7) { tx = -nx; ty = -ny; }
    else {
      const s = Math.sin(g.time * 1.6 + e.phase);
      tx = -ny * s; ty = nx * s;
    }
    // 远程射击
    e.shootCd -= dt;
    if (e.shootCd <= 0 && distToPlayer < 620 && e.born <= 0) {
      e.shootCd = d.shootCd * rand(0.85, 1.15);
      const a = Math.atan2(dy, dx) + rand(-0.06, 0.06);
      g.addEnemyBullet({
        x: e.x + Math.cos(a) * (e.r + 4),
        y: e.y + Math.sin(a) * (e.r + 4),
        vx: Math.cos(a) * d.projSpeed,
        vy: Math.sin(a) * d.projSpeed,
        r: 5,
        dmg: d.projDmg * (e.dmg / d.dmg),
        life: 2.4,
        color: '#b6ff5c'
      });
      g.audio.shoot('plasma');
    }
  }

  // 出生时减速
  const spawnMul = e.born > 0 ? 0.25 : 1;
  // 距离远时加速接近，减少"空场等怪"的时间
  const chargeMul = distToPlayer > 460 ? 1.35 : 1;
  const slowMul = 1 - Math.min(0.6, p.stats.enemySlow || 0);
  // 侵蚀 ≥70：地渊开始"认得"你了，所有敌人（含已在场的）移速 +10%
  const erosionMul = (p.erosion || 0) >= 70 ? 1.1 : 1;
  const k = damp(8, dt);
  e.vx += (tx * e.speed * spawnMul * slowMul * chargeMul * erosionMul - e.vx) * k;
  e.vy += (ty * e.speed * spawnMul * slowMul * chargeMul * erosionMul - e.vy) * k;

  // 击退衰减
  const kd = Math.exp(-6 * dt);
  e.kx *= kd;
  e.ky *= kd;

  e.x += (e.vx + e.kx) * dt;
  e.y += (e.vy + e.ky) * dt;

  // 世界边界
  e.x = clamp(e.x, e.r, g.W - e.r);
  e.y = clamp(e.y, e.r, g.H - e.r);

  // 灼烧/中毒
  if (e.burn > 0) {
    e.burn -= dt;
    damageEnemy(g, e, e.burnDps * dt, { silent: true, noKnockback: true });
    if (random() < dt * 22) {
      g.particles.add({
        type: 'smoke', x: e.x + rand(-6, 6), y: e.y + rand(-6, 6),
        vx: rand(-20, 20), vy: rand(-60, -20), life: 0.4, size: rand(3, 7),
        color: 'rgba(255,140,50,0.55)', drag: 1.4
      });
    }
  }
  if (e.hp <= 0) return;
  if (e.poison > 0) {
    e.poison -= dt;
    damageEnemy(g, e, e.poisonDps * dt, { silent: true, noKnockback: true, color: '#9dff2b' });
  }
  if (e.hp <= 0) return;

  // 接触伤害
  const hitDist = e.r + p.r;
  if (distToPlayer < hitDist && e.atkCd <= 0 && p.hp > 0) {
    e.atkCd = d.attackCd;
    g.hurtPlayer(e.dmg);
  }
}

export function damageEnemy(g, e, dmg, opts = {}) {
  if (e.dead) return;
  e.hp -= dmg;
  e.flash = 0.1;

  if (!opts.silent) {
    const col = opts.color || '#ffffff';
    g.particles.blood(e.x, e.y, Math.atan2(e.y - g.player.y, e.x - g.player.x), 2, e.def.blood, 0.5);
    if (opts.crit) g.particles.text(e.x, e.y - e.r - 6, Math.round(dmg) + '!', '#ffd166', 17);
    else if (random() < 0.22) g.particles.text(e.x, e.y - e.r - 4, Math.round(dmg), col, 12);
    if (random() < 0.4) g.audio.hit();
  }

  if (!opts.noKnockback && opts.knockback) {
    const mass = e.def.mass || 1;
    e.kx += (opts.knockback.x / mass) * 26;
    e.ky += (opts.knockback.y / mass) * 26;
  }

  if (e.hp <= 0) g.killEnemy(e, opts.source || 'unknown');
}
