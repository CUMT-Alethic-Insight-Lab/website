import assert from 'node:assert/strict';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { digest, launch, open, origin, releaseInfo, sleep, viewport, watch } from './browser-qa.mjs';
import { activate, anchorClear, contentInteractions, enter, layout, record, scrollChapter, site, stableScroll, tabTo, visible } from './home-film.mjs';

const output = process.env.ALETHIC_VISUAL_QA_OUTPUT || fileURLToPath(new URL('../qa-output/visual-refresh/', import.meta.url));
const opener = '.opening canvas';
const art = '.chapter-art canvas';
const toggle = '[data-theme-toggle]';
const tools = '#site-tools-trigger';
const findLink = href => `${site.menuPanel} a[href="${href}"]`;
const disclosureFor = href => `[data-site-group]:has(a[href="${href}"]) [data-site-disclosure]`;
const wait = { timeout: 6500 };
const widths = [320, 390, 768, 1440];
const themes = ['light', 'dark'];
// Normalized non-overlapping bounds. Select higher-alpha pixels in the wordmark region to exclude the quiet background field.
const openingRegions = { foreground: [.23, .29, .77, .72, 145], background: [.05, .05, .95, .22, 1] };
const fullRegion = { full: [0, 0, 1, 1] };
const openingHoldWindows = 3;
const save = (name, data) => writeFile(resolve(output, name), JSON.stringify(data, null, 2) + '\n');

// Hash real RGBA pixels in the target's existing bitmap. Read only, without drawing or overriding RAF.
function samplePixels(canvas, regions) {
  const context = canvas.getContext('2d');
  if (!context || canvas.width < 2 || canvas.height < 2) return null;
  return Object.fromEntries(Object.entries(regions).map(([name, [x1, y1, x2, y2, minAlpha = 1]]) => {
    const left = Math.floor(x1 * canvas.width), top = Math.floor(y1 * canvas.height);
    const width = Math.max(1, Math.floor(x2 * canvas.width) - left);
    const height = Math.max(1, Math.floor(y2 * canvas.height) - top);
    const pixels = context.getImageData(left, top, width, height).data;
    let hash = 2166136261, ink = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const drawn = pixels[i + 3] >= minAlpha;
      if (drawn) ink++;
      const rgba = drawn ? pixels[i] | pixels[i + 1] << 8 | pixels[i + 2] << 16 | pixels[i + 3] << 24 : 0;
      hash = Math.imul(hash ^ rgba, 16777619);
    }
    return [name, { hash: (hash >>> 0).toString(16).padStart(8, '0'), ink, total: width * height }];
  }));
}

async function samples(page, selector, regions, count, interval) {
  const since = performance.now();
  const frames = [];
  for (let i = 0; i < count; i++) {
    const remaining = i * interval - (performance.now() - since);
    if (remaining > 0) await sleep(remaining);
    const pixels = await page.$eval(selector, samplePixels, regions);
    assert.ok(pixels, `No 2D bitmap: ${selector}`);
    frames.push({ ms: Math.round(performance.now() - since), pixels });
  }
  return frames;
}

const distinct = (frames, region) => new Set(frames.map(frame => frame.pixels[region].hash)).size;

async function setTheme(page, theme) {
  // Set preference through the actual Tools disclosure and theme button.
  await open(page, '/#entry');
  if (await page.$eval('html', root => root.dataset.theme) !== theme) {
    await activate(page, tools);
    await activate(page, toggle);
  }
  await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, wait, theme);
  assert.equal(await page.$eval(toggle, node => node.getAttribute('aria-pressed')), String(theme === 'dark'));
}

async function atOpening(page) {
  await page.mouse.move(1, 1);
  await open(page, '/');
  await visible(page, site.openingReady);
  await page.waitForFunction(() => scrollY < 2 && Math.abs(document.querySelector('.opening').getBoundingClientRect().top) < 2, wait);
}

