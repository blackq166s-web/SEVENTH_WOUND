import { shuffle } from '../core/math.js';

/**
 * 关卡数据（数据驱动）。groups = [类型, 数量]
 * mods 为敌人属性倍率。新增关卡往数组里加一项即可。
 */
export const QUESTS = [
  {
    name: '第一章 · 消化场', brief: '地渊的胃前室，堆着没消化完的人',
    interval: 0.55, mods: { hpMul: 1, dmgMul: 1, speedMul: 1 },
    groups: [['zombie', 12]]
  },
  {
    name: '第二章 · 疾走回廊', brief: '被食道推着往下，停不下来',
    interval: 0.45, mods: { hpMul: 1.05, dmgMul: 1, speedMul: 1 },
    groups: [['zombie', 16], ['runner', 8]]
  },
  {
    name: '第三章 · 织网窟', brief: '整层都在感知你',
    interval: 0.4, mods: { hpMul: 1.1, dmgMul: 1.05, speedMul: 1.02 },
    groups: [['zombie', 18], ['spider', 12], ['runner', 8]]
  },
  {
    name: '第四章 · 酸池哨塔', brief: '免疫系统开始驱除异物',
    interval: 0.38, mods: { hpMul: 1.15, dmgMul: 1.1, speedMul: 1.02 },
    groups: [['zombie', 18], ['lizard', 8], ['spider', 10]]
  },
  {
    name: '第五章 · 融生腔', brief: '残响糊成一团，认不出形状',
    interval: 0.36, mods: { hpMul: 1.3, dmgMul: 1.15, speedMul: 1.03 },
    groups: [['zombie', 20], ['alien', 6], ['lizard', 6], ['runner', 8]]
  },
  {
    name: '第六章 · 守层者之厅', brief: '它曾经和你一样',
    interval: 0.34, mods: { hpMul: 1.45, dmgMul: 1.2, speedMul: 1.04 },
    groups: [['zombie', 22], ['runner', 12], ['alien', 8], ['brute', 1]]
  }
];

/** 把关卡编成一条生成队列（Boss 总在最后） */
export function buildQuestQueue(def) {
  const queue = [];
  let boss = null;
  for (const [type, count] of def.groups) {
    if (type === 'brute') { boss = type; continue; }
    for (let i = 0; i < count; i++) queue.push(type);
  }
  shuffle(queue);
  if (boss) queue.push(boss);
  return queue;
}
