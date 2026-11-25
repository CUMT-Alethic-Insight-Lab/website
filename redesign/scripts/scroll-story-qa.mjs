import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { digest, launch, open, origin, releaseInfo, sleep, viewport, watch } from './browser-qa.mjs';
import { record, stableScroll, tabTo } from './home-film.mjs';

const ui = {
  story: '[data-longform]', screen: '.story-screen[data-scene-page]', opening: '.opening',
  enter: '.opening a[href]', main: 'main', header: '[data-site-header]',
  brand: '[data-site-header] a.identity', theme: '[data-theme-toggle]', tools: '#site-tools-trigger',
  scene: 'canvas.page-scene', artFrame: '[data-scene-art]', quiet: '[data-scene-quiet]',
  direction: '[data-direction]', topic: '[data-topic]', meet: '[data-meeting]',
};
const order = ['position', 'structure', 'work', 'focus', 'projects', 'awards', 'work-mode', 'documents', 'join'];
const old = { about: 'position', structure: 'structure', research: 'work', focus: 'focus', projects: 'projects', awards: 'awards',
  agreement: 'work-mode', documents: 'documents', join: 'join' };
const widths = [320, 390, 768, 1440];
const menuToggle = '[data-site-nav-toggle]';
const languages = ['zh', 'en'];
const output = process.env.ALETHIC_STORY_QA_OUTPUT || fileURLToPath(new URL('../qa-output/scroll-story/', import.meta.url));
const tool = 'E:/projects/dsh/tools/ffmpeg/bin/ffmpeg.exe';
const ffmpeg = process.env.ALETHIC_FFMPEG || (existsSync(tool) ? tool : 'ffmpeg');
const wait = { timeout: 6000 };
const root = lang => lang === 'en' ? '/en/' : '/';
const save = (name, data) => writeFile(resolve(output, name), JSON.stringify(data, null, 2) + '\n');
const idOf = id => `#${id}`;
const motion = (page, reduced) => page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]);

async function activate(page, selector) {
  const hit = await page.waitForFunction(selector => [...document.querySelectorAll(selector)].find(node =>
    node.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && !node.closest('[inert]')), wait, selector);
  try {
    if (page.viewport().hasTouch) await hit.asElement().tap();
    else await hit.asElement().click();
  } finally { await hit.dispose(); }
}

async function longform(page, lang = 'zh', hash = '') {
  await open(page, root(lang) + hash);
  await page.waitForSelector(ui.story, wait);
  await page.waitForFunction(path => location.pathname === path, wait, root(lang));
  await stableScroll(page);
}

async function identity(page) {
  return page.evaluate(() => ({ origin: performance.timeOrigin, nav: performance.getEntriesByType('navigation').length, path: location.pathname }));
}

async function atScreen(page, id) {
  const active = await page.waitForFunction(({ selector, main }) => {
    const screen = document.querySelector(selector);
    const value = document.querySelector(main)?.dataset.activePage;
    const rect = screen?.getBoundingClientRect();
    if (!rect || rect.bottom <= 0 || rect.top >= innerHeight) return false;
    return value && value === screen.dataset.scenePage ? value : false;
  }, wait, { selector: idOf(id), main: ui.main });
  return active.jsonValue();
}

async function enter(page, initial) {
  await activate(page, ui.enter);
  await atScreen(page, 'position');
  await stableScroll(page);
  assert.deepEqual(await identity(page), initial, 'Opening click navigated to another document');
}

