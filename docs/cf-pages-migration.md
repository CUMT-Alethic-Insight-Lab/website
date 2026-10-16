# 官网迁移 Cloudflare Pages — 迁移 Runbook

> 状态：方案与构建已验证（2026-10-16），已 push 至 main（commit 7754500），未部署。
> 目标：静态站从「腾讯云 VPS nginx + CF Tunnel 回源」迁到 Cloudflare Pages，VPS 从静态站可用性路径上消失。招新平台（lab 主库 + 云端热备）保持不变，仅入口代理方式改变。

## 0. 现状摘要

- 源码：本仓（与 org website 仓同源），Vite 7 多页工程，`npm run build` → `dist/`。
- 线上：`deploy/push-dist.sh` 推 dist 到 VPS `/var/www/alethicinsight/releases/<ts>`，nginx 监听 `127.0.0.1:80`，公网经 CF Tunnel 回源，TLS 在 CF 边缘终止。
- nginx 上的非静态路径（快照见 `server/deploy/nginx-alethicinsight.vhost.conf`）：
  - `location ^~ /recruitment/` → strip 前缀反代 `lab-origin.alethicinsight.com`（lab 自己的 CF 隧道），lab 故障（502/503/504/520–530）回落 VPS 本地 uvicorn `127.0.0.1:8901` 只读热备（热备拒写，响应带 `X-Alethic-Origin: cloud-standby`）。
  - `location = /admin/recruitment` → 反代 lab 侧 `/admin`，同样的热备回落。
  - 三条规范化 301：`/recruitment`→`/recruitment/`、`/recruitment/admin`→`/admin/recruitment`、`/admin/recruitment/`→`/admin/recruitment`。
  - 缓存策略：`/assets/*` 30d immutable；`*.html|*.json` 5m must-revalidate；图片/字体/PDF 7d。

## 1. 构建与产物验证结论（已做）

- `npm run build` 通过（vite 7.3.6），dist 共约 8.0MB、36 个文件，最大单文件 2.3MB（`flued-experiment-atlas.json`）——远低于 Pages 上限（2.5 万文件、单文件 25MB）。
- `vite preview` 冒烟：9 个代表路径（三个入口页、FLUED 页、JSON、字体、指纹 JS）全部 200。
- Pages 兼容性检查：
  - **无服务端依赖**：纯静态，无 API 调用（flued-demo 的推理调用仅在本机 hostname 下指向 `127.0.0.1:8722`，公网自动回落静态样例 JSON）。
  - **路径引用全部根绝对**（`/assets/...`、`/flued.html`、`/mark.svg`）：站点必须挂在域根——Pages 自定义域正是域根，兼容；`*.pages.dev` 预览域也在根，可正常预览。
  - **无需 SPA fallback**：`src/shell.js` 的 SPA 换页只拦截 `/`、`/index.html`、`/people.html`、`/insights-memory-hierarchy.html` 四个真实存在的文件，其余链接（FLUED、/recruitment）本来就是整页跳转。**不需要** `/* /index.html 200` 式规则。
  - **缓存策略需用 `_headers` 复刻**：Pages 默认不给长缓存，已在 `public/_headers` 对齐 nginx 策略（构建后落入 dist 根）。
- **唯一发现的既有瑕疵**：FLUED 五页里烧死了 CF 邮箱混淆产物（`/cdn-cgi/l/email-protection#...` 链接 + `/cdn-cgi/scripts/5c5dd728/.../email-decode.min.js`）。同 zone 且 Scrape Shield 邮箱混淆开启时继续可用，但脚本 URL 含 CF 内部版本哈希，有腐化风险；建议后续顺手改成普通 `mailto:`（与 index.html 一致）。**不阻塞迁移**。

## 2. Pages 项目创建：Git 集成 vs wrangler 直传

**推荐：Git 集成为主，wrangler 直传仅用于首次引导与应急。** 理由：

| | Git 集成（推荐主路） | wrangler 直传（引导/应急） |
|---|---|---|
| 发布动作 | push 到 main 即自动构建部署 | 本机 `wrangler pages deploy dist` |
| 预览 | 每个 PR/分支自动出 preview 部署 | 无 |
| 回滚 | 控制台一键切回任一历史部署 | 重新部署旧产物 |
| 依赖 | 需 GitHub 连通（本机当前不通，属本机问题非架构问题） | 只需能连 Cloudflare |
| Functions | `functions/` 随仓自动构建 | 同样自动打包（兼容） |

创建参数（两条路一致）：

- 项目名称：`alethicinsight-website`（与 `wrangler.toml` 的 `name` 一致）
- Framework preset：**None**；Build command：`npm run build`；Build output：`dist`
- Node 版本：Vite 7 要求 Node ^20.19 / >=22.12。仓内已加 `.node-version`（内容 `22`），Pages 构建会自动采用；若走控制台覆盖则设环境变量 `NODE_VERSION=22`。
- 生产分支：`main`。

直传引导命令（网络只通 Cloudflare 时先用这条把项目立起来）：

