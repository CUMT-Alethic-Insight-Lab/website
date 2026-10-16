// /admin/recruitment → lab 反代，映射为 lab 侧 /admin（对齐 nginx location = /admin/recruitment）
import { proxyWithFallback } from "../_lib/proxy.js";

export async function onRequest(context) {
  const url = new URL(context.request.url);
  return proxyWithFallback(context.request, context.env, "/admin" + url.search);
}