async function roll(page, id, native = true) {
  const selector = idOf(id);
  if (!native) {
    await page.$eval(selector, node => node.scrollIntoView({ block: 'start', behavior: 'instant' }));
    if (id === 'position') {
      // The first anchor can leave a narrow strip of the opening above the sticky nav.
      await page.$eval(ui.opening, node => {
        const remainder = node.getBoundingClientRect().bottom;
        if (remainder > 1) scrollBy({ top: Math.ceil(remainder), behavior: 'instant' });
      });
    }
    await stableScroll(page);
    return atScreen(page, id);
  }
  const { width, height } = page.viewport();
  await page.mouse.move(width * .65, height * .74);
  const deadline = performance.now() + 23000;
  let noProgress = 0;
  while (performance.now() < deadline && noProgress < 7) {
    const state = await page.$eval(selector, (section, header) => {
      const rect = section.getBoundingClientRect();
      const bottom = document.querySelector(header)?.getBoundingClientRect().bottom || 0;
      const remaining = document.scrollingElement.scrollHeight - innerHeight - scrollY;
      return { distance: Math.round(rect.top - Math.max(bottom + 6, innerHeight * .17)), y: scrollY, remaining };
    }, ui.header);
    if (state.distance <= 4 || state.remaining <= 2) break;
    await page.mouse.wheel({ deltaY: Math.min(85, state.distance) });
    await sleep(35);
    noProgress = await page.evaluate(y => Math.abs(scrollY - y) < 1, state.y) ? noProgress + 1 : 0;
  }
  await stableScroll(page);
  return atScreen(page, id);
}

async function checkLayout(page, result, width, lang) {
  await viewport(page, width);
  await longform(page, lang);
  const documentId = await identity(page);
  result.layout = await page.evaluate(({ story, screen, opening, main }) => {
    const root = document.documentElement;
    const content = document.querySelector(main);
    const opener = document.querySelector(opening)?.getBoundingClientRect();
    return { language: root.lang, width: innerWidth, height: innerHeight, rootWidth: root.scrollWidth,
      scrollSnapType: getComputedStyle(document.scrollingElement).scrollSnapType,
      openerHeight: opener?.height, insideScroll: getComputedStyle(document.querySelector(story)).overflowY,
      contentWidth: content.scrollWidth, contentClient: content.clientWidth,
      ids: [...document.querySelector(story).querySelectorAll(screen)].map(node => node.id) };
  }, ui);
  const layout = result.layout;
  assert.ok(new RegExp(`^${lang}(?:-|$)`, 'i').test(layout.language));
  assert.equal(layout.width, width);
  assert.ok(layout.rootWidth <= width + 1 && layout.contentWidth <= layout.contentClient + 1,
    `Horizontal overflow ${JSON.stringify(layout)}`);
  assert.ok(Math.abs(layout.openerHeight - layout.height) <= 2, 'Opening is not a full viewport');
  assert.ok(!['auto', 'scroll'].includes(layout.insideScroll), 'Longform uses an internal scroll container');
  assert.deepEqual(layout.ids, order);
  assert.equal(layout.scrollSnapType, 'none', 'Document scrolling is snapped');
  result.screens = [];
  for (const id of order) {
    const active = await roll(page, id, false);
    assert.deepEqual(await identity(page), documentId, `Document changed at ${id}`);
    const room = await page.$eval(idOf(id), (node, header) => {
      const rect = node.getBoundingClientRect();
      const head = document.querySelector(header);
      const sticky = head && ['sticky', 'fixed'].includes(getComputedStyle(head).position) ? head.getBoundingClientRect().height : 0;
      const heading = node.querySelector('h1,h2,h3');
      const title = heading?.getBoundingClientRect();
      const hit = title && document.elementFromPoint(title.left + Math.min(title.width / 2, 10), title.top + 3);
      return { height: rect.height, minHeight: Math.max(0, innerHeight - sticky), viewport: innerHeight,
        top: rect.top, scrollY, page: node.dataset.scenePage, contentHeight: node.scrollHeight, clientHeight: node.clientHeight,
        title: heading?.textContent.trim(), titleCovered: !!hit?.closest(header) && !node.contains(hit) };
    }, ui.header);
    result.screens.push({ id, active, ...room });
    assert.ok(room.height >= room.minHeight - 2, `${id} is ${room.height}px, expected at least ${room.minHeight}px`);
    assert.ok(room.title && !room.titleCovered, `Title missing or covered in ${id}`);
    assert.ok(room.contentHeight <= room.clientHeight + 2, `Vertical clipping or overflow in ${id}`);
  }
  result.tallScreens = result.screens.filter(row => row.height > row.minHeight + 96)
    .map(row => ({ id: row.id, height: Math.round(row.height), extra: Math.round(row.height - row.minHeight) }));
}

