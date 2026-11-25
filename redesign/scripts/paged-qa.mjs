import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { digest, launch, open, origin, releaseInfo, sleep, viewport, watch } from './browser-qa.mjs';
import { record } from './home-film.mjs';

// Paged markup contract. Override keys from the handoff with ALETHIC_PAGED_CONFIG (JSON file).
const defaults = {
  opener: '.opening', enter: '.opening a[href]', header: '[data-site-header]',
  mobileMenu: '[data-site-nav-toggle]', disclosure: '[data-site-disclosure]',
  tools: null, account: '[data-site-account]', theme: '[data-theme-toggle]', locale: '[data-language]',
  primary: '[data-primary]', next: '[data-next-topic]',
  directions: '[data-direction]', topic: '[data-topic]', model: '[data-ruler-select]',
  scene: 'canvas.page-scene', transfer: 'canvas.page-scene-transfer',
};
const topics = ['about', 'structure', 'research', 'focus', 'projects', 'awards', 'agreement', 'documents', 'join'];
const details = ['flued', 'flued-architecture', 'flued-demo', 'flued-evidence', 'flued-experiments', 'people', 'insights-memory-hierarchy'];
const files = ['index.html', ...[...topics, ...details].map(name => `${name}.html`), '404.html'];
const core = ['about.html', 'structure.html', 'research.html', 'flued.html'];
const widths = [320, 390, 768, 1440];
const languages = ['zh', 'en'];
const legacy = [['#direction-memory', 'research.html', '#direction-memory'], ['#awards', 'awards.html'],
  ['#top', 'index.html'], ['#entry', 'about.html']];
const output = process.env.ALETHIC_PAGED_OUTPUT || fileURLToPath(new URL('../qa-output/paged/', import.meta.url));
const tool = 'E:/projects/dsh/tools/ffmpeg/bin/ffmpeg.exe';
const ffmpeg = process.env.ALETHIC_FFMPEG || (existsSync(tool) ? tool : 'ffmpeg');
const wait = { timeout: 6500 };
const route = (file, lang = 'zh') => `${lang === 'en' ? '/en' : ''}/${file === 'index.html' ? '' : file}`;
const pathname = url => new URL(url).pathname;
const isLocale = (lang, htmlLang) => new RegExp(`^${lang}(?:-|$)`, 'i').test(htmlLang);
const save = (file, body) => writeFile(resolve(output, file), JSON.stringify(body, null, 2) + '\n');
let config = defaults;

// Returns actionable descendants only. Page content remains in the original document.
const anchors = (selector, href, operator = '=') => `:is(${selector}, :is(${selector}) a):is(a[href${operator}${JSON.stringify(href)}])`;
async function click(page, selector) {
  const handle = await page.waitForFunction(selector => [...document.querySelectorAll(selector)].find(node =>
    node.checkVisibility({ opacityProperty: true, visibilityProperty: true }) && !node.closest('[inert]')), wait, selector);
  try {
    const element = handle.asElement();
    if (page.viewport().hasTouch) await element.tap();
    else await element.click();
  } finally { await handle.dispose(); }
}

async function at(page, file, lang, hash) {
  const urlPath = route(file, lang);
  await page.waitForFunction(({ urlPath, hash, file }) => location.pathname === urlPath &&
    (hash === undefined || location.hash === hash) && document.querySelector('main')?.dataset.page === file,
  wait, { urlPath, hash, file });
  await page.evaluate(() => document.fonts.ready.then(() => true));
}

async function visit(page, file, lang, hash = '') {
  await open(page, route(file, lang) + hash);
  await at(page, file, lang, hash || undefined);
}

async function follow(page, selector, file, lang, hash) {
  await click(page, selector);
  await at(page, file, lang, hash);
}

async function settle(page) {
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-transit'), wait);
  await sleep(220);
}