async function captureOpening(page, theme, reduced, result) {
  await viewport(page, 1440);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]);
  await setTheme(page, theme);
  await atOpening(page);
  const colors = await page.$eval('.opening', node => {
    const style = getComputedStyle(node);
    const gradientColor = style.backgroundImage.match(/rgba?\(([^)]+)\)/)?.[0];
    const paint = gradientColor || style.backgroundColor;
    const [r, g, b] = (paint.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
    return { theme: document.documentElement.dataset.theme, background: paint, gradient: style.backgroundImage, foreground: style.color,
      lightness: +((.2126 * r + .7152 * g + .0722 * b) / 255).toFixed(3), motion: document.documentElement.dataset.motion };
  });
  result.colors = colors;
  assert.equal(colors.theme, theme, 'Opening did not keep the chosen theme');
  assert.equal(colors.motion, reduced ? 'still' : 'play');
  const interval = 170;
  const frames = await samples(page, opener, openingRegions, openingHoldWindows * 6 + 1, interval);
  result.regions = openingRegions;
  result.frames = frames;
  result.windowDistinct = Object.fromEntries(Object.keys(openingRegions).map(region => [region,
    Array.from({ length: openingHoldWindows }, (_, i) => distinct(frames.slice(i * 6, i * 6 + 7), region))]));
  assert.ok(Object.values(result.windowDistinct).every(windows => windows.every(count => reduced ? count === 1 : count >= 2)),
    `Unexpected ${theme} opener pixel changes under ${reduced ? 'reduce' : 'default'}: ${JSON.stringify(result.windowDistinct)}`);
  assert.ok(frames.every(frame => frame.pixels.foreground.ink > 0), 'Opening had blank foreground');
  if (reduced) {
    result.context = await page.$eval(opener, canvas => canvas.getContext('2d').getContextAttributes());
    assert.equal(result.context.willReadFrequently, true, 'Opening reduce did not use the static readback context');
    result.compositedFrames = [];
    for (let i = 0; i < 4; i++) {
      result.compositedFrames.push(digest(await page.screenshot()));
      if (i < 3) await sleep(250);
    }
    assert.equal(new Set(result.compositedFrames).size, 1, 'Reduced opener changed in composited browser output');
  }
}

async function reveal(page, selector) {
  await page.$eval(selector, node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await stableScroll(page);
}

async function chapterArt(page, { width, theme, reduced }, result) {
  await viewport(page, width);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]);
  await setTheme(page, theme);
  const chapterIds = await page.$$eval('[data-home-chapter]', nodes => nodes.map(node => node.id || (node.matches('.home-intro') ? 'intro' : null)));
  assert.deepEqual(chapterIds, site.chapters.map(chapter => chapter.id), 'Chapter order or tally changed');
  result.chapters = [];
  for (const { id, section } of site.chapters) {
    const selector = `${section} ${art}`;
    const row = { id };
    try {
      const canvases = await page.$$(selector);
      assert.equal(canvases.length, 1, `Expected one ${art} in ${section}`);
      await reveal(page, selector);
      row.geometry = await page.$eval(selector, canvas => {
        const rect = canvas.getBoundingClientRect();
        const style = getComputedStyle(canvas);
        return { width: canvas.width, height: canvas.height, cssWidth: rect.width, cssHeight: rect.height, opacity: style.opacity,
          intersects: rect.bottom > 0 && rect.top < innerHeight, visible: canvas.checkVisibility({ opacityProperty: true, visibilityProperty: true }) };
      });
      row.frames = await samples(page, selector, fullRegion, 8, 160);
      row.distinct = distinct(row.frames, 'full');
      assert.ok(row.geometry.intersects && row.geometry.visible && row.geometry.cssWidth > 2 && row.geometry.cssHeight > 2, 'Canvas not visible in the viewport');
      assert.ok(row.frames.some(frame => frame.pixels.full.ink > 10), 'Canvas has no painted detail');
      assert.ok(reduced ? row.distinct === 1 : row.distinct >= 2, `Canvas has ${row.distinct} unique frames while idle`);
      row.status = 'pass';
    } catch (error) {
      row.status = 'fail';
      row.detail = error.message;
    }
    result.chapters.push(row);
  }
  const failures = result.chapters.filter(chapter => chapter.status !== 'pass').map(chapter => chapter.id);
  assert.ok(!failures.length, `Chapter art failures: ${failures.join(', ')}`);
}

async function ariaExpanded(page, selector, expanded) {
  await page.waitForFunction((selector, expanded) => document.querySelector(selector)?.getAttribute('aria-expanded') === String(expanded),
    wait, selector, expanded);
}

async function mainMenu(page, expanded) {
  if (page.viewport().width > 959) return;
  const open = await page.$eval(site.menuToggle, button => button.getAttribute('aria-expanded') === 'true');
  if (open !== expanded) await activate(page, site.menuToggle);
  await ariaExpanded(page, site.menuToggle, expanded);
}