async function menu(page, result, lang, width) {
  await viewport(page, width);
  await longform(page, lang, '#entry');
  const documentId = await identity(page);
  await atScreen(page, 'position');
  await page.focus(ui.brand);
  const research = '[data-site-chapter="work"]';
  const trigger = `[data-site-group]:has(${research}) [data-site-disclosure]`;
  const expanded = (selector, expected) => page.waitForFunction(({ selector, expected }) =>
    document.querySelector(selector)?.getAttribute('aria-expanded') === String(expected), wait, { selector, expected });
  const narrow = await page.$eval(menuToggle, button => button.checkVisibility());
  if (narrow) {
    result.tabsToMenu = await tabTo(page, menuToggle);
    await page.keyboard.press('Enter');
    await expanded(menuToggle, true);
  }
  result.tabsToGroup = await tabTo(page, trigger);
  await page.keyboard.press('ArrowDown');
  await expanded(trigger, true);
  assert.ok(await page.$eval(trigger, node => document.getElementById(node.getAttribute('aria-controls')).contains(document.activeElement)));
  await page.keyboard.press('Escape');
  await expanded(trigger, false);
  assert.ok(await page.$eval(trigger, button => button === document.activeElement));
  if (narrow) {
    await page.keyboard.press('Escape');
    await expanded(menuToggle, false);
    assert.ok(await page.$eval(menuToggle, node => node === document.activeElement));
    await page.keyboard.press('Enter');
    await expanded(menuToggle, true);
    await tabTo(page, trigger);
  }
  await page.keyboard.press('ArrowDown');
  await tabTo(page, research);
  await page.keyboard.press('Enter');
  await atScreen(page, 'work');
  await expanded(trigger, false);
  if (narrow) await expanded(menuToggle, false);
  assert.deepEqual(await identity(page), documentId, 'Menu changed document');
  result.current = await page.$eval(research, link => ({ hash: location.hash, current: link.getAttribute('aria-current'), scrollY }));
  assert.equal(result.current.hash, '#work');
  assert.equal(result.current.current, 'location');
  await page.goBack();
  await atScreen(page, 'position');
  assert.deepEqual(await identity(page), documentId, 'Back after an anchor changed document');
  assert.equal(new URL(page.url()).hash, '#entry');
}

async function brandNavigation(page, result, lang) {
  await viewport(page, 1440);
  await longform(page, lang, '#join');
  const previous = await identity(page);
  result.href = await page.$eval(ui.brand, node => node.getAttribute('href'));
  await activate(page, ui.brand);
  await page.waitForFunction(() => scrollY <= 2, wait);
  result.sameDocument = (await identity(page)).origin === previous.origin;
  assert.ok(result.sameDocument, `Brand link ${result.href} reloaded the longform to return to the opening`);
}

async function getDirections(page) {
  const directions = await page.$$eval(ui.direction, nodes => nodes.map(node => node.dataset.direction));
  assert.equal(directions.length, 7);
  assert.equal(new Set(directions).size, 7);
  return directions;
}

async function selectedDirection(page, id) {
  await page.waitForFunction(({ topic, direction, id }) => {
    const active = [...document.querySelectorAll(topic)].filter(node => !node.hidden);
    return location.hash === `#${id}` && active.length === 1 && active[0].id === id &&
      document.querySelector(`${direction}[data-direction="${id}"]`)?.getAttribute('aria-current') === 'true';
  }, wait, { topic: ui.topic, direction: ui.direction, id });
}

async function bitmap(page, selector, crop) {
  return page.$eval(selector, (canvas, crop) => {
    const width = canvas.width, height = canvas.height;
    const probe = new OffscreenCanvas(width, height);
    const pen = probe.getContext('2d', { willReadFrequently: true });
    pen.drawImage(canvas, 0, 0);
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(width * crop[0]), y = Math.floor(height * crop[1]);
    const w = Math.max(1, Math.floor(width * (crop[2] - crop[0])));
    const h = Math.max(1, Math.floor(height * (crop[3] - crop[1])));
    const pixels = pen.getImageData(x, y, w, h).data;
    let hash = 2166136261, ink = 0, strong = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      if (pixels[offset + 3]) ink++;
      if (pixels[offset + 3] >= 60) strong++;
      hash = Math.imul(hash ^ (pixels[offset] | pixels[offset + 1] << 8 | pixels[offset + 2] << 16 | pixels[offset + 3] << 24), 16777619);
    }
    return { hash: hash >>> 0, pixels: w * h, ink, strong, width, height, cssWidth: rect.width, cssHeight: rect.height };
  }, crop);
}

