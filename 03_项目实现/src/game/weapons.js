import { rand, pick, random } from '../core/math.js';

/**
 * 武器定义（数据驱动）。新增武器只需在这里加一项。
 * kind 决定子弹行为：bullet | plasma | flame | gauss | rocket
 *
 * s2 = 二阶段（S21）：重复捡到同一把武器（第 2 次）触发，每把效果独特。
 * 参数由 fireWeapon / 命中逻辑统一消费，组合出各自性格：
 *   dmgMul      伤害倍率
 *   pelletsMul  弹丸倍率
 *   rateMul     射击间隔倍率（<1 更快）
 *   pierceAdd   额外穿透
 *   spreadMul   散布倍率（<1 更准）
 *   burstAdd    连发数 +N
 *   doubleShot  一次打两发（同向微散）
 *   critAlways  必定暴击
 *   lifesteal   命中回血比例（占伤害）
 *   freezeChance 命中直接冻结概率
 *   splashMul   溅射半径/伤害倍率
 *   chainMul    连锁次数倍率
 *   chainNoDecay 连锁伤害不衰减
 *   burnGround  火焰落地留燃烧区
 *   poisonCloud 命中留毒云
 *   explodeEvery 每 N 发一颗爆裂弹
 */
export const WEAPONS = {
  pistol: {
    name: '第一声 · 手枪', icon: '🔫', tier: 1, desc: '稳定点射，中距可靠', dmg: 14, rate: 0.26, speed: 1080, spread: 0.022,
    pellets: 1, mag: 12, reload: 0.85, pierce: 0, knockback: 90,
    color: '#ffe6a3', size: 2.6, life: 1.0, sound: 'pistol', tier38: 1,
    s2: { doubleShot: true, dmgMul: 1.15, s2desc: '双发点射' }
  },
  rifle: {
    name: '连祷 · 突击步枪', icon: '🎯', tier: 2, desc: '全自动，均衡输出', dmg: 11, rate: 0.095, speed: 1250, spread: 0.05,
    pellets: 1, mag: 30, reload: 1.15, pierce: 0, knockback: 80,
    color: '#ffd27a', size: 2.4, life: 1.0, sound: 'rifle',
    s2: { rateMul: 0.72, spreadMul: 0.55, s2desc: '枪口稳定，射速更快' }
  },
  smg: {
    name: '口吃者 · 冲锋枪', icon: '🔥', tier: 2, desc: '高速泼水，近距压制', dmg: 7, rate: 0.058, speed: 1180, spread: 0.095,
    pellets: 1, mag: 45, reload: 1.2, pierce: 0, knockback: 40,
    color: '#ffe0a0', size: 2.2, life: 0.9, sound: 'smg',
    s2: { rateMul: 0.62, s2desc: '供弹加速，疯狂泼水' }
  },
  shotgun: {
    name: '宽恕 · 霰弹枪', icon: '💥', tier: 2, desc: '扇形散射，近距离爆发', dmg: 9, rate: 0.72, speed: 980, spread: 0.19,
    pellets: 9, mag: 8, reload: 1.35, pierce: 2, knockback: 320,
    color: '#ffc46b', size: 2.6, life: 0.55, sound: 'shotgun',
    s2: { pelletsMul: 1.8, spreadMul: 0.62, dmgMul: 1.1, s2desc: '弹丸翻倍，散布收拢' }
  },
  flamer: {
    name: '焚稿 · 火焰喷射器', icon: '♨️', tier: 3, desc: '持续灼烧，穿透一切', dmg: 4, rate: 0.032, speed: 430, spread: 0.16,
    pellets: 1, mag: 180, reload: 1.6, pierce: 99, knockback: 10,
    color: '#ff8a3c', size: 9, life: 0.24, sound: 'flame', kind: 'flame', burn: 0.5,
    s2: { burnGround: true, dmgMul: 1.2, s2desc: '火焰落地，留下火墙' }
  },
  plasma: {
    name: '结晶之喉 · 等离子枪', icon: '⚡', tier: 3, desc: '脉冲爆发，命中溅射', dmg: 27, rate: 0.3, speed: 820, spread: 0.03,
    pellets: 1, mag: 18, reload: 1.2, pierce: 0, knockback: 130,
    color: '#7ce7ff', size: 5, life: 1.4, sound: 'plasma', kind: 'plasma', glow: 26,
    splash: { radius: 48, dmg: 40 },
    s2: { splashMul: 1.8, dmgMul: 1.15, s2desc: '溅射范围暴涨' }
  },
  gauss: {
    name: '穿层者 · 电磁步枪', icon: '☄️', tier: 4, desc: '高速贯穿，精准狙杀', dmg: 90, rate: 0.95, speed: 2800, spread: 0.004,
    pellets: 1, mag: 6, reload: 1.5, pierce: 6, knockback: 260,
    color: '#b8ffef', size: 3.4, life: 1.6, sound: 'gauss', kind: 'gauss', glow: 20,
    s2: { pierceAdd: 99, dmgMul: 1.25, s2desc: '贯穿一切，无坚不摧' }
  },
  rocket: {
    name: '墓碑 · 火箭筒', icon: '🚀', tier: 4, desc: '范围爆炸，清场利器', dmg: 45, rate: 1.05, speed: 600, spread: 0.015,
    pellets: 1, mag: 4, reload: 1.6, pierce: 0, knockback: 200,
    color: '#ffb27a', size: 4.5, life: 2.4, sound: 'rocket', kind: 'rocket',
    splash: { radius: 118, dmg: 75 }, glow: 14,
    s2: { doubleShot: true, splashMul: 1.2, s2desc: '双联装填，两发齐射' }
  },
  minigun: {
    name: '蜂巢 · 转轮机枪', icon: '🌀', tier: 4, desc: '弹幕倾泻，火力压制', dmg: 9, rate: 0.042, speed: 1300, spread: 0.13,
    pellets: 1, mag: 120, reload: 2.2, pierce: 0, knockback: 55,
    color: '#ffe8b5', size: 2.4, life: 1.0, sound: 'minigun',
    s2: { explodeEvery: 5, s2desc: '每五发爆裂弹' }
  },

  // ---------- v0.3 新增 6 把（S6-C） ----------
  // 遗留：对称、工业感，靠"手艺"而不是蛮力
  whistle: {
    name: '口哨 · 精准手枪', icon: '🎯', tier: 2, desc: '穿甲狙击，一枪重创', dmg: 40, rate: 0.6, speed: 1600, spread: 0.003,
    pellets: 1, mag: 6, reload: 1.1, pierce: 2, knockback: 180,
    color: '#ffeacd', size: 2.8, life: 1.4, sound: 'pistol',
    s2: { critAlways: true, dmgMul: 1.2, s2desc: '百分百暴击' }
  },
  catechism: {
    name: '教诲 · 三连点射', icon: '🔱', tier: 2, desc: '三连点射，中距压制', dmg: 10, rate: 0.62, burst: 3, burstGap: 0.06,
    speed: 1350, spread: 0.02, pellets: 1, mag: 27, reload: 1.25, pierce: 0, knockback: 70,
    color: '#ffd8a0', size: 2.4, life: 1.0, sound: 'rifle',
    s2: { burstAdd: 2, s2desc: '三连变五连' }
  },
  // 再铸：生物感的持续输出
  acidbag: {
    name: '酸囊 · 腐蚀喷洒', icon: '🧪', tier: 3, desc: '酸液腐蚀，持续掉血', dmg: 3.4, rate: 0.045, speed: 400, spread: 0.2,
    pellets: 1, mag: 170, reload: 1.7, pierce: 99, knockback: 8,
    color: '#9dff2b', size: 8, life: 0.26, sound: 'flame', kind: 'acid', poison: 3,
    s2: { poisonCloud: true, dmgMul: 1.2, s2desc: '命中留下毒云' }
  },
  bonesaw: {
    name: '碎骨 · 链锯枪', icon: '🪚', tier: 3, desc: '贴脸链锯，极高输出', dmg: 9, rate: 0.052, speed: 1050, spread: 0.3,
    pellets: 1, mag: 200, reload: 2.0, pierce: 1, knockback: 40,
    color: '#e8d9b0', size: 2.6, life: 0.22, sound: 'minigun', kind: 'saw',
    s2: { lifesteal: 0.12, s2desc: '撕咬回血' }
  },
  // 重火力：控场与爆发
  cryo: {
    name: '裂层 · 冰冻射线', icon: '❄️', tier: 4, desc: '冰冻减速，控场', dmg: 4.6, rate: 0.035, speed: 760, spread: 0.05,
    pellets: 1, mag: 260, reload: 1.8, pierce: 1, knockback: 6,
    color: '#a8f0ff', size: 4, life: 0.5, sound: 'plasma', kind: 'cryo', slow: 1.2,
    s2: { freezeChance: 0.3, s2desc: '概率直接冻结' }
  },
  hymn: {
    name: '圣咏 · 轨道炮', icon: '🌠', tier: 4, desc: '蓄力轨道炮，穿透一切', dmg: 170, rate: 1.5, speed: 3600, spread: 0.002,
    pellets: 1, mag: 3, reload: 2.2, pierce: 99, knockback: 300,
    color: '#fff3c4', size: 3.6, life: 1.8, sound: 'gauss', kind: 'rail', charge: 0.6,
    s2: { chargeMul: 0.55, splashMul: 1.0, splashAdd: { radius: 70, dmg: 60 }, s2desc: '蓄力减半，弹道残留爆炸' }
  },

  // ---------- S9-C 特殊弹道（学习血腥大地 / 吸血鬼幸存者） ----------
  // 电弧：命中后跳向最近敌人，连锁闪击
  lightning: {
    name: '引线 · 电弧枪', icon: '⚡', tier: 3, desc: '命中后电弧连锁多个敌人',
    dmg: 16, rate: 0.42, speed: 1500, spread: 0.01,
    pellets: 1, mag: 30, reload: 1.3, pierce: 0, knockback: 40,
    color: '#9be7ff', size: 3, life: 1.0, sound: 'plasma',
    kind: 'chain', chain: 4, chainDmg: 0.6, chainRange: 220,
    s2: { chainMul: 2, chainNoDecay: true, s2desc: '连锁翻倍，不衰减' }
  },
  // 激光（S21 重做）：单发贯穿全屏，叠层变粗
  laser: {
    name: '焦痕 · 贯穿激光', icon: '🔆', tier: 4, desc: '单发贯穿全屏',
    dmg: 120, mag: 40, reload: 1.4, rate: 0.42,
    pellets: 1, knockback: 0, pierce: 999, life: 0.18,
    color: '#ff6b81', size: 4, sound: 'gauss', kind: 'beam',
    s2: { beamGrow: true, s2desc: '每叠一把更粗更痛' }
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

/** 取某把武器当前是否处于二阶段（S21） */
export function isStage2(p, wid) {
  return !!(p.weaponStage2 && p.weaponStage2[wid]);
}

/** 取二阶段参数（没到二阶段就返回空对象，逻辑零开销） */
export function stage2Of(p, wid) {
  if (!isStage2(p, wid)) return {};
  const w = WEAPONS[wid];
  return (w && w.s2) || {};
}

/**
 * 开火。返回本次产生的子弹数（用于统计/音效）。
 * beam 类武器不在这里发弹（激光由 player/game 单发处理）。
 */
export function fireWeapon(g, p) {
  const w = WEAPONS[p.weapon];
  const st = p.stats;
  if (w.kind === 'beam') return 0;   // 激光单独处理

  const s2 = stage2Of(p, p.weapon);

  // 弹丸数：基础 + 刻印加成，再乘二阶段倍率；双发再翻倍
  let pellets = Math.round(((w.pellets || 1) + (st.pelletsBonus || 0)) * (s2.pelletsMul || 1));
  if (s2.doubleShot) pellets *= 2;
  pellets = Math.max(1, pellets);

  const spread = w.spread * (1 + (st.spreadPenalty || 0)) * (s2.spreadMul || 1);
  const s2dmgMul = s2.dmgMul || 1;
  // 每 N 发一颗爆裂弹（转轮机枪二阶段）
  p._shotCount = (p._shotCount || 0) + 1;
  const explodeThis = s2.explodeEvery ? (p._shotCount % s2.explodeEvery === 0) : false;

  for (let i = 0; i < pellets; i++) {
    const a = p.aim + rand(-spread, spread);
    const ox = Math.cos(p.aim) * 17;
    const oy = Math.sin(p.aim) * 17;
    const sp = (w.speed || 900) * (1 + (st.bulletSpeedBonus || 0));
    const isCrit = s2.critAlways ? true : random() < (st.critChance || 0);
    const dmg = (w.dmg || 1) * st.dmgMul * s2dmgMul * (isCrit ? 2.2 : 1);

    // 溅射：二阶段放大半径与伤害
    let splash = w.splash;
    if (splash && s2.splashMul) {
      splash = { radius: splash.radius * s2.splashMul, dmg: splash.dmg * s2.splashMul };
    }
    // 轨道炮二阶段：额外残留爆炸
    if (!splash && s2.splashAdd) splash = { ...s2.splashAdd };

    g.addBullet({
      x: p.x + ox,
      y: p.y + oy,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      r: explodeThis ? (w.size || 2.5) * 1.8 : (w.size || 2.5),
      dmg: explodeThis ? dmg * 1.5 : dmg,
      pierce: (w.pierce || 0) + (st.pierceBonus || 0) + (s2.pierceAdd || 0),
      life: (w.life || 1.0) * (1 + (st.rangeBonus || 0)),
      color: w.color,
      kind: w.kind || 'bullet',
      glow: w.glow || 0,
      splash: explodeThis ? { radius: 46, dmg: dmg * 0.9 } : splash,
      knockback: (w.knockback || 0) * (1 + (st.knockbackBonus || 0)),
      burn: w.burn ? (w.burn + (st.burnBonus || 0)) : (st.fireChance > random() ? 0.4 : 0),
      poison: w.poison ? w.poison : (st.poisonChance > random() ? 3 : 0),
      slow: w.slow || 0,
      bounceLeft: st.bounce || 0,
      homing: st.homing || 0,
      crit: isCrit,
      // 电弧（S9-C）：命中后跳向最近敌人；二阶段翻倍且不衰减
      chain: Math.round((w.chain || 0) * (s2.chainMul || 1)),
      chainDmg: s2.chainNoDecay ? 1 : (w.chainDmg || 0.6),
      chainRange: w.chainRange || 200,
      // 二阶段附加行为（命中时消费）
      lifesteal: s2.lifesteal || 0,
      freezeChance: s2.freezeChance || 0,
      burnGround: !!s2.burnGround,
      poisonCloud: !!s2.poisonCloud
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
