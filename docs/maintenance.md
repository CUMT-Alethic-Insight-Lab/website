# 前端美化维护指南

面向后续改配色、改文案、调叙事的同学。不改逻辑也能完成大多数美化；改叙事阶段请按本文标准步骤走。

## 1. 配色与字体 token

全部设计 token 集中在 `src/styles.css` 开头（约 4460 行，**文件为混合换行，禁止整文件格式化**，用编辑器“保持原有换行”）：

- `:root`（约 59 行起）：深色主题默认值。`--paper` / `--ink` 纸色与墨色，`--muted`、`--line` / `--line-strong`、`--surface` 系列、`--accent`（主强调蓝紫）、`--accent-blue`（金，品牌点缀）、`--accent-red`（警示/次强调）。
- `:root[data-theme="light"]`（约 89 行起）：浅色主题同名覆盖。改色必须两处同步改。
- 字体栈在同一区块：`--font-display` / `--font-body` / `--font-mono`，自托管 IBM Plex（latin 子集）在文件最顶部 `@font-face`，中文回落 PingFang SC / Microsoft YaHei。换字体 = 换 `public/fonts/` 文件 + 改 `@font-face` + 改栈变量。

粒子颜色不在 CSS：`src/bg/scene.js` 重建 sprite 时读取 ink/accent 计算色值，主题切换会触发重建，一般无需动 JS。

## 2. 舞台文案在哪改

主页每个叙事舞台是 `index.html` 里带 `data-narrative-stage` 的 `<section>`：`intro`（约 156 行）、`directions`（约 270 行）、`projects`（约 360 行）、`awards`（约 414 行）、`finale`（约 524 行）。

- 双语内容用 `<span lang-zh>` / `<span lang-en>` 成对书写，改文案必须两条都改。
- slogan「由繁得构，由构显真」与英文单行在 hero 区（约 177–191 行）。
- 舞台里的 `data-formation` 元素是悬停/聚焦时粒子要拼出的词（如 FLUED、一等奖）；改词时确认 `src/bg/scene.js` 的采样能覆盖该字形（ASCII 与常用中文 OK）。

## 3. 叙事参数在哪调

`src/bg/narrative.js`（约 339 行）：

- `STAGE_STOPS`：各阶段滚动停点（0–1 的进度比例），决定一次滚轮推进到哪个相位。
- `STAGE_KEYS`：各相位粒子拼什么（如 finale 的 `noise → mark → AI → brandName`）。
- 序章时间线在 `initNarrative()` 内的 `seq` 数组（`at` 秒 / `dur` 秒）：stars → AI → brandName → risenCn → slogan。
- 粒子数在 `src/bg/scene.js`：桌面 8000 / 移动 3000，低性能乘 0.72。数字采样密度与队形清晰度直接相关，下调后必须抽帧复验。

## 4. 新增或修改一个叙事阶段的标准步骤

1. 在 `index.html` 复制一个现有 `<section data-narrative-stage="...">`，改 key 与文案，保证含 `[data-stage-art]`（粒子挂载容器）和 `data-stage-art` 内的 `.art-fallback`（无 canvas 时的回退文字）。
2. 若需要相位推进，在 `narrative.js` 的 `STAGE_STOPS` / `STAGE_KEYS` 登记同名 key；纯展示阶段可不登记（跟随默认队形）。
3. 新队形词若是新字形，确认 `scene.js` 采样分支覆盖；必要时在 scene.js 添加 formation 定义。
4. 移动端规则默认：非 finale 阶段自由滚动、由行程驱动形变；如需锁相位，改 `engagedStage()` 的移动端分支（慎重，影响触屏体验）。
5. 样式挂 `styles.css` 对应分区，token 只引用变量不写死颜色。
6. 按第 5 节流程验证。

## 5. 每轮改动的验证流程

1. **本地构建**：`npm run build` 必须退出码 0。
2. **本地抽帧**：`npm run preview` 起服务后跑 `node scripts/capture-intro.mjs`（1600×900）与 `node scripts/capture-mobile.mjs`（390×844），产物在 `.shots/`。
3. **逐帧看**：序章各时间点、每个阶段相位、移动端无横向溢出；重点看新改阶段的两端语言与深浅色。
4. **部署**：`DEPLOY_HOST=... bash deploy/push-dist.sh`（会操作线上服务器，先确认主机）。
5. **线上复核**：对线上 URL 再跑一遍抽帧脚本（脚本支持传入目标地址的用法见各脚本头部注释/参数），确认与本地一致。
