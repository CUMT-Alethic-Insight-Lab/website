import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { digest, launch, open, origin, releaseInfo, routes, sleep, viewport, watch } from './browser-qa.mjs';
import { record, stableScroll, tabTo } from './home-film.mjs';

const output = process.env.ALETHIC_READING_OUTPUT || fileURLToPath(new URL('../qa-output/reading/', import.meta.url));
const localFFmpeg = 'E:/projects/dsh/tools/ffmpeg/bin/ffmpeg.exe';
const ffmpeg = process.env.ALETHIC_FFMPEG || (existsSync(localFFmpeg) ? localFFmpeg : 'ffmpeg');
const widths = [320, 390, 768, 1440];
const themes = ['light', 'dark'];
const wait = { timeout: 6500 };
const essay = '/insights-memory-hierarchy.html';
const dock = '[data-site-preferences]';
const handle = `${dock} > summary`;
const themeControl = `${dock} [data-theme-toggle]`;
const language = `${dock} [data-language]`;
const menu = '[data-site-nav-toggle]';
const article = '.ed-paper > .ed-prose';
const toc = '.ed-paper > .ed-index';
const ruler = '#projects .cut-figure';
const directory = '#projects .story-directory';
const model = `${ruler} [data-ruler-select]`;
const save = (name, value) => writeFile(resolve(output, name), JSON.stringify(value, null, 2) + '\n');
const waitHash = (page, hash) => page.waitForFunction(hash => location.hash === hash, wait, hash);
const scope = (lang, path) => lang === 'en' ? `/en${path}` : path;
const paint = page => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));

async function activate(page, selector) {
  await page.waitForSelector(selector, { ...wait, visible: true });
  if (page.viewport().hasTouch) await page.tap(selector);
  else await page.click(selector);
}

async function displayTheme(page, theme) {
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
}

async function reveal(page, selector, block = 'center') {
  await page.$eval(selector, (node, block) => node.scrollIntoView({ block, behavior: 'instant' }), block);
  await stableScroll(page);
}

async function screenshot(page, name) {
  const png = await page.screenshot({ path: resolve(output, name) });
  return { name, sha256: digest(png) };
}

function rgb(png) {
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  const pixels = execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-i', 'pipe:0',
    '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { input: png, maxBuffer: width * height * 3 + 65536, windowsHide: true });
  assert.equal(pixels.length, width * height * 3);
  return { pixels, width, height };
}

function comparePixels(reference, samples, region) {
  let pixels = 0, changed = 0, outsideChanged = 0, outsidePixels = 0, paperMatches = 0;
  let maxDelta = 0;
  const paper = region.paper.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number) || [];
  for (let y = 0; y < reference.height; y++) for (let x = 0; x < reference.width; x++) {
    const i = (y * reference.width + x) * 3;
    const outside = region.outside.some(box => x >= box.x && x < box.r && y >= box.y && y < box.b);
    const inside = region.boxes.some(box => x >= box.x && x < box.r && y >= box.y && y < box.b);
    if (!inside && !outside) continue;
    let delta = 0;
    for (const sample of samples) for (let channel = 0; channel < 3; channel++) {
      delta = Math.max(delta, Math.abs(reference.pixels[i + channel] - sample.pixels[i + channel]));
    }
    if (inside) {
      pixels++;
      if (delta > 2) changed++;
      maxDelta = Math.max(maxDelta, delta);
      if (paper.length === 3 && paper.every((channel, k) => Math.abs(reference.pixels[i + k] - channel) <= 2)) paperMatches++;
    }
    if (outside) { outsidePixels++; if (delta > 2) outsideChanged++; }
  }
  return { pixels, changed, maxDelta, outsidePixels, outsideChanged, paperMatches };
}