async function directions(page, result, width, lang) {
  await viewport(page, width);
  await motion(page, true);
  await longform(page, lang, '#work');
  await atScreen(page, 'work');
  const ids = await getDirections(page);
  const documentId = await identity(page);
  result.frames = [];
  const first = `${ui.direction}[data-direction="${ids[0]}"]`;
  await activate(page, first);
  await selectedDirection(page, ids[0]);
  await page.focus(first);
  for (const [index, id] of ids.entries()) {
    if (index) await page.keyboard.press('ArrowDown');
    await selectedDirection(page, id);
    await stableScroll(page);
    // Keep the camera fixed during each pair, so ambient motion cannot masquerade as a new direction shape.
    const state = await page.$eval(ui.scene, canvas => canvas.dataset.sceneSelection);
    const a = await bitmap(page, ui.scene, [.08, .13, .98, .94]);
    await sleep(190);
    const b = await bitmap(page, ui.scene, [.08, .13, .98, .94]);
    result.frames.push({ id, state, first: a, second: b, scrollY: await page.evaluate(() => scrollY) });
    assert.ok(state === id || state === `#${id}`, `Scene did not follow ${id} (${state})`);
    assert.ok(a.ink > 15 && a.hash === b.hash, `Reduced direction did not settle: ${id}`);
    assert.deepEqual(await identity(page), documentId);
  }
  assert.equal(new Set(result.frames.map(row => row.first.hash)).size, 7, 'One or more research bitmap frames are identical');
  const scrolls = result.frames.map(frame => frame.scrollY);
  assert.ok(Math.max(...scrolls) - Math.min(...scrolls) <= 2, 'Changing direction moved the page camera');
  await page.keyboard.press('ArrowDown');
  await selectedDirection(page, ids[0]);
  await page.keyboard.press('End');
  await selectedDirection(page, ids.at(-1));
  await page.keyboard.press('Home');
  await selectedDirection(page, ids[0]);
}

async function theme(page, requested, lang) {
  await longform(page, lang, '#position');
  if (await page.$eval('html', node => node.dataset.theme) !== requested) {
    const visible = await page.$eval(ui.theme, node => node.checkVisibility());
    if (!visible) await activate(page, ui.tools);
    await activate(page, ui.theme);
  }
  await page.waitForFunction(value => document.documentElement.dataset.theme === value, wait, requested);
  assert.equal(await page.$eval(ui.theme, node => node.getAttribute('aria-pressed')), String(requested === 'dark'));
}

async function quietZones(page, result, requested, reduced) {
  await viewport(page, 1440);
  await motion(page, reduced);
  await theme(page, requested, 'zh');
  result.screens = [];
  for (const id of ['position', 'work', 'join']) {
    await roll(page, id, false);
    await page.waitForSelector(`${ui.scene}[data-scene-visible="true"]`, wait);
    const rectangles = await page.$eval(idOf(id), (screen, selectors) => {
      const clip = box => [Math.max(0, box.left) / innerWidth, Math.max(0, box.top) / innerHeight,
        Math.min(innerWidth, box.right) / innerWidth, Math.min(innerHeight, box.bottom) / innerHeight];
      const canSample = box => box.width > 15 && box.height > 5 && box.top >= 35 && box.bottom <= innerHeight;
      const text = [...screen.querySelectorAll(`${selectors.quiet}, h1, h2, p`)].filter(node => node.checkVisibility())
        .map(node => node.getBoundingClientRect()).filter(canSample).slice(0, 5).map(clip);
      const art = [...screen.querySelectorAll(selectors.artFrame)].map(node => node.getBoundingClientRect()).find(canSample);
      return { text, art: art ? clip(art) : [.70, .21, .94, .48], explicitArt: !!art };
    }, ui);
    assert.ok(rectangles.text.length, `No visible text to sample in ${id}`);
    const text = [];
    for (const box of rectangles.text) text.push(await bitmap(page, ui.scene, box));
    const art = await bitmap(page, ui.scene, rectangles.art);
    const after = await bitmap(page, ui.scene, [0, 0, 1, 1]);
    await sleep(380);
    const later = await bitmap(page, ui.scene, [0, 0, 1, 1]);
    const density = data => data.strong / data.pixels;
    const average = text.reduce((sum, data) => sum + density(data), 0) / text.length;
    result.screens.push({ id, requested, reduced, rectangles, quietDensity: average, artDensity: density(art), text, art, after, later });
    assert.ok(after.ink > 15, `No scene decoration at ${id}`);
    assert.equal(after.hash === later.hash, reduced, `Unexpected idle motion at ${id}`);
    // An explicitly marked artwork frame is the visual control for this comparison.
    if (rectangles.explicitArt && density(art) > .003) assert.ok(average < density(art), `Strong scene marks intrude into text in ${id}`);
  }
}

