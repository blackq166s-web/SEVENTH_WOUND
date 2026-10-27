import { random } from '../core/math.js';

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
    desc: '所有武器 +1 弹丸，伤害 -8%（适合霰弹 / 转轮）',
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
  },

  // ---------- v0.3 机制型刻印（S6-D）：不是加数值，是改玩法 ----------
  {
    id: 'ricochet', name: '跳弹', icon: '跳', color: '#7ce7ff', max: 2, line: 'steel', rarity: 'rare',
    desc: '子弹命中后弹向最近的另一个敌人（伤害 -25%）',
    apply(p) { p.stats.bounce += 1; }
  },
  {
    id: 'chain', name: '连锁', icon: '链', color: '#a8f0ff', max: 3, line: 'erosion', rarity: 'rare',
    desc: '命中时对最近的下一个敌人跳一次伤害（40%/层）',
    apply(p) { p.stats.chain += 1; }
  },
  {
    id: 'minefield', name: '布雷', icon: '雷', color: '#ffd166', max: 3, line: 'steel', rarity: 'rare',
    desc: '每 3 秒在脚下留一颗地雷，敌人踩到就炸',
    apply(p) { p.stats.mineRate += 1 / 3; }
  },
  {
    id: 'frosttrail', name: '冰痕', icon: '痕', color: '#a8f0ff', max: 2, line: 'instinct', rarity: 'rare',
    desc: '移动路径留下减速粘液，敌人经过会被冻住',
    apply(p) { p.stats.frostTrail += 1; }
  },
  {
    id: 'dualwield', name: '双持', icon: '双', color: '#ff9f43', max: 1, line: 'steel', rarity: 'rare',
    desc: '副武器与主武器同时开火（需先解锁副武器槽）',
    apply(p) {
      p.stats.dualWield = 1;
      p.secondaryUnlocked = true;
    }
  }
];

// 没写 rarity 的一律普通；两个最"要命"的侵蚀刻印归为禁忌
for (const perk of PERKS) {
  if (!perk.rarity) perk.rarity = 'common';
}
PERKS.find((p) => p.id === 'death_clock').rarity = 'forbidden';
PERKS.find((p) => p.id === 'uber').rarity = 'forbidden';

export const PERK_MAP = Object.fromEntries(PERKS.map((p) => [p.id, p]));

/** 稀有度显示名（卡片用） */
export const RARITY_LABEL = { common: '普通', rare: '稀有', forbidden: '禁忌' };

/** 抽取权重：稀有/禁忌出现率更低，但抽到就是质变 */
const RARITY_WEIGHT = { common: 1, rare: 0.55, forbidden: 0.6 };

/**
 * 协同表：拿到这些组合时卡面会标「＋协同」，让"这局在走什么流派"看得见。
 * 双向都写一遍，避免只从一个方向触发的困惑。
 */
export const SYNERGY = {
  ricochet: ['critical', 'piercing'],
  chain: ['toxic', 'pyromaniac'],
  minefield: ['death_clock', 'bloody_mess'],
  frosttrail: ['time_warp', 'long_ranged'],
  dualwield: ['alternate', 'ammomaniac'],
  pyromaniac: ['scatter', 'chain'],
  toxic: ['chain', 'scatter'],
  death_clock: ['minefield', 'bloody_mess'],
  critical: ['ricochet', 'piercing'],
  scatter: ['pyromaniac', 'toxic'],
  piercing: ['ricochet', 'critical'],
  alternate: ['dualwield']
};

/** 这张刻印与"已经拿到手的"有没有组合 */
export function synergyWith(p, perk) {
  const partners = SYNERGY[perk.id] || [];
  return partners
    .filter((id) => perkStacks(p, id) > 0)
    .map((id) => PERK_MAP[id])
    .filter(Boolean);
}

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
    // 双持依赖副武器槽：未解锁时别推（否则它解锁了槽，备用武器就成废卡）
    if (perk.id === 'dualwield' && !p.secondaryUnlocked) return false;
    // 医学博士是"救命牌"：只在血量偏低时出现，满血/半血都不推（否则是浪费一个格子）
    if (perk.id === 'doctor' && p.hp >= p.maxHp * 0.6) return false;
    return have < (perk.max || 1);
  });

  // 加权不放回抽取（走种子流，同 seed 结果一致）
  const bag = pool.slice();
  const picked = [];
  while (picked.length < n && bag.length > 0) {
    let total = 0;
    for (const perk of bag) total += RARITY_WEIGHT[perk.rarity] || 1;
    let r = random() * total;
    let idx = bag.length - 1;
    for (let i = 0; i < bag.length; i++) {
      r -= RARITY_WEIGHT[bag[i].rarity] || 1;
      if (r <= 0) {
        idx = i;
        break;
      }
    }
    picked.push(bag.splice(idx, 1)[0]);
  }
  return picked;
}

export function applyPerk(p, perk) {
  perk.apply(p);
  p.perkCounts[perk.id] = perkStacks(p, perk.id) + 1;
  // 代价：走"侵蚀"这条线就要付侵蚀值（钢铁 / 本能不能白拿，它们也不涨侵蚀）
  if (perk.line === 'erosion') {
    const gain = perk.rarity === 'forbidden' ? EROSION_PER_STACK * 2 : EROSION_PER_STACK;
    p.erosion = Math.min(EROSION_MAX, (p.erosion || 0) + gain);
  }
  return p.erosion || 0;
}