async function geometry(page, file, lang, width) {
  await visit(page, file, lang);
  const state = await page.evaluate(({ opener, header: headerSelector, primary, next }) => {
    const main = document.querySelector('main');
    const header = document.querySelector(headerSelector);
    const heading = main.querySelector('h1');
    const field = document.querySelector(opener);
    const within = (node, pad = 1) => {
      const { left, right } = node.getBoundingClientRect();
      return left >= -pad && right <= innerWidth + pad;
    };
    const targets = (scope, selector) => Array.from(scope.querySelectorAll(selector)).flatMap(node =>
      node.matches('a[href]') ? [node.href] : Array.from(node.querySelectorAll('a[href]'), anchor => anchor.href));
    return { file: main.dataset.page, lang: document.documentElement.lang,
      title: document.title, heading: heading?.textContent.trim() || null, width: innerWidth, height: innerHeight,
      rootWidth: document.documentElement.scrollWidth, mainWidth: main.scrollWidth, mainClient: main.clientWidth,
      heightOfDocument: document.scrollingElement.scrollHeight,
      openerHeight: field?.getBoundingClientRect().height || 0, headerVisible: !!header?.checkVisibility({ opacityProperty: true, visibilityProperty: true }),
      primary: targets(main, primary), next: targets(document, next),
      outside: Array.from(main.querySelectorAll('h1,h2,h3,p,button,canvas,select')).filter(node =>
        node.checkVisibility() && !within(node)).slice(0, 8).map(node => ({ tag: node.tagName, text: node.textContent.trim().slice(0, 50) })),
    };
  }, config);
  const issues = [];
  if (!state.title || (file !== 'index.html' && !state.heading)) issues.push('Missing page title or visible editorial heading');
  if (!isLocale(lang, state.lang)) issues.push(`Document language ${state.lang}`);
  if (state.width !== width || state.rootWidth > width + 1 || state.mainWidth > state.mainClient + 1 || state.outside.length) issues.push('Horizontal overflow');
  if (file === 'index.html') {
    if (Math.abs(state.openerHeight - state.height) > 2 || state.heightOfDocument > state.height + 2) issues.push('Landing is not one full viewport');
  } else if (topics.includes(file.slice(0, -5))) {
    if (!state.primary.length) issues.push('No linked primary CTA');
    if (!state.next.length) issues.push('No linked footer topic navigation');
    const localized = url => !files.some(candidate => pathname(url) === route(candidate)) || lang === 'zh';
    if ([...state.primary, ...state.next].some(url => new URL(url).origin === new URL(origin).origin && !localized(url))) issues.push('English CTA points at a Chinese topic');
  }
  return { ...state, issues };
}

async function pageMatrix(page, result, width, lang) {
  await viewport(page, width);
  result.routes = [];
  for (const file of files) {
    try { result.routes.push(await geometry(page, file, lang, width)); }
    catch (error) { result.routes.push({ file, issues: [error.message] }); }
  }
  const failed = result.routes.filter(row => row.issues.length);
  assert.ok(!failed.length, failed.map(row => `${row.file}: ${row.issues.join(', ')}`).join(' | '));
}

async function focusFromTab(page, selector) {
  for (let tabs = 0; tabs < 65; tabs++) {
    if (await page.evaluate(selector => document.activeElement.matches(selector), selector)) return tabs;
    await page.keyboard.press('Tab');
  }
  assert.fail(`Tab did not reach ${selector}`);
}

async function hitAnchor(page, hash) {
  return page.evaluate(hash => {
    const node = document.getElementById(hash.slice(1));
    if (!node || node.hidden) return { found: !!node, visible: false, covered: false };
    const target = node.querySelector('h1,h2,h3') || node;
    const box = target.getBoundingClientRect();
    const y = box.top + Math.min(5, box.height / 2);
    const x = box.left + Math.min(15, box.width / 2);
    const hit = document.elementFromPoint(x, y);
    return { found: true, visible: y >= 0 && y < innerHeight && x >= 0 && x < innerWidth,
      covered: !!hit?.closest('[data-site-header]') && !node.contains(hit), top: box.top, scrollY };
  }, hash);
}

async function compat(page, result, lang) {
  await viewport(page, 390);
  result.redirects = [];
  for (const [oldHash, file, finalHash] of legacy) {
    const evidence = { oldHash, file };
    try {
      await open(page, route('index.html', lang) + oldHash);
      await at(page, file, lang, finalHash);
      await settle(page);
      evidence.landed = page.url();
      if (finalHash) {
        evidence.anchor = await hitAnchor(page, finalHash);
        assert.ok(evidence.anchor.found && evidence.anchor.visible && !evidence.anchor.covered, `Legacy ${finalHash} is not visible`);
      }
      if (file === 'index.html') assert.ok(await page.$(config.enter), '#top lost the opening entry control');
      evidence.status = 'pass';
    } catch (error) { evidence.landed = page.url(); evidence.status = 'fail'; evidence.issue = error.message; }
    result.redirects.push(evidence);
  }
  await visit(page, 'about.html', lang, '#entry');
  result.entry = await hitAnchor(page, '#entry');
  assert.ok(result.entry.found && !result.entry.covered, 'About #entry anchor not present or covered');
  assert.ok(result.redirects.every(row => row.status === 'pass'), 'One or more legacy links failed');
}

