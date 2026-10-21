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
    burstLeft: 0,    // 连发剩余发数（三连点射）
    burstTimer: 0,
    chargeT: 0,      // 蓄力进度（轨道炮）
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
      xpMul: 1,
      // 机制型刻印（S6-D）
      bounce: 0,        // 跳弹次数
      chain: 0,         // 连锁层数
      mineRate: 0,      // 每秒布雷数
      frostTrail: 0,    // 冰痕强度
      dualWield: 0      // 双持（0/1）
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
  resetBurst(p);
  g.audio.click();
}

/**
 * 捡到武器。规则（按优先级）：
 *   1) 同名 → 补满弹匣
 *   2) 副武器槽空着 → 进副武器（永远不覆盖主武器）
 *   3) 比当前强 → 装备；如果副武器槽空着，旧枪退到副武器槽（不丢）
 *   4) 同级 → 装备（同级替换，属于"你自己走过去换的"）
 *   5) 更弱 → **不降级**：转成补给（补满当前弹匣 + 残响量）
 * 返回值：'ammo' | 'secondary' | 'equip' | 'swap' | 'salvage'
 */
export function giveWeapon(g, p, id) {
  const cap = magSize(id, p.stats);
  const newTier = WEAPONS[id].tier || 1;
  const curTier = WEAPONS[p.weapon].tier || 1;

  // 1) 同一把枪：补弹
  if (p.weapon === id) {
    p.ammo = cap;
    return 'ammo';
  }

  // 2) 更强：先升级（旧枪能放就退到副武器槽，不丢）
  if (newTier > curTier) {
    if (p.secondaryUnlocked && !p.secondary) {
      p.secondary = p.weapon;
      p.secondaryAmmo = magSize(p.weapon, p.stats);
    }
    p.weapon = id;
    p.ammo = cap;
    p.reloading = 0;
    p.cd = Math.max(p.cd, 0.1);
    resetBurst(p);
    return 'equip';
  }

  // 3) 副武器槽空着：进副武器，不动主武器
  if (p.secondaryUnlocked && !p.secondary) {
    p.secondary = id;
    p.secondaryAmmo = cap;
    return 'secondary';
  }

  // 4) 同级：替换（玩家自己踩上来的，算选择）
  if (newTier === curTier) {
    p.weapon = id;
    p.ammo = cap;
    p.reloading = 0;
    p.cd = Math.max(p.cd, 0.1);
    resetBurst(p);
    return 'swap';
  }

  // 5) 更弱：绝不降级，转成补给（补的是**当前这把枪**的弹匣）
  p.ammo = magSize(p.weapon, p.stats);
  if (g) g.score += 25;
  return 'salvage';
}

/** 换枪时清掉连发残留：否则三连的第二、三发会从新枪里打出来 */
export function resetBurst(p) {
  p.burstLeft = 0;
  p.burstTimer = 0;
}

export function updatePlayer(g, p, dt) {
  const input = g.input;
  const wDef = WEAPONS[p.weapon];

  // 移动（蓄力时拖慢脚步，换那一发大伤害）
  const mv = input.moveVector();
  const chargeSlow = wDef.charge ? 1 - 0.4 * Math.min(1, (p.chargeT || 0) / wDef.charge) : 1;
  const speed = p.speed * p.stats.speedMul * chargeSlow;
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

  // 连发补射（三连点射：自动补完剩下的两发）
  // 当前枪不支持连发就别补 —— 否则换枪后会把旧枪的残余发数打到新枪上
  if (p.burstLeft > 0 && !(wDef.burst > 1)) resetBurst(p);
  if (p.burstLeft > 0) {
    p.burstTimer -= dt;
    if (p.burstTimer <= 0 && p.ammo > 0) {
      fireWeapon(g, p);
      p.burstLeft--;
      p.burstTimer = wDef.burstGap || 0.06;
      p.muzzle = 0.05;
    }
    if (p.ammo <= 0) p.burstLeft = 0;
  }

  // 蓄力（轨道炮）：按住蓄满才放；松开就泄掉
  if (wDef.charge) {
    if (input.mouse.down && p.reloading <= 0) p.chargeT = Math.min(wDef.charge, p.chargeT + dt);
    else p.chargeT = Math.max(0, p.chargeT - dt * 4);
  } else if (p.chargeT) {
    p.chargeT = 0;
  }

  // 开火
  if (input.mouse.down && p.reloading <= 0 && p.cd <= 0) {
    const charged = !wDef.charge || p.chargeT >= wDef.charge;
    if (p.ammo > 0 && charged) {
      fireWeapon(g, p);
      p.cd = wDef.rate;
      p.muzzle = wDef.charge ? 0.1 : 0.06;
      if (wDef.charge) p.chargeT = 0;
      if (wDef.burst > 1) {
        p.burstLeft = wDef.burst - 1;
        p.burstTimer = wDef.burstGap || 0.06;
      }
      // 双持：副武器同时打一发。临时换枪/换弹药，打完换回来，
      // 这样弹匣、弹药、装填状态各归各的，不用给 fireWeapon 加参数。
      if (p.stats.dualWield && p.secondary && p.secondaryAmmo > 0 && p.secondary !== p.weapon) {
        const mainW = p.weapon;
        const mainAmmo = p.ammo;
        const mainReload = p.reloading;
        p.weapon = p.secondary;
        p.ammo = p.secondaryAmmo;
        fireWeapon(g, p);
        p.secondaryAmmo = p.ammo;
        p.weapon = mainW;
        p.ammo = mainAmmo;
        p.reloading = mainReload;
      }
    } else if (p.ammo <= 0) {
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
