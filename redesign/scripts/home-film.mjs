import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { digest, launch, open, origin, sleep, viewport, watch } from './browser-qa.mjs';

// This is the acceptance contract for the rebuilt homepage. Update here if markup changes.
export const site = {
  openingReady: '.opening[data-ready]',
  enter: '.opening a[href="#entry"]',
  mainStart: '#hero-title',
  nav: '[data-home-nav]',
  menuToggle: '[data-home-nav-toggle]',
  menuPanel: '[data-home-nav-content]',
  navCurrent: '[data-home-nav-current]',
  rail: '.chapter-wire, .signal-rail',
  graph: { root: '#structure .org-chart', labels: '.org-gate, .org-mode, h3' },
  direction: '[data-direction="direction-memory"]',
  modelSelect: '[data-ruler-select]',
  jump: { control: '[data-home-nav-content] a[href="#work"]', target: '#work' },
  back: { control: '[data-home-nav-start]', target: '#entry' },
  chapters: [
    { id: 'intro', section: '.home-intro', shot: '#hero-title' },
    ...['position', 'structure', 'work', 'focus', 'projects', 'awards', 'work-mode', 'documents', 'join']
      .map(id => ({ id, section: `#${id}`, shot: `#${id}-title` })),
  ],
};

const out = process.env.ALETHIC_HOME_FILM_OUTPUT || fileURLToPath(new URL('../qa-output/home-rewrite/', import.meta.url));
const dshBin = 'E:/projects/dsh/tools/ffmpeg/bin';
const tool = (name, override) => override ||
  (existsSync(`${dshBin}/${name}.exe`) ? `${dshBin}/${name}.exe` : name);
const ffmpeg = tool('ffmpeg', process.env.ALETHIC_FFMPEG);
const ffprobe = tool('ffprobe', process.env.ALETHIC_FFPROBE);
const wait = { timeout: 7500 };
const fps = 25;
const epochNow = () => (performance.timeOrigin + performance.now()) / 1000;
const json = (path, value) => writeFile(path, JSON.stringify(value, null, 2) + '\n');

export function checkConfig(config) {
  const required = ['openingReady', 'enter', 'mainStart', 'nav', 'menuToggle', 'menuPanel', 'navCurrent', 'rail', 'direction', 'modelSelect'];
  const missing = required.filter(key => !config[key]);
  if (!config.graph?.root) missing.push('graph.root');
  for (const key of ['jump', 'back']) if (!config[key]?.control || !config[key]?.target) missing.push(key);
  if (!config.chapters.length) missing.push('chapters');
  assert.ok(!missing.length, `Missing homepage selectors: ${missing.join(', ')}`);
  const ids = new Set();
  for (const { id, section } of config.chapters) {
    assert.ok(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id || '') && section && !ids.has(id), `Invalid or duplicate chapter: ${id}`);
    ids.add(id);
  }
}

async function visible(page, selector) {
  return page.waitForSelector(selector, { ...wait, visible: true });
}

async function activate(page, selector) {
  await visible(page, selector);
  if (page.viewport().hasTouch) await page.tap(selector);
  else await page.click(selector);
}

async function menuState(page, expanded) {
  await page.waitForFunction((toggle, panel, expanded) => {
    const button = document.querySelector(toggle);
    const node = document.querySelector(panel);
    if (button?.getAttribute('aria-expanded') !== String(expanded)) return false;
    if (!expanded) return true;
    if (!node?.checkVisibility({ visibilityProperty: true, opacityProperty: true })) return false;
    const rect = node.getBoundingClientRect();
    const left = Math.max(0, rect.left), right = Math.min(innerWidth, rect.right);
    const top = Math.max(0, rect.top), bottom = Math.min(innerHeight, rect.bottom);
    if (left >= right || top >= bottom) return false;
    return node.contains(document.elementFromPoint((left + right) / 2, (top + bottom) / 2));
  }, wait, site.menuToggle, site.menuPanel, expanded);
}

async function menu(page, expanded) {
  if (await page.$eval(site.menuToggle, node => node.getAttribute('aria-expanded')) !== String(expanded)) {
    await activate(page, site.menuToggle);
  }
  await menuState(page, expanded);
}

