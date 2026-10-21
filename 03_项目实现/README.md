# 03_项目实现 — 代码索引

代码实体**不在**本目录，位于仓库根。本文件只做索引，避免搬迁破坏 `start.bat`、README 相对路径与验证脚本。

| 模块 | 路径 | 行数 | 职责 |
| --- | --- | --- | --- |
| 入口页面 | `index.html` | 395 | 画布、菜单/HUD 覆盖层、全部样式 |
| 引导 | `src/main.js` | 118 | 画布尺寸、固定步长主循环、`?auto=` 调试快进 |
| UI 交互 | `src/ui.js` | 144 | 菜单 / 升级三选一 / 死亡 / 暂停 / 通关 |
| 数学 | `src/core/math.js` | 46 | clamp / damp / angleLerp / rand |
| 输入 | `src/core/input.js` | 66 | 键鼠，含边沿触发 `tap()` |
| 音频 | `src/core/audio.js` | 155 | WebAudio 实时合成，无音频文件 |
| 镜头 | `src/core/camera.js` | 73 | 跟随、震动、缩放、边界钳制 |
| 核心 | `src/game/game.js` | 1010 | 状态机、波次/关卡调度、碰撞、渲染管线 |
| 玩家 | `src/game/player.js` | 191 | 移动、瞄准、开火、装填、受伤 |
| 武器 | `src/game/weapons.js` | 126 | 武器数据表 + 开火逻辑 |
| 敌人 | `src/game/enemies.js` | 197 | 敌人数据表 + AI + 受伤 |
| Perk | `src/game/perks.js` | 132 | 20 个可叠加 Perk 数据表 |
| 关卡 | `src/game/quests.js` | 51 | 6 个手工关卡数据 |
| 粒子 | `src/game/particles.js` | 199 | 血、火花、尸块、烟雾、飘字 |
| 血迹 | `src/game/decals.js` | 86 | 离屏 0.5 分辨率，定期淡出 |
| HUD | `src/game/hud.js` | 157 | 画布内 HUD |
| 精灵 | `src/render/sprites.js` | 438 | 程序化精灵 + 地面瓦片 |
| 静态服务 | `tools/serve.mjs` | 54 | 零依赖 http 服务 |
| 冒烟测试 | `tools/smoke.mjs` | 282 | DOM 桩，node 内跑 1.5 万帧 |
| 截图 | `tools/shoot.mjs` | 152 | 本机 Chrome + playwright-core |
| 帧率 | `tools/fps.mjs` | 14 | 端到端 rAF 帧率（需服务在 8124） |
| 扩展文档 | `docs/EXTENDING.md` | — | 加武器/敌人/Perk/关卡/模式 |

## 本地约定

- 一切验证走 http，不用 `file://`。
- 调试入口：`window.__game`；URL 参数 `?auto=survival&warm=1500&bot=1`。
- 本机 Chrome 路径：`C:/Program Files/Google/Chrome/Application/chrome.exe`（`tools/*.mjs` 已硬编码）。