async function sampleRegions(page, selector) {
  return page.$eval(selector, panel => {
    const panelRect = panel.getBoundingClientRect();
    const chrome = [...document.querySelectorAll('[data-site-header], [data-site-preferences]')].map(n => n.getBoundingClientRect());
    const desktopTop = Math.max(0, ...chrome.filter(n => n.top <= 1 && n.bottom > 0 && n.width > innerWidth / 2).map(n => n.bottom));
    const clip = rect => ({ x: Math.ceil(Math.max(0, rect.left)), y: Math.ceil(Math.max(desktopTop, rect.top)),
      r: Math.floor(Math.min(innerWidth, rect.right)), b: Math.floor(Math.min(innerHeight, rect.bottom)) });
    const whole = clip(panelRect);
    const boxList = [];
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    while (walker.nextNode()) {
      const text = walker.currentNode;
      if (!text.textContent.trim() || !text.parentElement?.checkVisibility()) continue;
      range.selectNodeContents(text);
      for (const rect of range.getClientRects()) {
        const box = clip(rect);
        if (box.b > box.y && box.r > box.x) boxList.push(box);
      }
    }
    // Row gaps are bounded by actual text line boxes. Hardware and font-dependent offsets come from the DOM.
    const gaps = [];
    const x1 = whole.x + Math.max(5, (whole.r - whole.x) * .12);
    const x2 = whole.r - Math.max(5, (whole.r - whole.x) * .12);
    const relevant = boxList.filter(box => box.r > x1 && box.x < x2).sort((a, b) => a.y - b.y);
    let previous = whole.y + 2;
    for (const line of relevant) {
      if (line.y - previous >= 4 && gaps.length < 28) {
        gaps.push({ x: Math.ceil(x1), r: Math.floor(x2), y: previous + 1, b: Math.min(line.y - 1, previous + 14) });
      }
      previous = Math.max(previous, line.b);
    }
    const canvas = document.querySelector('.page-scene');
    const outside = [{ x: 0, y: Math.ceil(desktopTop) + 12, r: Math.max(0, whole.x - 4), b: innerHeight - 5 },
      { x: whole.r + 4, y: Math.ceil(desktopTop) + 12, r: innerWidth, b: innerHeight - 5 },
      { x: 0, y: Math.ceil(desktopTop) + 8, r: innerWidth, b: whole.y - 4 },
      { x: 0, y: whole.b + 4, r: innerWidth, b: innerHeight - 4 }].filter(box => box.r > box.x && box.b > box.y);
    const paper = getComputedStyle(document.body).backgroundColor;
    return { whole, boxes: gaps, outside, paper, lines: relevant.length, camera: scrollY,
      scene: { visible: canvas?.dataset.sceneVisible, width: canvas?.width, height: canvas?.height } };
  });
}

async function samplePanel(page, selector, name, evidence, capture, reduce) {
  await reveal(page, selector, name.includes('prose') ? 'start' : 'center');
  const region = await sampleRegions(page, selector);
  assert.ok(region.boxes.length >= 2, `Fewer than two real line gaps in ${name}`);
  const shots = [];
  for (let i = 0; i < 3; i++) {
    if (i) await sleep(220);
    shots.push(Buffer.from(await page.screenshot()));
  }
  assert.equal(await page.evaluate(() => scrollY), region.camera, `Camera moved while sampling ${name}`);
  const [first, ...rest] = shots.map(rgb);
  const gaps = comparePixels(first, rest, region);
  const panel = comparePixels(first, rest, { ...region, boxes: [region.whole], outside: [] });
  // Read the entire underlying visible panel from an independent software surface.
  const canvasInk = await page.$eval('canvas.page-scene', (canvas, box) => {
    const copy = new OffscreenCanvas(canvas.width, canvas.height);
    const ctx = copy.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0);
    const rect = canvas.getBoundingClientRect();
    const ratioX = canvas.width / rect.width, ratioY = canvas.height / rect.height;
    const x = Math.max(0, Math.ceil((box.x - rect.left + 2) * ratioX));
    const y = Math.max(0, Math.ceil((box.y - rect.top + 2) * ratioY));
    const w = Math.min(canvas.width - x, Math.floor((box.r - box.x - 4) * ratioX));
    const h = Math.min(canvas.height - y, Math.floor((box.b - box.y - 4) * ratioY));
    const pixels = ctx.getImageData(x, y, w, h).data;
    let marks = 0, strong = 0;
    for (let i = 3; i < pixels.length; i += 4) { if (pixels[i]) marks++; if (pixels[i] > 20) strong++; }
    return { pixels: w * h, marks, strong };
  }, region.whole);
  const file = `${name}.png`;
  if (capture) await writeFile(resolve(output, file), shots[0]);
  evidence.push({ name, file: capture ? file : undefined, sha256: digest(shots[0]), panel, gaps, canvasInk, region });
  assert.equal(gaps.changed, 0, `Composited blank line gaps move in ${name}`);
  assert.equal(panel.changed, 0, `Composited visible panel moves while idle in ${name}`);
  assert.equal(canvasInk.strong, 0, `Canvas has visible ink inside the panel in ${name}`);
  if (reduce) assert.equal(gaps.outsideChanged, 0, `Reduced-motion exterior changed in ${name}`);
}

