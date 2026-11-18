# 推送到 GitHub

仓库已整理完毕（提交 `90cf7f5`），下面是从零推到 GitHub 并开启在线部署的完整步骤。
**推送是对外操作，请你自己执行**，我不代劳。

---

## 1. 在 GitHub 建仓库

打开 <https://github.com/new>：

- **Repository name**：`SEVENTH_WOUND`（或你喜欢的名字）
- **不要**勾选 "Add a README / .gitignore / license"（本地已有）

> ⚠️ **Pages 对仓库可见性的要求**
> GitHub 免费账号只能在 **Public** 仓库开启 Pages。
> Private 仓库要开 Pages 需要 **GitHub Pro / Team / Enterprise**。
> 如果仓库是 Private 且没升级，`deploy` 任务会在最后一步失败（build 能过），只能走"单文件 + Releases"这条路。
> 本项目是 MIT 协议，本来就打算开源，直接建 Public 最省事。

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

> 选完后 `/repos/.../pages` 接口仍返回 404 是正常的 —— Pages 站点要**第一次部署成功后**才创建。

## 4. 触发第一次部署

**推到 `main` 就会自动部署**（不需要打 tag）：

```bash
git push origin main
```

去 **Actions** 页看 `Deploy to GitHub Pages` 跑完（约 1 分钟）。

> ⚠️ **为什么不用 tag 触发**（踩过的坑）
> `github-pages` 环境默认带一条**分支保护策略**，允许部署的 ref 只有 `main`。
> 从 tag（如 `v0.5.9`）触发时，deployment 会被 environment 直接拒绝：
> job **2 秒失败、steps 为空、runner 都没分配**，Actions 日志里看不到任何有用错误。
> 所以 `deploy.yml` 的触发条件是 `push: branches: [main]`。
>
> 如果确实想用 tag 部署，得去 **Settings → Environments → github-pages →
> Deployment branches and tags** 把 `v*` 加进允许列表；否则保持现状即可。

成功后地址是：

```
https://blackq166s-web.github.io/SEVENTH_WOUND/
```

同目录还有单文件可下载：

```
https://blackq166s-web.github.io/SEVENTH_WOUND/SEVENTH-WOUND-0.5.9.html
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

# 3. 提交（推 main 即自动部署 Pages）
cd ..
git add -A && git commit -m "feat: ..."
git push origin main

# 4. 可选：打个 tag 方便在 GitHub 上回看版本节点（不触发部署）
git tag v0.6.0 && git push origin v0.6.0
```

`main` 一推，Pages 自动更新（`paths` 限定 `03_项目实现/**`，纯文档改动不会触发部署）。

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
| **deploy job 2 秒失败、steps 为空** | **从 tag 触发了部署，但环境只允许 `main` 部署**。改用 `push: branches: [main]`，或去 Environments 把 `v*` 加进允许列表 |
| Setup Pages 步骤失败 | Pages 尚未启用（Source 还是 None） |
| Actions 挂在 smoke | 看日志里哪条断言失败；本地 `node tools/smoke.mjs` 能复现 |
| 版本号不一致报错 | `package.json` 与 `index.html#verLine` 必须一致，`pack.mjs` 会直接拒绝打包 |
| 推送后体积异常大 | 确认 `shots/`、`release/`、`_staging/`、`.workbuddy/` 没被提交（都在 `.gitignore`） |
| 仓库改 public 后仍 404 | 无痕窗口再试；确认看的是仓库页而不是 Pages 地址 |