async function revealHeaderLink(page, href, lang) {
  const path = route(href, lang);
  const link = `${config.header} a[href="${path}"]`;
  const clickable = selector => page.evaluate(selector => Array.from(document.querySelectorAll(selector)).some(node =>
    node.checkVisibility({ opacityProperty: true, visibilityProperty: true })), selector);
  if (await clickable(link)) return link;
  if (await clickable(`:is(${config.mobileMenu})[aria-expanded="false"]`)) await click(page, `:is(${config.mobileMenu})[aria-expanded="false"]`);
  if (await clickable(link)) return link;
  const trigger = await page.evaluate(({ header, disclosure, path }) => {
    for (const button of document.querySelectorAll(`${header} ${disclosure}[aria-controls]`)) {
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      if (panel && Array.from(panel.querySelectorAll('a[href]')).some(anchor => anchor.getAttribute('href') === path)) {
        return `#${CSS.escape(button.id)}`;
      }
    }
    return null;
  }, { header: config.header, disclosure: config.disclosure, path });
  assert.ok(trigger, `No header disclosure for ${path}`);
  await click(page, trigger);
  await page.waitForSelector(link, { ...wait, visible: true });
  return link;
}

async function chooseResearch(page, result, lang) {
  await visit(page, 'research.html', lang);
  const memory = `${config.directions}[data-direction="direction-memory"]`;
  await click(page, memory);
  await at(page, 'research.html', lang, '#direction-memory');
  const state = () => page.$$eval(config.topic, nodes => nodes.filter(node => !node.hidden).map(node => node.id));
  result.selected = await state();
  assert.deepEqual(result.selected, ['direction-memory']);
  assert.equal(await page.$eval(memory, node => node.getAttribute('aria-current')), 'true');
  await page.focus(memory);
  await page.keyboard.press('ArrowDown');
  result.keyboard = await page.evaluate(() => document.activeElement?.dataset.direction);
  assert.ok(result.keyboard && result.keyboard !== 'direction-memory');
  assert.deepEqual(await state(), [result.keyboard]);
  await page.goBack();
  await at(page, 'research.html', lang, '#direction-memory');
  assert.deepEqual(await state(), ['direction-memory']);
  await page.goForward();
  await at(page, 'research.html', lang, `#${result.keyboard}`);
  assert.deepEqual(await state(), [result.keyboard]);
}

async function changeModel(page, result, lang) {
  // The selector may live on a topic or on the original FLUED detail page.
  const candidates = ['about.html', 'research.html', 'projects.html', 'flued.html', 'flued-demo.html'];
  for (const file of candidates) {
    await visit(page, file, lang);
    if (!(await page.$(config.model))) continue;
    const state = () => page.$eval(config.model, select => ({ value: select.value,
      count: select.closest('.cut-row')?.querySelector('output')?.textContent,
      ticks: Array.from(select.closest('.cut-row')?.querySelectorAll('.cut-track i') || [], tick => tick.style.left) }));
    result.file = file;
    result.before = await state();
    await page.focus(config.model);
    await page.keyboard.press(result.before.value === '0' ? 'End' : 'Home');
    result.after = await state();
    assert.notEqual(result.before.value, result.after.value);
    if (result.before.count !== undefined) {
      assert.equal(Number(result.after.count), result.after.ticks.length + 1);
      assert.notDeepEqual(result.before.ticks, result.after.ticks);
    }
    return;
  }
  assert.fail(`Model switch ${config.model} missing across ${candidates.join(', ')}`);
}

async function theme(page, value, lang = 'zh') {
  await visit(page, 'about.html', lang);
  if ((await page.$eval('html', node => node.dataset.theme)) !== value) {
    if (config.tools) await click(page, config.tools);
    await click(page, config.theme);
  }
  await page.waitForFunction(value => document.documentElement.dataset.theme === value, wait, value);
  assert.equal(await page.$eval(config.theme, node => node.getAttribute('aria-pressed')), String(value === 'dark'));
}

async function headerAndLocale(page, result, lang, width) {
  await viewport(page, width);
  await visit(page, 'about.html', lang);
  await follow(page, await revealHeaderLink(page, 'research.html', lang), 'research.html', lang);
  await settle(page);
  result.current = await page.$$eval(`${config.header} [aria-current="page"]`, nodes => nodes.map(node => node.getAttribute('href')));
  assert.ok(result.current.includes(route('research.html', lang)), 'Header does not mark current topic');
  if (config.tools && await page.$(config.tools)) {
    const keyboard = !page.viewport().hasTouch;
    if (keyboard) {
      await focusFromTab(page, config.tools);
      await page.keyboard.press('ArrowDown');
      await page.waitForSelector(config.locale, { ...wait, visible: true });
      await page.keyboard.press('Escape');
      assert.ok(await page.$eval(config.tools, node => node === document.activeElement && node.getAttribute('aria-expanded') === 'false'));
    }
    await click(page, config.tools);
  }
  const other = lang === 'zh' ? 'en' : 'zh';
  await follow(page, config.locale, 'research.html', other);
  assert.ok(isLocale(other, await page.$eval('html', node => node.lang)));
  result.localized = page.url();
}

