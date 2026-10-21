import { clamp, damp, angleLerp, TAU, rand, random } from '../core/math.js';
import { WEAPONS, fireWeapon, magSize, reloadDuration } from './weapons.js';

export function createPlayer(x, y) {
  return {
    x, y,
    vx: 0, vy: 0,
    r: 14,
    hp: 100,
    maxHp: 100,
    speed: 238,
    aim: 0,
    body: 0,
    walkPhase: 0,
    level: 1,
    xp: 0,
    xpNext: 6,
    pendingLevels: 0,
    stripes: 1,      // 左臂布条数 = 已下潜层数（STORY §2.3）
    erosion: 0,      // 侵蚀值 0-100：每拿一层"侵蚀"线刻印 +8（STORY §8）
    weapon: 'pistol',
    ammo: 12,
    cd: 0,
    reloading: 0,
    reloadTotal: 1,
    secondary: null,
    secondaryAmmo: 0,
    secondaryUnlocked: false,
    perkCounts: {},
    hurtFlash: 0,
    muzzle: 0,
    stats: {
      dmgMul: 1,
      speedMul: 1,
      reloadBonus: 0,
      magBonus: 0,
      magnet: 240,
      regen: 0,
      healBonus: 0,
      pierceBonus: 0,
      pelletsBonus: 0,
      critChance: 0,
      dodge: 0,
      fireChance: 0,
      burnBonus: 0,
      poisonChance: 0,
      explodeOnKill: 0,
      homing: 0,
      bulletSpeedBonus: 0,
      rangeBonus: 0,
      knockbackBonus: 0,
      spreadPenalty: 0,
      enemySlow: 0,
      xpMul: 1
    }
  };
}

export function startReload(g, p) {
  if (p.reloading > 0) return;
  const cap = magSize(p.weapon, p.stats);
  if (p.ammo >= cap) return;
  p.reloadTotal = reloadDuration(p.weapon, p.stats);
  p.reloading = p.reloadTotal;
  g.audio.reload();
}

export function swapWeapon(g, p) {
  if (!p.secondary) return;
  const w = p.weapon, ammo = p.ammo;
  p.weapon = p.secondary;
  p.ammo = p.secondaryAmmo;
  p.secondary = w;
  p.secondaryAmmo = ammo;
  p.reloading = 0;
  p.cd = Math.max(p.cd, 0.18);
  g.audio.click();
}

export function giveWeapon(g, p, id) {
  const cap = magSize(id, p.stats);
  if (p.secondaryUnlocked && !p.secondary) {
    p.secondary = id;
    p.secondaryAmmo = cap;
    g.particles.text(p.x, p.y - 32, '副武器 ' + WEAPONS[id].name, '#ffd166', 15);
    return;
  }
  if (p.weapon === id) {
    p.ammo = cap;
    g.particles.text(p.x, p.y - 32, '+弹药', '#ffd166', 14);
    return;
  }
  p.weapon = id;
  p.ammo = cap;
  p.reloading = 0;
  p.cd = 0.1;
  g.particles.text(p.x, p.y - 32, WEAPONS[id].name, WEAPONS[id].color || '#fff', 16);
}

export function updatePlayer(g, p, dt) {
  const input = g.input;

  // 移动
  const mv = input.moveVector();
  const speed = p.speed * p.stats.speedMul;
  const k = damp(15, dt);
  p.vx += (mv.x * speed - p.vx) * k;
  p.vy += (mv.y * speed - p.vy) * k;
  p.x = clamp(p.x + p.vx * dt, p.r, g.W - p.r);
  p.y = clamp(p.y + p.vy * dt, p.r, g.H - p.r);

  // 瞄准
  p.aim = Math.atan2(g.mouseWorld.y - p.y, g.mouseWorld.x - p.x);
  p.body = angleLerp(p.body, p.aim, damp(16, dt));

  // 移动尾迹
  const moving = Math.hypot(p.vx, p.vy) > 30;
  p.walkPhase += Math.hypot(p.vx, p.vy) * dt * 0.05;
  if (moving && random() < dt * 14) {
    g.particles.add({
      type: 'smoke',
      x: p.x + rand(-5, 5) - Math.cos(p.body) * 8,
      y: p.y + rand(-5, 5) - Math.sin(p.body) * 8,
      vx: rand(-14, 14), vy: rand(-14, 14),
      life: 0.35, size: rand(2, 4.5),
      color: 'rgba(120,130,145,0.22)', drag: 2
    });
  }

  // 装填
  if (p.reloading > 0) {
    p.reloading -= dt;
    if (p.reloading <= 0) {
      p.reloading = 0;
      p.ammo = magSize(p.weapon, p.stats);
    }
  }

  p.cd = Math.max(0, p.cd - dt);

  // 开火
  if (input.mouse.down && p.reloading <= 0 && p.cd <= 0) {
    if (p.ammo > 0) {
      fireWeapon(g, p);
      p.cd = WEAPONS[p.weapon].rate;
      p.muzzle = 0.06;
    } else {
      g.audio.empty();
      startReload(g, p);
      p.cd = 0.15;
    }
  }
  p.muzzle = Math.max(0, p.muzzle - dt);

  if (p.ammo <= 0 && p.reloading <= 0) startReload(g, p);
  if (input.tap('KeyR')) startReload(g, p);
  if (input.tap('KeyQ') || input.mouse.rclicked) {
    input.mouse.rclicked = false;
    swapWeapon(g, p);
  }

  // 自然回复
  if (p.stats.regen > 0 && p.hp > 0) {
    p.hp = Math.min(p.maxHp, p.hp + p.stats.regen * dt);
  }

  p.hurtFlash = Math.max(0, p.hurtFlash - dt * 2.4);
}

export function hurtPlayer(g, dmg) {
  const p = g.player;
  if (p.hp <= 0) return;
  if (random() < p.stats.dodge) {
    g.particles.text(p.x, p.y - 26, '闪避', '#c9d6e5', 14);
    return;
  }
  p.hp -= dmg;
  p.hurtFlash = 1;
  g.cam.kick(5 + dmg * 0.25);
  g.audio.hurt();
  g.particles.blood(p.x, p.y, rand(0, TAU), 8, '#c8202b', 0.9);
  if (p.hp <= 0) {
    p.hp = 0;
    g.onPlayerDeath();
  }
}

export function healPlayer(g, amount) {
  const p = g.player;
  const v = amount * (1 + p.stats.healBonus);
  p.hp = Math.min(p.maxHp, p.hp + v);
  g.particles.text(p.x, p.y - 26, '+' + Math.round(v), '#5dff9b', 15);
}
