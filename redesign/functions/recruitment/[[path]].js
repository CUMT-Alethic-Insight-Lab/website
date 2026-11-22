// /recruitment/* → lab 反代，strip /recruitment 前缀（lab 应用挂在根路径）
import { proxyWithFallback } from "../_lib/proxy.js";

export async function onRequest(context) {
  const url = new URL(context.request.url);

  // 对齐 nginx 的规范化 301（_redirects 之外的防御）
  if (url.pathname === "/recruitment") {
    return Response.redirect(url.origin + "/recruitment/" + url.search, 301);
  }
  if (url.pathname === "/recruitment/admin") {
    return Response.redirect(url.origin + "/admin/recruitment" + url.search, 301);
  }

  const stripped = url.pathname.slice("/recruitment".length) || "/";
  return proxyWithFallback(context.request, context.env, stripped + url.search);
}