async function stableScroll(page) {
  await page.waitForFunction(() => !document.documentElement.hasAttribute('data-transit'), wait);
  await page.evaluate(() => new Promise((done, fail) => {
    let previous = scrollY, lastChange = performance.now();
    const deadline = lastChange + 4000;
    const step = () => {
      const now = performance.now();
      if (Math.abs(scrollY - previous) >= 0.5) lastChange = now;
      previous = scrollY;
      if (now - lastChange >= 200) done();
      else if (now >= deadline) fail(new Error('Scroll never settled'));
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }));
}

async function anchorClear(page, selector) {
  // Fragment navigation may announce its new URL before smooth scrolling has started.
  await page.waitForFunction(selector => {
    const node = document.querySelector(selector);
    if (!node) return false;
    const heading = node.matches('h1,h2,h3,h4,h5,h6,[role="heading"]') ? node :
      node.querySelector('h1,h2,h3,h4,h5,h6,[role="heading"]') || node;
    const { top, bottom } = heading.getBoundingClientRect();
    return top < innerHeight && bottom > 0;
  }, wait, selector).catch(error => { throw new Error(`Anchor never entered the viewport: ${selector}`, { cause: error }); });
  await stableScroll(page);
  const sample = await page.$eval(selector, node => {
    const heading = node.matches('h1,h2,h3,h4,h5,h6,[role="heading"]') ? node :
      node.querySelector('h1,h2,h3,h4,h5,h6,[role="heading"]') || node;
    const { top, right, bottom, left } = heading.getBoundingClientRect();
    const y = top + Math.min(4, (bottom - top) / 2);
    const x1 = Math.max(left, 0), x2 = Math.min(right, innerWidth);
    const blockers = [.2, .5, .8].map(fraction => document.elementFromPoint(x1 + (x2 - x1) * fraction, y))
      .filter(hit => !heading.contains(hit)).map(hit => hit?.outerHTML.slice(0, 140) ?? null);
    return { top, bottom, viewportHeight: innerHeight, scrollY, heading: heading.textContent.trim().slice(0, 120), blockers,
      visible: top >= -1 && y >= 0 && bottom <= innerHeight + 1 && x2 > x1 };
  });
  assert.ok(sample.visible && !sample.blockers.length, `Covered or offscreen anchor ${selector}: ${JSON.stringify(sample)}`);
  return sample;
}

async function fragment(page, hash) {
  if (hash) await page.waitForFunction(hash => location.hash === hash, wait, hash);
}

async function follow(page, action, input = () => activate(page, action.control)) {
  const href = await page.$eval(action.control, node => node.href ?? null);
  const from = page.url();
  await input();
  if (href && href !== from) {
    await page.waitForFunction(href => location.href === href, wait, href);
  }
  if (action === site.back) {
    await stableScroll(page);
    await menuState(page, true);
    const { top, padding } = await page.$eval(action.target, entry => ({ top: entry.getBoundingClientRect().top,
      padding: parseFloat(getComputedStyle(document.scrollingElement).scrollPaddingTop) || 0 }));
    const nav = await page.$eval(site.nav, node => ({ top: node.getBoundingClientRect().top, state: node.dataset.homeNavState }));
    assert.ok(Math.abs(top - padding) <= 2 && Math.abs(nav.top - Math.max(0, top)) <= 2 && nav.state === 'entry', `Start did not land at the expanded entry: ${JSON.stringify({ top, nav })}`);
    return { top, nav };
  }
  await visible(page, action.target);
  return anchorClear(page, action.target);
}

async function scrollChapter(page, section) {
  const target = () => page.$eval(section, node => {
    const top = node.getBoundingClientRect().top + scrollY;
    return Math.max(0, Math.min(top - innerHeight * .22, document.scrollingElement.scrollHeight - innerHeight));
  });
  const { width, height } = page.viewport();
  await page.mouse.move(width / 2, height * .75);
  let stuck = 0;
  const deadline = performance.now() + 25000;
  while (stuck < 4 && performance.now() < deadline) {
    const y = await page.evaluate(() => scrollY);
    const remaining = await target() - y;
    if (remaining <= 5) break;
    await page.mouse.wheel({ deltaY: Math.min(55, Math.ceil(remaining)) });
    await sleep(30);
    stuck = Math.abs(await page.evaluate(() => scrollY) - y) < 1 ? stuck + 1 : 0;
  }
  await stableScroll(page);
  return page.$eval(section, node => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom, height: innerHeight, y: scrollY };
  }).then(position => {
    assert.ok(position.top >= -50 && position.top < position.height * .85 && position.bottom > 0,
      `Did not reach ${section} using wheel input: ${JSON.stringify(position)}`);
    return position;
  });
}