async function rollIntoView(page, selector) {
  const { width, height } = page.viewport();
  await page.mouse.move(width * .58, height * .72);
  const limit = performance.now() + 12000;
  while (performance.now() < limit) {
    const offset = await page.$eval(selector, node => {
      const rect = node.getBoundingClientRect();
      const sticky = document.querySelector('[data-site-header]')?.getBoundingClientRect().bottom || 0;
      if (rect.top >= Math.max(0, sticky) + 8 && rect.bottom <= innerHeight - 15) return 0;
      return Math.round((rect.top + rect.height / 2) - innerHeight * .54);
    });
    if (!offset) return;
    await page.mouse.wheel({ deltaY: Math.sign(offset) * Math.min(110, Math.abs(offset)) });
    await sleep(45);
  }
  throw new Error(`Could not scroll control into view: ${selector}`);
}

async function observeTransfers(page, result) {
  result.transfers = [];
  await page.exposeFunction('reportPagedTransfer', row => result.transfers.push(row));
  await page.evaluateOnNewDocument(selector => {
    let observed;
    const probe = new OffscreenCanvas(90, 55);
    const pen = probe.getContext('2d', { willReadFrequently: true });
    const observer = new MutationObserver(() => {
      const stage = document.documentElement?.dataset.transit;
      if (!stage || stage === observed) { observed = stage; return; }
      observed = stage;
      const path = location.pathname;
      const phases = new Set();
      const read = () => {
        const field = document.querySelector(selector);
        const style = field && getComputedStyle(field);
        if (document.documentElement.dataset.transit !== stage || !field || field.hidden || style.display === 'none') return;
        pen.clearRect(0, 0, probe.width, probe.height);
        pen.drawImage(field, 0, 0, probe.width, probe.height);
        const data = pen.getImageData(0, 0, probe.width, probe.height).data;
        let hash = 2166136261, ink = 0;
        for (let i = 3; i < data.length; i += 4) {
          if (data[i]) ink++;
          hash = Math.imul(hash ^ data[i], 16777619);
        }
        if (ink && !phases.has(hash) && phases.size < 5) {
          phases.add(hash);
          void window.reportPagedTransfer({ path, stage, time: performance.timeOrigin + performance.now(), ink,
            hash: hash >>> 0, pointerEvents: style.pointerEvents });
        }
        if (phases.size < 5) requestAnimationFrame(read);
      };
      requestAnimationFrame(read);
    });
    observer.observe(document, { subtree: true, attributes: true, attributeFilter: ['data-transit'] });
  }, config.transfer);
}

async function coreTour(page, result, width, filename, reduced = false) {
  await viewport(page, width);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]);
  await observeTransfers(page, result);
  await visit(page, 'index.html', 'zh');
  await page.waitForSelector(config.opener, { ...wait, visible: true });
  const recorder = filename ? await record(page, resolve(output, filename)) : null;
  const mark = async (label, ms = 0, state = {}) => {
    const now = { label, path: new URL(page.url()).pathname, hash: new URL(page.url()).hash, ...state };
    result.routeSteps.push(now);
    recorder?.mark(label, { url: page.url(), ...state });
    if (recorder && ms) await sleep(ms);
  };
  result.routeSteps = [];
  let error;
  try {
    await mark('opening', 11500);
    await mark('activate:opening');
    await follow(page, config.enter, 'about.html', 'zh');
    await settle(page);
    await mark('about', 950);
    for (const [from, to] of [[core[0], core[1]], [core[1], core[2]]]) {
      const next = anchors(config.next, route(to));
      assert.ok(await page.$(next), `${from} missing next topic ${to}`);
      await mark(`scroll:next:${to}`);
      await rollIntoView(page, next);
      await mark(`activate:next:${to}`);
      await follow(page, next, to, 'zh');
      await settle(page);
      await mark(to, 950);
    }
    const memory = `:is(${config.directions})[data-direction="direction-memory"]`;
    await rollIntoView(page, memory);
    await click(page, memory);
    await at(page, 'research.html', 'zh', '#direction-memory');
    await mark('research-selection', 750);
    const cta = anchors(config.primary, route('flued.html'), '^=');
    let link = cta;
    if (!(await page.$(cta))) link = await revealHeaderLink(page, 'flued.html', 'zh');
    // Bring the actual clicked link into view before collecting the history restoration target.
    await rollIntoView(page, link);
    await settle(page);
    const before = await page.evaluate(() => ({ scrollY, hash: location.hash, scrollable: document.scrollingElement.scrollHeight - innerHeight }));
    await mark('activate:flued', 0, before);
    await follow(page, link, 'flued.html', 'zh');
    await settle(page);
    await mark('flued', 1100);
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await at(page, 'research.html', 'zh', before.hash);
    await settle(page);
    const after = await page.evaluate(() => ({ scrollY, hash: location.hash, navigation: performance.getEntriesByType('navigation')[0]?.type,
      selected: document.querySelector('[data-topic]:not([hidden])')?.id }));
    result.history = { before, after };
    assert.equal(after.selected, 'direction-memory', 'Back did not restore selected research topic');
    assert.ok(Math.abs(after.scrollY - before.scrollY) <= 30, `History restored ${after.scrollY}px instead of ${before.scrollY}px`);
    await mark('back:research', 1400, after);
    if (reduced) {
      assert.deepEqual(result.transfers, [], 'Route transfer painted under reduced motion');
      assert.equal(await page.$eval(config.transfer, node => getComputedStyle(node).display), 'none');
    } else {
      const visiblePhases = (path, stage) => new Set(result.transfers.filter(row => row.path === path && row.stage === stage).map(row => row.hash)).size;
      for (const path of [route('index.html'), ...core.slice(0, -1).map(file => route(file))]) {
        assert.ok(visiblePhases(path, 'out') > 1, `No changing transfer departure at ${path}`);
      }
      for (const file of core) assert.ok(visiblePhases(route(file), 'in') > 1, `No changing transfer arrival at ${file}`);
      assert.ok(result.transfers.every(row => row.pointerEvents === 'none'), 'Transfer overlay intercepts input');
    }
  } catch (failure) { error = failure; await mark('error', 250, { detail: failure.message }); }
  if (recorder) {
    const { temp, ...details } = await recorder.stop();
    Object.assign(result, details);
    if (!error) {
      await rename(temp, resolve(output, filename));
      result.file = filename;
      execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-xerror', '-i', resolve(output, filename), '-f', 'null', '-']);
    }
  }
  if (error) throw error;
}

