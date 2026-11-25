import { proxyWithFallback } from "./_lib/proxy.js";

// Match the same-origin aliases used by the production nginx entrypoint.
export function onRequest({ request, env }) {
  return proxyWithFallback(request, env, "/login" + new URL(request.url).search);
}
