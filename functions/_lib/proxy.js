// 招新平台反代共用逻辑（下划线目录不参与 Pages Functions 路由）
// 语义对齐 server/deploy/nginx-alethicinsight.vhost.conf 的 lab_origin upstream + 热备回落。
//
// Pages 项目需配置的变量（Settings → Environment variables）：
//   LAB_ORIGIN            默认 https://lab-origin.alethicinsight.com
//   STANDBY_ORIGIN        默认 https://cloud-standby.alethicinsight.com
//   CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET（secret，lab 回源挂 CF Access 时必填）

const FALLBACK_STATUSES = new Set([502, 503, 504, 520, 521, 522, 523, 524, 525, 526, 530]);

export async function proxyWithFallback(request, env, upstreamPath) {
  const labOrigin = (env.LAB_ORIGIN || "https://lab-origin.alethicinsight.com").replace(/\/$/, "");
  const standbyOrigin = (env.STANDBY_ORIGIN || "https://cloud-standby.alethicinsight.com").replace(/\/$/, "");

  let res;
  try {
    res = await fetch(buildUpstreamRequest(request, labOrigin, upstreamPath, env));
  } catch {
    res = null; // 连接失败视同 52x，走热备
  }

  if (res && !FALLBACK_STATUSES.has(res.status)) return res;

  // 热备仅读：写操作在 lab 不可达时直接 503（对齐 nginx if ($request_method !~ ^(GET|HEAD)$)）
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("lab unreachable, writes disabled on standby", { status: 503 });
  }
  const standbyRes = await fetch(buildUpstreamRequest(request, standbyOrigin, upstreamPath, env));
  const headers = new Headers(standbyRes.headers);
  headers.set("X-Alethic-Origin", "cloud-standby");
  return new Response(standbyRes.body, { status: standbyRes.status, headers });
}

function buildUpstreamRequest(request, origin, path, env) {
  const upstream = new URL(path, origin + "/");
  const headers = new Headers(request.headers);
  headers.set("Host", upstream.host);
  headers.set("X-Forwarded-Host", new URL(request.url).host);
  headers.set("X-Forwarded-Proto", "https");
  if (env.CF_ACCESS_CLIENT_ID) headers.set("CF-Access-Client-Id", env.CF_ACCESS_CLIENT_ID);
  if (env.CF_ACCESS_CLIENT_SECRET) headers.set("CF-Access-Client-Secret", env.CF_ACCESS_CLIENT_SECRET);
  return new Request(upstream, new Request(request, { headers }));
}