async function panels(page, result, width, theme, reduce, capture) {
  await viewport(page, width);
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }]);
  const stem = `${width}-${theme}${reduce ? '-reduce' : ''}`;
  const failures = [];
  result.samples = [];
  const capturePanel = async (selector, label) => {
    try { await samplePanel(page, selector, `${stem}-${label}`, result.samples, capture, reduce); }
    catch (error) { failures.push(`${label}: ${error.message}`); }
  };
  await open(page, '/#projects');
  await stableScroll(page);
  await capturePanel(ruler, 'projects-ruler');
  await reveal(page, model);
  await page.focus(model);
  await page.keyboard.press('End');
  await sleep(320);
  await capturePanel(ruler, 'projects-bpe');
  await activate(page, `${directory} > summary`);
  assert.ok(await page.$eval(directory, node => node.open));
  await capturePanel(`${directory} .project-directory`, 'projects-directory');
  await open(page, essay);
  await stableScroll(page);
  await capturePanel(toc, 'essay-contents');
  await capturePanel(article, 'essay-prose');
  if (!reduce) {
    for (const type of ['projects-', 'essay-']) {
      if (!result.samples.some(row => row.name.includes(type) && row.gaps.outsideChanged > 8)) failures.push(`No composited motion outside the ${type.slice(0, -1)} panels at any measured camera`);
    }
  }
  assert.ok(!failures.length, failures.join(' | '));
}

async function preferences(page, result, width, startingTheme, capture) {
  await viewport(page, width);
  await displayTheme(page, startingTheme);
  await open(page, '/#entry');
  await stableScroll(page);
  await page.waitForSelector(handle, { ...wait, visible: true });
  const placement = await page.$eval(dock, node => ({ inHeader: !!node.closest('[data-site-header]'), position: getComputedStyle(node).position,
    collapsed: !node.open, controls: [...node.querySelectorAll('a,button')].map(n => n.textContent.trim()) }));
  result.placement = placement;
  assert.ok(!placement.inHeader && placement.collapsed);
  if (page.viewport().hasTouch) await activate(page, handle);
  else { await tabTo(page, handle, 85); await page.keyboard.press('Enter'); }
  assert.equal(await page.$eval(dock, node => node.open), true);
  if (capture) result.screenshot = await screenshot(page, `${width}-${startingTheme}-preferences.png`);
  const nextTheme = startingTheme === 'dark' ? 'light' : 'dark';
  if (page.viewport().hasTouch) await activate(page, themeControl);
  else { await tabTo(page, themeControl); await page.keyboard.press('Space'); }
  await page.waitForFunction(value => document.documentElement.dataset.theme === value, wait, nextTheme);
  assert.equal(await page.$eval(themeControl, n => n.getAttribute('aria-pressed')), String(nextTheme === 'dark'));
  if (!page.viewport().hasTouch) {
    await page.keyboard.press('Escape');
    assert.ok(await page.$eval(handle, node => node === document.activeElement && !node.parentElement.open));
    await page.keyboard.press('Enter');
    await tabTo(page, language);
    await page.keyboard.press('Enter');
  } else {
    if (!await page.$eval(dock, node => node.open)) await activate(page, handle);
    await activate(page, language);
  }
  await page.waitForFunction(() => location.pathname === '/en/' && /^en/i.test(document.documentElement.lang), wait);
  result.after = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, lang: document.documentElement.lang, hash: location.hash }));
  assert.equal(result.after.theme, nextTheme);
  assert.ok(['#entry', '#position'].includes(result.after.hash), `Language change lost entry context: ${result.after.hash}`);
}

