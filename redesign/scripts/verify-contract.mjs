import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual, parseArgs } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const baselineRef = 'c9128367e3081b5c0ccdef8dd92af806de7746b5';
const site = 'https://alethicinsight.com';
const siteHosts = new Set(['alethicinsight.com', 'www.alethicinsight.com']);
const reference = {
  'index.html': ['top position structure work focus projects awards documents join direction-llm direction-cv direction-vlm direction-rl direction-agent direction-memory direction-infra'],
  'people.html': ['top join'],
  'insights-memory-hierarchy.html': ['top 引子 坐标系 架构 证据 硬件 预测 结尾'],
  'flued.html': ['top thesis history research-feed evidence roi architecture references boundary', 'flued-segmentation-showcase.json'],
  'flued-architecture.html': ['top evolution pipeline tasks evidence compare frontier code'],
  'flued-demo.html': ['top input segments completion timing', 'flued-demo-sample.json'],
  'flued-evidence.html': ['top curves strict reading', 'flued-training-curves.json'],
  'flued-experiments.html': ['top ledger curves frontier reading', 'flued-experiment-atlas.json'],
};
const legacyRedirects = [
  ['/recruitment', '/recruitment/', '301'],
  ['/recruitment/admin', '/admin/recruitment', '301'],
  ['/admin/recruitment/', '/admin/recruitment', '301'],
];
const dynamic = /^\/(?:login\/?|account\/?|recruitment(?:\/.*)?|admin\/recruitment\/?)$/;
const legacyUI = /^\/assets\/(?:flued(?:Demo|Evidence|Experiments)?|main)-[\w-]+\.(?:js|css)$/;

