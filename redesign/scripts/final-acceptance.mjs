import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digest, launch, open, origin, releaseInfo, routes, sleep, viewport, watch } from './browser-qa.mjs';
import { record, stableScroll, tabTo } from './home-film.mjs';

const out = process.env.ALETHIC_FINAL_OUTPUT || fileURLToPath(new URL('../qa-output/final/', import.meta.url));
const widths = [320, 390, 768, 1440];
const languages = ['zh', 'en'];
const aliases = { about: 'position', structure: 'structure', research: 'work', focus: 'focus', projects: 'projects',
  awards: 'awards', agreement: 'work-mode', documents: 'documents', join: 'join' };
const pages = [...routes, ...Object.keys(aliases).map(name => `/${name}.html`)];
const wait = { timeout: 7000 };
const hero = '.opening';
const header = '[data-site-header]';
const dock = '[data-site-preferences]';
const menuToggle = '[data-site-nav-toggle]';
const scene = 'canvas.page-scene';
const essay = '/insights-memory-hierarchy.html';
const toc = '.ed-paper > .ed-index';
const award = i => `[data-award-pick="${i}"]`;
const localePath = (lang, path = '/') => `${lang === 'en' ? '/en' : ''}${path}`;
const pathname = url => new URL(url).pathname;
const save = (name, data) => writeFile(resolve(out, name), JSON.stringify(data, null, 2) + '\n');
const ffmpeg = process.env.ALETHIC_FFMPEG || 'ffmpeg';

async function options(page, width, theme = 'light', reduce = false) {
  await viewport(page, width);
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme },
    { name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }]);
}

async function clickHandle(page, element) {
  if (page.viewport().hasTouch) await element.tap();
  else await element.click();
}

async function click(page, selector) {
  const hit = await page.waitForFunction(selector => [...document.querySelectorAll(selector)].find(node =>
    node.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && !node.closest('[inert]')), wait, selector);
  try {
    const element = hit.asElement();
    const inView = await element.evaluate(node => {
      const box = node.getBoundingClientRect();
      return box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth;
    });
    if (!inView) await element.scrollIntoView();
    const ready = await page.waitForFunction(node => {
      const box = node.getBoundingClientRect();
      return node.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)) &&
        !node.getAnimations({ subtree: false }).some(animation => animation.playState === 'running');
    }, wait, element);
    await ready.dispose();
    await clickHandle(page, element);
  } finally { await hit.dispose(); }
}

async function position(page, selector) {
  return page.$eval(selector, node => {
    const r = node.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    const chrome = document.querySelector('[data-site-header]')?.getBoundingClientRect();
    return { x, y, top: r.top, bottom: r.bottom, left: r.left, right: r.right, header: chrome?.bottom || 0,
      view: innerHeight, hittable: node.contains(hit), focused: document.activeElement === node, hitTag: hit?.tagName };
  });
}

async function hover(page, selector) {
  const p = await position(page, selector);
  assert.ok(p.hittable, `Pointer cannot reach ${selector}: ${JSON.stringify(p)}`);
  await page.mouse.move(p.x, p.y);
}

async function rootAt(page, hash, lang = 'zh') {
  await open(page, localePath(lang, '/') + hash);
  await stableScroll(page);
}

async function atHash(page, hash) {
  await page.waitForFunction(hash => decodeURIComponent(location.hash) === hash && !document.documentElement.hasAttribute('data-anchor-travel'), wait, hash);
  await stableScroll(page);
}

async function expanded(page, selector, desired) {
  await page.waitForFunction(({ selector, desired }) => document.querySelector(selector)?.getAttribute('aria-expanded') === String(desired), wait, { selector, desired });
}

async function navGroup(page, chapter) {
  const link = `[data-site-chapter="${chapter}"]`;
  const button = `[data-site-group]:has(${link}) [data-site-disclosure]`;
  if (await page.$eval(menuToggle, node => node.checkVisibility() && node.getAttribute('aria-expanded') === 'false')) await click(page, menuToggle);
  if (await page.$eval(button, node => node.getAttribute('aria-expanded')) !== 'true') await click(page, button);
  await expanded(page, button, true);
  await page.$eval(link, async node => {
    const panel = node.closest('.site-nav-flyout');
    if (panel) await Promise.allSettled(panel.getAnimations().map(animation => animation.finished));
  });
  return { button, link };
}

