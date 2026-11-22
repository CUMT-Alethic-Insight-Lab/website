import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('dist/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.pdf': 'application/pdf', '.png': 'image/png', '.svg': 'image/svg+xml' };
const upstream = /^(?:\/(?:login|account|admin\/recruitment)\/?$|\/recruitment(?:\/|$))/;
const redirects = new Map([['/recruitment', '/recruitment/'], ['/recruitment/admin', '/admin/recruitment'], ['/admin/recruitment/', '/admin/recruitment']]);
const port = Number(process.env.ALETHIC_PREVIEW_PORT || 14118);

http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    const redirect = redirects.get(pathname);
    if (redirect) {
      response.writeHead(301, { Location: redirect + url.search }).end();
      return;
    }
    const target = resolve(root, `.${pathname}${pathname.endsWith('/') ? 'index.html' : ''}`);
    const lookup = relative(root, target);
    if (lookup === '..' || lookup.startsWith(`..${sep}`)) {
      response.writeHead(404).end();
      return;
    }
    if (upstream.test(pathname)) {
      response.writeHead(503, { 'Content-Type': types['.html'], 'Cache-Control': 'no-store' }).end('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>业务服务</title><h1>业务服务需要预发环境</h1><p>静态预览未连接招新及账号服务。</p><a href="/">返回首页</a></html>');
      return;
    }
    const content = await readFile(target);
    response.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream' }).end(request.method === 'HEAD' ? undefined : content);
  } catch {
    const notFound = await readFile(resolve(root, '404.html')).catch(() => 'Run npm run build first.');
    response.writeHead(404, { 'Content-Type': types['.html'] }).end(request.method === 'HEAD' ? undefined : notFound);
  }
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/`));
