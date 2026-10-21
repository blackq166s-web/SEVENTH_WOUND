# 命名方案 · Steam 上架版

> 版本 v1.0（2026-10-21）· 用途：商店页过审前锁死游戏名
> 结论先行：**主名 `SEVENTH WOUND` / 中文商店名《第七道伤》**

---

## 0. 为什么现在必须定名

Steamworks 规则（已核实）：

| 事实 | 后果 |
| --- | --- |
| 名称存在**三处**：Store Listing（Basic Info）/ Steamworks Info（General Application Settings，库内显示）/ Package（购买与结账） | 三处不一致 = 玩家在商店看到 A，买完在库里看到 B |
| 本地化名在 General Application Settings 设置，并**覆盖**商店页同语言名 | 中文名要在这里设，否则库里仍是英文 |
| 商店页通过 **pre-release review 之后不能自助改名**，必须提交客服工单 | 实测流程 3.5 天首回复 + 2 天二次确认，还要回答"为何改名 / 是否法律原因 / 是否已变成另一个游戏" |
| Steam 未公开标题字符上限 | 别按某个数字设计，按"搜索框与库列表可读"设计 |
| 名称不得与已有产品过于相似 | 下表的检索就是干这个 |

**一句话**：现在改名零成本，过审后改名要两轮人工审核。名字今天定。

---

## 1. 检索结果（2026-10-21 实际查询）

踩过的坑，全部有据：

| 候选 | 状态 | 冲突对象 |
| --- | --- | --- |
| `CRIMSON ARENA` | ❌ 弃用 | 影射 `Crimsonland`；且 Steam 上 `CRIMSON` 已有两款（4093160 / 5196530），词族极度拥挤 |
| `ECHO PROTOCOL` | ❌ 已占用 | Echo Protocol: Escape Room（2025-07-18，App 3787520） |
| `REVERB` | ❌ 已占用 | Reverb（App 2514890，提取射击）；Reverb（App 5085070，音游） |
| `REMANENCE` | ❌ 已占用 | Remanence（2025-03-21，App 3564370，免费魂类） |
| `DEAD HAND` | ❌ 已占用 | Dead Hand（2019，App 1117480）；另有同名卡牌恐怖游戏 |
| `GULLET` | ❌ 已占用 | GULLET（2024-10-21，App 3100790），而且本身就是"探索巨型口腔"设定，撞得比名字更狠 |
| `MAW` | ❌ 弃用 | `The Maw` 是 Little Nightmares 的标志性地点名，检索会被彻底压住 |
| **`SEVENTH WOUND`** | ✅ 无同名游戏 | 检索仅返回无关内容（Pathfinder 战役、FF7 等） |
| **`AFTERSOUND`** | ✅ 无同名游戏 | 仅 aftersound.io（音频公司，非游戏领域） |

**结论**：单字 / 双字短词在 Steam 已饱和，能干净拿到的只剩**未被占用的短语组合**。

---

## 2. 推荐方案

### 主推：`SEVENTH WOUND` / 《第七道伤》

| 维度 | 评价 |
| --- | --- |
| 检索干净度 | 无同名游戏，无强关联作品 |
| 与设定咬合 | 守层者身上**七道自伤**是全局最大悬念（`STORY.md` §4）。七 = 六层 + 竞技场，也 = 七个 Perk 层级，数字自带结构 |
| 可扩展 | 续作 / DLC 天然有 1–7 的叙事台阶，不用另起品牌 |
| 品牌形态 | 2 词 16 字符，capsule 上单行排得下；可缩写为 `VII`，图标可用七道划痕 |
| 短板 | 一眼看不出是射击游戏 → 靠 capsule 画面与 tag 补，不靠名字 |

**中文商店名**：`第七道伤`（四字，字号好排，网文味足）

### 次选：`AFTERSOUND` / 《残响》

| 维度 | 评价 |
| --- | --- |
| 检索干净度 | 无同名游戏；aftersound.io 是音频公司，不影响游戏搜索 |
| 与设定咬合 | 直接就是金手指的名字，`STORY.md` §3 术语表第一行 |
| 品牌形态 | 10 字母单词，最好排 logo，也最好做域名与社媒 handle |
| 短板 | 中文《残响》偏素、同名词多，国内搜索可辨识度不如《第七道伤》；英文读者会觉得偏氛围、偏音乐 |

### 不推荐：双名堆叠

`AFTERSOUND: SEVENTH WOUND` 这类组合在 capsule 上排不下，且`副标题`在 Steam 搜索里不增加权重，只增加误输入概率。

---

## 3. 定名后的落地清单（8 处）

| # | 位置 | 现值 | 改为 |
| --- | --- | --- | --- |
| 1 | Steam Store Listing（Basic Info） | — | `SEVENTH WOUND` |
| 2 | Steamworks → General Application Settings（库内名） | — | `SEVENTH WOUND` |
| 3 | 同页 Localized Name → Simplified Chinese | — | `第七道伤` |
| 4 | Package Name | — | `SEVENTH WOUND` |
| 5 | `03_项目实现/index.html` `<title>` | `CRIMSON ARENA` | `SEVENTH WOUND · 第七道伤` |
| 6 | `03_项目实现/src/game/game.js:52` `:670` 存档键 | `crimson_best` | `seventhwound_best`，**保留旧键读取回退** |
| 7 | `STAGE.md` §7 待决策表 | 未列 | 已定名 + 决策日期 |
| 8 | `docs/STORY.md` §0 标题行 | `深红竞技场` | 游戏名 vs 地点名分离：`SEVENTH WOUND` 是游戏名，`深红竞技场` 保留为场景名 |

> 第 6 条是唯一有数据风险的：改键名必须写成 `localStorage.getItem('seventhwound_best') ?? localStorage.getItem('crimson_best')`，否则玩家最高分丢失。

---

## 4. 上架前仍需人工核验的三件事

自动化检索只能覆盖"Steam 上有没有同名游戏"，品牌层面的三件事必须自己做：

1. **商标**：USPTO（tmsearch.uspto.gov）+ 中国商标网，查 `SEVENTH WOUND` / `第七道伤` 在第 9 类（游戏软件）与第 41 类（娱乐服务）。短语商标通常可注册，但需确认无在先申请。
2. **域名与 handle**：`seventhwound.com`、Steam 群组 URL、X / Bluesky / YouTube / B站 / Discord 同名。名字再好，handle 被占就等于白送流量给他人。
3. **SteamDB 复核**：提交商店页前用 SteamDB 搜一次，确认期间没有新上架的同名产品——Steam 不强制唯一，但撞了会被埋。

---

## 5. 副标题是否需要

暂不设。理由：

- Steam 的搜索权重来自名称本身与 tag，副标题不增加权重；
- 页面显示会截断，副标题通常看不全；
- 真正承担"这是什么游戏"的是 capsule 图 + 前 3 个 tag（`Twin Stick Shooter` / `Arena Shooter` / `Roguelite`）。

若上线后数据显示自然流量转化差，再加 `: Arena Shooter` 这类描述性后缀属于 A 级改动，不影响存档与代码。

---

## 6. 未验证项

- `第七道伤` 在国内各平台（TapTap、B站、wegame）是否有同名作品，未检索。
- 商标检索未执行，本文件只提示路径。
- 域名与社媒 handle 可用性未查询。
- capsule 上 16 字符的实际排版效果未出图（需在定名后按 616×353 / 300×450 两套规格试排）。
