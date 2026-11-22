# Alethic B 端品牌复用验证

**验证对象是独立的会议稿件工作台。现有 React + Ant Design 样板已经把定位线、选中态和阶段反馈用于真实可操作的演示。新版官网的精确色值、字族和双主题尚未接入该样板。** 本轮于 2026 年 11 月 21 日复核样板源码与已有构建产物。

## 1. 官网与会议工作台各用自己的架构

官网的 `/meeting.html` 是面向访客的「阶段谱」，用一个虚构样例讲解投稿、评审、讨论和决定。B 端沿用工作导航、稿件表格和所选稿件的详情区。桌面将表格与详情并列，窄屏按列表、详情的顺序排列。会议是否对外、正式阶段、匿名与发布规则仍待负责人确认。 [官网 PRODUCT.md](../PRODUCT.md) · [官网会议演示源码](../src/meeting-ui.mjs)

共用的是语义色、正文与参数的字族分工、用于定位的细线、可见焦点和文字反馈。蓝靛边线在工作台指向当前所选稿件和它所在的阶段。密度、列宽、表格和阶段组件由工作台任务决定。全屏 ASCII、连续卷页、官网网格和开场时钟保留在官网架构内。 [官网 system.css](../src/system.css)

## 2. `ConfigProvider` 主题映射

| `system.css` 来源 | 浅色 | 深色 | B 端接入位置 |
| --- | --- | --- | --- |
| `--paper` | `#f3f4f8` | `#14182d` | `colorBgBase`、`colorBgLayout`、主按钮文字 |
| `--surface` | `#e8ebf4` | `#1d2440` | `colorBgContainer`、`colorBgElevated`、表头和普通悬停面 |
| `--ink` / `--muted` | `#171c34` / `#505c78` | `#eff1fc` / `#b4bdd5` | `colorText` / `colorTextSecondary`、`colorTextDescription` |
| `--accent` | `#333fa3` | `#adb7ff` | `colorPrimary`、`colorLink`、`colorInfo`、`controlOutline`、定位边线 |
| `--line` / `--strong-line` | `#a0a9c1` / `#687590` | `#535e80` / `#8592b9` | 普通分隔 `colorBorderSecondary` / 控件边界 `colorBorder` |
| `--sans` / `--mono` | 与深色共用 | 与浅色共用 | `fontFamily` 用官网无衬线栈。稿件编号和步骤编号使用本地 CSS 变量指定等宽栈 |
| B 端补充的选中底色 | `#dce2fb` | `#2c365e` | 工作台 `--selection`。与蓝靛定位线和「已选中」文字组合 |

下例供接入时使用。`palette` 是当前主题在上表中的实际色值对象，键为 `paper`、`surface`、`ink`、`muted`、`accent`、`line`、`strongLine`、`selection`。应用外壳与组件主题消费同一组值。表格基准继续用 14 px、控件高 36 px、圆角 4 px，触控尺寸由工作区另行保证。样板依赖锁定 `antd@6.7.1`。 样板依赖 · 已装 Ant Design 主题类型

```jsx
import { ConfigProvider, theme } from 'antd';

const sans = '"Segoe UI", "PingFang SC", "Microsoft YaHei", Arial, sans-serif';
const mono = '"Cascadia Mono", Consolas, "Liberation Mono", monospace';

function MeetingTheme({ palette, dark, children }) {
  const { paper, surface, ink, muted, accent, line, strongLine, selection } = palette;
  return (
    <ConfigProvider
      wave={{ disabled: true }}
      theme={{
        algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorBgBase: paper, colorBgLayout: paper,
          colorBgContainer: surface, colorBgElevated: surface,
          colorText: ink, colorTextSecondary: muted, colorTextDescription: muted,
          colorPrimary: accent, colorLink: accent, colorInfo: accent,
          colorBorder: strongLine, colorBorderSecondary: line, controlOutline: accent,
          fontFamily: sans, fontSize: 14, controlHeight: 36, borderRadius: 4,
          motion: false,
        },
        components: {
          Button: { primaryColor: paper, primaryShadow: 'none' },
          Table: { headerBg: surface, headerColor: muted, headerSplitColor: line, rowHoverBg: surface },
        },
      }}
    >
      <div className="workbench" style={{ colorScheme: dark ? 'dark' : 'light',
        backgroundColor: paper, color: ink, fontFamily: sans,
        '--selection': selection, '--accent': accent, '--mono': mono }}>
        {children}
      </div>
    </ConfigProvider>
  );
}
```

样板通过 `Table.rowClassName` 标出 `tr.is-selected`，其背景和首格 1 px 定位线由工作台 CSS 绘制。继续用这种「查看一篇稿件」的交互时，沿用 `.is-selected` 和 `--selection`。`Table` 的 `rowSelectedBg`、`rowSelectedHoverBg` 供采用 `rowSelection` 的原生勾选行使用，自定义行仍需要 CSS。`controlOutline` 用于组件内部的描边配置，键盘焦点由 `:focus-visible` 保证，沿用官网 2 px 轮廓和 3 px 偏移。 现有主题与组件 · 选中行 CSS · 已装 Table 令牌类型

