import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const origin = process.env.ALETHIC_QA_ORIGIN || 'http://127.0.0.1:14118';
export const recording = process.env.ALETHIC_QA_RECORD === '1';
export const output = process.env.ALETHIC_QA_OUTPUT || fileURLToPath(new URL('../qa-output/runtime/', import.meta.url));
export const routes = ['/', '/people.html', '/insights-memory-hierarchy.html', '/meeting.html', '/flued.html', '/flued-architecture.html', '/flued-demo.html', '/flued-evidence.html', '/flued-experiments.html'];
export const localize = (lang, route) => `${lang === 'en' ? '/en' : ''}${route}`;
export const routeName = route => route === '/' ? 'home' : route.slice(1, -5);
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export const digest = data => createHash('sha256').update(data).digest('hex');
export const pathOf = url => { const { pathname, search, hash } = new URL(url); return pathname + search + hash; };
export const localPortals = ['/login', '/account', '/recruitment/', '/admin/recruitment'];

export async function launch() {
  const driver = process.env.ALETHIC_PUPPETEER
    ? pathToFileURL(resolve(process.env.ALETHIC_PUPPETEER))
    : new URL('../../Alethic-官网迁移候选/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js', import.meta.url);
  const { default: puppeteer } = await import(driver.href);
  return puppeteer.launch({ executablePath: process.env.ALETHIC_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
}

export function viewport(page, width, height = width < 700 ? 844 : 900) {
  const mobile = width < 700;
  return page.setViewport({ width, height, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 });
}

export async function open(page, path, status = 200) {
  const nav = { waitUntil: 'domcontentloaded' };
  const response = await page.goto(new URL(path, origin).href, nav) ?? await page.reload(nav);
  assert.equal(response?.status(), status, `${path} HTTP`);
  await page.evaluate(() => document.fonts.ready.then(() => true));
  return response;
}

export function watch(page, errors, optional = []) {
  const report = (type, detail) => errors.push({ type, page: page.url(), detail });
  page.on('pageerror', error => report('pageerror', error.message));
  page.on('console', msg => {
    const source = msg.location().url;
    if (msg.type() !== 'error') return;
    if (/Failed to load resource/.test(msg.text()) && optional.some(url => source === url)) return;
    if (!/Failed to load resource.*(?:404|503)/.test(msg.text())) report('console', msg.text());
  });
  page.on('response', response => {
    const { pathname } = new URL(response.url());
    if (response.status() < 400 || /^\/(?:en\/)?qa-not-found$/.test(pathname)) return;
    if (new URL(response.url()).origin === new URL(origin).origin && localPortals.includes(pathname) && response.status() === 503) return;
    report('response', `${response.status()} ${response.url()}`);
  });
  page.on('requestfailed', request => {
    if (optional.includes(request.url()) && request.failure()?.errorText === 'net::ERR_CONNECTION_REFUSED') return;
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') report('requestfailed', `${request.failure()?.errorText} ${request.url()}`);
  });
}

export async function releaseInfo() {
  const response = await fetch(new URL('/', origin), { cache: 'no-store' });
  assert.ok(response.ok, 'preview homepage HTTP');
  const html = await response.text();
  const css = html.match(/\/assets\/[^/]+\/drawing\.css/)?.[0];
  assert.ok(css, 'built homepage has a fingerprinted drawing stylesheet');
  return { css, homepageSha256: digest(html) };
}

export async function suite(name, run) {
  const release = await releaseInfo();
  const browser = await launch();
  const result = { origin, startedAt: new Date().toISOString(), release, browser: await browser.version(), recording, checks: [], errors: [] };
  const check = async (label, callback) => {
    const start = performance.now();
    let entry;
    try {
      const data = await callback();
      entry = { label, status: 'pass', data };
    } catch (error) {
      entry = { label, status: 'fail', detail: error.stack || String(error) };
      process.exitCode = 1;
    }
    result.checks.push({ ...entry, ms: Math.round(performance.now() - start) });
    console.log(`${entry.status.toUpperCase()} ${label}${entry.detail ? ` — ${entry.detail.split('\n')[0]}` : ''}`);
  };
  const save = async (filename, data) => {
    if (!recording) return;
    await mkdir(output, { recursive: true });
    await writeFile(resolve(output, filename), data);
  };
  const shot = async (page, filename, options = {}) => {
    if (!recording) return;
    await mkdir(output, { recursive: true });
    const { clip, ...rest } = options;
    const offset = clip ? await page.evaluate(() => ({ x: visualViewport.pageLeft, y: visualViewport.pageTop })) : null;
    const documentClip = clip && { ...clip, x: clip.x + offset.x, y: clip.y + offset.y };
    const pixels = await page.screenshot({
      path: resolve(output, filename), ...rest,
      ...(documentClip ? { clip: documentClip, captureBeyondViewport: false } : {}),
    });
    assert.ok(pixels.byteLength > (clip && clip.height < 200 ? 300 : 5000), `unexpectedly sparse screenshot ${filename}`);
  };
  try {
    await run({ browser, result, check, shot, save });
    await check('served build consistent', async () => assert.deepEqual(await releaseInfo(), release));
    await check('browser errors', () => assert.deepEqual(result.errors, []));
  } finally {
    await browser.close();
    result.finishedAt = new Date().toISOString();
    await save(`${name}.json`, JSON.stringify(result, null, 2));
  }
}

const referenceLabels = {
  zh: ['研究', '公开项目', '竞赛成果', '成员', '文档', '会议', '加入'],
  en: ['Research', 'Projects', 'Awards', 'People', 'Documents', 'Meetings', 'Join'],
};
const navTargets = ['/#position', '/#work', '/#projects', '/#awards', '/people.html', '/#documents', '/meeting.html', '/#join'];
const referenceNav = { image: [1852, 283], x: 44, y: 143, width: 1739, height: 63, columns: [290, 290, 289, 145, 290, 145, 290] };

async function inspectHeader(page) {
  return page.$eval('.site-header', header => {
    function box(el) {
      if (!el) return null;
      const { x, y, width, height } = el.getBoundingClientRect();
      return Object.fromEntries(Object.entries({ x, y, width, height }).map(([key, value]) => [key, Math.round(value * 10) / 10]));
    }
    const nav = header.querySelector('.route-register');
    const identity = header.querySelector('.identity');
    const logo = identity?.querySelector('img, svg');
    return {
      head: box(header), mast: box(header.querySelector('.mast')), nav: box(nav), identity: box(identity),
      logo: logo && { box: box(logo), source: logo.currentSrc || logo.outerHTML, loaded: !('complete' in logo) || (logo.complete && logo.naturalWidth > 0) },
      items: Array.from(nav?.querySelectorAll('a[href]') || [], a => {
        const label = a.cloneNode(true);
        label.querySelectorAll('[aria-hidden="true"]').forEach(node => node.remove());
        const text = document.createRange();
        text.selectNodeContents(a);
        return { label: label.textContent.trim().replace(/\s+/g, ' '), href: a.href, box: box(a), textBox: box(text), fontSize: getComputedStyle(a).fontSize };
      }),
      utilities: Array.from(header.querySelectorAll('.utilities a, .utilities button:not([hidden])'), node => ({ label: node.innerText.trim(), href: node.href, box: box(node) })),
      manualControl: Boolean(header.querySelector('[data-motion-toggle], button[aria-label*="Pause motion" i]')),
    };
  });
}

function isPortal(href, path) {
  const url = new URL(href);
  return [new URL(origin).host, 'alethicinsight.com', 'www.alethicinsight.com'].includes(url.host) && url.pathname.replace(/\/$/, '') === path.replace(/\/$/, '');
}

async function verifyHeader(header, lang, width, data) {
  const primary = header.items;
  const expectedLabels = [lang === 'en' ? 'About' : '定位', ...referenceLabels[lang]];
  const expectedTargets = navTargets.map(route => localize(lang, route));
  const actual = primary.map(item => pathOf(item.href));
  data.referenceLabels = referenceLabels[lang];
  data.expectedLabels = expectedLabels;
  data.addedLabels = primary.map(item => item.label).filter(label => !referenceLabels[lang].includes(label));
  data.removedLabels = referenceLabels[lang].filter(label => !primary.some(item => item.label === label));
  assert.deepEqual(primary.map(item => item.label), expectedLabels, 'primary labels and order');
  assert.ok(primary.every(item => item.label && item.textBox?.width && item.box?.height), 'all primary links have visible labels');
  assert.ok(expectedTargets.every(target => actual.includes(target) || (target.endsWith('#join') && primary.some(item => isPortal(item.href, '/recruitment/')))), 'all eight destinations remain reachable in primary navigation');
  assert.equal(header.manualControl, false, 'no manual pause UI');
  assert.ok(header.logo?.loaded && header.logo.box?.width > 0 && header.logo.box?.height > 0, 'visible authentic logo');
  const markup = header.logo.source.startsWith('<svg') ? header.logo.source : await (await fetch(header.logo.source)).text();
  data.logoSha256 = digest(markup);
  // Original mark geometry from c912836:public/mark.svg. Allow reserialization and inline use.
  assert.match(markup, /M\s*19[\s,]+46\s*L\s*29\.5[\s,]+18\s*H\s*34\.5\s*L\s*45[\s,]+46/i, 'original Alethic A geometry');
  assert.match(markup, /#7b93ff/i, 'original mark accent');
  if (width === 390) {
    const rows = new Set(primary.map(item => Math.round(item.box.y)));
    assert.equal(rows.size, 2, '390 px navigation forms two rows of four');
    assert.ok(Math.max(...primary.map(item => item.box.width)) - Math.min(...primary.map(item => item.box.width)) <= 1, '390 px navigation has equally wide cells');
  }
  if (width === 1852) {
    const rows = new Set(primary.map(item => Math.round(item.box.y)));
    assert.equal(rows.size, 1, '1852 px navigation forms one row');
    assert.ok(Math.max(...primary.map(item => item.box.width)) - Math.min(...primary.map(item => item.box.width)) <= 1, '1852 px navigation has equally wide cells');
    primary.forEach(({ textBox: text, box }) => {
      assert.ok(text.x >= box.x - 1 && text.x + text.width <= box.x + box.width + 1, '1852 px labels fit their cells');
      assert.ok(text.y >= box.y - 1 && text.y + text.height <= box.y + box.height + 1, '1852 px labels fit vertically');
    });
  }
}

async function scanLocalLinks(page) {
  return page.$$eval('a[href]', links => Array.from(new Set(links.map(a => a.href).filter(href => {
    const url = new URL(href);
    return url.origin === location.origin && /^(?:\/|\/en\/|.*\.(?:html|pdf|png))$/.test(url.pathname);
  }))));
}

async function checkLocalLinks(browser, links) {
  const targets = new Map();
  for (const href of links) {
    const url = new URL(href);
    const hash = decodeURIComponent(url.hash.slice(1));
    url.hash = '';
    if (!targets.has(url.href)) targets.set(url.href, new Set());
    if (hash) targets.get(url.href).add(hash);
  }
  const page = await browser.newPage();
  try {
    await open(page, '/');
    const failures = await page.evaluate(async targets => {
      return (await Promise.all(targets.map(async ([url, ids]) => {
        try {
          const response = await fetch(url);
          if (!response.ok) return { url, status: response.status };
          if (!ids.length) return null;
          const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
          const missing = ids.filter(id => !doc.getElementById(id) && !doc.getElementsByName(id).length);
          return missing.length ? { url, missing } : null;
        } catch (error) { return { url, error: error.message }; }
      }))).filter(Boolean);
    }, Array.from(targets, ([url, ids]) => [url, [...ids]]));
    assert.deepEqual(failures, []);
    return { uniqueLinks: links.size, uniqueTargets: targets.size };
  } finally {
    await page.close();
  }
}

async function main() {
  await suite('browser-qa', async ({ browser, result, check, shot }) => {
    const page = await browser.newPage();
    watch(page, result.errors);
    // Main matrix represents 18 routes. Each width also checks page identity and renderability.
    const links = new Set();
    result.layouts = {};
    for (const lang of ['zh', 'en']) {
      for (const width of [1852, 1440, 390, 320]) {
        await viewport(page, width);
        await check(`${lang} ${width}px · page matrix`, async () => {
          const failures = [];
          for (const route of routes) {
            try {
              await open(page, localize(lang, route));
              assert.equal(pathOf(page.url()), localize(lang, route));
              const data = await page.evaluate(() => ({
                lang: document.documentElement.lang, title: document.title,
                headings: [...document.querySelectorAll('h1')].map(node => node.textContent.trim()),
                main: document.querySelector('main')?.innerText.trim().length,
                width: innerWidth, docWidth: document.documentElement.scrollWidth,
                poster: document.querySelector('vite-error-overlay, #webpack-dev-server-client-overlay, nextjs-portal')?.nodeName,
              }));
              assert.match(data.lang, lang === 'en' ? /^en\b/ : /^zh\b/);
              assert.match(data.title, /Alethic Insight/);
              assert.equal(data.headings.length, 1);
              assert.ok(data.headings[0] && data.main > 80 && !data.poster, 'rendered page content');
              assert.equal(data.width, width, 'viewport CSS width');
              assert.ok(data.docWidth <= data.width + 1, `horizontal spill ${data.docWidth} > ${data.width}`);
              if (width === 1852) (await scanLocalLinks(page)).forEach(link => links.add(link));
            } catch (error) {
              failures.push(`${route} ${error.message}`);
            }
          }
          assert.deepEqual(failures, []);
          return { count: routes.length };
        });
        if (width !== 1852 && width !== 390) continue;
        await check(`${lang} ${width}px · header and original mark`, async () => {
          await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: width === 1852 ? 'dark' : 'light' }]);
          await open(page, localize(lang, '/#entry'));
          await page.waitForSelector('.site-header');
          await page.$eval('.site-header', el => el.scrollIntoView({ block: 'start', behavior: 'instant' }));
          await page.waitForFunction(() => !document.documentElement.hasAttribute('data-transit'), { timeout: 5000 });
          const header = await inspectHeader(page);
          const data = result.layouts[`${lang}-${width}`] = { ...header, referenceNav };
          await shot(page, `${lang}-${width}-navigation.png`, width === 1852 ? { clip: { x: 0, y: 0, width, height: 283 } } : {});
          await verifyHeader(header, lang, width, data);
        });
      }
    }
    await check('local static destinations and fragments', () => checkLocalLinks(browser, links));
    await check('business and organization links resolve from each language', async () => {
      const ports = result.portals = [];
      for (const lang of ['zh', 'en']) {
        await open(page, localize(lang, '/#entry'));
        const links = await page.$$eval('a[href]', list => list.map(a => ({ href: a.href, label: a.textContent.trim() })));
        for (const url of ['https://github.com/CUMT-Alethic-Insight-Lab', 'https://huggingface.co/Alethic-Insight']) {
          assert.ok(links.some(link => link.href === url), lang + ' organization portal ' + url);
          ports.push({ lang, href: url, check: 'link destination' });
        }
        for (const path of localPortals.slice(0, 3)) {
          const link = links.find(a => isPortal(a.href, path));
          assert.ok(link, `${lang} business link ${path}`);
          const portal = { lang, ...link };
          ports.push(portal);
          if (new URL(link.href).origin === new URL(origin).origin) {
            const response = await page.evaluate(async href => {
              const res = await fetch(href);
              return { status: res.status, url: res.url, type: res.headers.get('content-type'), cache: res.headers.get('cache-control'), text: await res.text() };
            }, link.href);
            Object.assign(portal, { status: response.status, final: response.url, cache: response.cache });
            assert.ok([200, 503].includes(response.status) && response.type?.includes('text/html'), path);
            if (response.status === 503) assert.match(response.text, /静态预览未连接招新及账号服务/);
          }
        }
      }
    });
    await check('theme, language and fragment preference', async () => {
      await viewport(page, 1440);
      await open(page, '/#work');
      const old = await page.$eval('html', el => el.dataset.theme);
      await page.click('[data-theme-toggle]');
      const theme = await page.$eval('html', el => el.dataset.theme);
      assert.ok(theme && theme !== old);
      await page.click('[data-language]');
      await page.waitForFunction(() => document.documentElement.lang === 'en' && location.hash === '#work' && !document.documentElement.hasAttribute('data-transit'));
      assert.equal(pathOf(page.url()), '/en/#work');
      await open(page, '/en/flued.html');
      assert.equal(await page.$eval('html', el => el.dataset.theme), theme);
      await open(page, '/#documents');
      assert.equal(pathOf(page.url()), '/en/#documents');
      await page.evaluate(() => localStorage.clear());
      return { theme, localizedDestination: '/en/#documents' };
    });
    await check('meeting deep link and keyboard tabs', async () => {
      await open(page, '/meeting.html#stage-review');
      await page.waitForSelector('[data-meeting][data-mounted]');
      const selected = () => page.$eval('[role="tab"][aria-selected="true"]', node => node.hash);
      assert.equal(await selected(), '#stage-review');
      await page.focus('[role="tab"][aria-selected="true"]');
      await page.keyboard.press('End');
      const last = await selected();
      assert.equal(last, new URL(page.url()).hash);
      assert.equal(await page.$$eval('[data-stage-panel]:not([hidden])', nodes => nodes.length), 1);
      await page.keyboard.press('Home');
      assert.notEqual(await selected(), last);
      assert.equal(await page.evaluate(() => document.activeElement.hash), await selected());
    });
    await check('FLUED playback, metric and search input', async () => {
      await open(page, '/flued-demo.html?autorun=sample#input');
      await page.waitForFunction(() => document.querySelector('[data-f-model]')?.options.length === 5);
      await page.waitForFunction(() => document.querySelector('[data-f-completion]')?.innerText.trim().length > 25);
      await open(page, '/en/flued-evidence.html#curves');
      await page.waitForFunction(() => document.querySelector('[data-f-metric]')?.options.length >= 2);
      const old = await page.$eval('[data-f-metric]', el => el.value);
      await page.focus('[data-f-metric]');
      await page.keyboard.press('End');
      assert.notEqual(await page.$eval('[data-f-metric]', el => el.value), old);
      await page.waitForSelector('[data-f-plot] canvas');
      await open(page, '/en/flued-experiments.html#ledger');
      await page.waitForSelector('.f-ledger article');
      await page.type('[data-f-query]', '__no_such_experiment__');
      await page.waitForFunction(() => !document.querySelector('.f-ledger article'));
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await page.waitForSelector('.f-ledger article');
    });
    await check('unknown path uses accessible 404', async () => {
      await open(page, '/qa-not-found', 404);
      assert.match(await page.title(), /找不到这一页|Page not found/);
      assert.ok(await page.$('main a[href="/"]'));
    });
  });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main();