async function freezeReady(page) {
  await page.waitForSelector('main[data-page]', wait);
  await page.waitForFunction(() => Boolean(document.documentElement.dataset.theme && document.documentElement.dataset.motion), wait);
  await page.evaluate(() => document.fonts.ready.then(() => true));
}

async function staticAssets(page, result) {
  await options(page, 1440);
  await rootAt(page, '#position');
  const referenceRef = 'c9128367e3081b5c0ccdef8dd92af806de7746b5';
  const logo = await page.$eval(`${header} img.brand-logo`, image => ({ src: new URL(image.src).pathname, alt: image.alt,
    width: image.naturalWidth, height: image.naturalHeight, brand: image.closest('a')?.getAttribute('aria-label') }));
  assert.equal(logo.src, '/mark.svg');
  assert.ok(logo.width && logo.height && logo.brand);
  const response = await fetch(new URL(logo.src, origin));
  assert.equal(response.status, 200);
  const bytes = Buffer.from(await response.arrayBuffer());
  const original = execFileSync('git', ['-C', fileURLToPath(new URL('../../Alethic-官网迁移候选/', import.meta.url)), 'show', `${referenceRef}:public/mark.svg`], { windowsHide: true });
  assert.equal(digest(bytes), digest(original), 'Header logo differs from original site asset');
  result.logo = { ...logo, sha256: digest(bytes), baseline: referenceRef };
  result.organization = await page.$$eval(`${header} a[href^="https:"]`, links => links.map(a => ({ href: a.href, name: a.getAttribute('aria-label') || a.textContent.trim() })));
  assert.ok(result.organization.some(a => a.href === 'https://github.com/CUMT-Alethic-Insight-Lab' && a.name));
  assert.ok(result.organization.some(a => a.href === 'https://huggingface.co/Alethic-Insight' && a.name));
}

async function coldMatrix(browser, result, width, lang, attach) {
  result.pages = [];
  for (const address of pages) {
    const context = await browser.createBrowserContext();
    const row = { address, errors: [] };
    try {
      const page = await context.newPage();
      await attach(page, row.errors);
      await options(page, width);
      await page.setCacheEnabled(false);
      await open(page, localePath(lang, address));
      const name = address.split('/').at(-1).replace(/\.html$/, '');
      if (aliases[name]) await atHash(page, `#${aliases[name]}`);
      await freezeReady(page);
      Object.assign(row, await page.evaluate(() => {
        const main = document.querySelector('main');
        const id = document.querySelector('h1') || document.querySelector('.opening');
        return { path: location.pathname, lang: document.documentElement.lang, file: main.dataset.page, title: document.title,
          heading: id?.textContent.trim().slice(0, 90), width: innerWidth,
          documentWidth: document.documentElement.scrollWidth, mainWidth: main.scrollWidth, mainClient: main.clientWidth,
          badMedia: [...document.images].filter(img => img.complete && !img.naturalWidth && img.loading !== 'lazy').map(img => img.src),
          appOverlays: document.querySelectorAll('vite-error-overlay,nextjs-portal').length };
      }));
      assert.equal(row.path, localePath(lang, aliases[name] ? '/' : address));
      assert.equal(row.file, aliases[name] || address === '/' ? 'index.html' : `${name}.html`);
      assert.match(row.lang, new RegExp(`^${lang}(?:-|$)`, 'i'));
      assert.ok(row.title && row.heading, 'No meaningful main heading or opening');
      assert.equal(row.width, width);
      assert.ok(row.documentWidth <= width + 1 && row.mainWidth <= row.mainClient + 1, 'Horizontal overflow');
      assert.ok(!row.badMedia.length && !row.appOverlays && !row.errors.length);
      row.status = 'pass';
    } catch (error) { row.status = 'fail'; row.issue = error.message; }
    finally { await context.close(); }
    result.pages.push(row);
  }
  const failures = result.pages.filter(row => row.status === 'fail');
  assert.ok(!failures.length, failures.map(row => `${row.address}: ${row.issue}`).join(' | '));
}

