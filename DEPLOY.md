# 推送到 GitHub

仓库已整理完毕（提交 `90cf7f5`），下面是从零推到 GitHub 并开启在线部署的完整步骤。
**推送是对外操作，请你自己执行**，我不代劳。

---

## 1. 在 GitHub 建仓库

打开 <https://github.com/new>：

- **Repository name**：`my_game_2`（或你喜欢的名字）
- **不要**勾选 "Add a README / .gitignore / license"（本地已有）
- Public 或 Private 都行，Pages 对两种都支持（Private 需付费计划才能开 Pages）

## 2. 关联并推送

```bash
cd /d/my_game_2

# 分支建议改名为 main（GitHub 默认）
git branch -M main

# 换成你自己的仓库地址
git remote add origin https://github.com/<你的用户名>/my_game_2.git
git push -u origin main
```

> 仓库约 **25 MB**（含 19M 历史归档 + 2.3M 展示图），首次推送需要一点时间。

## 3. 开启 GitHub Pages

推完之后：

1. 进仓库 **Settings → Pages**
2. **Source** 选 **GitHub Actions**（不要选 "Deploy from a branch"）
3. 保存即可

## 4. 触发第一次部署

部署流程挂在 `v*` tag 上，打一个 tag 推上去：

```bash
git tag v0.5.9
git push origin v0.5.9
```

推完去仓库 **Actions** 页看 `Deploy to GitHub Pages` 跑完（约 1 分钟）。

成功后地址是：

```
https://<你的用户名>.github.io/my_game_2/
```

同目录还有单文件可下载：

```
https://<你的用户名>.github.io/my_game_2/SEVENTH-WOUND-0.5.9.html
```

## 5. 以后发版的固定流程

```bash
# 1. 改版本号（两处必须一致，CI 会校验）
#    03_项目实现/package.json       "version": "0.6.0"
#    03_项目实现/index.html         id="verLine">v0.6.0<

# 2. 本地验证 + 打包
cd 03_项目实现
node tools/smoke.mjs
node tools/determinism.mjs
node tools/pack.mjs

# 3. 提交并打 tag
cd ..
git add -A && git commit -m "feat: ..."
git tag v0.6.0
git push origin main --tags
```

tag 一推，Pages 自动更新。

---

## 附：手动发 Release（可选，给朋友下载单文件）

```bash
cd 03_项目实现
node tools/pack.mjs
```

然后把 `release/SEVENTH-WOUND-<version>.html` 拖到 GitHub 仓库的 **Releases → Draft a new release** 里，
tag 填 `v<version>`，附件上传那个 HTML。别人下载双击就能玩。

---

## 遇到的问题

| 现象 | 原因 / 处理 |
| --- | --- |
| Pages 显示 404 | Settings → Pages 的 Source 没选 "GitHub Actions"，或 Actions 还没跑完 |
| Actions 挂在 smoke | 看日志里哪条断言失败；本地 `node tools/smoke.mjs` 能复现 |
| 版本号不一致报错 | `package.json` 与 `index.html#verLine` 必须一致，`pack.mjs` 会直接拒绝打包 |
| 推送后体积异常大 | 确认 `shots/`、`release/`、`_staging/`、`.workbuddy/` 没被提交（都在 `.gitignore`） |