```bash
cd website-spa-proto
npm run build
npx wrangler login                                     # 浏览器授权
npx wrangler pages project create alethicinsight-website --production-branch main
npx wrangler pages deploy dist                         # 同时打包 functions/
```

Functions 的环境变量（控制台 Settings → Environment variables，或 `npx wrangler pages secret put`）：

```
LAB_ORIGIN = https://lab-origin.alethicinsight.com        # 非 secret，默认值已内置，可不设
STANDBY_ORIGIN = https://cloud-standby.alethicinsight.com # 非 secret，默认值已内置，可不设
CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET             # secret，lab 回源挂 CF Access 时必填
```

## 3. 自定义域接入与 DNS 变化

zone 本就在 Cloudflare（现走 CF Tunnel），接入是纯 DNS 变更：

1. Pages 项目 → Custom domains → 添加 `alethicinsight.com`，CF 提示替换现有 DNS 记录时确认——apex 由指向 VPS 隧道的 CNAME（`<tunnel-uuid>.cfargotunnel.com`）改为指向 `<project>.pages.dev`（apex 自动 CNAME flattening）。
2. 同样添加 `www.alethicinsight.com` → `<project>.pages.dev`。建议再加一条 Single Redirect：`www` → apex 301（现状 www 是 nginx 同站服务，迁后建议归一到 apex；不加也能双域同名服务）。
3. 证书：Pages 自定义域自动签发，无需操作。SSL/TLS 模式保持现状。
4. 其余四个域名（alethicinsight.cn/.org、aletheion.cn/.org.cn）的 CF 页面规则 301 到 com，**不动**。
5. VPS 隧道 ingress 里 apex/www 的 public hostname 条目：DNS 切走即失效，**确认切换稳定后再删**，删早了对隧道本身无害但会产生误导性报错。

切换前把 apex/www 两条 DNS 记录截图存档（回滚要用到隧道 UUID）。

## 4. 关键冲突：`/recruitment/*` 与 `/admin/recruitment` 怎么办

约束事实：

- 官网 `index.html` 有 7+ 处 `/recruitment/`、`/recruitment/login` 站内链接。
- **已分发的机试安装包把 `https://alethicinsight.com/recruitment` 烧死在 `cloud_base`**（`exam_kit/config.json`、`exam_server.py`），考场机器无法召回改配置。
- 机试清洗件上传是几十 MB 的 POST body。CF 免费版边缘上传上限 100MB 是**全局限流、现状已存在**（nginx `client_max_body_size 100m` 当年就是为对齐它设的），三个方案都受同一边界约束，不构成区分项。Workers/Pages Functions 免费版 CPU 限制对纯转发可忽略（流式 passthrough 不吃 CPU 时间）。

三方案评估：

| | A. Pages Functions（**推荐**） | B. 独立 Worker + 路由 | C. 拆子域名 recruit. |
|---|---|---|---|
| 机制 | 仓内 `functions/` 反代 lab-origin，含热备回落 | 同左，独立部署，路由 `alethicinsight.com/recruitment/*` 优先于 Pages | apex 纯静态；recruit. 直接 CNAME 到 lab 隧道 |
| URL 兼容性 | `/recruitment/*`、`/admin/recruitment` 原样保留，官网链接、考试包、文档**零改动** | 同 A | 全要改：官网链接、考试包（不可召回）、`PUBLIC_PREFIX`/`ADMIN_PUBLIC_PATH`、lab nginx、文档 |
| 热备回落 | Function 内复刻（已实现，见下） | 同 A | 丢失，需另建 Worker 或接受 lab 宕机即 522 |
| 耦合风险 | 招新代理由网站部署携带——网站回滚会连带回滚代理（但 Pages 回滚是整体原子回滚，风险可控） | 解耦最干净 | 解耦最干净 |
| 运维面 | 一条流水线 | 多一个 wrangler 工程 | 多一组 DNS/域名/跳转（POST 路径跳转须用 308，301/302 会让 curl 丢 body） |

**选 A 的决定性理由**：URL 结构全保留是唯一对已分发考试包零影响的方案；`functions/` 与站点同仓同流水线，Pages Git 集成下零额外部署动作；热备语义已在本仓 `functions/_lib/proxy.js` 里逐条复刻 nginx 行为。B 与 A 能力等价但多一套部署物，只在「网站发布与招新代理必须互不干扰」成为硬诉求时再拆。C 是长期最干净的拓扑，可作为下一代招新季之前的演进方向（届时新安装包改用子域名，旧路径用 308 过渡一届）。

已落地的文件（草稿，已随构建验证）：

- `functions/recruitment/[[path]].js` — `/recruitment*` 反代，strip 前缀打 lab-origin，52x/连接失败回落热备，热备仅 GET/HEAD，写操作 503，回落响应带 `X-Alethic-Origin: cloud-standby`；含 `/recruitment`、`/recruitment/admin` 的防御性 301。
- `functions/admin/recruitment.js` — `/admin/recruitment` → lab 侧 `/admin`，同样回落。
- `functions/_lib/proxy.js` — 共用代理逻辑（下划线目录不参与路由）。
- `public/_redirects` — 三条规范化 301（与 nginx 一致，Functions 内的 301 是双保险）。
- `public/_headers` — 缓存策略对齐 nginx。
- `wrangler.toml` + `.node-version` — 直传配置与构建 Node 版本。