async function sceneCoverage(page, result) {
  await viewport(page, 1440);
  await motion(page, true);
  await longform(page, 'zh', '#entry');
  result.scenes = [];
  for (const id of order) {
    const file = await roll(page, id, false);
    await page.waitForFunction(({ selector, file }) => {
      const canvas = document.querySelector(selector);
      return canvas?.dataset.scenePage === file && canvas.dataset.sceneVisible === 'true';
    }, wait, { selector: ui.scene, file });
    const descriptor = await page.$eval(ui.scene, canvas => ({ motif: canvas.dataset.sceneMotif, kind: canvas.dataset.scene }));
    const pixels = await bitmap(page, ui.scene, [0, 0, 1, 1]);
    result.scenes.push({ id, file, ...descriptor, pixels });
    assert.ok(descriptor.kind && descriptor.motif && pixels.ink > 15, `No visible scene at ${id}`);
  }
  assert.equal(new Set(result.scenes.map(row => row.kind)).size, order.length, 'A scene kind is reused');
  assert.equal(new Set(result.scenes.map(row => row.pixels.hash)).size, order.length, 'A scene bitmap is reused');
}

async function joinCTA(page, result) {
  const selector = '#join .join-start a[href="/recruitment/"]';
  result.samples = [];
  for (const width of [390, 1440]) for (const lang of languages) {
    await viewport(page, width);
    for (const requested of ['light', 'dark']) {
      await theme(page, requested, lang);
      await roll(page, 'join', false);
      const style = await page.$eval(selector, anchor => {
        const style = getComputedStyle(anchor);
        const { left, right, top, bottom } = anchor.getBoundingClientRect();
        return { text: anchor.textContent.trim(), color: style.color, background: style.backgroundColor,
          hittable: anchor.contains(document.elementFromPoint((left + right) / 2, (top + bottom) / 2)) };
      });
      result.samples.push({ width, lang, theme: requested, ...style });
    }
  }
  result.screenshots = ['light-join.png', 'dark-join.png'];
  assert.ok(result.samples.every(row => row.hittable && row.text && row.color !== row.background),
    'Recruitment CTA label uses the same color as its background');
}

async function projectDirectory(page, result) {
  await viewport(page, 390);
  await longform(page, 'zh', '#projects');
  const selector = '#projects .story-directory';
  const measure = () => page.$eval(selector, node => ({ open: node.open,
    height: node.closest('.story-screen').getBoundingClientRect().height,
    visible: node.querySelector('.project-directory').checkVisibility({ contentVisibilityAuto: true }) }));
  result.before = await measure();
  assert.equal(result.before.open, false);
  await activate(page, `${selector} summary`);
  result.expanded = await measure();
  assert.ok(result.expanded.open && result.expanded.visible && result.expanded.height > result.before.height);
  await activate(page, `${selector} summary`);
  result.closed = await measure();
  assert.equal(result.closed.open, false);
}

