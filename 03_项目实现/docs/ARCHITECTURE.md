# 架构说明

> 面向接手本项目的开发者 / AI Agent。读之前先看仓库根 `AGENTS.md`（规则与验证门槛）。
> 本文只讲**代码怎么组织、改哪里、容易踩什么坑**。

---

## 1. 总览

单页游戏，无框架。入口 `index.html` → `src/main.js` → `Game` 实例。

```
index.html          画布 + 全部 CSS + DOM 面板（菜单/刻印/武器/图鉴/结算）
src/main.js         启动：创建 Game / Input / Audio / UI，跑固定步长主循环
src/ui.js           DOM 面板的显隐与内容填充（唯一的 DOM 操作层）
src/game/game.js    核心：状态机、主循环逻辑、生成/碰撞/结算（最大的文件）
src/render/         精灵生成与配色（程序化 + PNG 覆盖）
src/core/           与玩法无关的基础设施
```

**依赖方向单向**：`main → game → (player/enemies/weapons/perks/hud/...) → core/render`。
`ui.js` 被 `game` 持有，但只负责 DOM，不参与玩法计算。

---

## 2. 主循环

`main.js` 固定步长 1/60：

```js
while (acc >= STEP && guard++ < 6) { game.update(STEP); acc -= STEP; }
game.render();
```

- **一次 `update` 只推进 1/60 秒**，不依赖真实帧时长 → 逻辑可复现
- 单帧最多补 6 步（防止切标签页回来时炸帧）
- `game.render()` 每帧一次，只读状态、不写

`Game.update()` 内部顺序（顺序会影响手感，改动需谨慎）：

```
玩家输入/移动 → 侵蚀心跳 → 敌人 AI → 分离 → 子弹 → 拾取物 → 陷阱(雷/冰/火/毒)
→ 波次刷怪 → 计时器（保底武器）
```

---

## 3. 状态机

`game.state` 决定 update / render / 输入的行为：

| 状态 | 含义 | 进入方式 |
| --- | --- | --- |
| `menu` | 主菜单 | 启动 / 返回菜单 |
| `playing` | 战斗中 | 开局、选完刻印、选完武器 |
| `paused` | 暂停（`ESC` 或切出窗口） | `ESC` / visibilitychange |
| `levelup` | 升级三选一（暂停） | 经验满 |
| `weaponchoice` | 捡到武器对比（暂停） | 捡到不同款武器 |
| `dead` | 死亡结算 | HP 归零 |
| `clear` | 关卡清空（**下潜模式遗留，竞技场不可达**） | — |

只有 `playing` 会推进玩法；其余状态 `update` 里会提前 return（或只跑演出）。
**注意**：`levelup` / `weaponchoice` 是"暂停式面板"——这是设计选择（让玩家专心选），
但`叙事层`（`voice.js` 的独白、`banner`）**不允许暂停 update、不允许阻塞输入**，别把两者混在一起。

---

## 4. 数据表（改玩法优先改这里）

三张表驱动了绝大部分内容。**新增内容不要改 `game.js`**。

### 4.1 武器 `src/game/weapons.js`

```js
WEAPONS[id] = {
  name, desc, tier,          // 显示用
  dmg, rate, speed, spread,  // 伤害 / 射击间隔 / 弹速 / 散布
  pellets, mag, reload,      // 弹丸数 / 弹匣 / 装填时长
  pierce, knockback,
  color, size, life, sound,  // 表现
  kind,                      // 'bullet'|'plasma'|'flame'|'gauss'|'rocket'|'acid'|'saw'|'cryo'|'rail'|'chain'|'beam'
  splash, burn, poison, slow, chain, charge,  // 可选机制
  s2: { ... , s2desc }       // 二阶段：见下
}
```

**二阶段（`s2`）是参数组合**，由 `fireWeapon()` 与命中逻辑统一消费：