async function preferences(page, result, width, lang) {
  await options(page, width, 'dark');
  await rootAt(page, '#work', lang);
  const summary = `${dock} > summary`;
  const theme = `${dock} [data-theme-toggle]`;
  const system = `${dock} [data-theme-system]`;
  const mirror = `${dock} [data-language]`;
  const use = async selector => {
    if (page.viewport().hasTouch) await click(page, selector);
    else {
      if (selector !== summary) await page.$eval(selector, async node => {
        const panel = node.closest('.site-preferences-panel');
        await Promise.allSettled(panel.getAnimations().map(animation => animation.finished));
      });
      await tabTo(page, selector, 90);
      await page.keyboard.press('Enter');
    }
  };
  assert.equal(await page.$eval(dock, node => node.closest('[data-site-header]')), null);
  assert.equal(await page.$eval('html', node => node.dataset.theme), 'dark');
  if (!page.viewport().hasTouch) await page.focus(`${header} .identity`);
  await use(summary);
  await use(theme);
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light', wait);
  await use(system);
  assert.equal(await page.$eval('html', node => node.dataset.theme), 'dark');
  if (!page.viewport().hasTouch) {
    await page.keyboard.press('Escape');
    assert.ok(await page.$eval(summary, node => node === document.activeElement && !node.parentElement.open));
    await page.keyboard.press('Enter');
  }
  if (!(await page.$eval(dock, node => node.open))) await use(summary);
  const other = lang === 'zh' ? 'en' : 'zh';
  await use(mirror);
  await page.waitForFunction(path => location.pathname === path, wait, localePath(other));
  await stableScroll(page);
  result.mirror = await page.evaluate(() => ({ path: location.pathname, hash: location.hash, theme: document.documentElement.dataset.theme, active: document.querySelector('main').dataset.activePage }));
  assert.equal(result.mirror.theme, 'dark');
  assert.equal(result.mirror.active, 'research.html');
}

async function canvasState(page, selector, parts) {
  return page.$eval(selector, (canvas, parts) => {
    const { width, height } = canvas;
    const surface = new OffscreenCanvas(width, height);
    const pen = surface.getContext('2d', { willReadFrequently: true });
    pen.drawImage(canvas, 0, 0);
    return parts.map(([a, b, c, d]) => {
      const rgba = pen.getImageData(Math.floor(a * width), Math.floor(b * height), Math.max(1, Math.floor((c - a) * width)), Math.max(1, Math.floor((d - b) * height))).data;
      let hash = 2166136261, painted = 0;
      for (let i = 0; i < rgba.length; i += 4) {
        if (rgba[i + 3]) painted++;
        hash = Math.imul(hash ^ (rgba[i] | rgba[i+1] << 8 | rgba[i+2] << 16 | rgba[i+3] << 24), 16777619);
      }
      return { hash: hash >>> 0, painted };
    });
  }, parts);
}