async function accessibleNames(page, result, lang) {
  await viewport(page, 390);
  await longform(page, lang, '#position');
  const cdp = await page.createCDPSession();
  try {
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    result.controls = nodes.filter(node => !node.ignored && ['button', 'link', 'combobox'].includes(node.role?.value))
      .map(node => ({ role: node.role.value, name: node.name?.value || '', node: node.backendDOMNodeId }));
    const empty = result.controls.filter(node => !node.name.trim());
    assert.ok(result.controls.length > 12, 'Not enough accessible links and buttons exposed');
    for (const node of empty) {
      const described = await cdp.send('DOM.describeNode', { backendNodeId: node.node });
      node.attributes = described.node.attributes;
    }
    result.unnamed = empty;
    assert.ok(!empty.length, `Unnamed links or icon controls: ${JSON.stringify(empty)}`);
  } finally { await cdp.detach(); }
}

async function compatibility(page, result, lang) {
  await viewport(page, 390);
  result.redirects = [];
  for (const [slug, target] of [...Object.entries(old), ['research#direction-memory', 'direction-memory']]) {
    const [file, hash] = slug.split('#');
    const request = `${root(lang)}${file}.html${hash ? `#${hash}` : ''}`;
    try {
      await page.goto(new URL(request, origin).href, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(({ path, target }) => location.pathname === path && location.hash === `#${target}`,
        wait, { path: root(lang), target });
      if (hash) await selectedDirection(page, hash);
      else await atScreen(page, target);
      result.redirects.push({ request, landed: page.url(), pass: true });
    } catch (error) { result.redirects.push({ request, landed: page.url(), pass: false, message: error.message }); }
  }
  assert.ok(result.redirects.every(redirect => redirect.pass), 'Compatibility routes failed');
}

async function tour(page, result, width, filename) {
  await viewport(page, width);
  await longform(page);
  await page.waitForSelector(`${ui.opening} canvas`, { ...wait, visible: true });
  const documentId = await identity(page);
  const recorder = filename ? await record(page, resolve(output, filename)) : null;
  result.steps = [];
  const mark = async (label, delay = 0, state = {}) => {
    const event = { label, url: page.url(), scrollY: await page.evaluate(() => scrollY), ...state };
    result.steps.push(event);
    recorder?.mark(label, event);
    if (recorder && delay) await sleep(delay);
  };
  let failure;
  try {
    await mark('opening', 11800);
    await mark('click-entry');
    await enter(page, documentId);
    for (const id of order) {
      const active = await roll(page, id);
      assert.deepEqual(await identity(page), documentId);
      await mark(`screen:${id}`, 740, { active });
      if (id === 'work') {
        for (const direction of await getDirections(page)) {
          await activate(page, `${ui.direction}[data-direction="${direction}"]`);
          await selectedDirection(page, direction);
          assert.deepEqual(await identity(page), documentId);
          await mark(`direction:${direction}`, 840);
        }
      }
    }
    await mark('back-to-opening');
    await activate(page, ui.brand);
    await page.waitForFunction(() => scrollY <= 2, wait);
    assert.deepEqual(await identity(page), documentId, 'Brand return changed document');
    await mark('opening-returned', 1450);
  } catch (error) { failure = error; await mark('tour-error', 300, { message: error.message }); }
  if (recorder) {
    const { temp, ...timing } = await recorder.stop();
    Object.assign(result, timing);
    if (!failure) {
      await rename(temp, resolve(output, filename));
      result.file = filename;
      execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-xerror', '-i', resolve(output, filename), '-f', 'null', '-']);
    }
  }
  if (failure) throw failure;
}

async function keyframes(page, result, requested) {
  await viewport(page, 1440);
  await theme(page, requested, 'zh');
  await longform(page);
  result.files = [];
  const shot = async name => {
    const file = `${requested}-${name}.png`;
    const data = await page.screenshot({ path: resolve(output, file) });
    result.files.push({ file, sha256: digest(data) });
  };
  await shot('opening');
  for (const id of order) {
    await roll(page, id, false);
    await shot(id);
  }
  await roll(page, 'work', false);
  for (const direction of ['direction-llm', 'direction-memory', 'direction-infra']) {
    await activate(page, `${ui.direction}[data-direction="${direction}"]`);
    await selectedDirection(page, direction);
    await sleep(350);
    await shot(direction);
  }
}

async function main() {
  const mode = process.argv[2] || '--help';
  if (mode === '--help') {
    console.log('Usage: node scripts/scroll-story-qa.mjs --measure | --ready | --audit\n--measure rehearses without media. --ready captures and measures. --audit adds targeted checks to existing evidence from the same build.');
    return;
  }
  assert.ok(['--measure', '--ready', '--audit'].includes(mode), `Unknown mode ${mode}`);
  const release = await releaseInfo();
  const expected = process.env.ALETHIC_STORY_RELEASE;
  if (expected) assert.equal(release.css.split('/')[2], expected, 'Different build is active');
  const live = await fetch(new URL('/', origin));
  if (!(await live.text()).includes('data-longform')) {
    console.error(`Longform build unavailable at ${origin} (${release.css})`);
    process.exitCode = 1;
    return;
  }
  await mkdir(output, { recursive: true });
  const browser = await launch();
  const audit = mode === '--audit';
  const report = audit ? JSON.parse(await readFile(resolve(output, 'report.json'), 'utf8')) :
    { mode, origin, release, startedAt: new Date().toISOString(), browser: await browser.version(), checks: [] };
  if (audit) {
    assert.deepEqual(report.release, release, 'Existing media belongs to a different build');
    report.auditAt = new Date().toISOString();
  }
  const capture = mode === '--ready';
  const only = !capture && process.env.ALETHIC_STORY_CHECKS ? new RegExp(process.env.ALETHIC_STORY_CHECKS) : null;
  const run = async (name, task) => {
    if (only && !only.test(name)) return;
    const result = { name, errors: [] };
    const context = await browser.createBrowserContext();
    try {
      const page = await context.newPage();
      await page.setRequestInterception(true);
      page.on('request', request => {
        const url = new URL(request.url());
        if (url.origin === new URL(origin).origin && url.pathname === '/recruitment/api/auth/me') {
          void request.respond({ status: 200, contentType: 'application/json', body: '{}' }).catch(() => {});
        } else void request.continue().catch(() => {});
      });
      watch(page, result.errors);
      await task(page, result);
      assert.deepEqual(result.errors, [], 'Browser reported errors');
      result.status = 'pass';
    } catch (error) { result.status = 'fail'; result.issue = error.stack || String(error); process.exitCode = 1; }
    finally { await context.close(); }
    report.checks = report.checks.filter(check => check.name !== name);
    report.checks.push(result);
    await save(capture || audit ? 'report.json' : 'rehearsal.json', report);
    console.log(`${result.status.toUpperCase()} ${name}${result.issue ? ` — ${result.issue.split('\n')[0]}` : ''}`);
    return result;
  };
  const auditChecks = async () => {
    await run('scene-coverage', sceneCoverage);
    await run('mobile-project-directory', projectDirectory);
    await run('join-cta-visibility', joinCTA);
  };
  try {
    if (audit) {
      await auditChecks();
      await run('build-identity', async () => assert.deepEqual(await releaseInfo(), release));
      return;
    }
    const tours = [];
    for (const [device, width] of [['desktop', 1440], ['mobile', 390]]) {
      const evidence = await run(`${device}-tour`, (page, result) => tour(page, result, width, capture ? `${device}-tour.mp4` : null));
      if (evidence) tours.push(evidence);
      if (capture) await save('timeline.json', { release, origin, browser: report.browser, tours });
    }
    for (const value of ['light', 'dark']) {
      if (capture) await run(`${value}-keyframes`, (page, result) => keyframes(page, result, value));
      for (const reduced of [false, true]) await run(`quiet-${value}-${reduced}`, (page, result) => quietZones(page, result, value, reduced));
    }
    for (const lang of languages) {
      for (const width of widths) await run(`layout-${lang}-${width}`, (page, result) => checkLayout(page, result, width, lang));
      for (const width of [390, 1440]) {
        await run(`menu-${lang}-${width}`, (page, result) => menu(page, result, lang, width));
        await run(`directions-${lang}-${width}`, (page, result) => directions(page, result, width, lang));
      }
      await run(`brand-return-${lang}`, (page, result) => brandNavigation(page, result, lang));
      await run(`accessible-names-${lang}`, (page, result) => accessibleNames(page, result, lang));
      await run(`compatibility-${lang}`, (page, result) => compatibility(page, result, lang));
    }
    await auditChecks();
    await run('build-identity', async () => assert.deepEqual(await releaseInfo(), release));
  } finally { await browser.close(); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main();