// Record actual composited Edge frames. Quantize CDP's epoch timestamps to a fixed-rate MP4 grid,
// carrying forward the last frame on static intervals. Never pause the recorder between actions.
async function record(page, destination) {
  const cdp = await page.createCDPSession();
  const temp = destination.replace(/\.mp4$/, '.partial.mp4');
  const encoder = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', `${fps}`,
    '-c:v', 'png', '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', temp], { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
  const stopped = once(encoder, 'close');
  stopped.catch(() => {});
  let stderr = '', first, last, previousTick = 0, frameCount = 0, browserFrames = 0;
  let pending = Promise.resolve();
  let captureError;
  encoder.stdin.on('error', error => { captureError ??= error; });
  encoder.stderr.on('data', buffer => { stderr += buffer; });
  const pushUntil = (frame, tick) => {
    pending = pending.then(async () => {
      while (frameCount < tick) {
        if (!encoder.stdin.write(frame)) await once(encoder.stdin, 'drain');
        frameCount++;
      }
    }).catch(error => { captureError ??= error; });
  };
  let signalFirst;
  const ready = new Promise(resolve => { signalFirst = resolve; });
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    void cdp.send('Page.screencastFrameAck', { sessionId }).catch(error => { captureError ??= error; });
    const epoch = metadata.timestamp;
    if (!Number.isFinite(epoch)) return;
    if (first === undefined) {
      first = epoch;
      signalFirst();
    }
    const tick = Math.max(previousTick, Math.round((epoch - first) * fps));
    if (last && tick > previousTick) pushUntil(last, tick);
    previousTick = tick;
    browserFrames++;
    last = Buffer.from(data, 'base64');
  });
  const events = [];
  let timer;
  const stop = async () => {
    const end = epochNow();
    await cdp.send('Page.stopScreencast').finally(() => cdp.detach());
    if (last) pushUntil(last, Math.max(previousTick + 1, Math.round((end - first) * fps)));
    await pending;
    encoder.stdin.end();
    const [exit] = await stopped;
    assert.equal(exit, 0, stderr);
    if (captureError) throw captureError;
    assert.ok(browserFrames > 1 && frameCount > fps, 'No continuous browser frames recorded');
    const probe = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-select_streams', 'v:0', '-show_entries',
      'stream=width,height,codec_name,nb_frames,r_frame_rate:format=duration', '-of', 'json', temp], { encoding: 'utf8' }));
    const stream = probe.streams[0];
    assert.equal(stream.codec_name, 'h264');
    assert.equal(stream.width, page.viewport().width);
    assert.equal(stream.height, page.viewport().height);
    assert.equal(Number(stream.nb_frames), frameCount);
    assert.ok(events.every(event => event.frame < frameCount), 'Timeline extends past encoded video');
    return { firstFrameAt: new Date(first * 1000).toISOString(), browserFrames, frameCount, stream,
      durationSeconds: Number(probe.format.duration), events, temp };
  };
  try {
    await cdp.send('Page.startScreencast', { format: 'png', everyNthFrame: 1 });
    await Promise.race([ready, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('No Edge screencast frame')), 7500); })]);
  } catch (error) {
    await cdp.detach().catch(() => {});
    encoder.kill();
    await stopped.catch(() => {});
    throw error;
  } finally {
    clearTimeout(timer);
  }
  return { mark(label, state) {
    const seconds = Math.max(0, epochNow() - first);
    events.push({ label, seconds: +seconds.toFixed(3), frame: Math.floor(seconds * fps), ...state });
  }, stop };
}

