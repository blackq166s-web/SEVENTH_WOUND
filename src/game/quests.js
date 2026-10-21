import { shuffle } from '../core/math.js';

/**
 * 关卡数据（数据驱动）。groups = [类型, 数量]
 * mods 为敌人属性倍率。新增关卡往数组里加一项即可。
 */
export const QUESTS = [
  {
    name: '第一章 · 苏醒', brief: '清理前哨站的丧尸',
    interval: 0.55, mods: { hpMul: 1, dmgMul: 1, speedMul: 1 },
    groups: [['zombie', 12]]
  },
  {
    name: '第二章 · 疾行', brief: '它们比想象中更快',
    interval: 0.45, mods: { hpMul: 1.05, dmgMul: 1, speedMul: 1 },
    groups: [['zombie', 16], ['runner', 8]]
  },
  {
    name: '第三章 · 蛛群', brief: '小心毒蛛的包围',
    interval: 0.4, mods: { hpMul: 1.1, dmgMul: 1.05, speedMul: 1.02 },
    groups: [['zombie', 18], ['spider', 12], ['runner', 8]]
  },
  {
    name: '第四章 · 吐酸者', brief: '蜥蜴射手会保持距离',
    interval: 0.38, mods: { hpMul: 1.15, dmgMul: 1.1, speedMul: 1.02 },
    groups: [['zombie', 18], ['lizard', 8], ['spider', 10]]
  },
  {
    name: '第五章 · 异形降临', brief: '它们皮糙肉厚',
    interval: 0.36, mods: { hpMul: 1.3, dmgMul: 1.15, speedMul: 1.03 },
    groups: [['zombie', 20], ['alien', 6], ['lizard', 6], ['runner', 8]]
  },
  {
    name: '第六章 · 巨兽', brief: '干掉那头怪物',
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