async function traceStart(page) {
  await page.evaluate(() => {
    window.__readingScrollTrace = [];
    window.__readingTraceOn = true;
    const tick = time => {
      if (!window.__readingTraceOn) return;
      window.__readingScrollTrace.push({ ms: +time.toFixed(1), y: scrollY, flag: document.documentElement.dataset.anchorTravel || null });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function traceEnd(page) {
  return page.evaluate(() => { window.__readingTraceOn = false; return window.__readingScrollTrace; });
}

async function menuLink(page, id) {
  if (await page.$eval(menu, node => node.checkVisibility() && node.getAttribute('aria-expanded') === 'false')) await activate(page, menu);
  const link = `[data-site-chapter="${id}"]`;
  const trigger = `[data-site-group]:has(${link}) [data-site-disclosure]`;
  if (await page.$eval(trigger, node => node.getAttribute('aria-expanded')) !== 'true') await activate(page, trigger);
  return link;
}

async function target(page, id) {
  return page.$eval(`#${id}`, section => {
    const title = section.querySelector('h1,h2');
    const bounds = title.getBoundingClientRect();
    const header = document.querySelector('[data-site-header]').getBoundingClientRect();
    const hit = document.elementFromPoint(bounds.left + Math.min(12, bounds.width / 2), bounds.top + 4);
    return { top: bounds.top, bottom: bounds.bottom, viewport: innerHeight, header: header.bottom,
      onTop: title.contains(hit), focus: document.activeElement.id, hash: location.hash, scrollY, timeOrigin: performance.timeOrigin };
  });
}

async function anchorJourney(page, result, width, theme, reduce, mark = async () => {}, prepared = false) {
  if (!prepared) {
    await viewport(page, width);
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }]);
    await open(page, '/#position');
  }
  await stableScroll(page);
  result.source = await target(page, 'position');
  let link = await menuLink(page, 'documents');
  await traceStart(page);
  await mark('start-anchor-to-documents');
  await activate(page, link);
  await waitHash(page, '#documents');
  await stableScroll(page);
  result.arrival = await target(page, 'documents');
  result.trace = await traceEnd(page);
  const middle = result.trace.filter(row => row.y > result.source.scrollY + 25 && row.y < result.arrival.scrollY - 25);
  result.intermediate = [...new Set(middle.filter(row => row.flag === 'documents').map(row => row.y))];
  const issues = [];
  if (!(reduce ? result.intermediate.length === 0 && !middle.length : result.intermediate.length >= 2)) issues.push(`Expected ${reduce ? '0' : 'at least 2'} measured intermediate positions, got ${result.intermediate.length}`);
  const arrival = result.arrival;
  if (!(arrival.top >= arrival.header - 1 && arrival.bottom <= arrival.viewport && arrival.onTop && arrival.timeOrigin === result.source.timeOrigin)) issues.push('Target title covered, offscreen, or in a new document');
  await mark('documents-title-arrived', 700, { top: arrival.top, y: arrival.scrollY });
  await page.goBack();
  await waitHash(page, '#position');
  await stableScroll(page);
  result.back = await target(page, 'position');
  if (Math.abs(result.back.scrollY - result.source.scrollY) > 28 || result.back.timeOrigin !== result.source.timeOrigin) issues.push('Back did not restore initial camera');
  await mark('history-back', 650, { y: result.back.scrollY });
  if (!reduce) {
    link = await menuLink(page, 'documents');
    await traceStart(page);
    await activate(page, link);
    try {
      await page.waitForFunction(({ from, to }) => document.documentElement.dataset.anchorTravel === 'documents' && scrollY > from + 70 && scrollY < to - 200,
        wait, { from: result.source.scrollY, to: result.arrival.scrollY });
      result.interruptAt = await page.evaluate(() => scrollY);
      if (page.viewport().hasTouch) {
        await page.touchscreen.touchStart(Math.round(width * .52), 650);
        await page.touchscreen.touchMove(Math.round(width * .52), 690);
        await page.touchscreen.touchEnd();
      } else {
        await page.mouse.move(Math.round(width * .6), 615);
        await page.mouse.wheel({ deltaY: -140 });
      }
      await page.waitForFunction(() => !document.documentElement.hasAttribute('data-anchor-travel'), wait);
      await sleep(970);
      result.interruptAfter = await page.evaluate(() => ({ y: scrollY, hash: location.hash }));
      if (Math.abs(result.interruptAfter.y - result.arrival.scrollY) < 160) issues.push('Input did not stop the scroll before its target');
      await mark('user-interruption', 650, result.interruptAfter);
    } catch (error) { issues.push(`Interruption: ${error.message}`); }
    result.interruptTrace = await traceEnd(page);
  }
  assert.ok(!issues.length, issues.join(' | '));
}

async function allControls(page, result, width, theme) {
  await viewport(page, width);
  await displayTheme(page, theme);
  result.pages = [];
  const issues = [];
  for (const lang of ['zh', 'en']) for (const route of [...routes, '/404.html']) {
    await open(page, scope(lang, route) + (route === '/' ? '#entry' : ''));
    await page.waitForSelector('main[data-page]', wait);
    await paint(page);
    const measurements = await page.evaluate(() => {
      const controls = [...document.querySelectorAll('main a[data-primary], main .chart-link, main button, main select, main summary, main input:not([type="hidden"]), main [role="tab"]')]
        .filter(node => node.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && !node.closest('details:not([open]) :not(summary,summary *)'));
      const details = node => {
        const css = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        const type = node.matches('a[data-primary]') ? 'primary' : node.matches('.chart-link') ? 'resource' : node.tagName.toLowerCase();
        return { type, tag: node.tagName, text: (node.getAttribute('aria-label') || node.textContent).trim().slice(0, 60),
          color: css.color, background: css.backgroundColor, radius: css.borderRadius, decoration: css.textDecorationLine,
          minHeight: css.minBlockSize, height: Math.round(rect.height), disabled: !!node.disabled };
      };
      return { page: document.querySelector('main').dataset.page, theme: document.documentElement.dataset.theme,
        width: innerWidth, root: document.documentElement.scrollWidth, controls: controls.map(details) };
    });
    const inspectFocus = () => page.evaluate(() => {
        const node = document.activeElement, css = getComputedStyle(node), rect = node.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return { tag: node.tagName, outline: css.outlineStyle, width: css.outlineWidth, offset: css.outlineOffset,
          visible: node.matches(':focus-visible'), hittable: node.contains(hit), text: (node.getAttribute('aria-label') || node.textContent).trim().slice(0, 60) };
    });
    await page.focus('[data-site-header] .identity');
    await page.keyboard.press('Tab');
    const focus = await inspectFocus();
    await page.focus('main[data-page]');
    await page.keyboard.press('Tab');
    const bodyFocus = await inspectFocus();
    const focusOK = state => state.visible && state.hittable && state.outline !== 'none' && state.width !== '0px';
    const bad = measurements.controls.filter(item => item.color === item.background && !item.disabled);
    const roleStyles = measurements.controls.reduce((groups, item) => {
      (groups[item.type] ||= new Set()).add(`${item.radius}|${item.minHeight}|${item.decoration}`);
      return groups;
    }, {});
    const styles = Object.fromEntries(Object.entries(roleStyles).map(([key, value]) => [key, [...value]]));
    const primaryInconsistent = measurements.controls.filter(control => control.type === 'primary' &&
      (control.radius !== '0px' || control.minHeight !== '44px' || control.decoration !== 'none'));
    result.pages.push({ lang, route, ...measurements, focus, bodyFocus, styles });
    if (bad.length || primaryInconsistent.length || !focusOK(focus) || !focusOK(bodyFocus) || measurements.root > width + 1 || measurements.theme !== theme) {
      issues.push({ lang, route, bad, primaryInconsistent, focus, bodyFocus, root: measurements.root, theme: measurements.theme });
    }
  }
  result.issues = issues;
  assert.ok(!issues.length, issues.map(row => `${row.lang}:${row.route}`).join(', '));
}

async function articleAnchor(page, result) {
  const destination = '架构';
  const link = await page.waitForFunction(({ toc, destination }) =>
    [...document.querySelectorAll(`${toc} a[href]`)].find(node => decodeURIComponent(node.hash) === `#${destination}`),
  wait, { toc, destination });
  try {
    const element = link.asElement();
    const href = await element.evaluate(anchor => anchor.getAttribute('href'));
    if (page.viewport().hasTouch) await element.tap();
    else await element.click();
    await page.waitForFunction(id => decodeURIComponent(location.hash) === `#${id}`, wait, destination);
    await stableScroll(page);
    result.essayAnchor = await page.evaluate(({ destination, href }) => {
      const heading = document.getElementById(destination);
      const box = heading.getBoundingClientRect();
      const header = document.querySelector('[data-site-header]').getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + 8, box.top + 4);
      return { href, hash: location.hash, decoded: decodeURIComponent(location.hash), title: heading.textContent.trim(),
        top: box.top, headerBottom: header.bottom, inView: box.top >= header.bottom - 1 && box.bottom <= innerHeight && heading.contains(hit) };
    }, { destination, href });
    assert.ok(result.essayAnchor.inView, 'Article heading is hidden or covered after its TOC link');
  } finally { await link.dispose(); }
}