async function enter(page) {
  await activate(page, site.enter);
  await fragment(page, '#entry');
  await visible(page, site.mainStart);
  await stableScroll(page);
}

async function tour(page, { name, width, rehearse }, result) {
  await viewport(page, width);
  await open(page, '/');
  await visible(page, site.openingReady);
  const destination = resolve(out, `${name}-tour.mp4`);
  const recorder = rehearse ? { mark() {}, stop: async () => ({}) } : await record(page, destination);
  const hold = async (label, ms, state = {}) => {
    recorder.mark(label, { url: page.url(), ...state });
    if (!rehearse) await sleep(ms);
  };
  let failure;
  try {
    // The opener has three scenes on a 5.4s beat. Give the third scene a full second.
    await hold('opening', 11900);
    recorder.mark('activate-opening');
    await enter(page);
    await menuState(page, true);
    await hold('navigation-entry', 1100);
    await menu(page, false);
    recorder.mark('activate-navigation');
    await menu(page, true);
    await hold('navigation-open', 1400);
    await menu(page, false);
    await hold('navigation-closed', 450);
    for (const { id, section } of site.chapters) {
      recorder.mark(`scroll-to:${id}`);
      const position = await scrollChapter(page, section);
      const current = await page.$eval(site.navCurrent, node => ({ id: node.dataset.homeNavCurrent, text: node.textContent.trim() }));
      assert.equal(current.id, id, 'Sticky navigation should identify the chapter on screen');
      assert.ok(current.text, 'Sticky navigation chapter label is empty');
      await hold(`chapter:${id}`, 850, { scrollY: position.y, current });
    }
    await menu(page, true);
    await hold('navigation-reopened', 950);
    recorder.mark('activate-menu-jump');
    const jumped = await follow(page, site.jump);
    await hold('menu-jump-arrived', 1250, { anchor: jumped });
    recorder.mark('activate-return');
    const returned = await follow(page, site.back);
    await hold('returned-to-navigation-start', 900, { anchor: returned });
    await menu(page, false);
    const intro = await scrollChapter(page, site.chapters[0].section);
    await hold('content-start', 1500, { scrollY: intro.y });
  } catch (error) {
    failure = error;
    recorder.mark('tour-failed', { message: error.message });
    await sleep(350);
  }
  const { temp, ...details } = await recorder.stop();
  Object.assign(result, details);
  if (failure) throw failure;
  if (rehearse) return;
  await rename(temp, destination);
  result.file = `${name}-tour.mp4`;
}

async function tabTo(page, selector, max = 60) {
  for (let step = 0; step <= max; step++) {
    if (await page.evaluate(selector => document.activeElement?.matches(selector), selector)) return step;
    if (step < max) await page.keyboard.press('Tab');
  }
  assert.fail(`Tab never reached ${selector}`);
}

async function layout(page, width, reduced, lang) {
  const result = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth,
    lang: document.documentElement.lang, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches }));
  assert.equal(result.width, width, 'Viewport meta / CSS width');
  assert.ok(result.documentWidth <= width + 1, `Horizontal overflow ${result.documentWidth}px > ${width}px`);
  assert.equal(result.reduced, reduced);
  assert.match(result.lang, lang === 'en' ? /^en(?:-|$)/i : /^zh(?:-|$)/i);
  return result;
}