async function scrollHistory(page, result, width) {
  await viewport(page, width);
  await visit(page, 'research.html', 'zh');
  await click(page, `:is(${config.directions})[data-direction="direction-memory"]`);
  await at(page, 'research.html', 'zh', '#direction-memory');
  await page.mouse.move(width * .60, 670);
  await page.mouse.wheel({ deltaY: 212 });
  await page.waitForFunction(() => scrollY >= 100, wait);
  await settle(page);
  const flued = await revealHeaderLink(page, 'flued.html', 'zh');
  const state = () => page.evaluate(() => ({ scrollY, hash: location.hash, visibleTopic: document.querySelector('[data-topic]:not([hidden])')?.id }));
  result.before = await state();
  assert.ok(result.before.scrollY >= 100, 'Opening the header changed the nonzero scroll target');
  await follow(page, flued, 'flued.html', 'zh');
  await settle(page);
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await at(page, 'research.html', 'zh', '#direction-memory');
  await settle(page);
  result.after = await state();
  assert.equal(result.after.visibleTopic, result.before.visibleTopic);
  assert.ok(Math.abs(result.after.scrollY - result.before.scrollY) <= 24, `History restored ${result.after.scrollY}px instead of ${result.before.scrollY}px`);
  await page.goForward({ waitUntil: 'domcontentloaded' });
  await at(page, 'flued.html', 'zh');
  result.forward = page.url();
}