**配套新增（在 VPS 上做，切换前完成）**：热备需要一个不依赖 apex 的入口。在 VPS 隧道加 public hostname `cloud-standby.alethicinsight.com` 指向本机 nginx，并加一个 vhost：

```nginx
# /etc/nginx/sites-available/alethic-standby（新建）
server {
    listen 127.0.0.1:80;
    server_name cloud-standby.alethicinsight.com;
    # Function 已 strip /recruitment 前缀，这里根路径直转热备
    location / {
        if ($request_method !~ ^(GET|HEAD)$) { return 503; }
        proxy_pass http://127.0.0.1:8901;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

（若让 Function 不 strip 直接透传，也可复用现有 vhost 的 `@recruitment_fallback` 逻辑；当前实现取 strip 语义，与打 lab-origin 的请求形状一致，两处共用一段代码。）

## 5. 切换执行清单（顺序）

1. 存档：apex/www 现有 DNS 记录值（隧道 UUID）、隧道 ingress 配置、VPS 当前 release 名。
2. 建 Pages 项目（§2），首次部署后在 `<project>.pages.dev` 冒烟：`/`、三个入口页、FLUED 五页、`/flued-demo-sample.json`、`curl -I` 核对 `_headers` 缓存头、`curl -I https://<project>.pages.dev/recruitment` 应 301。
3. 配 Functions 环境变量/secret（§2）。
4. VPS 侧建 `cloud-standby.alethicinsight.com`（§4 片段），`curl -s https://cloud-standby.alethicinsight.com/api/health` 验证。
5. 在 pages.dev 上验证代理主链：`curl -s https://<project>.pages.dev/recruitment/api/health`（应 200 且**无** `X-Alethic-Origin: cloud-standby`）；再用 POST 探针验证写路径不被热备误接（热备对 POST 应 503——主链正常时该探针直接打 lab）。
6. 验证回落：把 Pages 环境变量 `LAB_ORIGIN` 临时改成不可达地址，重 GET 应回落热备且响应带 `X-Alethic-Origin: cloud-standby`，POST 应 503；验完改回。
7. 添加自定义域 `alethicinsight.com` 与 `www`（§3），DNS 切换即生效（CF 代理记录秒级）。
8. 线上复验第 5 步全部 curl；浏览器过一遍官网主导航与「加入我们」入口。
9. 观察 24–48h 无异常后：删隧道 ingress 里 apex/www 条目；`deploy/push-dist.sh` 归档停用（VPS 上 releases 保留，是回滚的物质基础）。

## 6. 回滚方案

- **DNS 级回滚（主）**：把 apex/www 的 CNAME 改回 `<tunnel-uuid>.cfargotunnel.com`（代理开启）。VPS 的 nginx 与静态 releases 全程未被改动，秒级恢复旧链路。Pages 项目留着无影响。
- **Pages 内容级回滚**：某次部署有问题时，控制台 Deployments 一键切回历史部署（含 Functions，原子）。
- **Functions 级回滚**：代理逻辑出问题时，`git revert` 对应提交或控制台回滚部署；极端情况在 Pages 控制台临时删除 `functions/` 对应路由依赖的环境变量不会停站——静态页照常服务，仅 `/recruitment` 不可用，影响面与 lab+热备双宕相同。
- 任何回滚都不涉及数据迁移（纯静态站 + 反向代理，无状态）。

## 7. 风险与遗留

1. **`/cdn-cgi/` 邮箱混淆产物**（§1）：依赖 zone 的 Scrape Shield 开关与 CF 内部脚本哈希，建议后续改 `mailto:`。
2. **双跳延迟无回归**：现状已是 访客→CF→VPS 隧道→lab 隧道 的双跳；迁后 访客→CF Pages Function→lab 隧道，跳数相同。
3. **弱网大上传的 524 风险**：几十 MB 上传经双跳，边缘 100s TTFB 限制现状同样存在，无回归；考试包本有 `pending_upload/` 本地兜底与监考重传流程。
4. **Pages 免费配额**：10 万请求/天，官网+招新流量远低于此；Functions 与静态请求同池。
5. **本机 GitHub 不通**：只影响「push 触发构建」的启用时点；可先用 wrangler 直传把项目和首版立起来，网络恢复后再绑 Git 集成（Pages 项目可后绑仓库）。
6. **`/dl/kit.exe` 仅在考试包测试夹具里出现**，线上 vhost 无此 location、dist 无此文件——若后续要挂安装包下载，直接放 `public/dl/` 即随 dist 上 Pages，无需额外配置。
7. **VPS 退役边界**：迁移后 VPS 仍承担招新热备（8901）、staging 转发 timer 与隧道；本次只把「静态站可用性」从 VPS 上摘除，VPS 下线的完整评估另立题目。
