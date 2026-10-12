# 首页连续叙事 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 在独立原型交付可直接看、滚动、悬停的品牌与内容连续叙事，升级粒子尺度和运动质感。

**Architecture:** 原生滚动，不劫持。首页粒子仅在有真实说明与交互的专属舞台中出现；同一 canvas 移到当前舞台并局部裁剪，不能以 fixed 画布透明度曲线猜测正文安全。滚动驱动身份转换，方向/项目/成果各有内容伴随的舞台；终章缩向 logo。

**Tech Stack:** 现有 Vite 7 / 原生 JS / Canvas 2D / CSS；不新增依赖。

**Spec:** ../specs/2026-10-02-intro-narrative-effects-design.md

## Global Constraints

- 仅改 website-spa-proto；现网 E 盘仓库、FLUED 页面、招新平台不改。
- 简体中文与原站事实；站点主题变量；双语功能保留。
- logo 回首页、SPA/popstate/锚点/章节轨保留。
- 粒子不压在正文后面，不做满屏尘埃；舞台内容与粒子明确分区。
- reduced-motion 静态标识、关动态交互、减少舞台高度，不丢内容。
- 没有现有测试框架则不加测试脚手架；用 npm run build、真实浏览器操作与 evaluate 断言验证。
- 不 git commit/push，不写任何服务器。

## 主代理综合决策（优先于设计稿旧建议）

1. 拒绝再增加 490svh 空白间奏带。3 个内容舞台，每个桌面约 80–100svh，移动端按内容自然撑开；用可读标题/说明/按钮承接正文，不是 aria-hidden 空 section。
2. 序章不是定时轮播。给 200–240svh 的短连续滚动序章，sticky 内部呈现 mark → 真知灼见/Alethic Insight → 口号/定位；保留初次聚合入场与静止态呼吸。粒子形变随滚动可逆，页面原生滚动、可跳过。
3. 悬停显影本轮必须做（不是 P5）：七方向语义按钮（键盘 focus 同等效果）对应真实描述，点击直达方向正文；项目舞台聚焦 FLUED 的项目简介与 link（只描述链接不改 FLUED 页）；成果舞台对应实际一/三等奖事实，不生成数字或荣誉。
4. 舞台自身 overflow:hidden / clip，画布仅在舞台的艺术区域渲染。正文与艺术区域 DOM 分隔，移动端艺术/说明上下排列。导航过场改为主题内的克制连续遮揭，旧像素墙若仍粗暴需缩小色差/纹理，不让换页比内容更抢戏。
5. 终章可以附在加入区之前的小段舞台（约 60svh），不独占漫长空屏。dock 时读 logo 坐标，保持 logo 可点击；所有换页先清理舞台观察/listeners。

## Task 1: 引擎与舞台接口

**Files:** Modify src/bg/scene.js; Create src/bg/narrative.js (仅在有必要拆出生命周期时); Modify src/shell.js.
**Interfaces:** 引擎 initScene(canvas, config) 返回 update/setState/destroy，state 包含 formation(字符串或mark或方向)、progress、hoverKey、alpha、transform；具体命名可按现有 idiom 落地，使用方保持一致。narrative 持有舞台绑定和统一 RAF/scroll/resize 调度，返回 cleanup 函数供 swapDocument 调用。

- [x] 记录当前局限：fillRect 1.8px 粒子、序章定时三句、fixed canvas fade 会在前后正文入屏时重叠。检查 package.json / AGENTS.md，建立验证基线。
- [x] 换为 2400/900 上限粒子，核心 3–4.5px、少量 6–8px anchor，预渲染 ink/accent sprite，DPR cap 2/1.75。采样按粒子尺度足够密，不让笔画断裂或膨成白块。
- [x] 连续目标插值 + 时间归一弹簧，受控切向转移；hold 微呼吸，hover 收束提亮、暂停次要运动。固定 RAF 一个、hidden 停止、off-stage 停画、主题/语言实时更新。
- [x] 画布挂到当前舞台艺术容器：`art.append(canvas)`，尺寸读取容器 clientWidth/Height，canvas absolute inset:0，不跨容器；移到新舞台时重采样并保留可控的点状态。
- [x] 用 npm run build 验证引擎与调用契约一致。

## Task 2: 内容编排与交互

**Files:** Modify index.html; src/styles.css; src/shell.js; src/bg/narrative.js.
**Interfaces:** 舞台 `[data-narrative-stage]`、艺术区域 `[data-stage-art]`、语义控件 `[data-direction]`；生命周期绑定于每次 initPage/swapDocument，cleanup 时退监听和观察器。

- [x] 序章把品牌身份、中文名与定位融入分幕字幕，sticky 阶段由自然滚动控制，不靠等循环看三句。`#top` 在序章顶保留；减少动作模式不使用漫长 sticky。
- [x] 方向舞台位于 position 后 work 前，七方向标签+真实 description，鼠标/focus 相同显影效果。标签用现有 LLM/CV/VLM/RL/Agent/Memory/AI Infra 名称；对应 article 增加稳定 id，点击锚点直达。
- [x] 项目舞台在 focus 与 projects 之间；成果舞台在 projects 与 awards 之间；文本和粒子左右分区，窄屏上下分区。交互 show selected detail 而非新增虚构统计。
- [x] 文本开关沿用 lang-zh/lang-en；每个舞台有编号、标题、真实事实、可跳到正文的 action，视觉读 CSS 变量。禁把舞台整体 aria-hidden。
- [x] 加入前紧凑 mark 归位收尾；轮询舞台坐标只在激活时，移动端可禁 dock 保留静态 mark。
- [x] 风格统一：艺术留白、大尺度标题、按钮反色/聚焦、cursor 外圆内点按压填充保留；避免细网格叠粒子和高亮噪点。
- [x] reduced-motion 与 coarse pointer 分支：无 hover 依赖、点击/focus 显示描述；CSS 关闭 sticky 长停留/呼吸。

## Task 3: 验收与修正

**Files:** 更新现有 README.md 的接口/已验证事实，勿把预期写成已验证。

- [x] npm run build（必须实际退出码 0，不通过管道隐藏失败）。
- [x] WebBridge session spa-proto-verify 真实浏览器检查：intro 顶/中/底、方向 hover 及移开、项目、成果、归位、正文是否零粒子；每处截图后 ReadMediaFile。
- [x] `window.__mark=1` 后点击 people，再 logo：标记存活、路径/title/rail 正确；检查 popstate；直接博客入口；不点击外部 CTA 导致真实写操作。
- [x] 主题与语言切换；CDP 移动视口截图并验证 scrollWidth<=innerWidth；Emulation.setEmulatedMedia reduce 后 reload，确保内容完整且静止，最后恢复 no-preference。
- [x] 复核粒子实际绘制性能，采样 RAF 可反映前台调度但不能用后台截图声称 60fps；明确指标测量条件。
- [x] 亲自代码复核：生命周期/clip/滚动可逆/交互可访问/性能；修完再 build。按用户要求未再委派代码审查。

## 自审

规格所需的大粒子/真实内容索引/归位/双语主题/隔离/降级由上述任务覆盖。原稿空白带 p 曲线不可能保证正文不重叠，已由局部 canvas clip 替代。七方向悬停显影提升为本轮交付，用户只验收效果故决策由代理承担。没有不确定占位步骤；无依赖添加和提交操作。