async function rulerRegression(page, result, capture) {
  await viewport(page, 320);
  await visit(page, 'projects.html', 'en');
  const state = () => page.$eval(config.model, select => {
    const main = document.querySelector('main');
    const label = select.closest('.cut-label');
    const readout = label.querySelector('output').closest('span');
    const box = node => node.getBoundingClientRect().toJSON();
    const mainRight = box(main).right;
    const track = select.closest('.cut-row').querySelector('.cut-track');
    const trackBounds = box(track);
    const clip = getComputedStyle(track).overflowX;
    const clipped = ['clip', 'hidden'].includes(clip);
    const overhang = [...track.querySelectorAll('i')].map(mark => ({ left: mark.style.left, right: box(mark).right }))
      .filter(mark => mark.right > trackBounds.right + .5);
    const paintedRight = overhang.length && !clipped ? Math.max(...overhang.map(mark => mark.right)) : trackBounds.right;
    const overflow = overhang.filter(mark => !clipped && mark.right > mainRight + .5);
    return { value: select.value, option: select.selectedOptions[0].textContent.trim(), readout: readout.textContent.trim(),
      mainWidth: main.scrollWidth, mainClient: main.clientWidth, mainRight, overflow, clip, paintedRight, trackRight: trackBounds.right,
      label: box(label), select: box(select), count: box(readout) };
  });
  result.states = [await state()];
  await page.focus(config.model);
  await page.keyboard.press('End');
  result.states.push(await state());
  assert.notEqual(result.states[0].value, result.states[1].value);
  for (const state of result.states) {
    assert.ok(state.select.left >= state.label.left - 1 && state.count.right <= state.label.right + 1 && state.select.right <= state.count.left,
      'Model selector or count overflows its dedicated column');
  }
  const over = result.states.find(state => state.mainWidth > state.mainClient + 1 || state.paintedRight > state.trackRight + .5);
  if (over && capture) {
    await page.$eval('.cut-figure', node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await settle(page);
    result.screenshot = 'defect-320-en-projects-bpe.png';
    await page.screenshot({ path: resolve(output, result.screenshot) });
  }
  assert.ok(!over, over && `${over.option}: main overflow ${over.mainWidth - over.mainClient}px (${over.overflow.length} ticks beyond main)`);
}

async function shotSet(page, result, value) {
  await viewport(page, 1440);
  await theme(page, value);
  result.files = [];
  const frames = ['index.html', 'about.html', 'structure.html', 'research.html', 'flued.html'];
  for (const file of frames) {
    await visit(page, file, 'zh');
    await settle(page);
    assert.equal(await page.$eval('html', node => node.dataset.theme), value);
    const name = `${value}-${file === 'index.html' ? 'opening' : file.slice(0, -5)}.png`;
    const buffer = await page.screenshot({ path: resolve(output, name) });
    result.files.push({ file: name, sha256: digest(buffer) });
  }
  await viewport(page, 320);
  await visit(page, 'structure.html', 'zh');
  await page.$eval('.org-chart', node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await settle(page);
  const name = `${value}-320-structure.png`;
  const buffer = await page.screenshot({ path: resolve(output, name) });
  result.files.push({ file: name, sha256: digest(buffer) });
}

async function seats(page, result) {
  await viewport(page, 320);
  for (const lang of languages) {
    await visit(page, 'structure.html', lang);
    result[lang] = await page.$$eval('.seat-count', rows => rows.map(row => {
      const textRects = node => {
        const range = document.createRange();
        range.selectNodeContents(node);
        return [...range.getClientRects()].map(rect => rect.toJSON());
      };
      const label = row.querySelector('b');
      const box = textRects(label);
      const ticks = [...row.querySelectorAll('.glyph')].flatMap(textRects);
      return { label: label.textContent.trim(), lines: new Set(box.map(rect => Math.round(rect.top))).size,
        overlap: box.some(a => ticks.some(b => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top)),
        clipped: box.some(rect => rect.left < 0 || rect.right > innerWidth) };
    }));
  }
  assert.ok(languages.every(lang => result[lang].length === 2 && result[lang].every(seat => seat.lines === 1 && !seat.overlap && !seat.clipped)));
}

async function assets(page, result) {
  await viewport(page, 1440);
  const discovered = new Set();
  const observed = new Map();
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin === new URL(origin).origin && url.pathname !== '/recruitment/api/auth/me' && response.ok() && !/html/.test(response.headers()['content-type'] || '')) observed.set(url.href, response.status());
  });
  for (const file of files) {
    await visit(page, file, 'zh');
    const urls = await page.evaluate(() => Array.from(document.querySelectorAll('img[src],source[src],script[src],link[rel="stylesheet"][href],a[href]'), node =>
      node.currentSrc || node.src || node.href).filter(Boolean));
    for (const resource of urls) {
      const url = new URL(resource);
      if (url.origin === new URL(origin).origin && /\.(?:svg|png|jpe?g|webp|pdf|json|woff2?|css|mjs)$/i.test(url.pathname)) {
        url.hash = '';
        discovered.add(url.href);
      }
    }
  }
  for (const url of observed.keys()) discovered.add(url);
  result.resources = await Promise.all([...discovered].sort().map(async url => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(6500) });
      const body = Buffer.from(await response.arrayBuffer());
      const type = response.headers.get('content-type') || '';
      const path = pathname(url);
      const starts = body.subarray(0, 256).toString();
      let format = !!body.length && !/^\s*<!doctype html/i.test(starts);
      if (path.endsWith('.pdf')) format = starts.startsWith('%PDF-');
      if (path.endsWith('.png')) format = body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      if (path.endsWith('.svg')) format = /<svg[\s>]/i.test(body.toString());
      if (path.endsWith('.json')) { JSON.parse(body.toString()); format = true; }
      return { path, status: response.status, type, bytes: body.length, sha256: digest(body), format, ok: response.ok && format };
    } catch (error) { return { path: pathname(url), ok: false, issue: error.message }; }
  }));
  const records = result.resources;
  assert.ok(records.some(resource => resource.path.endsWith('.pdf')) && records.some(resource => resource.path.endsWith('.json')) &&
    records.some(resource => resource.path.endsWith('.png')), 'Expected linked real certificates and runtime JSON');
  assert.ok(records.every(resource => resource.ok), records.filter(resource => !resource.ok).map(resource => resource.path).join(', '));
}

