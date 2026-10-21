# my_game_2 — CRIMSON ARENA

《血腥大地 / Crimsonland》复刻原型项目仓库。由「总控」会话持续维护：维持状态、组织任务、验证成果、沉淀知识。

## 快速开始

```bash
cd 03_项目实现
start.bat            # 或： node tools/serve.mjs 8123
```

浏览器打开 <http://127.0.0.1:8123/>。必须走 http，`file://` 会因 ES Module 跨域失败。

## 项目结构

```
AGENTS.md                  执行规则与权限边界（先读这个）
STAGE.md                   当前阶段：目标 / 完成标准 / 进展 / 阻塞 / 下一步
01_阶段成果/               滚动总结（当前总结.md）+ 阶段快照归档
02_输入材料/               原始需求与参考资料（只增不改）
03_项目实现/               代码实现根：index.html / src / tools / docs / shots
_staging/YYYYMMDD_事项/    草稿与临时材料（不入库）
SECRETS.local.md           敏感信息（不入库）
```

## 验证

```bash
node 03_项目实现/tools/smoke.mjs    # 无头冒烟：SMOKE_OK + 功能校验 PASS
node 03_项目实现/tools/shoot.mjs    # 真浏览器截图 → 03_项目实现/shots/（需先起 8124 服务）
```

## 当前进度

见 `STAGE.md`。S1（手感与信息可读性）：D1 边缘威胁指示器已完成，接着 D2 冲刺、D3 受击反馈。
