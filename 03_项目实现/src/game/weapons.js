import { rand, pick, random } from '../core/math.js';

/**
 * 武器定义（数据驱动）。新增武器只需在这里加一项。
 * kind 决定子弹行为：bullet | plasma | flame | gauss | rocket
 */
export const WEAPONS = {
  pistol: {
    name: '第一声 · 手枪', tier: 1, dmg: 14, rate: 0.26, speed: 1080, spread: 0.022,
    pellets: 1, mag: 12, reload: 0.85, pierce: 0, knockback: 90,
    color: '#ffe6a3', size: 2.6, life: 1.0, sound: 'pistol', tier38: 1
  },
  rifle: {
    name: '连祷 · 突击步枪', tier: 2, dmg: 11, rate: 0.095, speed: 1250, spread: 0.05,
    pellets: 1, mag: 30, reload: 1.15, pierce: 0, knockback: 80,
    color: '#ffd27a', size: 2.4, life: 1.0, sound: 'rifle'
  },
  smg: {
    name: '口吃者 · 冲锋枪', tier: 2, dmg: 7, rate: 0.058, speed: 1180, spread: 0.095,
    pellets: 1, mag: 45, reload: 1.2, pierce: 0, knockback: 40,
    color: '#ffe0a0', size: 2.2, life: 0.9, sound: 'smg'
  },
  shotgun: {
    name: '宽恕 · 霰弹枪', tier: 2, dmg: 9, rate: 0.72, speed: 980, spread: 0.19,
    pellets: 9, mag: 8, reload: 1.35, pierce: 0, knockback: 320,
    color: '#ffc46b', size: 2.6, life: 0.55, sound: 'shotgun'
  },
  flamer: {
    name: '焚稿 · 火焰喷射器', tier: 3, dmg: 4, rate: 0.032, speed: 430, spread: 0.16,
    pellets: 1, mag: 180, reload: 1.6, pierce: 99, knockback: 10,
    color: '#ff8a3c', size: 9, life: 0.24, sound: 'flame', kind: 'flame', burn: 0.5
  },
  plasma: {
    name: '结晶之喉 · 等离子枪', tier: 3, dmg: 27, rate: 0.3, speed: 820, spread: 0.03,
    pellets: 1, mag: 18, reload: 1.2, pierce: 1, knockback: 130,
    color: '#7ce7ff', size: 5, life: 1.4, sound: 'plasma', kind: 'plasma', glow: 26
  },
  gauss: {
    name: '穿层者 · 电磁步枪', tier: 4, dmg: 90, rate: 0.95, speed: 2800, spread: 0.004,
    pellets: 1, mag: 6, reload: 1.5, pierce: 6, knockback: 260,
    color: '#b8ffef', size: 3.4, life: 1.6, sound: 'gauss', kind: 'gauss', glow: 20
  },
  rocket: {
    name: '墓碑 · 火箭筒', tier: 4, dmg: 45, rate: 1.05, speed: 600, spread: 0.015,
    pellets: 1, mag: 4, reload: 1.6, pierce: 0, knockback: 200,
    color: '#ffb27a', size: 4.5, life: 2.4, sound: 'rocket', kind: 'rocket',
    splash: { radius: 118, dmg: 75 }, glow: 14
  },
  minigun: {
    name: '蜂巢 · 转轮机枪', tier: 4, dmg: 9, rate: 0.042, speed: 1300, spread: 0.13,
    pellets: 1, mag: 120, reload: 2.2, pierce: 0, knockback: 55,
    color: '#ffe8b5', size: 2.4, life: 1.0, sound: 'minigun'
  },

  // ---------- v0.3 新增 6 把（S6-C） ----------
  // 遗留：对称、工业感，靠"手艺"而不是蛮力
  whistle: {
    name: '口哨 · 精准手枪', tier: 2, dmg: 27, rate: 0.42, speed: 1500, spread: 0.004,
    pellets: 1, mag: 8, reload: 0.95, pierce: 1, knockback: 150,
    color: '#ffeacd', size: 2.8, life: 1.3, sound: 'pistol'
  },
  catechism: {
    name: '教诲 · 三连点射', tier: 2, dmg: 10, rate: 0.62, burst: 3, burstGap: 0.06,
    speed: 1350, spread: 0.02, pellets: 1, mag: 27, reload: 1.25, pierce: 0, knockback: 70,
    color: '#ffd8a0', size: 2.4, life: 1.0, sound: 'rifle'
  },
  // 再铸：生物感的持续输出
  acidbag: {
    name: '酸囊 · 腐蚀喷洒', tier: 3, dmg: 3.4, rate: 0.045, speed: 400, spread: 0.2,
    pellets: 1, mag: 170, reload: 1.7, pierce: 99, knockback: 8,
    color: '#9dff2b', size: 8, life: 0.26, sound: 'flame', kind: 'acid', poison: 3
  },
  bonesaw: {
    name: '碎骨 · 链锯枪', tier: 3, dmg: 7.5, rate: 0.052, speed: 1000, spread: 0.34,
    pellets: 1, mag: 200, reload: 2.0, pierce: 1, knockback: 40,
    color: '#e8d9b0', size: 2.6, life: 0.13, sound: 'minigun', kind: 'saw'
  },
  // 重火力：控场与爆发
  cryo: {
    name: '裂层 · 冰冻射线', tier: 4, dmg: 4.6, rate: 0.035, speed: 760, spread: 0.05,
    pellets: 1, mag: 260, reload: 1.8, pierce: 1, knockback: 6,
    color: '#a8f0ff', size: 4, life: 0.5, sound: 'plasma', kind: 'cryo', slow: 1.2
  },
  hymn: {
    name: '圣咏 · 轨道炮', tier: 4, dmg: 170, rate: 1.5, speed: 3600, spread: 0.002,
    pellets: 1, mag: 3, reload: 2.2, pierce: 99, knockback: 300,
    color: '#fff3c4', size: 3.6, life: 1.8, sound: 'gauss', kind: 'rail', charge: 0.6
  }
};