async function tour(page, result, width, theme) {
  await viewport(page, width);
  await displayTheme(page, theme);
  await open(page, '/#position');
  const file = `${width < 700 ? 'mobile' : 'desktop'}-reading.mp4`;
  const recorder = await record(page, resolve(output, file));
  const mark = async (label, delay = 0, data = {}) => {
    recorder.mark(label, { url: page.url(), ...data });
    if (delay) await sleep(delay);
  };
  result.issues = [];
  try {
    try { await anchorJourney(page, result, width, theme, false, mark, true); } catch (error) { result.issues.push(error.message); }
    await mark('navigate-projects');
    await activate(page, await menuLink(page, 'projects'));
    await waitHash(page, '#projects');
    await stableScroll(page);
    await mark('projects', 800);
    await reveal(page, model);
    await page.focus(model);
    await page.keyboard.press('End');
    await mark('ruler-bpe', 1000);
    await activate(page, `${directory} > summary`);
    await mark('directory-expanded', 1250);
    await activate(page, await menuLink(page, 'documents'));
    await waitHash(page, '#documents');
    await stableScroll(page);
    await mark('documents', 500);
    await activate(page, `#documents a[href="${essay}"]`);
    await page.waitForFunction(path => location.pathname === path, wait, essay);
    await stableScroll(page);
    await reveal(page, toc);
    await mark('essay-toc', 1100);
    await articleAnchor(page, result);
    await mark('essay-text', 1300, result.essayAnchor);
    await activate(page, handle);
    await mark('preferences-open', 850);
    await activate(page, themeControl);
    await mark('theme-switched', 900);
  } catch (error) { result.issues.push(error.message); }
  const { temp, ...metadata } = await recorder.stop();
  Object.assign(result, metadata);
  await rename(temp, resolve(output, file));
  result.file = file;
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-xerror', '-i', resolve(output, file), '-f', 'null', '-']);
  assert.ok(!result.issues.length, result.issues.join(' | '));
}