async function openGroup(page, href) {
  await mainMenu(page, true);
  const trigger = disclosureFor(href);
  await activate(page, trigger);
  await ariaExpanded(page, trigger, true);
  await visible(page, findLink(href));
}

async function interactions(page, { width, lang, reduced }, result) {
  await viewport(page, width);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]);
  const path = lang === 'en' ? '/en/' : '/';
  await open(page, path);
  result.layout = await layout(page, width, reduced, lang);
  await tabTo(page, site.enter);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.hash === '#entry', wait);
  await stableScroll(page);
  const narrow = width <= 959;
  if (narrow) {
    result.tabsToMenu = await tabTo(page, site.menuToggle);
    await page.keyboard.press('Enter');
    await ariaExpanded(page, site.menuToggle, true);
  }
  const research = disclosureFor('#work');
  const jump = findLink('#work');
  result.tabsToResearch = await tabTo(page, research);
  const openResearch = async () => {
    await page.keyboard.press('ArrowDown');
    await ariaExpanded(page, research, true);
    assert.ok(await page.$eval(research, button => document.getElementById(button.getAttribute('aria-controls')).contains(document.activeElement)),
      'ArrowDown did not focus a link in the research disclosure');
  };
  await openResearch();
  await page.keyboard.press('Escape');
  await ariaExpanded(page, research, false);
  assert.ok(await page.$eval(research, node => node === document.activeElement), 'Escape did not restore focus to the category button');
  if (narrow) {
    await page.keyboard.press('Escape');
    await ariaExpanded(page, site.menuToggle, false);
    assert.ok(await page.$eval(site.menuToggle, node => node === document.activeElement), 'Escape did not restore focus to the mobile menu');
    await page.keyboard.press('Enter');
    await ariaExpanded(page, site.menuToggle, true);
    await tabTo(page, research);
  }
  await openResearch();
  result.tabsToJump = await tabTo(page, jump);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => location.hash === '#work', wait);
  await ariaExpanded(page, research, false);
  if (narrow) await ariaExpanded(page, site.menuToggle, false);
  result.jump = await anchorClear(page, '#work');
  result.navCurrent = await page.$eval(site.navCurrent, node => ({ id: node.dataset.homeNavCurrent, text: node.textContent.trim() }));
  assert.equal(result.navCurrent.id, 'work');
  assert.ok(result.navCurrent.text);
  assert.equal(await page.$eval(jump, node => node.getAttribute('aria-current')), 'location');
  await activate(page, site.back.control);
  await page.waitForFunction(() => location.hash === '#entry', wait);
  await stableScroll(page);
  result.back = await page.$eval('#entry', entry => ({ top: entry.getBoundingClientRect().top, scrollY }));
  assert.ok(Math.abs(result.back.top) <= 21, 'Back-to-start did not return to entry');
  await contentInteractions(page, path, result);
}