function readMarkup(html) {
  // For static generated markup. Skip inert templates, comments and raw-text bodies.
  const tags = html.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<template\b[^>]*>[\s\S]*?<\/template\s*>/gi, '')
    .replace(/(<(?:script|style|textarea|title)\b[^>]*>)[\s\S]*?<\/(?:script|style|textarea|title)\s*>/gi, '$1');
  const ids = new Map();
  const links = [];
  for (const tag of tags.matchAll(/<([a-z][\w:-]*)\b((?:[^>"']|"[^"]*"|'[^']*')*)>/gi)) {
    const attrs = new Map();
    for (const attr of tag[2].matchAll(/\s([^\s"'<>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+))/g)) {
      attrs.set(attr[1].toLowerCase(), (attr[2] ?? attr[3] ?? attr[4]).replaceAll('&amp;', '&'));
    }
    const id = attrs.get('id');
    if (id !== undefined) ids.set(id, (ids.get(id) ?? 0) + 1);
    for (const name of ['href', 'src', 'data-account-href']) {
      if (attrs.has(name)) links.push({ name, value: attrs.get(name), rel: attrs.get('rel'), tag: tag[1].toLowerCase() });
    }
  }
  return { ids, links };
}

function run() {
  const { values } = parseArgs({ options: {
    dist: { type: 'string', default: join(root, 'dist') },
    source: { type: 'string', default: join(root, '..', 'Alethic-官网迁移候选') },
    ref: { type: 'string', default: baselineRef },
    help: { type: 'boolean', short: 'h' },
  } });
  if (values.help) {
    console.log('node scripts/verify-contract.mjs [--dist <built directory>] [--source <legacy git checkout>] [--ref <commit SHA>]');
    return;
  }

  const dist = resolve(values.dist);
  const git = (...args) => execFileSync('git', ['-C', resolve(values.source), ...args], { maxBuffer: 32 * 1024 * 1024 });
  const commit = git('rev-parse', '--verify', '--end-of-options', `${values.ref}^{commit}`).toString().trim();
  const source = path => git('show', `${commit}:${path}`);
  const read = path => readFileSync(join(dist, path));
  const failures = new Set();
  const check = (pass, message) => { if (!pass) failures.add(message); };
  const files = new Set(readdirSync(dist, { recursive: true, withFileTypes: true })
    .filter(file => file.isFile())
    .map(file => relative(dist, join(file.parentPath, file.name)).split(sep).join('/')));
  const htmlFiles = [...files].filter(name => name.endsWith('.html'));
  for (const name of ['meeting.html', 'en/meeting.html']) check(!files.has(name), `/${name} 未获批准公开发布`);
  const pages = new Map();
  for (const name of new Set([...Object.keys(reference), ...htmlFiles])) {
    try {
      const html = read(name).toString('utf8');
      check(/<!doctype html\b/i.test(html), `/${name} 缺少 HTML doctype`);
      pages.set(name, readMarkup(html));
    } catch (error) {
      check(false, `无法读取页面 /${name} (${error.code ?? error.message})`);
    }
  }

  let anchors = 0;
  let dataFiles = 0;
  for (const [name, [anchorList, dataName]] of Object.entries(reference)) {
    const sourcePath = name.startsWith('flued') ? `public/${name}` : name;
    const original = readMarkup(source(sourcePath).toString('utf8'));
    for (const id of anchorList.split(' ')) {
      anchors++;
      check(original.ids.get(id) === 1, `基线 ${sourcePath} 的公开锚点 #${id} 缺失或重复，请核对基线版本`);
      check(pages.get(name)?.ids.get(id) === 1, `/${name}#${id} 缺失或重复`);
    }
    if (dataName) {
      dataFiles++;
      try {
        const originalData = JSON.parse(source(`public/${dataName}`).toString('utf8'));
        check(isDeepStrictEqual(JSON.parse(read(dataName).toString('utf8')), originalData), `/${dataName} 数据内容与 ${commit.slice(0, 12)} 不一致`);
      } catch (error) {
        check(false, `无法比较 /${dataName} (${error.code ?? error.message})`);
      }
    }
  }

  const awards = git('ls-tree', '-rz', '--name-only', commit, '--', 'public/awards').toString().split('\0')
    .filter(path => /\.pdf$|\.png$/i.test(path));
  check(awards.length >= 6, '基线少于三组证书 PDF/PNG，请核对基线版本');
  for (const path of awards) {
    const name = path.slice('public/'.length);
    try {
      check(read(name).equals(source(path)), `/${name} 与基线证书文件不一致`);
    } catch (error) {
      check(false, `无法比较 /${name} (${error.code ?? error.message})`);
    }
  }

  for (const name of ['login', 'account', 'recruitment', 'admin/recruitment']) {
    for (const path of [name, `${name}.html`, `${name}/index.html`]) {
      check(!files.has(path), `静态路径 /${path} 占用业务服务路由`);
    }
  }

  for (const path of files) {
    if (path.startsWith('recruitment/')) check(false, `静态文件 /${path} 占用招新服务前缀`);
  }

  const serviceLinks = new Set();
  for (const [page, { ids, links }] of pages) {
    for (const [id, count] of ids) check(count === 1, `/${page} 重复 ID #${id}`);
    check(!ids.has('meeting'), `/${page} 不应包含会议栏目`);
    for (const { name, value, tag, rel } of links) {
      let target;
      try { target = new URL(value, `${site}/${page}`); }
      catch { check(false, `/${page} 包含无效 URL ${value}`); continue; }
      if (!/^https?:$/.test(target.protocol) || !siteHosts.has(target.hostname)) continue;
      const metadata = tag === 'link' && (rel === 'canonical' || rel === 'alternate');
      check(metadata || !/^(?:https?:)?\/\//i.test(value), `/${page} 同站链接写死域名 ${value}，预发会离开当前环境`);
      if (dynamic.test(target.pathname)) {
        if (tag === 'a' && (name === 'href' || name === 'data-account-href')) serviceLinks.add(target.pathname);
        continue;
      }
      check(!legacyUI.test(target.pathname), `/${page} 仍引用旧站 UI ${value}`);
      try {
        const path = decodeURIComponent(target.pathname);
        if (path.split('/').some(part => part === '..' || part.includes('\\') || part.includes(':'))) throw new Error('无效的站内路径');
        const file = path.slice(1) + (path.endsWith('/') ? 'index.html' : '');
        if (pages.has(file)) {
          const id = decodeURIComponent(target.hash.slice(1));
          if (id) check(pages.get(file).ids.get(id) === 1, `/${page} 指向缺失或重复的锚点 ${value}`);
        } else {
          check(files.has(file), `/${page} 指向缺失的文件 ${value}`);
        }
      } catch (error) {
        check(false, `/${page} 无法解析站内引用 ${value} (${error.code ?? error.message})`);
      }
    }
  }
  for (const path of ['/login', '/account', '/recruitment/']) {
    check(serviceLinks.has(path), `公开页面缺少同源入口 ${path}`);
  }

  try {
    const rules = read('_redirects').toString('utf8').split(/\r?\n/).map(line => line.trim())
      .filter(line => line && !line.startsWith('#')).map(line => line.split(/\s+/));
    check(isDeepStrictEqual(rules, legacyRedirects), '/_redirects 应包含三条规范化 301，按部署文档所列顺序');
    const headers = read('_headers').toString('utf8');
    check(!immutableAssetWildcard(headers), '/_headers 对未指纹化的 /assets/* 设置了 immutable');
  } catch (error) {
    check(false, `部署配置缺失或无法读取 (${error.code ?? error.message})`);
  }

  console.log(`基线 ${commit}\n构建目录 ${dist}`);
  console.log(`检查结果 ${pages.size} 个 HTML 文件、${anchors} 个旧公开锚点、${dataFiles} 份 FLUED JSON、${awards.length} 个证书文件。`);
  for (const failure of failures) console.error(`FAIL ${failure}`);
  console.log(failures.size ? `静态合约失败，共 ${failures.size} 项。` : 'PASS 静态合约');
  console.log('待预发验收。HTTP 状态与响应头、浏览器交互、真实登录与会话、报名、后台和机试。脚本仅读取本地文件及 Git 对象。');
  process.exitCode = failures.size ? 1 : 0;
}

function immutableAssetWildcard(headers) {
  return /^\/assets\/\*\s*$\n(?:[ \t]+[^\r\n]*\r?\n)*?[ \t]+cache-control:[^\r\n]*\bimmutable\b/im.test(headers);
}

try {
  run();
} catch (error) {
  console.error(`FAIL 无法执行静态合约检查。${error.message}`);
  process.exitCode = 1;
}