async function opening(page, result, width, theme, reduce, marker = async () => {}) {
  const original = await page.evaluate(() => performance.timeOrigin);
  const selector = `${hero} canvas`;
  await page.waitForSelector(`${hero}[data-ready]`, { ...wait, visible: true });
  result.colors = await page.$eval(hero, node => {
    const s = getComputedStyle(node);
    return { chosen: document.documentElement.dataset.theme, background: s.getPropertyValue('--opening').trim(), color: s.color, size: node.getBoundingClientRect().height };
  });
  assert.equal(result.colors.chosen, theme);
  assert.ok(Math.abs(result.colors.size - page.viewport().height) < 3);
  const swatch = result.colors.background.match(/^#([0-9a-f]{6})$/i)?.[1];
  assert.ok(swatch, 'Opening color token missing');
  const [r, g, b] = [0, 2, 4].map(offset => parseInt(swatch.slice(offset, offset + 2), 16));
  const lightness = (.2126 * r + .7152 * g + .0722 * b) / 255;
  assert.ok(theme === 'light' ? lightness > .65 : lightness < .4);
  const regions = [[.22, .30, .78, .72], [.08, .07, .92, .22]];
  result.idle = [];
  for (let i = 0; i < 5; i++) { result.idle.push(await canvasState(page, selector, regions)); if (i < 4) await sleep(180); }
  for (const i of [0, 1]) {
    assert.ok(result.idle.every(pair => pair[i].painted > 15));
    assert.ok(new Set(result.idle.map(pair => pair[i].hash)).size >= (reduce ? 1 : 3));
    if (reduce) assert.equal(new Set(result.idle.map(pair => pair[i].hash)).size, 1);
  }
  await page.evaluate(() => {
    const opener = document.querySelector('.opening');
    const header = document.querySelector('[data-site-header]');
    const position = document.getElementById('position');
    const rows = [];
    window.__finalHandoff = rows;
    const measure = progress => {
      const a = opener.getBoundingClientRect(), b = header.getBoundingClientRect(), c = position.getBoundingClientRect();
      rows.push({ progress, ms: performance.now(), y: scrollY, openingBottom: a.bottom, headerTop: b.top,
        headerBottom: b.bottom, positionTop: c.top, document: performance.timeOrigin });
    };
    document.addEventListener('alethic:handoff', event => measure(event.detail.progress));
    const start = performance.now();
    const tick = now => {
      measure(null);
      if (now - start < 3000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await marker('enter');
  await click(page, `${hero} a[href]`);
  await atHash(page, '#entry');
  result.handoff = await page.evaluate(() => window.__finalHandoff);
  const paintedProgress = result.handoff.filter(row => row.progress > 0 && row.progress < 1);
  const current = await page.$eval('#position', node => ({ y: scrollY, state: document.querySelector('main').dataset.activePage,
    document: performance.timeOrigin, top: node.getBoundingClientRect().top }));
  result.arrival = current;
  assert.equal(current.document, original);
  assert.equal(current.state, 'about.html');
  assert.ok(current.top >= 0 && current.top < page.viewport().height);
  if (reduce) assert.equal(paintedProgress.length, 0);
  else {
    assert.ok(new Set(paintedProgress.map(row => row.y)).size >= 2, 'No intermediate scroll positions during opening handoff');
    const continuous = paintedProgress.filter(row => Math.abs(row.headerTop - row.openingBottom) <= 4);
    assert.ok(continuous.length / paintedProgress.length >= .8, 'Opening edge and entering header detached during handoff');
    assert.ok(paintedProgress.every((row, i) => i === 0 || row.y >= paintedProgress[i - 1].y - 2));
  }
  await marker('position-arrived', 650);
}

async function directions(page, result, lang, width, mark = async () => {}) {
  const controls = '#work [data-direction]';
  const ids = await page.$$eval(controls, nodes => nodes.map(node => node.dataset.direction));
  assert.equal(ids.length, 7);
  assert.equal(new Set(ids).size, 7);
  result.selections = [];
  await click(page, `${controls}[data-direction="${ids[0]}"]`);
  for (const [index, id] of ids.entries()) {
    const control = `${controls}[data-direction="${id}"]`;
    if (index && width < 700) await click(page, control);
    else if (index) await page.keyboard.press('ArrowDown');
    await page.waitForFunction(id => location.hash === `#${id}` &&
      document.querySelector(`[data-direction="${id}"]`)?.getAttribute('aria-current') === 'true' &&
      [...document.querySelectorAll('#work [data-topic]')].filter(panel => !panel.hidden).map(panel => panel.id).join() === id,
    wait, id);
    await page.waitForFunction(id => document.querySelector('canvas.page-scene')?.dataset.sceneSelection === id, wait, id);
    const row = await page.$eval(`#${id}`, node => ({ id: node.id, title: node.querySelector('h3')?.textContent.trim(), motif: document.querySelector('canvas.page-scene').dataset.sceneMotif }));
    assert.ok(row.title);
    result.selections.push(row);
    await mark(`direction:${id}`, 500);
  }
  assert.equal(new Set(result.selections.map(row => row.motif)).size, 7, 'Seven research picks should yield seven motifs');
  await page.goBack();
  await atHash(page, `#${ids.at(-2)}`);
  assert.equal(await page.$eval('#work [data-topic]:not([hidden])', node => node.id), ids.at(-2));
  await page.goForward();
  await atHash(page, `#${ids.at(-1)}`);
  assert.equal(await page.$eval('#work [data-topic]:not([hidden])', node => node.id), ids.at(-1));
}

async function navigateStory(page, result, width, mark = async () => {}) {
  const anchor = '[data-site-chapter="work"]';
  const button = `[data-site-group]:has(${anchor}) [data-site-disclosure]`;
  const original = await page.evaluate(() => ({ y: scrollY, document: performance.timeOrigin, hash: location.hash }));
  if (width >= 1024) {
    await page.mouse.move(2, 250);
    const started = performance.now();
    await hover(page, button);
    await sleep(40);
    assert.equal(await page.$eval(button, node => node.getAttribute('aria-expanded')), 'false', 'Hover menu opened immediately');
    await expanded(page, button, true);
    result.hoverOpenMs = Math.round(performance.now() - started);
    await mark('header-hover-open', 600);
    await page.mouse.move(2, 250);
    await expanded(page, button, false);
    await page.focus(button);
    await page.keyboard.press('ArrowDown');
    await expanded(page, button, true);
    assert.ok(await page.$eval(button, node => document.getElementById(node.getAttribute('aria-controls')).contains(document.activeElement)));
    await page.keyboard.press('Escape');
    await expanded(page, button, false);
    assert.ok(await page.$eval(button, node => document.activeElement === node));
  } else {
    await click(page, menuToggle);
    await expanded(page, menuToggle, true);
    await mark('header-touch-open', 600);
    await click(page, menuToggle);
    await expanded(page, menuToggle, false);
  }
  const { link } = await navGroup(page, 'work');
  await page.evaluate(() => {
    const rows = [];
    window.__finalAnchor = rows;
    const until = performance.now() + 2300;
    const frame = now => {
      rows.push({ y: scrollY, state: document.documentElement.dataset.anchorTravel || null });
      if (now < until) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  await click(page, link);
  await atHash(page, '#work');
  result.anchor = await position(page, '#work h2');
  result.anchorTrace = await page.evaluate(() => window.__finalAnchor);
  assert.ok(new Set(result.anchorTrace.filter(row => row.state === 'work').map(row => row.y)).size >= 2, 'No smooth anchor intermediates');
  assert.ok(result.anchor.hittable && result.anchor.top >= result.anchor.header - 1);
  assert.equal(await page.evaluate(() => performance.timeOrigin), original.document);
  await mark('research-arrived', 550);
  await page.goBack();
  await atHash(page, original.hash);
  assert.ok(Math.abs((await page.evaluate(() => scrollY)) - original.y) <= 30, 'Back did not restore scroll');
  const forward = page.goForward();
  await forward;
  await atHash(page, '#work');
  await mark('research-history-forward', 500);
}

async function awards(page, result, width, lang, mark = async () => {}) {
  const state = () => page.$eval('#awards', section => {
    const active = section.querySelector('[data-award-pick][aria-pressed="true"]');
    const panels = [...section.querySelectorAll('[data-award-panel]:not([hidden])')];
    const medal = section.querySelector('[data-award-medal]');
    return { id: active?.id, caption: panels[0]?.querySelector('h3')?.textContent.trim(), count: panels.length,
      pdf: panels[0]?.querySelector('a[href$=".pdf"]')?.href, medal: medal?.textContent.trim() };
  });
  result.awards = [];
  for (const index of [0, 1, 2]) {
    if (width < 700) await click(page, award(index));
    else {
      await page.$eval(award(index), node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
      await hover(page, award(index));
    }
    const row = await state();
    assert.equal(row.id, `awards-item-${index + 1}`);
    assert.equal(row.count, 1);
    assert.ok(row.caption && row.pdf && row.medal);
    result.awards.push({ ...row, medal: digest(row.medal) });
    await mark(`award:${index + 1}`, 690);
  }
  assert.equal(new Set(result.awards.map(row => row.pdf)).size, 3);
  assert.equal(new Set(result.awards.map(row => row.medal)).size, 3);
  const spacing = await page.$$eval('[data-award-pick]', nodes => nodes.map(node => ({ row: node.offsetTop,
    width: node.clientWidth, height: node.clientHeight, scroll: node.scrollWidth,
    text: node.querySelector('strong')?.getBoundingClientRect().width, name: node.textContent.trim() })));
  result.spacing = spacing;
  assert.ok(spacing.every(row => row.width > 44 && row.height >= 44 && row.scroll <= row.width + 1 && row.text > 20));
  if (width < 700) assert.equal(new Set(spacing.map(row => row.row)).size, 1, 'Mobile award choices are not in one row');
}

async function certificates(result, rows) {
  result.certificates = [];
  for (const row of rows) {
    const url = new URL(row.pdf);
    assert.equal(url.origin, new URL(origin).origin);
    assert.match(url.pathname, /^\/awards\/cert-\w+\.pdf$/);
    const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const data = Buffer.from(await response.arrayBuffer());
    assert.ok(response.ok);
    assert.match(response.headers.get('content-type'), /application\/pdf/i);
    assert.equal(data.subarray(0, 5).toString(), '%PDF-');
    assert.ok(data.toString('latin1').trimEnd().endsWith('%%EOF'));
    const original = await readFile(new URL(`../public${url.pathname}`, import.meta.url));
    assert.equal(digest(data), digest(original));
    result.certificates.push({ path: url.pathname, bytes: data.length, sha256: digest(data) });
  }
}

async function flued(page, result, lang, mark = async () => {}, prepared = false) {
  if (!prepared) await open(page, localePath(lang, '/flued-demo.html'));
  const sample = await fetch(new URL('/flued-demo-sample.json', origin));
  assert.equal(sample.status, 200);
  const payload = await sample.json();
  assert.equal(payload.models.length, 5);
  assert.ok(payload.input.text.trim());
  await mark('flued-demo', 650);
  await page.waitForSelector('[data-f-run]:not([disabled])', wait);
  await page.evaluate(() => {
    window.__finalResult = [];
    const canvas = document.querySelector('canvas.page-scene-transfer');
    const started = performance.now();
    function tick(now) {
      window.__finalResult.push({ ms: now - started, y: scrollY, anchor: document.documentElement.hasAttribute('data-anchor-travel'),
        feedback: canvas?.dataset.travelFeedback || null });
      if (now - started < 2600) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
  await mark('flued-run-sample');
  await click(page, '[data-f-run]');
  await page.waitForFunction(() => document.querySelector('[data-f-model]')?.options.length === 5 &&
    document.querySelector('[data-f-completion]')?.innerText.trim().length > 25, wait);
  await page.waitForFunction(() => document.activeElement.matches('[data-f-model]') &&
    !document.documentElement.hasAttribute('data-anchor-travel'), wait);
  await stableScroll(page);
  const landing = await position(page, '[data-f-model]');
  assert.ok(landing.hittable && landing.top >= landing.header - 1 && landing.bottom <= landing.view, 'FLUED result focus is obscured');
  result.resultTrace = await page.evaluate(() => window.__finalResult);
  assert.ok(result.resultTrace.some(row => row.feedback || row.anchor), 'FLUED result gave no movement or visual feedback');
  const { before, key } = await page.$eval('[data-f-model]', node => ({ before: node.value, key: node.selectedIndex < node.options.length - 1 ? 'End' : 'Home' }));
  await page.keyboard.press(key);
  const after = await page.$eval('[data-f-model]', node => node.value);
  assert.notEqual(after, before);
  result.demo = { input: 'recorded sample', models: 5, before, after, landing };
  await mark('flued-model-changed', 900);
  if (prepared) return;
  await open(page, localePath(lang, '/flued-evidence.html') + '#curves');
  await page.waitForSelector('[data-f-plot] canvas', wait);
  await page.waitForFunction(() => document.querySelector('[data-f-metric]')?.options.length >= 2, wait);
  const metric = await page.$eval('[data-f-metric]', node => node.value);
  await page.focus('[data-f-metric]');
  const metricKey = await page.$eval('[data-f-metric]', node => node.selectedIndex === node.options.length - 1 ? 'Home' : 'End');
  await page.keyboard.press(metricKey);
  result.metric = await page.$eval('[data-f-metric]', node => node.value);
  assert.notEqual(result.metric, metric);
}

async function article(page, result, lang, mark = async () => {}) {
  const selector = `${toc} li:nth-child(5) a[href]`;
  const anchor = await page.$eval(selector, node => decodeURIComponent(node.hash));
  await mark('article-directory', 680);
  await click(page, selector);
  await atHash(page, anchor);
  const heading = `#${await page.evaluate(hash => CSS.escape(hash.slice(1)), anchor)}`;
  result.article = { anchor, ...(await position(page, heading)) };
  assert.ok(result.article.hittable && result.article.focused && result.article.top >= result.article.header - 1);
  await mark('article-target', 1100);
}

async function backend(result) {
  const paths = ['/login', '/account', '/recruitment/', '/admin/recruitment', '/recruitment/api/auth/me'];
  result.observed = await Promise.all(paths.map(async path => {
    const response = await fetch(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(6500) });
    const text = await response.text();
    return { path, status: response.status, previewStub: /静态预览未连接招新及账号服务/.test(text) };
  }));
  result.realIntegration = result.observed.every(row => row.previewStub) ? 'not connected in static preview' : 'unverified';
  result.scope = 'Browser suites simulate anonymous session only. No credential, account, or recruitment workflow was exercised.';
}

async function tour(page, result, width, theme, capture) {
  await options(page, width, theme);
  await open(page, '/');
  await freezeReady(page);
  await page.waitForSelector('.opening[data-ready]', wait);
  const name = width < 700 ? 'mobile-tour.mp4' : 'desktop-tour.mp4';
  const recorder = capture ? await record(page, resolve(out, name)) : null;
  const mark = async (event, pause = 0) => {
    recorder?.mark(event, { url: page.url(), y: await page.evaluate(() => scrollY) });
    if (recorder && pause) await sleep(pause);
  };
  let issue;
  try {
    await mark('opening', 11600);
    await opening(page, result, width, theme, false, mark);
    await navigateStory(page, result, width, mark);
    await directions(page, result, 'zh', width, mark);
    const researchHash = await page.evaluate(() => location.hash);
    await click(page, '#work a[data-primary][href="/flued.html"]');
    await page.waitForFunction(() => location.pathname === '/flued.html', wait);
    await stableScroll(page);
    await mark('flued-overview', 750);
    await click(page, 'main a[data-primary][href^="/flued-demo.html"]');
    await page.waitForFunction(() => location.pathname === '/flued-demo.html', wait);
    await stableScroll(page);
    await flued(page, result, 'zh', mark, true);
    await page.goBack();
    await page.waitForFunction(() => location.pathname === '/flued.html', wait);
    await page.goBack();
    await atHash(page, researchHash);
    const { link: awardsLink } = await navGroup(page, 'awards');
    await click(page, awardsLink);
    await atHash(page, '#awards');
    await awards(page, result, width, 'zh', mark);
    const { link: documentsLink } = await navGroup(page, 'documents');
    await click(page, documentsLink);
    await atHash(page, '#documents');
    await click(page, `#documents a[href="${essay}"]`);
    await page.waitForFunction(path => location.pathname === path, wait, essay);
    await stableScroll(page);
    await article(page, result, 'zh', mark);
  } catch (error) { issue = error; await mark('failed', 300); }
  if (recorder) {
    const { temp, ...video } = await recorder.stop();
    Object.assign(result, video);
    if (!issue) {
      await rename(temp, resolve(out, name));
      result.file = name;
      execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-xerror', '-i', resolve(out, name), '-f', 'null', '-'], { windowsHide: true });
    } else result.partial = `${name.slice(0, -4)}.partial.mp4`;
  }
  if (issue) throw issue;
}

async function main() {
  const mode = process.argv[2] || '--help';
  if (mode === '--help') {
    console.log('Usage: node scripts/final-acceptance.mjs --measure | --stable\n--measure runs baseline checks without media. --stable runs all checks and records both tours. Optional ALETHIC_FINAL_RELEASE pins the build.');
    return;
  }
  assert.ok(['--measure', '--stable'].includes(mode));
  assert.equal(new Set(pages).size, 18);
  const release = await releaseInfo();
  if (process.env.ALETHIC_FINAL_RELEASE) assert.equal(release.css.split('/')[2], process.env.ALETHIC_FINAL_RELEASE);
  const capture = mode === '--stable';
  const filter = !capture && process.env.ALETHIC_FINAL_CHECKS ? new RegExp(process.env.ALETHIC_FINAL_CHECKS) : null;
  const account = new URL('/recruitment/api/auth/me', origin).href;
  const unavailable = ['http://127.0.0.1:8722/api/health'];
  const attach = async (page, errors) => {
    await page.setRequestInterception(true);
    page.on('request', request => {
      const work = request.url() === account && request.method() === 'GET'
        ? request.respond({ status: 200, contentType: 'application/json', body: '{}' }) : request.continue();
      void work.catch(() => {});
    });
    watch(page, errors, unavailable);
  };
  await mkdir(out, { recursive: true });
  const browser = await launch();
  const report = { origin, mode, release, browser: await browser.version(), startedAt: new Date().toISOString(), checks: [] };
  const reportName = capture ? 'report.json' : 'baseline.json';
  const run = async (name, task, needsPage = true) => {
    if (filter && !filter.test(name)) return;
    const result = { name, errors: [] };
    const context = needsPage ? await browser.createBrowserContext() : null;
    try {
      const page = context && await context.newPage();
      if (page) await attach(page, result.errors);
      await task(page, result);
      assert.deepEqual(result.errors, []);
      result.status = 'pass';
    } catch (error) { result.status = 'fail'; result.issue = error.stack || String(error); process.exitCode = 1; }
    finally { await context?.close(); }
    report.checks.push(result);
    report.summary = { passed: report.checks.filter(check => check.status === 'pass').length,
      failed: report.checks.filter(check => check.status === 'fail').length };
    await save(reportName, report);
    console.log(`${result.status.toUpperCase()} ${name}${result.issue ? ` | ${result.issue.split('\n')[0]}` : ''}`);
    return result;
  };
  try {
    const tours = [];
    for (const [width, theme, device] of [[1440, 'light', 'desktop'], [390, 'dark', 'mobile']]) {
      const result = await run(`${device}-tour`, (page, result) => tour(page, result, width, theme, capture));
      if (result) tours.push(result);
      if (capture) await save('timeline.json', { origin, release, browser: report.browser, tours });
    }
    await run('backend-limit', (_, result) => backend(result), false);
    await run('original-assets', staticAssets);
    for (const lang of languages) for (const width of widths) {
      await run(`cold-${lang}-${width}`, (_, result) => coldMatrix(browser, result, width, lang, attach), false);
    }
    for (const [width, theme] of [[1440, 'dark'], [390, 'light']]) for (const reduce of [false, true]) {
      await run(`opening-${width}-${theme}-${reduce ? 'reduce' : 'default'}`, async (page, result) => {
        await options(page, width, theme, reduce);
        await open(page, '/');
        await opening(page, result, width, theme, reduce);
      });
    }
    for (const [width, lang] of [[1440, 'zh'], [390, 'en']]) {
      await run(`preferences-${width}-${lang}`, (page, result) => preferences(page, result, width, lang));
      await run(`flued-${width}-${lang}`, async (page, result) => { await options(page, width); await flued(page, result, lang); });
    }
    for (const [width, lang, theme] of [[320, 'en', 'dark'], [390, 'zh', 'dark'], [1440, 'en', 'light']]) {
      await run(`awards-${width}-${lang}`, async (page, result) => {
        await options(page, width, theme);
        await rootAt(page, '#awards-item-3', lang);
        if (width < 700) {
          result.firstPick = await position(page, award(0));
          assert.ok(result.firstPick.hittable && result.firstPick.top >= result.firstPick.header - 1, 'Touch target is under sticky header when opening third award');
        }
        await awards(page, result, width, lang);
        await certificates(result, result.awards);
      });
    }
    await run('build-identity', async () => assert.deepEqual(await releaseInfo(), release), false);
  } finally { await browser.close(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) await main();
