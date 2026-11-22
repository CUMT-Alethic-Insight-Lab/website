import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { digest, localize, open, output, recording, routeName, routes, sleep, suite, viewport, watch } from './browser-qa.mjs';

const opener = '.opening canvas';
const plate = '.signal-plate';
const rail = '.signal-rail';
const timeout = 6500;
const reduce = (page, value) => page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value }]);
const settled = page => page.waitForFunction(() => !document.documentElement.hasAttribute('data-transit'), { timeout });
const at = (page, url) => page.waitForFunction(path => location.pathname + location.search + location.hash === path, { timeout }, url);
const frame = async (page, selector) => {
  const { image, width, height } = await page.$eval(selector, node => {
    const canvas = node instanceof HTMLCanvasElement ? node : node.querySelector('canvas');
    if (!canvas) throw new Error('No canvas in ' + node.className);
    return { image: canvas.toDataURL(), width: canvas.width, height: canvas.height };
  });
  assert.ok(width > 1 && height > 1 && image.length > 600, `nonempty ${selector} ${width}x${height}`);
  return { hash: digest(image).slice(0, 16), width, height };
};

async function reveal(page, selector) {
  await page.waitForSelector(selector, { timeout });
  await page.$eval(selector, node => {
    const rect = node.getBoundingClientRect();
    const top = scrollY + rect.top + rect.height / 2 - innerHeight / 2;
    // A rail can have a zero-height box until its first IntersectionObserver paint.
    scrollTo({ top, behavior: 'instant' });
  });
  await page.waitForFunction(selector => {
    const node = document.querySelector(selector);
    const rect = node?.getBoundingClientRect();
    if (!rect || rect.bottom <= 0 || rect.top >= innerHeight) return false;
    if (!(node instanceof HTMLCanvasElement)) return Boolean(node.textContent.trim());
    if (node.width < 2 || node.height < 2) return false;
    const pixels = node.getContext('2d').getImageData(0, 0, node.width, node.height).data;
    for (let offset = 3; offset < pixels.length; offset += 4) if (pixels[offset] !== 0) return true;
    return false;
  }, { timeout }, selector);
}

async function cropped(page, shot, target, filename) {
  if (!recording) return;
  const clip = await page.$eval(target, node => {
    const { x, y, width, height } = node.getBoundingClientRect();
    const x0 = Math.max(0, Math.floor(x - 12));
    const y0 = Math.max(0, Math.floor(y - 8));
    return { x: x0, y: y0, width: Math.min(innerWidth - x0, Math.ceil(width + 24)), height: Math.min(innerHeight - y0, Math.ceil(height + 16)) };
  });
  await shot(page, filename, { clip });
}

async function installProbe(page) {
  const events = [];
  await page.exposeFunction('__alethicQaTransit', event => events.push(event));
  await page.evaluateOnNewDocument(() => {
    const root = document.documentElement;
    const arm = () => {
      const html = document.documentElement;
      if (!html) return;
      const report = value => window.__alethicQaTransit({ value, url: location.pathname + location.search + location.hash, at: performance.timeOrigin + performance.now() });
      if (html.hasAttribute('data-transit')) report(html.dataset.transit);
      new MutationObserver(() => report(html.getAttribute('data-transit'))).observe(html, { attributeFilter: ['data-transit'] });
    };
    if (root) arm();
    else new MutationObserver((_, observer) => {
      if (document.documentElement) { observer.disconnect(); arm(); }
    }).observe(document, { childList: true });
  });
  return events;
}

async function targetState(page, id) {
  return page.evaluate(id => {
    const rect = document.getElementById(id)?.getBoundingClientRect();
    return { top: Math.round(rect?.top ?? -99999), visible: !!rect && rect.bottom > 0 && rect.top < innerHeight, active: document.activeElement.id, scroll: Math.round(scrollY) };
  }, id);
}

const waitInView = (page, id) => page.waitForFunction(id => {
  const rect = document.getElementById(id)?.getBoundingClientRect();
  return rect && rect.top < innerHeight && rect.bottom > 0;
}, { timeout }, id);

const waitForEntryTop = page => page.waitForFunction(() => {
  const rect = document.querySelector('#entry')?.getBoundingClientRect();
  return rect && Math.abs(rect.top) < 24;
}, { timeout });