async function fitAndSeats(page, width, result) {
  await viewport(page, width);
  result.locales = [];
  for (const path of ['/', '/en/']) {
    await open(page, `${path}#structure`);
    await stableScroll(page);
    const readFit = () => page.evaluate(() => {
      const overflow = [...document.querySelectorAll('[data-site-header] :is(a, button), main :is(h1, h2, h3, p, a, button, select, canvas)')]
        .filter(node => node.checkVisibility())
        .map(node => ({ node, rect: node.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1))
        .map(({ node, rect }) => ({ tag: node.tagName, text: node.textContent.trim().slice(0, 60), left: rect.left, right: rect.right }));
      const main = document.querySelector('main');
      return { viewport: innerWidth, root: document.documentElement.scrollWidth, body: document.body.scrollWidth, scrollX, overflow,
        main: main.scrollWidth, mainClient: main.clientWidth };
    });
    const row = { path, compact: await readFit() };
    await openGroup(page, '#position');
    row.expanded = await readFit();
    await page.keyboard.press('Escape');
    await mainMenu(page, false);
    row.seats = await page.$$eval('#structure .seat-count', rows => {
      const rects = node => {
        const range = document.createRange();
        range.selectNodeContents(node);
        return Array.from(range.getClientRects(), rect => rect.toJSON());
      };
      return rows.map(row => {
        const label = row.querySelector('b');
        const marks = row.querySelectorAll('.glyph');
        const labelRects = rects(label);
        const markRects = [...marks].flatMap(rects);
        const box = row.closest('.org-chart').getBoundingClientRect();
        const overlap = labelRects.some(a => markRects.some(b => Math.min(a.right, b.right) - Math.max(a.left, b.left) > .5 &&
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > .5));
        return { text: label.textContent.trim(), labelRects, markRects, overlap,
          inside: labelRects.every(rect => rect.left >= box.left - 1 && rect.right <= Math.min(innerWidth, box.right + 1)) };
      });
    });
    result.locales.push(row);
  }
  const issues = [];
  for (const row of result.locales) {
    for (const mode of ['compact', 'expanded']) {
      const { viewport, root, body, scrollX, overflow, main, mainClient } = row[mode];
      if (viewport !== width || Math.max(root, body) > width + 1 || main > mainClient + 1 || overflow.length || Math.abs(scrollX) > 1) issues.push(`${row.path} ${mode} horizontally overflows`);
    }
    if (row.seats.length !== 2) issues.push(`${row.path} expected two seat counts`);
    for (const seat of row.seats) {
      if (!seat.labelRects.length || new Set(seat.labelRects.map(rect => Math.round(rect.top))).size !== 1 || !seat.inside || seat.overlap) issues.push(`${row.path} ${seat.text} wraps, clips, or overlaps`);
    }
  }
  assert.ok(!issues.length, `${width}px: ${issues.join('; ')}`);
}

async function buttonFeedback(page, result) {
  await viewport(page, 1440);
  await open(page, '/#work');
  await anchorClear(page, '#work');
  const selector = disclosureFor('#work');
  const button = await visible(page, selector);
  const box = await button.boundingBox();
  const position = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const state = () => page.$eval(selector, node => {
    const properties = ['backgroundColor', 'borderColor', 'boxShadow', 'clipPath', 'color', 'filter', 'opacity', 'outlineColor', 'scale', 'textDecorationLine', 'transform', 'translate'];
    const read = (element, pseudo) => {
      const css = getComputedStyle(element, pseudo);
      return Object.fromEntries(properties.map(key => [key, css[key]]));
    };
    return { focused: node.matches(':focus-visible'), active: node.matches(':active'), expanded: node.getAttribute('aria-expanded'),
      styles: [read(node), read(node, '::after'), read(node.querySelector('span') || node, '::before')] };
  });
  result.rest = await state();
  await page.mouse.move(position.x, position.y);
  await sleep(230);
  result.hover = await state();
  await page.mouse.down();
  try {
    result.pressSamples = [];
    for (const ms of [20, 60, 100]) {
      await sleep(ms);
      result.pressSamples.push(await state());
    }
    result.down = result.pressSamples.find(sample => JSON.stringify(sample.styles) !== JSON.stringify(result.hover.styles)) || result.pressSamples.at(-1);
  } finally { await page.mouse.up(); }
  await page.waitForFunction(selector => document.querySelector(selector)?.getAttribute('aria-expanded') === 'true', wait, selector);
  result.open = await state();
  result.hoverChanges = JSON.stringify(result.rest.styles) !== JSON.stringify(result.hover.styles);
  result.pressChanges = JSON.stringify(result.down.styles) !== JSON.stringify(result.hover.styles);
  await page.keyboard.press('Escape');
  result.escape = await state();
  assert.equal(result.escape.expanded, 'false');
  assert.ok(result.down.active && result.pressChanges, 'Pointerdown has no distinct rendered style from hover');
}

async function stills(page, theme, result) {
  await viewport(page, 1440);
  await setTheme(page, theme);
  await atOpening(page);
  result.files = [];
  const shot = async label => {
    const name = `${theme}-${label}.png`;
    await page.screenshot({ path: resolve(output, name) });
    result.files.push(name);
  };
  await shot('opening');
  await enter(page);
  await openGroup(page, '#work');
  await shot('navigation');
  await page.keyboard.press('Escape');
  for (const id of ['structure', 'work', 'join']) {
    await reveal(page, `#${id} ${art}`);
    await shot(id);
  }
  await open(page, '/people.html');
  await stableScroll(page);
  await shot('people');
  await viewport(page, 320);
  await open(page, '/#structure');
  await reveal(page, '#structure .org-chart');
  await shot('320-structure');
}

async function clip(page, theme, result) {
  await viewport(page, 1440);
  await setTheme(page, theme);
  await atOpening(page);
  const filename = `${theme}-refresh.mp4`;
  const destination = resolve(output, filename);
  const recorder = await record(page, destination);
  const mark = (label, extra = {}) => recorder.mark(label, { url: page.url(), ...extra });
  let failure;
  try {
    mark('opening');
    await sleep(11900);
    mark('enter-home');
    await enter(page);
    mark('navigation');
    await sleep(650);
    for (const id of ['intro', 'position', 'structure']) {
      const { section } = site.chapters.find(chapter => chapter.id === id);
      await scrollChapter(page, section);
      mark(`chapter:${id}`, { scrollY: await page.evaluate(() => scrollY) });
      await sleep(620);
    }
    await openGroup(page, '/people.html');
    await sleep(500);
    mark('depart-for-people');
    await activate(page, findLink('/people.html'));
    await page.waitForFunction(() => location.pathname === '/people.html' && document.querySelector('main.detail'), wait);
    await stableScroll(page);
    mark('people-arrived');
    await sleep(1200);
  } catch (error) {
    failure = error;
    mark('error', { detail: error.message });
  }
  const { temp, ...timeline } = await recorder.stop();
  Object.assign(result, timeline);
  if (failure) throw failure;
  await rename(temp, destination);
  result.file = filename;
}

async function main() {
  const mode = process.argv[2] || '--help';
  if (mode === '--help') {
    console.log('Usage: node scripts/visual-refresh-qa.mjs --measure | --stable\n--measure writes a rehearsal report. --stable records final evidence and runs measurements.');
    return;
  }
  assert.ok(['--measure', '--stable'].includes(mode), `Unknown option ${mode}`);
  const stable = mode === '--stable';
  const release = await releaseInfo();
  const expectedRelease = process.env.ALETHIC_VISUAL_QA_RELEASE;
  if (expectedRelease) assert.equal(release.css.split('/')[2], expectedRelease, 'Preview is serving a different build');
  await mkdir(output, { recursive: true });
  const browser = await launch();
  const report = { origin, release, startedAt: new Date().toISOString(), browser: await browser.version(), mode, checks: [] };
  const filename = mode === '--measure' ? 'rehearsal.json' : 'measurements.json';
  const run = async (name, test, details = {}) => {
    const context = await browser.createBrowserContext();
    const result = { name, ...details, errors: [] };
    try {
      const page = await context.newPage();
      watch(page, result.errors);
      await test(page, result);
      assert.deepEqual(result.errors, []);
      result.status = 'pass';
    } catch (error) {
      result.status = 'fail';
      result.detail = error.stack || String(error);
      process.exitCode = 1;
    } finally {
      await context.close();
    }
    report.checks.push(result);
    await save(filename, report);
    console.log(`${result.status.toUpperCase()} ${name}${result.detail ? ` — ${result.detail.split('\n')[0]}` : ''}`);
    return result;
  };
  try {
    if (stable) {
      const clips = [];
      for (const theme of themes) {
        await run(`${theme}-stills`, (page, result) => stills(page, theme, result));
        clips.push(await run(`${theme}-clip`, (page, result) => clip(page, theme, result)));
        await save('timeline.json', { origin, release, browser: report.browser, clips });
      }
    }
    const colors = {};
    for (const theme of themes) for (const reduced of [false, true]) {
      const name = `${theme}-${reduced ? 'reduce' : 'default'}`;
      const opening = await run(`opening-${name}`, (page, result) => captureOpening(page, theme, reduced, result));
      if (!reduced) colors[theme] = opening.colors;
      await run(`chapters-${name}`, (page, result) => chapterArt(page, { theme, reduced, width: theme === 'light' ? 1440 : 390 }, result));
    }
    await run('opening-theme-contrast', (_, result) => {
      result.colors = colors;
      assert.ok(colors.light?.lightness > .55 && colors.dark?.lightness < .45 && colors.light.lightness - colors.dark.lightness > .25,
        `Opening background does not visibly switch between light and dark: ${JSON.stringify(colors)}`);
    });
    await run('button-feedback', buttonFeedback);
    for (const width of widths) {
      await run(`fit-and-seats-${width}`, (page, result) => fitAndSeats(page, width, result));
      for (const lang of ['zh', 'en']) {
        const reduced = lang === 'en';
        await run(`interactions-${width}-${lang}-${reduced ? 'reduce' : 'default'}`, (page, result) => interactions(page, { width, lang, reduced }, result), { width, lang, reduced });
      }
    }
    await run('build-identity', async () => assert.deepEqual(await releaseInfo(), release));
  } finally { await browser.close(); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main();