export const WEAPON_IDS = Object.keys(WEAPONS);

export function magSize(id, stats) {
  const w = WEAPONS[id];
  return Math.round(w.mag * (1 + (stats.magBonus || 0)));
}

export function reloadDuration(id, stats) {
  const w = WEAPONS[id];
  return w.reload * (1 - Math.min(stats.reloadBonus || 0, 0.7));
}

/** 按难度层级随机掉落一把武器（尽量排除当前武器） */
export function randomWeaponDrop(maxTier = 3, exclude = null) {
  let pool = WEAPON_IDS.filter((id) => WEAPONS[id].tier <= maxTier && id !== exclude);
  if (!pool.length) pool = WEAPON_IDS.filter((id) => WEAPONS[id].tier <= maxTier);
  if (!pool.length) pool = WEAPON_IDS;
  return pick(pool);
}

/**
 * 开火。返回本次产生的子弹数（用于统计/音效）。
 */
export function fireWeapon(g, p) {
  const w = WEAPONS[p.weapon];
  const st = p.stats;
  const pellets = (w.pellets || 1) + (st.pelletsBonus || 0);
  const spread = w.spread * (1 + (st.spreadPenalty || 0));

  for (let i = 0; i < pellets; i++) {
    const a = p.aim + rand(-spread, spread);
    const ox = Math.cos(p.aim) * 17;
    const oy = Math.sin(p.aim) * 17;
    const sp = (w.speed || 900) * (1 + (st.bulletSpeedBonus || 0));
    const isCrit = random() < (st.critChance || 0);
    const dmg = (w.dmg || 1) * st.dmgMul * (isCrit ? 2.2 : 1);

    g.addBullet({
      x: p.x + ox,
      y: p.y + oy,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      r: w.size || 2.5,
      dmg,
      pierce: (w.pierce || 0) + (st.pierceBonus || 0),
      life: (w.life || 1.0) * (1 + (st.rangeBonus || 0)),
      color: w.color,
      kind: w.kind || 'bullet',
      glow: w.glow || 0,
      splash: w.splash || null,
      knockback: (w.knockback || 0) * (1 + (st.knockbackBonus || 0)),
      burn: w.burn ? (w.burn + (st.burnBonus || 0)) : (st.fireChance > random() ? 0.4 : 0),
      poison: w.poison ? w.poison : (st.poisonChance > random() ? 3 : 0),
      slow: w.slow || 0,
      bounceLeft: st.bounce || 0,
      homing: st.homing || 0,
      crit: isCrit
    });
  }

  p.ammo--;
  g.stats.shots += pellets;
  g.audio.shoot(w.sound || 'pistol');

  // 枪口火花
  const mx = p.x + Math.cos(p.aim) * 22;
  const my = p.y + Math.sin(p.aim) * 22;
  g.particles.sparks(mx, my, p.aim, w.kind === 'flame' ? 1 : 3, w.color);
  if (w.kind !== 'flame') g.particles.flash(mx, my, 26, 'rgba(255,190,110,0.55)');
  g.cam.kick(w.tier >= 4 ? 2.6 : w.tier >= 3 ? 1.6 : 1.0);

  return pellets;
}