async function matrix(page, { lang, width, reduced }, result) {
  await viewport(page, width);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }]);
  const path = lang === 'en' ? '/en/' : '/';
  await open(page, path);
  result.layout = await layout(page, width, reduced, lang);
  if (site.enter && await page.evaluate(selector => document.querySelector(selector)?.checkVisibility({ visibilityProperty: true }), site.enter)) {
    await tabTo(page, site.enter);
    await page.keyboard.press('Enter');
  }
  await stableScroll(page);
  result.tabsToMenu = await tabTo(page, site.menuToggle);
  if (await page.$eval(site.menuToggle, button => button.getAttribute('aria-expanded') === 'true')) {
    await page.keyboard.press('Enter');
    await menuState(page, false);
  }
  await page.keyboard.press('Enter');
  await menuState(page, true);
  await tabTo(page, site.jump.control);
  await page.keyboard.press('Escape');
  await menuState(page, false);
  assert.ok(await page.evaluate(selector => document.activeElement?.matches(selector), site.menuToggle), 'Escape did not restore focus to the menu toggle');
  await page.keyboard.press('Enter');
  await menuState(page, true);
  result.tabsToJump = await tabTo(page, site.jump.control);
  result.jump = await follow(page, site.jump, () => page.keyboard.press('Enter'));
  await menuState(page, false);
  result.back = await follow(page, site.back);
  await contentInteractions(page, path, result);
}

async function contentInteractions(page, path, result) {
  result.chapters = [];
  for (const { id, section } of site.chapters) {
    const hash = await page.$eval(section, node => node.id ? `#${encodeURIComponent(node.id)}` : null);
    if (!hash) continue;
    await open(page, path + hash);
    await fragment(page, hash);
    result.chapters.push({ id, ...await anchorClear(page, section) });
  }
  await activate(page, site.direction);
  const activeTopic = await page.$eval(site.direction, link => link.dataset.direction);
  await fragment(page, `#${activeTopic}`);
  await visible(page, `[data-topic]#${activeTopic}`);
  result.direction = await page.$$eval('[data-topic]', nodes => nodes.filter(node => !node.hidden).map(node => node.id));
  assert.deepEqual(result.direction, [activeTopic]);
  assert.equal(await page.$eval(site.direction, link => link.getAttribute('aria-current')), 'true');
  await page.focus(site.direction);
  await page.keyboard.press('ArrowDown');
  const nextTopic = await page.evaluate(() => document.activeElement?.dataset.direction);
  assert.ok(nextTopic && nextTopic !== activeTopic, 'ArrowDown did not move research selection');
  await fragment(page, `#${nextTopic}`);
  await visible(page, `[data-topic]#${nextTopic}`);
  result.directionByKeyboard = nextTopic;
  await page.$eval(site.modelSelect, select => select.scrollIntoView({ block: 'center', behavior: 'instant' }));
  const modelState = () => page.$eval(site.modelSelect, select => ({
    value: select.value,
    segments: Number(select.closest('.cut-row').querySelector('output').textContent),
    marks: Array.from(select.closest('.cut-row').querySelectorAll('.cut-track i'), mark => mark.style.left),
    expected: JSON.parse(select.closest('[data-cuts]').dataset.cuts)[Number(select.value)].length,
  }));
  const before = await modelState();
  await page.focus(site.modelSelect);
  await page.keyboard.press(before.value === '0' ? 'End' : 'Home');
  const after = await modelState();
  assert.notEqual(after.value, before.value, 'Native select did not change model');
  assert.equal(after.segments, after.expected, 'Ruler segment count did not update');
  assert.equal(after.marks.length, after.expected - 1);
  assert.notDeepEqual(after.marks, before.marks, 'Ruler segment marks did not update');
  result.model = { before: before.value, after: after.value, segments: after.segments };
}