async function navigateByKeyboard(page, selector) {
  await page.focus(selector);
  await page.keyboard.press('Enter');
}

async function transitionFrame(page, shot, phase, file) {
  if (!recording) return;
  // Keep timestamp checks separate from screenshot latency. This waits for a genuinely drawn thread.
  await page.waitForFunction(phase => {
    const root = document.documentElement;
    const canvas = document.querySelector('canvas.route-thread');
    return root.dataset.transit === phase && canvas && !canvas.hidden && canvas.width > 0;
  }, { timeout, polling: 'raf' }, phase);
  await sleep(65);
  await shot(page, file);
}

await suite('motion-qa', async ({ browser, result, check, shot }) => {
  const page = await browser.newPage();
  // Direct access to the demo intentionally tries its optional desktop runner.
  watch(page, result.errors, ['http://127.0.0.1:8722/api/health']);
  const events = await installProbe(page);
  result.transit = events;
  result.frames = {};
  await viewport(page, 1440);
  const skipOpening = process.env.ALETHIC_QA_SKIP_OPENING === '1';
  if (!skipOpening) {
    await check('full-viewport opener changes, pointer and scrolling handoff', async () => {
      await open(page, '/');
      await page.waitForSelector('.opening[data-ready]', { timeout });
      const dimensions = await page.$eval('.opening', node => ({ opening: node.getBoundingClientRect().height, entry: document.querySelector('#entry').getBoundingClientRect().top, viewport: innerHeight }));
      assert.ok(Math.abs(dimensions.opening - dimensions.viewport) <= 2 && dimensions.entry >= dimensions.viewport - 2);
      const frames = [];
      const start = performance.now();
      for (const [index, ms] of [500, 6300, 11700].entries()) {
        await sleep(Math.max(0, start + ms - performance.now()));
        frames.push({ ms: Math.round(performance.now() - start), ...await frame(page, opener) });
        await shot(page, `opening-${index + 1}.png`);
      }
      assert.equal(new Set(frames.map(item => item.hash)).size, frames.length, 'opener phases render different pictures');
      await page.mouse.move(760, 470, { steps: 5 });
      await sleep(250);
      await shot(page, 'opening-pointer.png');
      await page.mouse.wheel({ deltaY: 350 });
      await page.waitForFunction(() => scrollY > 250 && scrollY < innerHeight, { timeout });
      await sleep(140);
      const scrub = await frame(page, opener);
      assert.notEqual(scrub.hash, frames.at(-1).hash);
      await shot(page, 'opening-scroll.png');
      return { dimensions, frames, scrub };
    });
    if (recording) await check('English opener wordmark and slogan frames', async () => {
      await open(page, '/en/');
      await page.waitForSelector('.opening[data-ready]', { timeout });
      const start = performance.now();
      const frames = [];
      for (const [index, ms] of [500, 6300, 11700].entries()) {
        await sleep(Math.max(0, start + ms - performance.now()));
        frames.push({ ms: Math.round(performance.now() - start), ...await frame(page, opener) });
        await shot(page, `en-opening-${index + 1}.png`);
      }
      assert.equal(new Set(frames.map(item => item.hash)).size, 3);
      return frames;
    });
    await check('opener touch, keyboard, and entry history', async () => {
      await viewport(page, 390);
      await open(page, '/en/');
      await page.waitForSelector('.opening[data-ready]', { timeout });
      await shot(page, 'en-390-opening.png');
      await page.tap('.opening a');
      await at(page, '/en/#entry');
      await waitForEntryTop(page);
      await settled(page);
      await shot(page, 'en-390-opening-entered.png');
      await viewport(page, 1440);
      await open(page, '/');
      await page.waitForSelector('.opening[data-ready]', { timeout });
      await page.keyboard.press('Tab');
      if (await page.evaluate(() => document.activeElement.classList.contains('skip'))) await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('href')), '#entry');
      await page.keyboard.press('Enter');
      await at(page, '/#entry');
      await settled(page);
      assert.ok(await page.$eval('#entry', entry => entry === document.activeElement || entry.contains(document.activeElement)), 'keyboard focus lands in site header');
      await waitForEntryTop(page);
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await at(page, '/');
      await page.waitForFunction(() => scrollY < 2, { timeout });
      await page.goForward({ waitUntil: 'domcontentloaded' });
      await at(page, '/#entry');
      await waitForEntryTop(page);
      await settled(page);
    });
  }
  if (!skipOpening) await check('Back cancels an in-flight opener scroll', async () => {
    await open(page, '/');
    await page.waitForSelector('.opening[data-ready]', { timeout });
    await navigateByKeyboard(page, '.opening a');
    await at(page, '/#entry');
    await page.waitForFunction(() => scrollY > 45 && scrollY < innerHeight - 65, { timeout });
    const during = await targetState(page, 'entry');
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await at(page, '/');
    await sleep(650);
    const afterBack = await targetState(page, 'entry');
    await shot(page, 'rapid-back-from-opener.png');
    assert.ok(afterBack.scroll < 2, JSON.stringify({ during, afterBack }));
    await page.goForward({ waitUntil: 'domcontentloaded' });
    await at(page, '/#entry');
    await waitForEntryTop(page);
    return { during, afterBack };
  });
  for (const lang of ['zh', 'en']) {
    await viewport(page, 1440);
    for (const route of routes) {
      const id = `${lang}-${routeName(route)}`;
      await check(`${id} · rendered ASCII frames and inline rail`, async () => {
        await open(page, localize(lang, route === '/' ? '/#entry' : route));
        await reveal(page, plate);
        const initial = await frame(page, plate);
        await shot(page, `${id}-plate-context.png`);
        await cropped(page, shot, plate, `${id}-plate-a.png`);
        await sleep(440);
        const next = await frame(page, plate);
        await cropped(page, shot, plate, `${id}-plate-b.png`);
        assert.notEqual(next.hash, initial.hash, 'visible plate paints a second frame');
        await reveal(page, rail);
        const text = () => page.$eval(rail, node => node.textContent);
        const railA = await text();
        await cropped(page, shot, rail, `${id}-rail-a.png`);
        await page.waitForFunction(before => document.querySelector('.signal-rail')?.textContent !== before, { timeout }, railA);
        const railB = await text();
        await cropped(page, shot, rail, `${id}-rail-b.png`);
        assert.match(railA, /[+|=.]/, 'inline rail contains decorative ASCII');
        assert.notEqual(railA, railB);
        const summary = { initial, next, railA, railB };
        result.frames[id] = summary;
        return summary;
      });
    }
  }
  await check('mouse route, keyboard reverse route, and browser back/forward', async () => {
    await open(page, '/#entry');
    const index = events.length;
    await page.click('.route-register a[href="/people.html"]');
    if (recording) {
      await transitionFrame(page, shot, 'out', 'travel-out.png');
      await transitionFrame(page, shot, 'in', 'travel-in.png');
    }
    await at(page, '/people.html');
    await settled(page);
    assert.ok(events.slice(index).some(event => event.value === 'out' && event.url.startsWith('/#')));
    assert.ok(events.slice(index).some(event => event.value === 'in' && event.url === '/people.html'));
    await navigateByKeyboard(page, '.route-register a[href="/meeting.html"]');
    await at(page, '/meeting.html');
    await settled(page);
    assert.equal(await page.evaluate(() => document.activeElement.tagName), 'H1');
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await at(page, '/people.html');
    await settled(page);
    await page.goForward({ waitUntil: 'domcontentloaded' });
    await at(page, '/meeting.html');
    await settled(page);
    assert.ok(events.slice(index).filter(event => event.value === 'in').length >= 3, 'link and history arrivals recorded');
    return events.slice(index);
  });
  await check('hash click, encoded deep link and fragment back/forward', async () => {
    await open(page, '/#entry');
    const index = events.length;
    await navigateByKeyboard(page, '.route-register a[href="/#work"]');
    if (recording) await transitionFrame(page, shot, 'hash', 'travel-hash.png');
    await at(page, '/#work');
    await settled(page);
    const work = await targetState(page, 'work');
    assert.ok(work.visible && work.active === 'work');
    await page.click('.route-register a[href="/#projects"]');
    await at(page, '/#projects');
    await settled(page);
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await at(page, '/#work');
    await settled(page);
    assert.ok((await targetState(page, 'work')).visible);
    await page.goForward({ waitUntil: 'domcontentloaded' });
    await at(page, '/#projects');
    await settled(page);
    assert.ok((await targetState(page, 'projects')).visible);
    assert.ok(events.slice(index).some(event => event.value === 'hash'), 'transit hash recorded');
    await open(page, '/#position');
    await waitInView(page, 'position');
    assert.match(await page.$eval('#position', node => node.innerText), /组织定位/);
    const hash = encodeURIComponent('架构');
    await open(page, `/insights-memory-hierarchy.html#${hash}`);
    await page.waitForFunction(() => Math.abs(document.getElementById('架构')?.getBoundingClientRect().top ?? Infinity) < innerHeight, { timeout });
    assert.ok((await targetState(page, '架构')).visible);
    return { work, events: events.slice(index) };
  });
  await check('rapid link activation keeps final intent and one history entry', async () => {
    await open(page, '/#entry');
    const historyLength = await page.evaluate(() => history.length);
    // Native key events are independent of pointer hover geometry and reach the same links.
    await navigateByKeyboard(page, '.route-register a[href="/people.html"]');
    await navigateByKeyboard(page, '.route-register a[href="/meeting.html"]');
    await at(page, '/meeting.html');
    await settled(page);
    assert.equal(await page.evaluate(() => history.length), historyLength + 1);
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await at(page, '/#entry');
    return { historyLength, finalRoute: '/meeting.html' };
  });
  await check('fixed reading thread repaints and leaves controls clickable', async () => {
    await open(page, '/insights-memory-hierarchy.html');
    const thread = '.reading-thread';
    const link = '.route-register a[href="/meeting.html"]';
    await reveal(page, thread);
    const initial = await frame(page, thread);
    const style = await page.$eval(thread, node => ({
      position: getComputedStyle(node).position,
      pointerEvents: getComputedStyle(node).pointerEvents,
      hidden: node.getAttribute('aria-hidden'),
    }));
    assert.deepEqual(style, { position: 'fixed', pointerEvents: 'none', hidden: 'true' });
    await page.hover(link);
    await page.waitForFunction(link => document.querySelector(link)?.dataset.tracing === 'true', { timeout }, link);
    await sleep(120);
    const hovered = await frame(page, thread);
    assert.notEqual(hovered.hash, initial.hash);
    await shot(page, 'reading-thread-hover.png');
    return { style, initial, hovered };
  });
  await check('focus, hover and typing while the visual cue is active', async () => {
    await open(page, '/en/flued-experiments.html');
    await page.waitForSelector('.f-ledger article', { timeout });
    const query = '[data-f-query]';
    await page.hover(query);
    assert.equal(await page.$eval(query, input => input.dataset.tracing), 'true');
    await page.focus(query);
    const hashLink = 'a[href="#ledger"]';
    assert.ok(await page.$(hashLink), 'native ledger link');
    await page.click(hashLink);
    await at(page, '/en/flued-experiments.html#ledger');
    await page.focus(query);
    await page.type(query, '__no_such_experiment__');
    assert.equal(await page.$eval(query, input => input.value), '__no_such_experiment__');
    await page.waitForFunction(() => !document.querySelector('.f-ledger article'), { timeout });
    await settled(page);
    assert.equal(await page.evaluate(() => document.activeElement.matches('[data-f-query]')), true);
    await shot(page, 'input-during-travel.png');
  });
  await check('FLUED search input and results survive browser history', async () => {
    const path = '/en/flued-experiments.html#ledger';
    const query = '[data-f-query]';
    const value = '__history_qa_no_matching_record__';
    await page.evaluateOnNewDocument(() => {
      addEventListener('pageshow', event => { window.__qaFromBFCache = event.persisted; });
    });
    await open(page, path);
    await page.waitForSelector('.f-ledger article', { timeout });
    await page.type(query, value);
    await page.waitForFunction(() => !document.querySelector('.f-ledger article'), { timeout });
    await page.click('.route-register a[href="/en/people.html"]');
    await at(page, '/en/people.html');
    await settled(page);
    const state = async () => {
      await page.waitForSelector(query, { timeout });
      const observed = await page.evaluate(query => ({
        value: document.querySelector(query).value,
        results: document.querySelectorAll('.f-ledger article').length,
        notice: document.querySelector('[data-f-ledger]')?.innerText.trim(),
        bfcache: window.__qaFromBFCache ?? null,
        navigationType: performance.getEntriesByType('navigation')[0]?.type,
      }), query);
      assert.equal(observed.value, value, JSON.stringify(observed));
      assert.equal(observed.results, 0, JSON.stringify(observed));
      assert.match(observed.notice, /No matching records/, JSON.stringify(observed));
      return observed;
    };
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await at(page, path);
    await settled(page);
    const back = await state();
    await page.goForward({ waitUntil: 'domcontentloaded' });
    await at(page, '/en/people.html');
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await at(page, path);
    await settled(page);
    const backAfterForward = await state();
    return { back, backAfterForward };
  });
  await check('reduced motion freezes both canvas and rail while links work', async () => {
    await reduce(page, 'reduce');
    const index = events.length;
    if (!skipOpening) {
      await open(page, '/');
      await page.waitForSelector('.opening[data-ready]', { timeout });
      const start = await frame(page, opener);
      await page.mouse.move(870, 410);
      await sleep(550);
      assert.equal((await frame(page, opener)).hash, start.hash);
      await shot(page, 'reduced-opening.png');
      await navigateByKeyboard(page, '.opening a');
      await at(page, '/#entry');
      assert.ok(await page.$eval('#entry', entry => entry === document.activeElement || entry.contains(document.activeElement)), 'keyboard focus lands in site header');
    }
    await open(page, '/en/people.html');
    assert.equal(await page.$eval('html', node => node.dataset.motion), 'still');
    await reveal(page, plate);
    const start = await frame(page, plate);
    await sleep(550);
    assert.equal((await frame(page, plate)).hash, start.hash);
    await shot(page, 'reduced-people.png');
    await reveal(page, rail);
    const railStart = await page.$eval(rail, node => node.textContent);
    await sleep(420);
    assert.equal(await page.$eval(rail, node => node.textContent), railStart);
    await page.click('.route-register a[href="/en/meeting.html"]');
    await at(page, '/en/meeting.html');
    await page.waitForSelector('[data-meeting][data-mounted]', { timeout });
    await page.click('[role="tab"][href="#stage-review"]');
    await at(page, '/en/meeting.html#stage-review');
    assert.equal(await page.$eval('[role="tab"][aria-selected="true"]', tab => tab.hash), '#stage-review');
    assert.deepEqual(events.slice(index).filter(event => event.value), []);
    await reduce(page, 'no-preference');
    await page.waitForFunction(() => document.documentElement.dataset.motion === 'play', { timeout });
  });
  if (recording && !skipOpening) await check('short live browser recording', async () => {
    await viewport(page, 1280, 800);
    await open(page, '/');
    await page.waitForSelector('.opening[data-ready]', { timeout });
    await mkdir(output, { recursive: true });
    const ffmpeg = process.env.ALETHIC_FFMPEG || 'ffmpeg';
    const capture = resolve(output, 'alethic-motion-source.webm');
    const recorder = await page.screencast({ path: capture, fps: 25, ffmpegPath: ffmpeg });
    try {
      await sleep(1500);
      await page.mouse.move(670, 400, { steps: 10 });
      await sleep(800);
      await page.mouse.wheel({ deltaY: 380 });
      await sleep(700);
      await page.click('.opening a');
      await at(page, '/#entry');
      await settled(page);
      await sleep(850);
      await page.click('.route-register a[href="/people.html"]');
      await at(page, '/people.html');
      await settled(page);
      await sleep(1000);
      await page.click('.route-register a[href="/meeting.html"]');
      await at(page, '/meeting.html');
      await settled(page);
      await sleep(850);
      await page.goBack({ waitUntil: 'domcontentloaded' });
      await at(page, '/people.html');
      await settled(page);
      await sleep(700);
    } finally {
      await recorder.stop();
    }
    execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-i', capture, '-an', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', resolve(output, 'alethic-motion-preview.mp4')]);
  });
});
