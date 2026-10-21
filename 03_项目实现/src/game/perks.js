import { shuffle } from '../core/math.js';

/**
 * Perk 定义（数据驱动）。apply(p) 直接修改玩家状态。
 * max = 最大可叠层数
 */
export const PERKS = [
  {
    id: 'bloody_mess', name: '血肉横飞', icon: '血', color: '#ff4d5e', max: 6, line: 'steel',
    desc: '所有武器伤害 +22%',
    apply(p) { p.stats.dmgMul += 0.22; }
  },
  {
    id: 'fastloader', name: '快速装填', icon: '装', color: '#7ce7ff', max: 4, line: 'steel',
    desc: '装填速度 +35%',
    apply(p) { p.stats.reloadBonus += 0.35; }
  },
  {
    id: 'ammomaniac', name: '弹药狂徒', icon: '弹', color: '#ffd166', max: 4, line: 'steel',
    desc: '弹匣容量 +40%',
    apply(p) { p.stats.magBonus += 0.4; p.ammo = Math.round(p.ammo * 1.4) + 4; }
  },
  {
    id: 'thick_skin', name: '厚皮', icon: '甲', color: '#9fb4c9', max: 5, line: 'instinct',
    desc: '最大生命 +30，并治疗 30',
    apply(p) { p.maxHp += 30; p.hp = Math.min(p.maxHp, p.hp + 30); }
  },
  {
    id: 'regeneration', name: '再生', icon: '愈', color: '#5dff9b', max: 4, line: 'instinct',
    desc: '每秒回复 1.5 点生命',
    apply(p) { p.stats.regen += 1.5; }
  },
  {
    id: 'doctor', name: '医学博士', icon: '医', color: '#5dff9b', max: 1, line: 'instinct',
    desc: '立即回满生命，治疗量 +60%',
    apply(p) { p.stats.healBonus += 0.6; p.hp = p.maxHp; }
  },
  {
    id: 'ninja', name: '疾风步', icon: '速', color: '#b8ffef', max: 5, line: 'instinct',
    desc: '移动速度 +14%',
    apply(p) { p.stats.speedMul += 0.14; }
  },
  {
    id: 'long_ranged', name: '远程专精', icon: '远', color: '#ffd166', max: 3, line: 'steel',
    desc: '子弹速度 +35%，射程 +25%',
    apply(p) { p.stats.bulletSpeedBonus += 0.35; p.stats.rangeBonus += 0.25; }
  },
  {
    id: 'bonus_magnet', name: '磁力吸引', icon: '磁', color: '#7ce7ff', max: 3, line: 'instinct',
    desc: '拾取范围 ×2.4',
    apply(p) { p.stats.magnet *= 2.4; }
  },
  {
    id: 'angry_bullets', name: '愤怒子弹', icon: '追', color: '#ff9f43', max: 2, line: 'steel',
    desc: '子弹会追踪附近敌人',
    apply(p) { p.stats.homing += 3.2; }
  },
  {
    id: 'pyromaniac', name: '纵火狂', icon: '焰', color: '#ff7a3c', max: 3, line: 'erosion',
    desc: '命中时有 35% 概率点燃敌人',
    apply(p) { p.stats.fireChance += 0.35; p.stats.burnBonus += 0.3; }
  },
  {
    id: 'toxic', name: '剧毒之触', icon: '毒', color: '#9dff2b', max: 3, line: 'erosion',
    desc: '命中时使敌人中毒（持续伤害）',
    apply(p) { p.stats.poisonChance += 0.4; }
  },
  {
    id: 'dodging', name: '闪避', icon: '闪', color: '#c9d6e5', max: 4, line: 'instinct',
    desc: '18% 概率完全闪避伤害',
    apply(p) { p.stats.dodge = Math.min(0.72, p.stats.dodge + 0.18); }
  },
  {
    id: 'critical', name: '致命一击', icon: '暴', color: '#ffd166', max: 4, line: 'instinct',
    desc: '暴击率 +15%（2.2 倍伤害）',
    apply(p) { p.stats.critChance += 0.15; }
  },
  {
    id: 'scatter', name: '散射改造', icon: '散', color: '#ff9f43', max: 3, line: 'steel',
    desc: '所有武器 +1 弹丸，伤害 -8%',
    apply(p) { p.stats.pelletsBonus += 1; p.stats.dmgMul *= 0.92; }
  },
  {
    id: 'piercing', name: '穿甲弹', icon: '穿', color: '#7ce7ff', max: 4, line: 'steel',
    desc: '子弹额外穿透 1 个敌人',
    apply(p) { p.stats.pierceBonus += 1; }
  },
  {
    id: 'death_clock', name: '死亡时钟', icon: '死', color: '#ff4d5e', max: 3, line: 'erosion',
    desc: '击杀敌人时有 22% 概率引发爆炸',
    apply(p) { p.stats.explodeOnKill += 0.22; }
  },
  {
    id: 'time_warp', name: '时间扭曲', icon: '缓', color: '#9fb4c9', max: 3, line: 'erosion',
    desc: '所有敌人移动速度 -9%',
    apply(p) { p.stats.enemySlow += 0.09; }
  },
  {
    id: 'uber', name: '超级战士', icon: '全', color: '#ff4d5e', max: 2, line: 'erosion',
    desc: '伤害 +12%、移速 +8%、装填 +15%',
    apply(p) {
      p.stats.dmgMul += 0.12;
      p.stats.speedMul += 0.08;
      p.stats.reloadBonus += 0.15;
    }
  },
  {
    id: 'alternate', name: '备用武器', icon: '副', color: '#ffd166', max: 1, line: 'steel',
    desc: '解锁副武器槽，按 Q / 右键切换',
    apply(p) { p.secondaryUnlocked = true; }
  }
];

export const PERK_MAP = Object.fromEntries(PERKS.map((p) => [p.id, p]));

/** 每拿一层"侵蚀"线刻印累积的侵蚀值（STORY §8：越强越不像人） */
export const EROSION_PER_STACK = 8;
export const EROSION_MAX = 100;

export function perkStacks(p, id) {
  return p.perkCounts[id] || 0;
}

export function rollPerks(p, n = 3) {
  const pool = PERKS.filter((perk) => {
    const have = perkStacks(p, perk.id);
    if (perk.id === 'alternate' && p.secondaryUnlocked) return false;
    return have < (perk.max || 1);
  });
  return shuffle(pool.slice()).slice(0, n);
}

export function applyPerk(p, perk) {
  perk.apply(p);
  p.perkCounts[perk.id] = perkStacks(p, perk.id) + 1;
  // 代价：走"侵蚀"这条线就要付侵蚀值（钢铁 / 本能不能白拿，它们也不涨侵蚀）
  if (perk.line === 'erosion') {
    p.erosion = Math.min(EROSION_MAX, (p.erosion || 0) + EROSION_PER_STACK);
  }
  return p.erosion || 0;
}
