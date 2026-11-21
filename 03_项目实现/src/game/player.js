import { clamp, damp, angleLerp, TAU, rand, random } from '../core/math.js';
import { WEAPONS, fireWeapon, magSize, reloadDuration, stage2Of } from './weapons.js';

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
    // 武器二阶段（S21）：weaponStacks 记每把武器捡到次数，weaponStage2 记是否已觉醒
    weaponStacks: { pistol: 1 },   // 开局自带手枪算第 1 把
    weaponStage2: {},
    hurtFlash: 0,
    muzzle: 0,
    burstLeft: 0,    // 连发剩余发数（三连点射）
    burstTimer: 0,
    chargeT: 0,      // 蓄力进度（轨道炮）
    weaponLocked: false,  // 锁定当前武器：捡到更高等级也不自动换（按 L 切换）
    shield: 0,        // 护盾值（消耗品）：受伤先扣盾，扣完才扣血
    boostT: 0,        // 加速剩余时间（秒）
    beamOn: false,    // 激光（S21）：保留字段，单发模式下恒为 false
    beamAngle: 0,     // 激光方向
    beamLife: 0,      // 光束视觉残留计时（单发后衰减）
    beamWidth: 4,     // 光束粗细（叠层变粗）
    dashT: 0,         // 冲刺（S1-D2）：剩余位移时间
    dashCd: 0,        // 冲刺冷却
    dashInv: 0,       // 冲刺无敌帧剩余
    dashDirX: 0, dashDirY: 0,  // 冲刺方向
    hurtDirX: 0, hurtDirY: 0,  // 受击方向（S1-D3 方向提示）
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
 * 执行武器选择（S9-A：手动替换）。由 game.js 的武器选择面板调用，
 * action 只可能是玩家明确选出的结果，不再有自动判断：
 *   'equip'     → 替换主武器（旧枪若副武器槽空则退槽，不丢）
 *   'secondary' → 放进副武器槽（仅槽空时）
 *   'salvage'   → 放弃，补满当前弹匣 + 残响
 * 返回实际动作（'equip' | 'secondary' | 'salvage'）。
 */