async function stills(page, width, result) {
  await viewport(page, width);
  await open(page, '/');
  await enter(page);
  const style = await page.addStyleTag({ content: `${site.rail} { visibility: hidden !important; }` });
  const directory = resolve(out, 'chapters');
  await mkdir(directory, { recursive: true });
  const shot = async (id, target) => {
    await page.$eval(target, node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await stableScroll(page);
    assert.equal(await page.$$eval(site.rail, nodes => nodes.filter(node => getComputedStyle(node).visibility === 'visible').length), 0,
      'Common character rail still visible');
    const image = await page.screenshot();
    const file = `${width}-${id}.png`;
    const destination = resolve(directory, file);
    if (width <= 800) await writeFile(destination, image);
    else execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-c:v', 'png', '-i', 'pipe:0',
      '-vf', 'scale=800:-1:flags=lanczos', '-frames:v', '1', '-update', '1', destination], { input: image, windowsHide: true });
    result.files.push(`chapters/${file}`);
  };
  try {
    for (const { id, section, shot: target } of site.chapters) await shot(id, target || section);
    await visible(page, site.graph.root);
    await page.$eval(site.graph.root, node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await stableScroll(page);
    result.graph = await page.$eval(site.graph.root, (node, selector) => {
      const labels = selector ? Array.from(node.querySelectorAll(selector)) : [];
      const { x, y, width, height } = node.getBoundingClientRect();
      return { x, y, width, height, visible: node.checkVisibility({ visibilityProperty: true, opacityProperty: true }),
        labels: labels.map(label => ({ text: (label.textContent || label.getAttribute('aria-label') || '').trim(),
          visible: label.checkVisibility({ visibilityProperty: true, opacityProperty: true }) })) };
    }, site.graph.labels || null);
    assert.ok(result.graph.visible && result.graph.width > 2 && result.graph.height > 2, 'Relationship graph hidden with character rail');
    if (site.graph.labels) assert.ok(result.graph.labels.length && result.graph.labels.every(label => label.visible && label.text), 'Graph labels missing with character rail hidden');
    await shot('relationship-graph', site.graph.root);
  } finally {
    await style.evaluate(node => node.remove());
  }
}

async function main() {
  const mode = process.argv[2] || '--help';
  if (mode === '--help') {
    console.log('Usage: node scripts/home-film.mjs --ready | --rehearse | --qa | --check-config\n--ready records both tours. --rehearse runs the same inputs without recording. Both run browser QA and stills.');
    return;
  }
  assert.ok(['--ready', '--rehearse', '--qa', '--check-config'].includes(mode), `Unknown option ${mode}`);
  checkConfig(site);
  if (mode === '--check-config') return;
  const response = await fetch(new URL('/', origin), { cache: 'no-store' });
  assert.ok(response.ok, `Homepage returned ${response.status}`);
  const homepageSha256 = digest(await response.text());
  await mkdir(out, { recursive: true });
  const browser = await launch();
  const report = { startedAt: new Date().toISOString(), origin, homepageSha256, browser: await browser.version(), checks: [] };
  const timeline = { origin, homepageSha256, browser: report.browser, fps, clock: 'Edge CDP screencast first frame at 0s', tours: [] };
  const run = async (name, config, callback, extra = {}) => {
    const result = { name, ...config, ...extra, errors: [] };
    const context = await browser.createBrowserContext();
    try {
      const page = await context.newPage();
      watch(page, result.errors);
      await callback(page, config, result);
      assert.deepEqual(result.errors, [], 'Browser reported errors');
      result.status = 'pass';
    } catch (error) {
      result.status = 'fail';
      result.detail = error.stack || String(error);
      process.exitCode = 1;
    } finally {
      await context.close();
    }
    console.log(`${result.status.toUpperCase()} ${name}${result.detail ? ` — ${result.detail.split('\n')[0]}` : ''}`);
    return result;
  };
  try {
    if (mode === '--ready' || mode === '--rehearse') {
      for (const [name, width] of [['desktop', 1440], ['mobile', 390]]) {
        const result = await run(`${name}-tour`, { width }, (page, config, result) => tour(page, { name, rehearse: mode === '--rehearse', ...config }, result));
        if (mode === '--ready') {
          timeline.tours.push(result);
          await json(resolve(out, 'timeline.json'), timeline);
        } else report.checks.push(result);
      }
    }
    for (const width of [1440, 390, 320]) {
      report.checks.push(await run(`stills-${width}`, { width }, (page, config, result) => stills(page, config.width, result), { files: [] }));
      for (const lang of ['zh', 'en']) for (const reduced of [false, true]) {
        report.checks.push(await run(`${lang}-${width}-${reduced ? 'reduce' : 'default'}`, { lang, width, reduced }, matrix));
      }
      await json(resolve(out, 'qa.json'), report);
    }
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main();
export { activate, anchorClear, contentInteractions, enter, layout, record, scrollChapter, stableScroll, tabTo, visible };