async function fieldFrames(page, selector, count) {
  const node = await page.waitForSelector(selector, wait);
  const frames = [];
  for (let i = 0; i < count; i++) {
    const bitmap = await node.evaluate(canvas => {
      if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Field layer selector must address a canvas');
      const width = canvas.width, height = canvas.height;
      const copy = new OffscreenCanvas(width, height);
      const pen = copy.getContext('2d', { willReadFrequently: true });
      pen.drawImage(canvas, 0, 0);
      const pixels = pen.getImageData(0, 0, width, height).data;
      let hash = 2166136261, ink = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3]) ink++;
        hash = Math.imul(hash ^ (pixels[i] | pixels[i + 1] << 8 | pixels[i + 2] << 16 | pixels[i + 3] << 24), 16777619);
      }
      return { width, height, ink, hash: hash >>> 0 };
    });
    frames.push({ ...bitmap, time: new Date().toISOString() });
    if (i < count - 1) await sleep(160);
  }
  return frames;
}

async function fields(page, result, reduced, width) {
  await viewport(page, width);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]);
  result.layers = [];
  for (const [file, selector] of [['index.html', `${config.opener} canvas`], ['research.html', config.scene]]) {
    await visit(page, file, 'zh');
    await settle(page);
    const before = await fieldFrames(page, selector, 6);
    const box = await page.$eval(selector, canvas => {
      const rect = canvas.getBoundingClientRect();
      return { width: rect.width, height: rect.height, top: rect.top, pointerEvents: getComputedStyle(canvas).pointerEvents,
        visible: canvas.checkVisibility({ visibilityProperty: true, opacityProperty: true }) };
    });
    assert.ok(box.visible && Math.abs(box.width - width) < 2 && box.height > 0, `Field geometry at ${file}`);
    const x = Math.round(width * .82), y = Math.round(box.height * .62);
    if (page.viewport().hasTouch) {
      await page.touchscreen.touchStart(x, y);
      if (file === 'index.html') await page.touchscreen.touchMove(x - 28, y);
    } else await page.mouse.move(x, y, { steps: 8 });
    let after;
    try { after = await fieldFrames(page, selector, 5); }
    finally { if (page.viewport().hasTouch) await page.touchscreen.touchEnd(); }
    const idle = new Set(before.map(frame => frame.hash)).size;
    const input = new Set([...before, ...after].map(frame => frame.hash)).size;
    result.layers.push({ file, before, after, box, idle, input });
    assert.ok(before.some(frame => frame.ink > 10), `Blank bitmap on ${file}`);
    assert.ok(reduced ? input === 1 : idle > 1 && input > idle, `Unexpected idle/input pixel history at ${file} (${idle}/${input})`);
    assert.equal(pathname(page.url()), route(file));
  }
  await visit(page, 'research.html', 'zh');
  const memory = `:is(${config.directions})[data-direction="direction-memory"]`;
  await click(page, memory);
  await at(page, 'research.html', 'zh', '#direction-memory');
  await page.waitForFunction(({ scene, memory }) => {
    const control = document.querySelector(memory);
    return control?.dataset.direction === 'direction-memory' && control.hash === '#direction-memory' &&
      document.querySelector(scene)?.dataset.sceneSelection === 'direction-memory';
  }, wait, { scene: config.scene, memory });
  result.sceneSelection = await page.$eval(config.scene, canvas => canvas.dataset.sceneSelection);
}

async function hiddenField(page, result) {
  await viewport(page, 390);
  const cdp = await page.createCDPSession();
  await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'forced-colors', value: 'active' }] });
  assert.ok(await page.evaluate(() => matchMedia('(forced-colors: active)').matches), 'Edge did not activate forced colors');
  await visit(page, 'research.html', 'zh');
  const selector = config.scene;
  const hidden = canvas => ['hidden', 'collapse'].includes(getComputedStyle(canvas).visibility) || getComputedStyle(canvas).display === 'none';
  result.sceneHidden = await page.$eval(selector, hidden);
  assert.equal(result.sceneHidden, true, 'Forced colors did not hide the backdrop');
  const memory = `:is(${config.directions})[data-direction="direction-memory"]`;
  const tabs = await focusFromTab(page, memory);
  await page.keyboard.press('Enter');
  await at(page, 'research.html', 'zh', '#direction-memory');
  assert.ok(await page.$eval('[data-topic]#direction-memory', node => !node.hidden));
  result.tabsToResearch = tabs;
  await follow(page, await revealHeaderLink(page, 'about.html', 'zh'), 'about.html', 'zh');
  await follow(page, anchors(config.primary, route('structure.html')), 'structure.html', 'zh');
  result.cta = page.url();
}