纸色作主按钮文字，与主题强调底的静态对比分别为浅色 **8.03∶1**、深色 **9.17∶1**。强调色焦点轮廓对建议选中底色分别为 **6.85∶1**、**6.12∶1**。这些是候选色对的计算结果。接入双主题后需实测渲染出的默认、悬停、按下、选中和焦点色对。 [颜色原值](../src/system.css)

## 3. 从稿件行到对应详情和步骤

**一条稿件记录决定详情内容与当前步骤。** 稿件标题按钮执行 `select(item.id)`，`Table.rowKey="id"` 保持记录标识稳定。同一 `selected` 同时控制按钮的 `aria-pressed`、表格的 `.is-selected` 和详情查找 `records.find(...)`。详情使用该记录的编号、标题、阶段和完成状态。现有 `StageList` 用 `record.stage` 标记 `aria-current="step"`，并用当前阶段索引取对应说明。若后续换成 Ant Design `Steps`，令 `current` 取当前记录的阶段索引，保持只读进度显示，并保留可访问的当前步骤和状态文字。 会议工作台源码

| 演示操作 | 表格、详情与阶段应同时出现的结果 |
| --- | --- |
| 打开工作台会议列表 | `MTG-001` 为初始选中。详情为「小样本检索的复现记录」，定位「匿名评审」 |
| 选择 `MTG-002` | 只有 `MTG-002` 有选中反馈。详情为「知识索引的评估方案」，定位「提交材料」，显示本阶段说明 |
| 对 `MTG-002` 执行「标记本阶段完成」 | `MTG-002` 继续选中。表格的所在阶段与详情当前步骤一起变为「匿名评审」，状态消息包含 `MTG-002` 与转移结果 |
| 切到 `MTG-003` | 详情为「实验记录的可追溯性」，定位「处理决定」，显示全部阶段已完成。完成操作禁用，上一稿件的反馈清空 |

键盘焦点与选中分别表达控件位置和稿件选择。现有设计在选择稿件后把焦点留在标题按钮，用户可继续浏览列表。窄屏若加入「查看当前稿件详情」入口，入口应定位到当前记录对应的详情标题，并给出回到当前稿件按钮的路径。这条跳转属于接入建议。样板内阶段推进是浏览器内存中的演示，正式阶段推进、文件与权限由会议服务接入后另验。 工作台交互源码

## 4. 实测与验收

用 Edge + Playwright 只读加载独立样板的现有 `dist`，验证「进入会议列表 → 选择第二篇 → 完成当前步骤 → 选择已完成的第三篇」。以下通过项限于该样板和测试条件。 样板构建入口

| 检查 | 通过标准 | 本轮结果 |
| --- | --- | --- |
| 键盘与焦点 | `Tab` 到稿件标题按钮，`Space` 或 `Enter` 选稿。焦点轮廓清晰，按钮选中语义、详情标题、稿件编号和当前步骤一致 | **通过**。1366 px 两种动效设置均走通。选稿按钮测得 2 px 焦点轮廓。读屏实机播报待测 |
| 触屏与窄屏 | 点按标题即可选稿，点按阶段操作可推进。详情位于列表下方，页面无横向溢出。建议主要触控目标至少 44 × 44 CSS px | **模拟触屏通过**。390 与 320 px 均走通。`MTG-002` 按钮实测约 159 × 47 和 108 × 69 CSS px。待测真机与其他数据长度 |
| 减少动效 | 系统开启 `prefers-reduced-motion: reduce` 时，选中、步骤和状态消息仍更新，反馈不等待动画。新增自定义过渡时为减少动效提供即时更新，并同步处理平滑滚动等 JS 动效 | **样板路径通过**。`token.motion: false` 与禁用水波纹在两种设置均生效。选稿反馈后均测得 0 个活动动画。新增动效后的变体待复测 |
| 精确品牌接入 | 浅深主题分别核实色值、字族、文字和焦点对比，选中与当前步骤具有可读文字或语义。TBM 和会议使用同一个主题入口 | **待接入**。现有样板两个场景同用一个 `ConfigProvider`，使用独立深色 `#151627`、强调蓝 `#9fafff` 和 IBM Plex 字族栈。新版系统值和浅色模式仍待接入 |
| 线上业务 | 作者能找回提交记录，评审人只看到分配给自己的稿件，决定到发布时点才在授权范围内可见 | **待业务验收**。样板覆盖演示记录及操作反馈。真实账号、角色权限、稿件提交与决定发布待接入 |

复用结论为**真实组件与交互复用已验证，精确主题复用待接入**。更早的 HTML/CSS TBM 样板仍使用各自的 `tokens.css`。独立 React 样板的两个场景才共享 `ConfigProvider`。 旧 TBM 教学样板 · 旧视觉样板样式入口 · 独立 B 端样板主题入口