async function main() {
  const mode = process.argv[2] || '--help';
  if (mode === '--help') {
    console.log('Usage: node scripts/reading-qa.mjs --measure | --ready. --ready also records MP4s and saves PNG evidence.');
    return;
  }
  assert.ok(['--ready', '--measure'].includes(mode));
  const release = await releaseInfo();
  if (process.env.ALETHIC_READING_RELEASE) assert.equal(release.css.split('/')[2], process.env.ALETHIC_READING_RELEASE);
  await mkdir(output, { recursive: true });
  const browser = await launch();
  const capture = mode === '--ready';
  const selected = process.env.ALETHIC_READING_CHECKS && new RegExp(process.env.ALETHIC_READING_CHECKS);
  const report = { mode, origin, release, browser: await browser.version(), checks: [] };
  const file = capture ? 'report.json' : 'rehearsal.json';
  async function run(name, task) {
    if (selected && !selected.test(name)) return null;
    const result = { name, browserErrors: [] };
    const context = await browser.createBrowserContext();
    try {
      const page = await context.newPage();
      await page.setRequestInterception(true);
      page.on('request', request => {
        const path = new URL(request.url());
        if (path.origin === new URL(origin).origin && path.pathname === '/recruitment/api/auth/me') {
          void request.respond({ status: 200, contentType: 'application/json', body: '{}' }).catch(() => {});
        } else void request.continue().catch(() => {});
      });
      watch(page, result.browserErrors);
      await task(page, result);
      assert.deepEqual(result.browserErrors, []);
      result.status = 'pass';
    } catch (error) { result.status = 'fail'; result.issue = error.stack || String(error); process.exitCode = 1; }
    finally { await context.close(); }
    report.checks.push(result);
    await save(file, report);
    console.log(`${result.status.toUpperCase()} ${name}${result.issue ? ` — ${result.issue.split('\n')[0]}` : ''}`);
    return result;
  }
  try {
    if (capture) {
      const tours = [await run('desktop-tour', (page, result) => tour(page, result, 1440, 'light')),
        await run('mobile-tour', (page, result) => tour(page, result, 390, 'dark'))].filter(Boolean);
      if (tours.length) await save('timeline.json', { origin, release, browser: report.browser, tours });
    }
    for (const width of widths) for (const theme of themes) {
      await run(`panels-${width}-${theme}`, (page, result) => panels(page, result, width, theme, false, capture));
      await run(`anchors-${width}-${theme}`, (page, result) => anchorJourney(page, result, width, theme, false));
      await run(`preferences-${width}-${theme}`, (page, result) => preferences(page, result, width, theme, capture));
      await run(`controls-${width}-${theme}`, (page, result) => allControls(page, result, width, theme));
    }
    for (const [width, theme] of [[390, 'dark'], [1440, 'light']]) {
      await run(`panels-${width}-${theme}-reduce`, (page, result) => panels(page, result, width, theme, true, capture));
      await run(`anchors-${width}-${theme}-reduce`, (page, result) => anchorJourney(page, result, width, theme, true));
    }
    await run('build-identity', async () => assert.deepEqual(await releaseInfo(), release));
    report.summary = { passed: report.checks.filter(check => check.status === 'pass').length,
      failed: report.checks.filter(check => check.status === 'fail').length };
    await save(file, report);
  } finally { await browser.close(); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main();