| 参数 | 效果 |
| --- | --- |
| `dmgMul` / `pelletsMul` / `rateMul` | 伤害 / 弹丸 / 射速倍率（`rateMul < 1` 更快） |
| `pierceAdd` / `spreadMul` | 额外穿透 / 散布倍率 |
| `doubleShot` / `burstAdd` | 一次两发（同向微散）/ 连发数 +N |
| `critAlways` | 必定暴击 |
| `lifesteal` | 命中按伤害比例回血 |
| `freezeChance` | 概率直接冻结 |
| `splashMul` / `splashAdd` | 溅射倍率 / 无溅射时附加溅射 |
| `chainMul` / `chainNoDecay` | 连锁次数倍率 / 连锁不衰减 |
| `burnGround` / `poisonCloud` | 命中留火墙 / 毒云（写入 `frostPools`，`kind: 'fire'|'poison'`） |
| `explodeEvery` | 每 N 发一颗爆裂弹 |
| `chargeMul` | 蓄力时长倍率（轨道炮） |
| `beamGrow` | 激光每叠一层变粗+增伤 |

**激光（`kind: 'beam'`）是特殊路径**：不走 `fireWeapon`，由 `player.js` 触发 `game.fireLaser(p)`，
单发贯穿全屏（射线投影判定），视觉残留靠 `p.beamLife` 衰减。

### 4.2 刻印 `src/game/perks.js`

```js
PERKS[] = {
  id, name, icon, color, max,   // max = 最大叠层
  line,                         // 'steel' | 'instinct' | 'erosion'
  rarity,                       // 'common' | 'rare' | 'forbidden'
  desc,
  apply(p) { ... }              // 直接改 p.stats / p.maxHp 等
}
```

- `SYNERGY` 表定义协同对，`synergyWith()` 在卡面标「＋协同」
- **侵蚀代价**：`applyPerk()` 里对 `line === 'erosion'` 的刻印累加 `p.erosion`（普通 +8，禁忌 +16）
- **情境化抽取**在 `rollPerks()` 的 `filter` 里：卡不该出现时从池子里剔除（例如血量 > 60% 不推"医学博士"、未解锁副武器槽不推"双持"）
- 抽取走 `random()`（种子流），权重按 `RARITY_WEIGHT`

### 4.3 敌人 `src/game/enemies.js`

```js
ENEMY_TYPES[key] = { name, hp, dmg, speed, r, score, threat, lore, blood, isBoss, ... }
```

波次解锁与权重在 `game.js` 的 `pickType()`（按 `wave` 逐步加入新种类）。

### 4.4 新增内容的完整清单

| 想加 | 改哪里 |
| --- | --- |
| 一把枪 | `weapons.js` 加一项（含 `s2`）→ 需要图标就跑 `docs/武器图标生成规范.md` |
| 一个刻印 | `perks.js` 加一项（含 `apply`）→ 需要图标就跑 `docs/刻印图标生成规范.md` → 可能要补 `SYNERGY` |
| 一种敌人 | `enemies.js` 加一项 → `sprites.js` 加绘制分支或出 PNG → `pickType()` 加权重 |
| 一个 UI 面板 | `index.html` 加 `<section class="panel">` → `ui.js` 的 `panels` 注册 + `show()` |
| 一段叙事台词 | `voice.js` 的台词表 |

---

## 5. 渲染与美术

### 5.1 三层美术策略

```
PNG 素材（assets/*.png，图像 Agent 产出）
   ↓ 异步加载，成功后覆写缓存画布
程序化绘制（sprites.js，兜底）
```

`sprites.js` 里每个图标都有两个入口：

- `getSpriteDataUrl(key)` / `getGunIcon(id, opts)` / `getPerkIcon(id)`
- 缓存 key 区分：带底板（面板卡片用）vs `id:bare`（HUD 纯剪影用）

**PNG 加载失败不会崩**，继续用程序化版本。所以换素材是"可选增强"，不是必需。

### 5.2 踩过的坑（务必注意）