export function applyWeaponChoice(g, p, id, action) {
  const cap = magSize(id, p.stats);

  if (action === 'secondary' && p.secondaryUnlocked && !p.secondary) {
    p.secondary = id;
    p.secondaryAmmo = cap;
    return 'secondary';
  }

  if (action === 'salvage') {
    p.ammo = magSize(p.weapon, p.stats);
    if (g) g.score += 25;
    return 'salvage';
  }

  // 默认（含 'equip'）：替换主武器
  if (p.secondaryUnlocked && !p.secondary && p.weapon !== id) {
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

/** 同一把枪：补满弹匣（不弹面板） */
export function refillWeapon(p, id) {
  p.ammo = magSize(id, p.stats);
}

/**
 * 记录一次武器获取（S21）。重复捡到同款第 2 把 → 该武器觉醒二阶段。
 * @returns {boolean} 是否"刚刚"觉醒（用于播横幅/音效）
 */
export function grantWeaponStack(p, id) {
  if (!p.weaponStacks) p.weaponStacks = {};
  if (!p.weaponStage2) p.weaponStage2 = {};
  p.weaponStacks[id] = (p.weaponStacks[id] || 0) + 1;
  if (p.weaponStacks[id] >= 2 && !p.weaponStage2[id]) {
    p.weaponStage2[id] = true;
    return true;
  }
  return false;
}

/** 某把武器已捡到几把（UI 显示用） */
export function weaponStackCount(p, id) {
  return (p.weaponStacks && p.weaponStacks[id]) || 0;
}

/** 换枪时清掉连发残留：否则三连的第二、三发会从新枪里打出来 */
export function resetBurst(p) {
  p.burstLeft = 0;
  p.burstTimer = 0;
}

export function updatePlayer(g, p, dt) {
  const input = g.input;
  const wDef = WEAPONS[p.weapon];

  // 加速消耗品计时
  if (p.boostT > 0) p.boostT = Math.max(0, p.boostT - dt);

  // ---- 冲刺（S1-D2）：Shift 触发，0.18s 位移 + 0.12s 无敌帧 + 1.2s 冷却 ----
  const dashKey = input.tap('TouchDash') || input.isDown('ShiftLeft') || input.isDown('ShiftRight');
  if (p.dashCd > 0) p.dashCd = Math.max(0, p.dashCd - dt);
  if (p.dashInv > 0) p.dashInv = Math.max(0, p.dashInv - dt);

  // 冲刺进行中：按冲刺方向强制位移，不响应普通移动
  if (p.dashT > 0) {
    p.dashT -= dt;
    const dspeed = 1050;
    p.vx = p.dashDirX * dspeed;
    p.vy = p.dashDirY * dspeed;
    p.x = clamp(p.x + p.vx * dt, p.r, g.W - p.r);
    p.y = clamp(p.y + p.vy * dt, p.r, g.H - p.r);
    // 冲刺残影
    if (random() < dt * 40) {
      g.particles.add({
        type: 'ghost', x: p.x, y: p.y,
        life: 0.3, size: 16,
        color: 'rgba(160,210,255,0.85)'
      });
    }
  } else if (dashKey && p.dashCd <= 0 && p.dashT <= 0) {
    // 触发冲刺：方向优先移动方向，否则朝向（aim）
    let dx = 0, dy = 0;
    const mvNow = input.moveVector();
    if (mvNow.x || mvNow.y) { dx = mvNow.x; dy = mvNow.y; }
    else {
      const aim = input.touchMode ? input.touchAim ?? p.aim : p.aim;
      dx = Math.cos(aim); dy = Math.sin(aim);
    }
    const l = Math.hypot(dx, dy) || 1;
    p.dashDirX = dx / l;
    p.dashDirY = dy / l;
    p.dashT = 0.18;
    p.dashInv = 0.12;
    p.dashCd = 1.2;
    g.audio.click();
    g.particles.ring(p.x, p.y, 20, 'rgba(150,200,255,0.6)', 0.22);
  }

  // 移动（蓄力时拖慢脚步；加速时 ×1.5）；冲刺期间跳过普通移动
  const mv = input.moveVector();
  const chargeSlow = wDef.charge ? 1 - 0.4 * Math.min(1, (p.chargeT || 0) / wDef.charge) : 1;
  const boostMul = p.boostT > 0 ? 1.5 : 1;
  const speed = p.speed * p.stats.speedMul * chargeSlow * boostMul;
  const k = damp(15, dt);
  if (p.dashT <= 0) {
    p.vx += (mv.x * speed - p.vx) * k;
    p.vy += (mv.y * speed - p.vy) * k;
    p.x = clamp(p.x + p.vx * dt, p.r, g.W - p.r);
    p.y = clamp(p.y + p.vy * dt, p.r, g.H - p.r);
  }

  // 瞄准
  if (input.touchMode) p.aim = input.touchAim ?? p.aim;
  else p.aim = Math.atan2(g.mouseWorld.y - p.y, g.mouseWorld.x - p.x);
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

  // 蓄力（轨道炮）：按住蓄满才放；松开就泄掉。二阶段蓄力时间缩短
  const s2w = stage2Of(p, p.weapon);
  const chargeTime = wDef.charge ? wDef.charge * (s2w.chargeMul || 1) : 0;
  if (wDef.charge) {
    if (input.firing && p.reloading <= 0) p.chargeT = Math.min(chargeTime, p.chargeT + dt);
    else p.chargeT = Math.max(0, p.chargeT - dt * 4);
  } else if (p.chargeT) {
    p.chargeT = 0;
  }

  // 激光（S21 重做）：单发贯穿全屏。按一次打一道光束，按 rate 冷却；不再持续耗弹
  if (p.beamLife > 0) p.beamLife = Math.max(0, p.beamLife - dt);
  if (wDef.kind === 'beam') {
    p.beamOn = false;
    if (input.firing && p.reloading <= 0 && p.cd <= 0 && p.ammo > 0 && p.dashT <= 0) {
      p.beamAngle = p.aim;
      p.ammo--;
      p.cd = wDef.rate || 0.42;
      p.muzzle = 0.05;
      g.fireLaser(p);
      g.audio.shoot('gauss');
    } else if (p.ammo <= 0 && input.firing && p.reloading <= 0) {
      g.audio.empty();
      startReload(g, p);
    }
  } else {
    p.beamOn = false;
  }

  // 开火（beam 武器不走这里；冲刺中不可开火）
  if (input.firing && p.reloading <= 0 && p.cd <= 0 && wDef.kind !== 'beam' && p.dashT <= 0) {
    const charged = !wDef.charge || p.chargeT >= chargeTime;
    if (p.ammo > 0 && charged) {
      fireWeapon(g, p);
      // 二阶段射速加成（rateMul < 1 更快）
      p.cd = wDef.rate * (s2w.rateMul || 1);
      p.muzzle = wDef.charge ? 0.1 : 0.06;
      if (wDef.charge) p.chargeT = 0;
      // 二阶段：连发数加成（教诲三连 → 五连）
      const burstN = (wDef.burst || 0) + (s2w.burstAdd || 0);
      if (burstN > 1) {
        p.burstLeft = burstN - 1;
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
  // 锁定/解锁当前武器（L）：锁定时捡到更高等级也不自动换，只转补给
  if (input.tap('KeyL')) g.toggleWeaponLock(p);

  // 自然回复
  if (p.stats.regen > 0 && p.hp > 0) {
    p.hp = Math.min(p.maxHp, p.hp + p.stats.regen * dt);
  }

  p.hurtFlash = Math.max(0, p.hurtFlash - dt * 2.4);
}

export function hurtPlayer(g, dmg, dirX, dirY) {
  const p = g.player;
  if (p.hp <= 0) return;
  // 冲刺无敌帧（S1-D2）：冲刺期间不吃伤害
  if (p.dashInv > 0) return;
  if (random() < p.stats.dodge) {
    g.particles.text(p.x, p.y - 26, '闪避', '#c9d6e5', 14);
    return;
  }
  // 受击方向（S1-D3）：记录伤害来源方向，供 HUD 画方向指示
  if (dirX !== undefined && dirY !== undefined && (dirX || dirY)) {
    const l = Math.hypot(dirX, dirY) || 1;
    p.hurtDirX = dirX / l;
    p.hurtDirY = dirY / l;
  }
  // 护盾先扣：扣完前不掉血
  if (p.shield > 0) {
    const absorbed = Math.min(p.shield, dmg);
    p.shield -= absorbed;
    dmg -= absorbed;
    g.particles.ring(p.x, p.y, 22, 'rgba(150,220,255,0.8)', 0.3);
    g.particles.text(p.x, p.y - 26, `护盾 -${Math.round(absorbed)}`, '#a8e0ff', 13);
    if (dmg <= 0) return;
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
