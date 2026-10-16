# Alethic Insight 官网

Alethic Insight 人工智能社团（CUMT）官网：**粒子叙事单页 + 多页 Vite 工程**。线上部署于 alethicinsight.com（腾讯云主站），本仓库是唯一权威源码。

## 快速开始

```bash
npm install
npm run dev       # 开发，127.0.0.1
npm run build     # 产物到 dist/
npm run preview   # 预览构建产物，127.0.0.1:4173
```

依赖只有 Vite 7 与 puppeteer-core（抽帧验证用），无前端框架。

## 页面构成

`vite.config.js` 的多页 input 只有三个入口：`index.html`（主页）、`people.html`（成员）、`insights-memory-hierarchy.html`（技术博客）。FLUED 研究展示五页（flued / flued-architecture / flued-demo / flued-evidence / flued-experiments）放在 `public/` 下原样分发，不参与打包，仍是经典静态页；`public/awards/` 放获奖证书，`public/assets/` 放 FLUED 页预构建的 JS/CSS。

主页 `index.html` 的 SPA 换页由 `src/shell.js` 承担：截取站内链接、替换 `<main>` 并重建叙事生命周期，同页 hash 交给浏览器。

## 六阶段粒子叙事（首屏长滚动）

1. **序章 intro**：噪点星野聚成「AI」→ 展开为 Alethic Insight 品牌名 → 字幕升起，中文 slogan「由繁得构，由构显真」与英文单行依次呈现；固定时间线驱动，可跳过。
2. **方向 directions**：七个研究方向词（LLM / CV / VLM / RL / Agent / Memory / Infra）由粒子组成，悬停或聚焦某个方向即重组显影。
3. **项目 projects**：噪点（01 二进制单元）聚成 FLUED 大字，对应字节级语言接口研究。
4. **成果 awards**：噪点聚成「一等奖」队形，链接到团队与证书。
5. **终章 finale**：先聚回首屏的 A，随后 A 与 I 各自散开、粒子重组为 Alethic 与 Insight，收束于 A 中心的蓝点，呼应品牌 mark。
6. 各阶段滚轮/触摸一次推进一个相位，相位间锁滚动，防止快速滚动跳过叙事。

粒子数：桌面 8000、移动端（≤760px）3000，低性能设备再按比例降（`src/bg/scene.js`）。`prefers-reduced-motion` 下退化为静态队形、无自定义指针、短序章。

## 文件职责

- `src/bg/scene.js`（约 457 行）：粒子引擎——Canvas 2D 字形采样、粒子物理、sprite 渲染；暴露 `initScene(canvas)` → `mount / update({from,to,mix,focus,energy,dock}) / setActive / resize / destroy`。
- `src/bg/narrative.js`（约 339 行）：阶段编排——阶段停点（STAGE_STOPS）、相位推进、滚动吸附、悬停/触屏选形、序章时间线。
- `src/bg/cursor.js`：自定义指针（外圆内点、滞后跟随、difference 反色，仅精细指针设备）。
- `src/bg/transition.js`：换页过渡遮罩（纸色遮揭）。
- `src/shell.js`：SPA 换页、历史滚动位置保存。
- `src/main.js`：主题/语言切换、页眉巨型菜单、正文区块逻辑。
- `src/styles.css`（约 4460 行，**注意文件为混合换行**，编辑时保持原样勿整文件格式化）：设计 token 在 `:root` / `:root[data-theme="light"]`，其后按页面/组件分区。
- `public/`：FLUED 五页、字体（自托管 IBM Plex）、证书、数据 JSON，原样进 dist。

## 无头抽帧验证工作流

`scripts/` 下是基于 puppeteer-core 的截图脚本（需本机已有 Chrome/Edge）：

- `scripts/capture-intro.mjs`：1600×900 桌面序章抽帧。
- `scripts/capture-mobile.mjs`：390×844 移动端抽帧。
- `scripts/capture-entry.mjs` / `capture-entry-check.mjs` / `capture-stage.mjs`：入口与指定阶段补拍。

产物默认进 `.shots/`（已 gitignore）。标准验证流程见 [docs/maintenance.md](docs/maintenance.md)。

## 部署

```bash
DEPLOY_HOST=ubuntu@<服务器公网IP> bash deploy/push-dist.sh
```

`deploy/push-dist.sh` 本地 `npm run build` 后把 `dist/` 打成 tar 推到 `/var/www/alethicinsight/releases/<时间戳>`，切换 `current` 软链并 reload nginx，保留最近 5 个 release。可选 `DEPLOY_KEY` 指定 SSH 私钥（默认 `~/.ssh/alethic_site_ed25519`）。**部署脚本会操作线上服务器，执行前确认目标主机无误。**

## 文档

- [docs/design/](docs/design/)：叙事设计与实现计划（specs / plans）。
- [docs/maintenance.md](docs/maintenance.md)：前端美化维护指南——token 位置、舞台文案位置、叙事参数、新增阶段步骤、验证流程。
- [docs/cf-pages-migration.md](docs/cf-pages-migration.md)：迁移 Cloudflare Pages 方案与 runbook（未切换，线上仍走 `deploy/push-dist.sh`）。
