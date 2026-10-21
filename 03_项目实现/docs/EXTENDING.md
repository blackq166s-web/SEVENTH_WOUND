# 扩展指南

所有内容都是**数据表 + 少量逻辑**的结构，加内容基本不用改核心循环。

---

## 1. 加一种武器

文件：`src/game/weapons.js`，往 `WEAPONS` 里加一项即可。

```js
laser: {
  name: '激光枪', tier: 4,          // tier 决定掉落池（1..4）
  dmg: 40,                          // 单发伤害（会被 dmgMul 等 Perk 放大）
  rate: 0.16,                       // 开火间隔（秒）
  speed: 1800,                      // 子弹速度 px/s
  spread: 0.01,                     // 散布（弧度，双方各一半）
  pellets: 1,                       // 弹丸数（霰弹枪是 9）
  mag: 14, reload: 1.2,             // 弹匣 / 装填时间（秒）
  pierce: 2,                        // 穿透几个敌人
  knockback: 60,                    // 击退
  color: '#8ef0ff',                 // 子弹颜色
  size: 3,                          // 子弹半径
  life: 1.2,                        // 存活时间（秒）
  sound: 'plasma',                  // 音效 key，见 core/audio.js shoot()
  kind: 'plasma',                   // 子弹行为：bullet | plasma | gauss | flame | rocket
  glow: 22,                         // >0 时画光晕
  // splash: { radius: 118, dmg: 75 },  // 有这项就变成爆炸弹
  // burn: 0.5,                          // 命中点燃概率
}
```

如果需要一个**全新的子弹行为**，去 `src/game/game.js` 的 `updateBullets()` 里加分支，
在 `drawBullets()` 里加对应画法。

---

## 2. 加一种敌人

文件：`src/game/enemies.js` → `ENEMY_TYPES`。

```js
summoner: {
  name: '召唤者', hp: 70, speed: 55, dmg: 6, r: 15,
  xp: 3, score: 40,
  spriteSet: 'alien',      // 先用现成精灵，见 render/sprites.js
  spriteScale: 1.1,
  blood: '#6b2b93',        // 血迹颜色
  mass: 1.4,               // 击退抗性
  behavior: 'ranged',      // chase | erratic | ranged
  attackCd: 0.9,           // 接触伤害间隔
  keepDist: 320, shootCd: 2.2, projSpeed: 400, projDmg: 10  // ranged 才需要
}
```

要在生存模式里出现，改 `game.js` 的 `pickType()`：往 `pool` 里 push `['summoner', 权重]`，
并用 `if (w >= N)` 控制它从第几波开始出现。

**要新精灵**：在 `render/sprites.js` 写一个 `drawXxx(ctx, S, seed)`，然后在 `getSprites()`
里 `build('xxx0', 60, (c, s) => drawXxx(c, s, 0.7))`（建议出 2 帧做摆动动画），
再让敌人的 `spriteSet: 'xxx'` 指过去。绘制约定是**朝 +X（右）方向**。

---

## 3. 加一个 Perk

文件：`src/game/perks.js` → `PERKS` 数组。

```js
{
  id: 'berserk',          // 唯一 id
  name: '狂暴', icon: '狂', color: '#ff4d5e',
  max: 3,                 // 最多叠 3 层
  desc: '生命低于 30% 时伤害 +40%',
  apply(p) { p.stats.dmgMul += 0.05; }   // 简单加成
}
```

复杂效果（触发型）就在 `game.js` 里读 `p.stats.xxx` 或 `p.perkCounts['berserk']` 来判断。

已有的可加字段都在 `player.js` 的 `stats` 里，加新字段记得在那里初始化。

Perk 图标用的是单个汉字/符号，直接改 `icon` 就行。

---

## 4. 加一个关卡

文件：`src/game/quests.js` → `QUESTS` 数组，按顺序推进。

```js
{
  name: '第七章 · 虫巢',
  brief: '它们从地底涌出',
  interval: 0.3,                              // 出怪间隔（秒）
  mods: { hpMul: 1.6, dmgMul: 1.25, speedMul: 1.05 },
  groups: [['zombie', 30], ['spider', 20], ['alien', 10], ['brute', 2]]
}
```

`brute` 会被自动放到队列最后（Boss 收尾）。通关判定是"队列清空 + 场上无敌人"。

---

## 5. 加一个游戏模式

1. `game.js` 里 `mode` 目前有 `'survival' | 'quest'`，在 `updateWorld()` 里分流到
   `updateWaveSpawner()` / `updateQuestSpawner()`。加一个 `updateRushSpawner()` 同理。
2. `index.html` 菜单加按钮，`ui.js` 的 `_bind()` 里绑 `g.start('rush')`。
3. `start()` 里补一下该模式的初始化和横幅文案。

---

## 6. 调平衡的地方

| 想改什么 | 改哪里 |
| --- | --- |
| 敌人数量压力 | `game.js` → `updateWaveSpawner()` 的 `interval` / `maxAlive` |
| 难度成长 | 同上的 `hpMul` / `dmgMul` / `speedMul` 公式 |
| 升级速度 | `player.js` 的 `xpNext` 初值 + `game.js` `gainXp()` 里的成长公式 |
| 掉落率 | `game.js` → `killEnemy()` 的 `0.05`（血包）/ `0.032`（武器） |
| 玩家手感 | `player.js` 的 `speed`、`r`，`updatePlayer()` 里的 `damp(15, dt)` 加速度 |
| 镜头 | `core/camera.js` 的 `zoom`、`pad`；`game.js` 里准星前探系数 `0.16` |

---

## 7. 约定

- 所有时间单位是**秒**，距离是**世界像素**（1 世界像素 = 1 CSS 像素 × 镜头缩放）。
- 世界固定 2600×2000（`game.js` 顶部 `WORLD_W/WORLD_H`）。
- 固定步长 1/60 秒更新，渲染每帧一次；`update(dt)` 里不要依赖帧率。
- 每个敌人被击杀要调用 `g.killEnemy()`，它会统一处理掉落/得分/经验。
- 改完跑一下 `node tools/smoke.mjs`，能抓到 90% 的低级错误。