1. **同一 canvas 的 context 会残留状态**。`getGunIcon()` 里做了 `ctx.scale(3,3)` 超采样，
   `fitWeaponIcon()` 复用同一 context 时必须先 `ctx.setTransform(1,0,0,1,0,0)`，
   否则所有绘制被再放大 3 倍（表现为只剩左上角）。
2. **`globalCompositeOperation = 'source-in'` 会作用于整张画布**。
   给剪影染色必须在**临时画布**上做，否则会把底板一起染成实心块。
3. **图标画布分辨率要够**。44px 画布放大到 104px 显示必然糊；用 132px 画布 + 缩放坐标系。
4. **横条状素材要按 alpha 包围盒裁剪**再缩放，否则枪只占中间一条。

### 5.3 配色

`src/render/palettes.js` 按层定义调色板；`ARENA_PALETTE` 是竞技场用的。
改配色只动这一处，不要在各处硬编码颜色。

---

## 6. UI 层

- 所有 DOM 操作集中在 `src/ui.js`，`game.js` 只调 `this.ui.xxx()`
- 面板是 `<section class="panel hidden" id="p-xxx">`，`ui.show(key)` 切换 `hidden`
- 长列表面板（图鉴）用 `.codex-grid` 内部滚动，注意 `align-content: start`（否则行会被压扁）
- **死亡类文案不能画在画布上**（结算面板会盖住），必须填进 DOM 元素

---

## 7. 随机与可复现

- 玩法随机一律走 `core/math.js` 的 `random() / rand() / chance()`（种子流）
- **唯一例外**：`core/audio.js` 用 `Math.random`——音效初始化时机不可控，若消耗种子流会让复现漂移
- 表现层随机（粒子/血迹/镜头抖动）也走 `fx.js` / `random()`，与玩法分开
- `?seed=xxx` 固定整局序列；`determinism.mjs` 用同 seed 跑三遍比对指纹

---

## 8. 验证脚本

| 脚本 | 作用 | 通过标志 |
| --- | --- | --- |
| `tools/smoke.mjs` | 无头冒烟 + 功能断言（用 `dom-stub.mjs` 造 DOM） | `SMOKE_OK` + `功能校验: PASS` |
| `tools/determinism.mjs` | 同 seed 三遍指纹比对 + 换 seed 必变 | `DETERMINISM_OK` |
| `tools/shoot.mjs` | 真 Chrome 截图（需先起 8124） | `NO_PAGE_ERRORS` |
| `tools/pack.mjs` | 内联所有资源 → 单文件 | `PACK_OK` |
| `tools/fps.mjs` | 帧率测量 | **指标当前不可信**，见 AGENTS.md |

`dom-stub.mjs` 是一个最小 DOM 桩，让逻辑能在 Node 里跑。**新增 DOM 依赖时要同步扩展它**，
否则 `smoke.mjs` 会报 `xxx is not a function`。

---

## 9. 打包

`tools/pack.mjs` 做的事：

1. 读 `index.html`，把 `<script type="module" src="./src/main.js">` 替换为内联 bundle
2. 把三套 PNG（7 + 17 + 25 张）base64 注入 `window.__SPRITE_ASSETS__` / `__WEAPON_ICON_ASSETS__` / `__PERK_ICON_ASSETS__`
3. 校验 `#verLine` 与 `package.json` 版本一致
4. 自检：产物里不得残留 `script src=` / `import './'` 等外部依赖
5. 输出 `release/SEVENTH-WOUND-<version>.html` + `运行说明.txt`

产物约 700 KB，`file://` 双击可玩（因为所有资源已内联，不走 ES Module 加载）。

---

## 10. 已知边界

- **下潜模式已停用**：`quests.js`、`updateQuestSpawner()`、`clear` 状态都还在，但 `start('quest')` 会被重定向到 `survival`。可回退，但不要在它上面继续加功能。
- **帧率指标不可信**：headless Chrome 的 rAF 调度让测值在 24~60 之间乱跳，不得用数字判定性能回归。
- **`shots/` 与 `release/` 不入库**：随时可重跑生成，不要往里塞手工文件。