async function main() {
  const mode = process.argv[2] || '--help';
  const only = process.env.ALETHIC_PAGED_CHECKS ? new RegExp(process.env.ALETHIC_PAGED_CHECKS) : null;
  if (mode === '--help') {
    console.log('Usage: node scripts/paged-qa.mjs --check-config | --measure | --ready\n--measure runs QA without recordings. --ready also writes continuous video and key frames.');
    return;
  }
  assert.ok(['--check-config', '--measure', '--ready'].includes(mode), `Unknown mode ${mode}`);
  if (process.env.ALETHIC_PAGED_CONFIG) config = { ...defaults, ...JSON.parse(await readFile(process.env.ALETHIC_PAGED_CONFIG, 'utf8')) };
  if (mode === '--check-config') {
    console.log(JSON.stringify({ files, widths, config }, null, 2));
    return;
  }
  const release = await releaseInfo();
  if (process.env.ALETHIC_PAGED_RELEASE) assert.equal(release.css.split('/')[2], process.env.ALETHIC_PAGED_RELEASE);
  // Fail early if this URL still serves the replaced long homepage build.
  const probe = await fetch(new URL('/about.html', origin), { cache: 'no-store' });
  const aboutHtml = await probe.text();
  if (!probe.ok || !/data-page=["']about\.html["']/.test(aboutHtml)) {
    console.error(`Paged build unavailable at ${origin} (About HTTP ${probe.status})`);
    process.exitCode = 1;
    return;
  }
  await mkdir(output, { recursive: true });
  const browser = await launch();
  const report = { mode, origin, release, browser: await browser.version(), startedAt: new Date().toISOString(), checks: [] };
  const reportName = mode === '--ready' ? 'report.json' : 'rehearsal.json';
  const run = async (name, task) => {
    if (only && !only.test(name)) return { name, status: 'skipped' };
    const result = { name, errors: [] };
    const context = await browser.createBrowserContext();
    try {
      const page = await context.newPage();
      const mocked = [];
      await page.setRequestInterception(true);
      page.on('request', request => {
        const url = new URL(request.url());
        if (url.origin === new URL(origin).origin && url.pathname === '/recruitment/api/auth/me') {
          mocked.push({ path: url.pathname, method: request.method() });
          void request.respond({ status: 200, contentType: 'application/json', body: '{}' }).catch(() => {});
        } else void request.continue().catch(() => {});
      });
      watch(page, result.errors);
      result.mockedAccountRequests = mocked;
      await task(page, result);
      assert.deepEqual(result.errors, [], 'Browser console, script, or response error');
      result.status = 'pass';
    } catch (error) { result.status = 'fail'; result.issue = error.stack ?? String(error); process.exitCode = 1; }
    finally { await context.close(); }
    report.checks.push(result);
    await save(reportName, report);
    console.log(`${result.status.toUpperCase()} ${name}${result.issue ? ` — ${result.issue.split('\n')[0]}` : ''}`);
    return result;
  };
  try {
    const tours = [];
    for (const [device, width] of [['desktop', 1440], ['mobile', 390]]) {
      tours.push(await run(`${device}-core`, (page, result) => coreTour(page, result, width, mode === '--ready' ? `${device}-tour.mp4` : null)));
    }
    if (mode === '--ready') {
      await save('timeline.json', { origin, release, browser: report.browser, tours });
      for (const value of ['light', 'dark']) await run(`${value}-keyframes`, (page, result) => shotSet(page, result, value));
    }
    for (const lang of languages) {
      for (const width of widths) await run(`pages-${lang}-${width}`, (page, result) => pageMatrix(page, result, width, lang));
      await run(`legacy-${lang}`, (page, result) => compat(page, result, lang));
      await run(`research-${lang}`, async (page, result) => { await viewport(page, 390); await chooseResearch(page, result, lang); });
      await run(`model-${lang}`, async (page, result) => { await viewport(page, 390); await changeModel(page, result, lang); });
      for (const width of [390, 1440]) await run(`header-${lang}-${width}`, (page, result) => headerAndLocale(page, result, lang, width));
    }
    for (const width of [390, 1440]) for (const reduced of [false, true]) {
      await run(`field-${width}-${reduced ? 'reduce' : 'default'}`, (page, result) => fields(page, result, reduced, width));
    }
    for (const width of [390, 1440]) await run(`history-scroll-${width}`, (page, result) => scrollHistory(page, result, width));
    await run('320-en-model-regression', (page, result) => rulerRegression(page, result, mode === '--ready'));
    await run('reduced-route-transfer', (page, result) => coreTour(page, result, 390, null, true));
    await run('hidden-field', hiddenField);
    await run('320-seats', seats);
    await run('anonymous-account', async (page, result) => {
      await viewport(page, 390);
      await visit(page, 'about.html', 'zh');
      result.account = await page.$eval(config.account, node => ({ href: new URL(node.href).pathname,
        state: node.dataset.siteSession, visible: node.checkVisibility() }));
      assert.deepEqual(result.account, { href: '/login', state: 'anonymous', visible: true });
      assert.ok(result.mockedAccountRequests.some(request => request.method === 'GET'), 'Account proxy was never queried');
    });
    await run('resources', assets);
    await run('build-identity', async () => assert.deepEqual(await releaseInfo(), release));
  } finally { await browser.close(); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main();
