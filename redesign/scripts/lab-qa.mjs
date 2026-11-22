import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, readFile, rename, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { digest, launch, open, origin, releaseInfo, sleep, viewport, watch } from './browser-qa.mjs';
import { record, stableScroll, tabTo } from './home-film.mjs';

const out = process.env.ALETHIC_LAB_OUTPUT || fileURLToPath(new URL('../qa-output/lab-revision/', import.meta.url));
const ffmpeg = process.env.ALETHIC_FFMPEG || (existsSync('E:/projects/dsh/tools/ffmpeg/bin/ffmpeg.exe') ? 'E:/projects/dsh/tools/ffmpeg/bin/ffmpeg.exe' : 'ffmpeg');
const reference = Number(process.env.ALETHIC_LAB_REFERENCE_WIDTH || 1852);
const widths = [...new Set([320, 390, 1440, reference])];
const themes = ['light', 'dark'];
const locales = ['zh', 'en'];
const wait = { timeout: 6200 };
const sectionOrder = ['position', 'structure', 'work', 'focus', 'projects', 'awards', 'work-mode', 'documents', 'meeting', 'join'];
const ui = {
  step: '#position [data-lab-step]', figure: '#position [data-lab-figure]', note: '#position [role="status"]',
  pick: '#awards [data-award-pick]', panel: '#awards [data-award-panel]',
  title: '#projects #project-story-title', ruler: '#projects .cut-figure', model: '#projects [data-ruler-select]',
  opening: '.opening', enter: '.opening a[href]', home: '[data-site-header] .identity', scene: 'canvas.page-scene',
  header: '[data-site-header]', navToggle: '[data-site-nav-toggle]',
  disclosure: '[data-site-group]:has([data-site-chapter="work"]) [data-site-disclosure]',
  dock: '[data-site-preferences]', dockHandle: '[data-site-preferences] > summary',
  cursor: '[data-site-cursor], #cursor-layer', ring: '.site-cursor-ring, .cursor-ring', dot: '.site-cursor-dot, .cursor-dot',
};
const value = (base, attribute, key) => `${base}[${attribute}="${key}"]`;
const step = n => value(ui.step, 'data-lab-step', n);
const pick = n => value(ui.pick, 'data-award-pick', n);
const pathFor = (lang, hash = '') => `${lang === 'en' ? '/en/' : '/'}${hash}`;
const save = (name, data) => writeFile(resolve(out, name), JSON.stringify(data, null, 2) + '\n');

async function options(page, width, theme, reduce = false) {
  await viewport(page, width);
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme },
    { name: 'prefers-reduced-motion', value: reduce ? 'reduce' : 'no-preference' }]);
}

async function arrive(page, id) {
  await page.waitForFunction(id => {
    const screen = document.getElementById(id);
    return screen && document.querySelector('main')?.dataset.activePage === screen.dataset.scenePage &&
      screen.getBoundingClientRect().bottom > 0 && screen.getBoundingClientRect().top < innerHeight;
  }, wait, id);
  await stableScroll(page);
}

async function reveal(page, selector) {
  await page.$eval(selector, node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await stableScroll(page);
}

async function activate(page, selector) {
  await page.waitForSelector(selector, { ...wait, visible: true });
  if (page.viewport().hasTouch) await page.tap(selector);
  else await page.click(selector);
}

async function shot(page, filename, capture, result) {
  if (!capture) return;
  const png = await page.screenshot({ path: resolve(out, filename) });
  (result.screenshots ??= []).push({ filename, sha256: digest(png) });
}

async function labState(page) {
  return page.$eval('#position', section => {
    const buttons = [...section.querySelectorAll('[data-lab-step]')];
    const figures = [...section.querySelectorAll('[data-lab-figure]')];
    return { heading: section.querySelector('h1')?.textContent.trim(), note: section.querySelector('[role="status"]')?.textContent.trim(),
      active: buttons.filter(node => node.getAttribute('aria-pressed') === 'true').map(node => node.dataset.labStep),
      controls: buttons.map(node => ({ label: node.querySelector('.lab-label')?.textContent.trim(), controls: node.getAttribute('aria-controls') })),
      figures: figures.map(node => ({ shared: node.matches('.lab-master-plate'), tag: node.tagName, text: node.textContent,
        hidden: node.getAttribute('aria-hidden'), width: node.clientWidth, scrollWidth: node.scrollWidth })) };
  });
}

async function lab(page, result, { lang, theme, width, reduce, capture }) {
  await options(page, width, theme, reduce);
  await open(page, pathFor(lang, '#position'));
  await reveal(page, ui.figure);
  await arrive(page, 'position');
  result.initial = await labState(page);
  assert.equal(result.initial.controls.length, 4);
  assert.ok(result.initial.heading && result.initial.note && result.initial.controls.every(row => row.label));
  assert.equal(result.initial.figures.length, 1);
  const plate = result.initial.figures[0];
  assert.ok(plate.shared && plate.text.trim() && plate.hidden === 'true');
  assert.ok(plate.scrollWidth <= plate.width + 1, 'Shared plate has horizontal overflow');
  await sleep(410);
  result.idleChanged = (await labState(page)).figures[0].text !== plate.text;
  assert.equal(result.idleChanged, !reduce, 'Unexpected idle animation in the workbench');
  const notes = [];
  for (let index = 0; index < 4; index++) {
    if (!index || page.viewport().hasTouch) await activate(page, step(index));
    else await page.keyboard.press('ArrowRight');
    const state = await labState(page);
    assert.deepEqual(state.active, [String(index)]);
    notes.push(state.note);
  }
  result.notes = notes;
  assert.equal(new Set(notes).size, 4, 'Four workflow steps should show four explanations');
  await page.keyboard.press('Home');
  assert.deepEqual((await labState(page)).active, ['0']);
  await page.keyboard.press('End');
  await page.keyboard.press('Home');
  await page.keyboard.press('End');
  const final = await labState(page);
  assert.deepEqual(final.active, ['3']);
  assert.equal(final.note, notes[3]);
  result.final = final.active[0];
  await sleep(reduce ? 60 : 300);
  await shot(page, `${width}-${lang}-${theme}${reduce ? '-reduce' : ''}-position.png`, capture, result);
}

async function awardState(page) {
  return page.$eval('#awards', section => {
    const buttons = [...section.querySelectorAll('[data-award-pick]')];
    const panels = [...section.querySelectorAll('[data-award-panel]')];
    return { active: buttons.filter(node => node.getAttribute('aria-pressed') === 'true').map(node => node.id),
      controls: buttons.map(node => ({ id: node.id, name: node.textContent.trim(), controls: node.getAttribute('aria-controls') })),
      panels: panels.map(node => ({ id: node.id, hidden: node.hidden, heading: node.querySelector('h3')?.textContent.trim(),
        href: node.querySelector('a[href$=".pdf"]')?.href, alt: node.querySelector('img')?.alt })) };
  });
}

async function award(page, result, { lang, theme, width, capture }) {
  await options(page, width, theme);
  result.deepLinks = [];
  for (let index = 0; index < 3; index++) {
    const id = `awards-item-${index + 1}`;
    await open(page, pathFor(lang, `#${id}`));
    const state = await awardState(page);
    assert.equal(state.panels.length, 3);
    assert.equal(state.controls.length, 3);
    assert.deepEqual(state.active, [id]);
    assert.equal(state.controls[index].controls, state.panels[index].id);
    assert.deepEqual(state.panels.filter(row => !row.hidden).map(row => row.id), [state.panels[index].id]);
    assert.ok(state.panels[index].heading && state.panels[index].href && state.panels[index].alt);
    await stableScroll(page);
    const landing = await focusState(page, pick(index));
    assert.ok(landing.inView && landing.hittable, `Deep link ${id} lands beneath the sticky header`);
    result.deepLinks.push({ id, ...state.panels[index], landing });
  }
  if (page.viewport().hasTouch) {
    result.fromThirdToFirst = await focusState(page, pick(0));
    assert.ok(result.fromThirdToFirst.inView && result.fromThirdToFirst.hittable, 'First award option is obscured from the third deep link');
  }
  await activate(page, pick(0));
  assert.deepEqual((await awardState(page)).active, ['awards-item-1']);
  if (page.viewport().hasTouch) await activate(page, pick(1));
  else await page.keyboard.press('ArrowDown');
  assert.deepEqual((await awardState(page)).active, ['awards-item-2']);
  await page.goBack();
  await page.waitForFunction(() => location.hash === '#awards-item-1', wait);
  assert.deepEqual((await awardState(page)).active, ['awards-item-1']);
  await page.goForward();
  await page.waitForFunction(() => location.hash === '#awards-item-2', wait);
  assert.deepEqual((await awardState(page)).active, ['awards-item-2']);
  await reveal(page, `${ui.panel}:not([hidden])`);
  await page.$eval(`${ui.panel}:not([hidden]) img`, image => image.decode());
  await shot(page, `${width}-${lang}-${theme}-awards.png`, capture, result);
}

async function certificatePDFs(page, result, capture) {
  await options(page, 1440, 'light');
  await open(page, '/#awards');
  const { panels } = await awardState(page);
  assert.equal(panels.length, 3);
  assert.equal(new Set(panels.map(panel => panel.href)).size, 3);
  result.certificates = [];
  const temporary = await mkdtemp(resolve(tmpdir(), 'alethic-cert-'));
  try {
    for (const panel of panels) {
      const url = new URL(panel.href);
      assert.equal(url.origin, new URL(origin).origin);
      assert.match(url.pathname, /^\/awards\/cert-[A-Za-z0-9]+\.pdf$/);
      const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
      assert.equal(response.status, 200);
      assert.match(response.headers.get('content-type') || '', /application\/pdf/i);
      const data = Buffer.from(await response.arrayBuffer());
      assert.equal(data.subarray(0, 5).toString(), '%PDF-');
      const file = url.pathname.split('/').at(-1);
      const packed = await readFile(new URL(`../public/awards/${file}`, import.meta.url));
      assert.equal(digest(data), digest(packed), `Served certificate differs from ${file}`);
      const input = resolve(temporary, file);
      await writeFile(input, data);
      const metadata = execFileSync('pdfinfo', [input], { encoding: 'utf8', windowsHide: true });
      const pages = Number(metadata.match(/^Pages:\s+(\d+)/m)?.[1]);
      assert.ok(pages >= 1);
      const renderStem = resolve(temporary, file.slice(0, -4));
      execFileSync('pdftoppm', ['-png', '-singlefile', '-f', '1', '-l', '1', '-scale-to', '900', input, renderStem], { windowsHide: true });
      const image = await readFile(`${renderStem}.png`);
      assert.equal(image.subarray(1, 4).toString(), 'PNG');
      if (capture) await writeFile(resolve(out, `${file.slice(0, -4)}.png`), image);
      result.certificates.push({ heading: panel.heading, file, pages, bytes: data.length, sha256: digest(data), rendered: capture ? `${file.slice(0, -4)}.png` : undefined });
    }
  } finally {
    for (const file of await readdir(temporary)) await unlink(resolve(temporary, file));
    await rmdir(temporary);
  }
}

async function projectLayout(page) {
  return page.$eval('#projects', section => {
    const title = section.querySelector('#project-story-title');
    const ruler = section.querySelector('.cut-figure');
    const caption = ruler.querySelector('figcaption');
    const main = document.querySelector('main');
    const rect = node => node.getBoundingClientRect().toJSON();
    const captionText = [...caption.childNodes].filter(node => node.textContent.trim());
    const range = document.createRange();
    range.setStartBefore(captionText[0]);
    range.setEndAfter(captionText.at(-1));
    const captionInk = range.getBoundingClientRect().toJSON();
    const headings = [...section.querySelectorAll('h2,h3,h4,figcaption')].filter(node => /^FLUED(?:\s*↗)?$/i.test(node.textContent.trim()));
    return { title: title.textContent.trim(), caption: caption.textContent.trim(), totalTitles: headings.length,
      titleBox: rect(title), rulerBox: rect(ruler), captionBox: rect(caption), captionInk,
      mainContent: main.clientWidth, mainScroll: main.scrollWidth, body: document.documentElement.scrollWidth, width: innerWidth };
  });
}

async function focusState(page, selector) {
  return page.$eval(selector, node => {
    const r = node.getBoundingClientRect();
    const header = document.querySelector('[data-site-header]')?.getBoundingClientRect().bottom || 0;
    const style = getComputedStyle(node);
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { focused: document.activeElement === node, ring: node.matches(':focus-visible') && style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0,
      top: r.top, header, bottom: r.bottom, hittable: node.contains(hit), inView: r.top >= header - 1 && r.bottom <= innerHeight + 1 };
  });
}

async function projects(page, result, { lang, theme, width, capture }) {
  await options(page, width, theme);
  await open(page, pathFor(lang, '#projects'));
  await reveal(page, ui.ruler);
  result.layout = await projectLayout(page);
  const { layout } = result;
  assert.match(layout.title, /^FLUED(?:\s*↗)?$/i);
  assert.equal(layout.totalTitles, 1);
  assert.ok(layout.caption && !/^FLUED\b\s*$/i.test(layout.caption));
  assert.ok(layout.captionBox.top >= layout.titleBox.bottom - 1, 'Ruler caption is above the FLUED heading');
  assert.ok(Math.abs(layout.captionInk.left - layout.titleBox.left) <= 5, `Caption origin ${layout.captionInk.left} does not align with heading ${layout.titleBox.left}`);
  assert.ok(layout.body <= width + 1 && layout.mainScroll <= layout.mainContent + 1, 'Projects makes the document overflow');
  const titleLink = `${ui.title} a`;
  await page.focus(titleLink);
  await tabTo(page, ui.model, 20);
  result.focusBefore = await focusState(page, ui.model);
  await page.keyboard.press('End');
  const ruler = await page.$eval(ui.model, select => {
    const row = select.closest('.cut-row');
    const track = row.querySelector('.cut-track');
    const count = row.querySelector('output');
    const fig = select.closest('figure');
    const expected = JSON.parse(fig.dataset.cuts)[Number(select.value)];
    return { value: select.value, count: Number(count.textContent), expected: expected.length, ticks: track.querySelectorAll('i').length,
      clipped: ['hidden', 'clip'].includes(getComputedStyle(track).overflowX),
      split: select.getBoundingClientRect().right <= count.getBoundingClientRect().left + 1,
      selectColor: getComputedStyle(select).color, selectBackground: getComputedStyle(select).backgroundColor };
  });
  result.ruler = ruler;
  assert.equal(ruler.count, ruler.expected);
  assert.equal(ruler.ticks + 1, ruler.count);
  assert.ok(ruler.split && ruler.clipped && ruler.selectColor !== ruler.selectBackground);
  // Scroll the already-focused select underneath the sticky bar, then use Shift+Tab/Tab to reacquire it.
  await page.$eval(ui.model, select => {
    const top = select.getBoundingClientRect().top + scrollY;
    scrollTo({ top: top - 12, behavior: 'instant' });
  });
  await page.keyboard.down('Shift');
  try { await page.keyboard.press('Tab'); } finally { await page.keyboard.up('Shift'); }
  await page.keyboard.press('Tab');
  await stableScroll(page);
  result.focusAfter = await focusState(page, ui.model);
  for (const focus of [result.focusBefore, result.focusAfter]) assert.ok(focus.focused && focus.ring && focus.inView && focus.hittable,
    `Focused model is obscured or missing a focus ring: ${JSON.stringify(focus)}`);
  await shot(page, `${width}-${lang}-${theme}-projects.png`, capture, result);
}

async function pointerAt(page, selector) {
  const box = await page.$eval(selector, node => node.getBoundingClientRect().toJSON());
  assert.ok(box.width && box.height && box.top >= 0 && box.bottom <= page.viewport().height, `Offscreen pointer target ${selector}`);
  await page.mouse.move(box.left + box.width / 2, box.top + box.height / 2);
}

async function hoverTiming(page, selector, state, result) {
  await page.mouse.move(2, 210);
  await sleep(300);
  assert.equal(await state(), false);
  const start = performance.now();
  await pointerAt(page, selector);
  await sleep(55);
  const early = await state();
  while (!(await state()) && performance.now() - start < 950) await sleep(15);
  const open = await state();
  const openedMs = Math.round(performance.now() - start);
  const away = performance.now();
  await page.mouse.move(2, 210);
  await sleep(75);
  const exitEarly = await state();
  while (await state() && performance.now() - away < 1100) await sleep(18);
  const closed = !(await state());
  Object.assign(result, { early, open, openedMs, exitEarly, closed, closedMs: Math.round(performance.now() - away) });
  assert.ok(!early && open && exitEarly && closed, 'Hover preview failed its delayed open or delayed dismissal');
}

async function menus(page, result, width, theme, capture) {
  await options(page, width, theme);
  await open(page, '/#structure');
  await arrive(page, 'structure');
  const groupOpen = () => page.$eval(ui.disclosure, node => node.getAttribute('aria-expanded') === 'true');
  const dockOpen = () => page.$eval(ui.dock, node => node.open);
  if (width >= 1100) {
    result.group = {};
    result.preferences = {};
    await hoverTiming(page, ui.disclosure, groupOpen, result.group);
    await hoverTiming(page, ui.dockHandle, dockOpen, result.preferences);
    await page.focus(ui.home);
    await tabTo(page, ui.disclosure);
    await page.keyboard.press('ArrowDown');
    assert.equal(await groupOpen(), true);
    assert.ok(await page.$eval(ui.disclosure, node => document.getElementById(node.getAttribute('aria-controls')).contains(document.activeElement)));
    await page.keyboard.press('Escape');
    assert.equal(await groupOpen(), false);
    assert.ok(await page.$eval(ui.disclosure, node => node === document.activeElement));
    await page.focus(`${ui.dock} summary`);
    await page.keyboard.press('Enter');
    assert.equal(await dockOpen(), true);
    await page.keyboard.press('Tab');
    assert.ok(await page.$eval(ui.dock, node => node.contains(document.activeElement)));
    await page.keyboard.press('Escape');
    assert.equal(await dockOpen(), false);
    assert.ok(await page.$eval(ui.dockHandle, node => node === document.activeElement));
  } else {
    const tapHittable = async selector => {
      await page.waitForFunction(selector => {
        const node = document.querySelector(selector);
        if (!node) return false;
        const { x, y, width, height } = node.getBoundingClientRect();
        return node.contains(document.elementFromPoint(x + width / 2, y + height / 2));
      }, wait, selector);
      await activate(page, selector);
    };
    await tapHittable(ui.navToggle);
    await tapHittable(ui.disclosure);
    assert.equal(await groupOpen(), true);
    await tapHittable(ui.disclosure);
    assert.equal(await groupOpen(), false);
    await reveal(page, ui.dockHandle);
    await page.waitForFunction(selector => document.querySelector(selector).getAttribute('aria-expanded') === 'false', wait, ui.navToggle);
    result.menuDismissedOnScroll = true;
    await tapHittable(ui.dockHandle);
    await page.waitForFunction(selector => document.querySelector(selector).open, wait, ui.dock);
    await shot(page, `${width}-${theme}-preferences.png`, capture, result);
    await activate(page, `${ui.header} .identity`);
    await page.waitForFunction(() => scrollY <= 2, wait);
    await page.waitForFunction(selector => !document.querySelector(selector).open, wait, ui.dock);
  }
}

async function cursorState(page) {
  return page.$eval(ui.cursor, (layer, ui) => {
    const ring = layer.querySelector(ui.ring);
    const dot = layer.querySelector(ui.dot);
    const shell = getComputedStyle(layer);
    const rect = node => node.getBoundingClientRect();
    const dotBox = rect(dot);
    return { active: document.documentElement.hasAttribute('data-site-cursor-active'), hiddenFromAT: layer.getAttribute('aria-hidden'),
      pointerEvents: shell.pointerEvents, visible: layer.checkVisibility({ opacityProperty: true, visibilityProperty: true }),
      blend: shell.mixBlendMode, pressed: layer.hasAttribute('data-pressed'),
      ringBase: parseFloat(getComputedStyle(ring).width), ringPainted: rect(ring).width, dotBase: parseFloat(getComputedStyle(dot).width),
      dotCenter: [dotBox.left + dotBox.width / 2, dotBox.top + dotBox.height / 2] };
  }, ui);
}

async function cursor(page, result, width, reduce, capture) {
  await options(page, width, 'light', reduce);
  await open(page, '/#position');
  await reveal(page, step(0));
  await pointerAt(page, step(0));
  await sleep(460);
  result.hover = await cursorState(page);
  assert.equal(result.hover.hiddenFromAT, 'true');
  assert.equal(result.hover.pointerEvents, 'none');
  if (width < 700 || reduce) {
    assert.ok(!result.hover.active && !result.hover.visible);
    if (width < 700) {
      await activate(page, step(1));
      assert.deepEqual((await labState(page)).active, ['1']);
      result.touch = await cursorState(page);
      assert.ok(!result.touch.active && !result.touch.visible);
    }
    return;
  }
  assert.ok(result.hover.active && result.hover.visible && result.hover.blend === 'difference');
  assert.ok(result.hover.ringBase >= 34 && result.hover.ringPainted > result.hover.ringBase * 1.5 && result.hover.dotBase === 6);
  const target = await page.$eval(step(0), button => {
    const r = button.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  });
  assert.ok(result.hover.dotCenter.every((coordinate, i) => Math.abs(coordinate - target[i]) < 2));
  await shot(page, '1440-light-cursor-hover.png', capture, result);
  await page.mouse.down();
  try {
    await sleep(340);
    result.pressed = await cursorState(page);
    assert.ok(result.pressed.pressed && result.pressed.ringPainted < result.pressed.ringBase);
  } finally { await page.mouse.up(); }
  result.released = await cursorState(page);
  assert.equal(result.released.pressed, false);
  await open(page, '/#projects');
  await reveal(page, ui.model);
  await pointerAt(page, ui.model);
  result.nativeSelect = await cursorState(page);
  assert.ok(!result.nativeSelect.active, 'Native select failed to regain system cursor');
}

async function nativeRoll(page, id) {
  const { width, height } = page.viewport();
  await page.mouse.move(width * .48, height * .57);
  const deadline = performance.now() + 18000;
  while (performance.now() < deadline) {
    const delta = await page.$eval(`#${id}`, node => {
      const r = node.getBoundingClientRect();
      return Math.round(r.top - innerHeight * .16);
    });
    if (Math.abs(delta) <= 5) break;
    await page.mouse.wheel({ deltaY: Math.sign(delta) * Math.min(100, Math.abs(delta)) });
    await sleep(33);
  }
  await arrive(page, id);
}

async function observeScene(page) {
  await page.evaluate(() => {
    const scene = document.querySelector('canvas.page-scene');
    window.__labSceneTrace = [];
    const observe = () => {
      const { scenePage, sceneRewrite, sceneMotif, sceneVisible } = scene.dataset;
      window.__labSceneTrace.push({ scenePage, sceneRewrite, sceneMotif, sceneVisible,
        time: +performance.now().toFixed(1), y: scrollY });
    };
    const observer = new MutationObserver(observe);
    observer.observe(scene, { attributes: true, attributeFilter: ['data-scene-page', 'data-scene-rewrite', 'data-scene-visible', 'data-scene-motif'] });
    observe();
  });
}

async function sceneState(page, id) {
  const scene = await page.waitForFunction(({ id, selector }) => {
    const canvas = document.querySelector(selector);
    return canvas && canvas.dataset.scenePage === document.getElementById(id).dataset.scenePage &&
      canvas.dataset.sceneVisible === 'true' ? { ...canvas.dataset } : false;
  }, wait, { id, selector: ui.scene });
  try { return await scene.jsonValue(); } finally { await scene.dispose(); }
}

async function pageMotion(page, result, width, theme, reduce, capture) {
  await options(page, width, theme, reduce);
  await open(page, '/');
  await page.waitForSelector(`${ui.opening}[data-ready]`, { ...wait, visible: true });
  const filename = `${width < 700 ? 'mobile' : 'desktop'}-tour.mp4`;
  const recorder = capture ? await record(page, resolve(out, filename)) : null;
  const documentId = await page.evaluate(() => performance.timeOrigin);
  result.steps = [];
  const mark = async (label, delay = 0, extra = {}) => {
    const row = { label, url: page.url(), y: await page.evaluate(() => scrollY), ...extra };
    result.steps.push(row);
    recorder?.mark(label, row);
    if (recorder && delay) await sleep(delay);
  };
  try {
    await observeScene(page);
    await mark('opening', 11500);
    await shot(page, `${width}-${theme}-opening.png`, capture, result);
    await activate(page, ui.enter);
    await arrive(page, 'position');
    await mark('position-arrived', 550, await sceneState(page, 'position'));
    for (const index of [0, 1, 2, 3]) {
      await activate(page, step(index));
      assert.deepEqual((await labState(page)).active, [String(index)]);
      await mark(`lab-step-${index}`, 600);
    }
    for (const id of sectionOrder.slice(1, 6)) {
      await nativeRoll(page, id);
      await mark(`forward-${id}`, 520, await sceneState(page, id));
      if (id === 'projects') {
        await reveal(page, ui.model);
        await page.focus(ui.model);
        await page.keyboard.press('End');
        await mark('projects-bpe', 740);
      }
    }
    for (const index of [0, 1, 2]) {
      await activate(page, pick(index));
      assert.deepEqual((await awardState(page)).active, [`awards-item-${index + 1}`]);
      await mark(`award-${index + 1}`, 670);
    }
    await nativeRoll(page, 'projects');
    await mark('reverse-projects', 720, await sceneState(page, 'projects'));
    await nativeRoll(page, 'position');
    await mark('reverse-position', 650, await sceneState(page, 'position'));
    await activate(page, ui.home);
    await page.waitForFunction(() => scrollY <= 2 && location.hash === '#top', wait);
    assert.equal(await page.evaluate(() => performance.timeOrigin), documentId);
    await mark('opening-returned', 1000);
    result.scenes = await page.evaluate(() => window.__labSceneTrace);
    const directions = new Set(result.scenes.map(row => row.sceneRewrite).filter(Boolean));
    if (reduce) assert.equal(directions.size, 0, 'Scene rewrite is still running under reduced motion');
    else assert.ok(directions.has('forward') && directions.has('reverse'), `Missing scene rewrite direction ${[...directions].join(', ')}`);
  } catch (error) {
    result.issue = error.message;
    await mark('issue', 300, { detail: error.message });
  } finally {
    if (recorder) {
      const { temp, ...timing } = await recorder.stop();
      Object.assign(result, timing);
      await rename(temp, resolve(out, filename));
      result.file = filename;
      execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-xerror', '-i', resolve(out, filename), '-f', 'null', '-']);
    }
  }
  if (result.issue) throw new Error(result.issue);
}

async function baselinePlates(page, result, capture) {
  const original = process.env.ALETHIC_LAB_BASELINE || '6fda0a980501';
  assert.match(original, /^[a-f0-9]{12}$/);
  const module = await import(new URL(`../dist/assets/${original}/lab-workbench.mjs`, import.meta.url));
  assert.equal(typeof module.renderLab, 'function');
  const source = module.renderLab('zh');
  const compare = text => text.replace(/\r/g, '').split('\n').map(line => line.trimEnd()).join('\n').trim();
  const older = [...source.matchAll(/<span[^>]*data-lab-figure[^>]*>([^<]*)<\/span>/g)].map(match => compare(match[1]));
  await options(page, 1440, 'light', true);
  await open(page, '/#position');
  await reveal(page, ui.figure);
  const newer = [];
  for (let index = 0; index < 4; index++) {
    await activate(page, step(index));
    const state = await labState(page);
    assert.deepEqual(state.active, [String(index)]);
    assert.equal(state.figures.length, 1);
    newer.push(compare(state.figures[0].text));
    if (capture) await shot(page, `intro-plate-${index + 1}.png`, capture, result);
  }
  assert.equal(older.length, 4);
  assert.equal(newer.length, 4);
  result.baseline = original;
  result.figures = newer.map((text, index) => ({ index, old: digest(older[index]), current: digest(text), changed: !older.includes(text) }));
  assert.ok(result.figures.every(figure => figure.changed) && new Set(newer).size === 4, 'At least one intro plate reuses the previous artwork');
}

async function medal(page) {
  return page.$$eval('[data-award-medal]', nodes => nodes.filter(node => node.checkVisibility({ opacityProperty: true })).map(node => {
    const r = node.getBoundingClientRect();
    if (node instanceof HTMLCanvasElement) return { picture: node.toDataURL(), width: r.width, height: r.height };
    const copy = node.cloneNode(true);
    for (const element of [copy, ...copy.querySelectorAll('*')]) for (const name of ['id', 'aria-label', 'aria-describedby', 'data-award-medal']) element.removeAttribute(name);
    return { picture: copy.outerHTML, width: r.width, height: r.height, source: node.currentSrc || null };
  }));
}

async function awardPreview(page, result, width, theme, lang, capture) {
  await options(page, width, theme, true);
  await open(page, pathFor(lang, '#awards'));
  await reveal(page, pick(0));
  const selected = async n => {
    await page.waitForFunction(n => document.getElementById(`awards-item-${n + 1}`)?.getAttribute('aria-pressed') === 'true', wait, n);
    const state = await awardState(page);
    assert.deepEqual(state.active, [`awards-item-${n + 1}`]);
    assert.deepEqual(state.panels.filter(row => !row.hidden).map(row => row.id), [state.controls[n].controls]);
    const medals = await medal(page);
    assert.ok(medals.length && medals.every(item => item.width > 0 && item.height > 0));
    return { selected: n, hash: locationHash(page), medals: digest(JSON.stringify(medals.map(item => [item.picture, item.source]))) };
  };
  result.states = [await selected(0)];
  for (let index = 1; index < 3; index++) {
    if (page.viewport().hasTouch) await activate(page, pick(index));
    else await pointerAt(page, pick(index));
    result.states.push(await selected(index));
  }
  assert.equal(new Set(result.states.map(row => row.medals)).size, 3, 'Three award states did not show three medal graphics');
  if (!page.viewport().hasTouch) {
    await page.mouse.move(2, 300);
    await page.focus(pick(0));
    await page.keyboard.press('Tab');
    const focus = await focusState(page, pick(1));
    assert.ok(focus.focused && focus.ring && focus.hittable, 'Award picker has no visible keyboard focus');
    result.focusSelection = await selected(1);
    await page.keyboard.press('End');
    await page.keyboard.press('Home');
    await page.keyboard.press('End');
  } else {
    await activate(page, pick(0));
    await activate(page, pick(1));
    await activate(page, pick(2));
  }
  await stableScroll(page);
  result.final = await selected(2);
  assert.equal(result.final.medals, result.states[2].medals, 'Fast interaction left a stale medal graphic');
  await shot(page, `${width}-${lang}-${theme}-award-medal.png`, capture, result);
}

function locationHash(page) { return new URL(page.url()).hash; }

async function organizationWires(page, result, width, theme, lang, capture) {
  await options(page, width, theme, true);
  await open(page, pathFor(lang, '#structure'));
  const selector = '#structure svg[data-org-wires]';
  await reveal(page, selector);
  result.geometry = await page.$eval(selector, svg => {
    const root = svg.closest('.org-chart') || svg.parentElement;
    const rect = root.getBoundingClientRect();
    const point = (path, len) => {
      const pos = path.getPointAtLength(len).matrixTransform(path.getScreenCTM());
      return [pos.x, pos.y];
    };
    const port = (node, side) => {
      const range = document.createRange();
      const text = [...node.childNodes].find(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim());
      range.selectNodeContents(text || node);
      const label = range.getBoundingClientRect();
      return [side === 'in' ? label.left - 6 : label.right + 5, (label.top + label.bottom) / 2];
    };
    const compact = matchMedia('(max-width:760px)').matches;
    const start = port(root.querySelector('.org-gate'), compact ? 'in' : 'out');
    const expected = [...root.querySelectorAll('.org-branch')].flatMap(branch => {
      const mode = branch.querySelector('.org-mode');
      return [[start, port(mode, 'in')], ...[...branch.querySelectorAll('.object-control')].map(door => [port(mode, 'out'), port(door, 'in')])];
    });
    const paths = [...svg.querySelectorAll('path')].map(path => {
      const len = path.getTotalLength();
      const style = getComputedStyle(path);
      return { d: path.getAttribute('d'), len, start: point(path, 0), end: point(path, len),
        visible: style.stroke !== 'none' && parseFloat(style.strokeWidth) > 0 && parseFloat(style.opacity) > 0 };
    });
    const inside = ([x, y]) => x >= rect.left - 8 && x <= rect.right + 8 && y >= rect.top - 8 && y <= rect.bottom + 8;
    const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const portErrors = expected.map(([a, b], index) => paths[index]
      ? Math.max(distance(a, paths[index].start), distance(b, paths[index].end)) : null);
    return { root: rect.toJSON(), paths, portErrors, onChart: paths.every(path => inside(path.start) && inside(path.end)),
      terminals: [...root.querySelectorAll('.org-gate,.org-mode,.seat-node h3')].filter(node => node.checkVisibility()).map(node => node.textContent.trim()) };
  });
  await shot(page, `${width}-${lang}-${theme}-organization-wires.png`, capture, result);
  assert.ok(result.geometry.terminals.length >= 4);
  assert.ok(result.geometry.paths.length >= 2 && result.geometry.onChart);
  assert.ok(result.geometry.paths.every(path => path.len > 9 && path.visible && Math.hypot(path.end[0] - path.start[0], path.end[1] - path.start[1]) > 5));
  assert.equal(new Set(result.geometry.paths.map(path => path.d)).size, result.geometry.paths.length);
  assert.equal(result.geometry.portErrors.length, result.geometry.paths.length);
  assert.ok(result.geometry.portErrors.every(error => error !== null && error <= 2), 'Wires do not meet the expected text ports');
}

async function traceMotion(page, selector, milliseconds) {
  await page.evaluate(({ selector, milliseconds }) => {
    const node = selector && document.querySelector(selector);
    const started = performance.now();
    const rows = [];
    window.__labTrace = rows;
    const frame = now => {
      const css = node && getComputedStyle(node);
      const rect = node?.getBoundingClientRect();
      rows.push({ ms: +(now - started).toFixed(1), y: scrollY, anchor: document.documentElement.dataset.anchorTravel || null,
        opacity: css ? Number(css.opacity) : null, transform: css?.transform, clip: css?.clipPath,
        visible: node ? node.checkVisibility() : null, height: rect?.height, top: rect?.top });
      if (now - started < milliseconds) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, { selector, milliseconds });
}

async function drawer(page, result, width, reduce, capture) {
  await options(page, width, 'dark', reduce);
  await open(page, '/#entry');
  const controls = width < 700 ? ui.navToggle : ui.dockHandle;
  const selector = width < 700 ? '#site-nav-content' : `${ui.dock} .site-preferences-panel`;
  await reveal(page, controls);
  await page.focus(controls);
  result.edges = [];
  for (const edge of ['open', 'close']) {
    await traceMotion(page, selector, 820);
    await sleep(75);
    await page.keyboard.press('Enter');
    await sleep(820);
    const trace = await page.evaluate(() => window.__labTrace);
    const key = value => JSON.stringify([value.opacity, value.transform, value.clip, value.height, value.top]);
    const start = key(trace[0]), end = key(trace.at(-1));
    const middle = new Set(trace.filter(row => row.visible && key(row) !== start && key(row) !== end).map(key));
    result.edges.push({ edge, intermediate: middle.size, trace });
    assert.equal(trace.at(-1).visible, edge === 'open', `Drawer did not ${edge}`);
    assert.ok(reduce ? middle.size === 0 : middle.size >= 2, `Drawer ${edge} had ${middle.size} intermediate visual states`);
    if (edge === 'open') await shot(page, `${width}${reduce ? '-reduce' : ''}-drawer.png`, capture, result);
  }
}

async function clickArticleAnchor(page, index) {
  const selector = `.ed-paper > .ed-index li:nth-child(${index}) a[href]`;
  const anchor = await page.$eval(selector, node => decodeURIComponent(node.hash).slice(1));
  await activate(page, selector);
  return anchor;
}

async function waitForArticleTitle(page, id) {
  await page.waitForFunction(id => decodeURIComponent(location.hash) === `#${id}` && !document.documentElement.hasAttribute('data-anchor-travel'), wait, id);
  await stableScroll(page);
  return page.evaluate(id => {
    const title = document.getElementById(id);
    const r = title.getBoundingClientRect();
    const bar = document.querySelector('[data-site-header]').getBoundingClientRect();
    return { id, y: scrollY, top: r.top, bar: bar.bottom, title: title.textContent.trim(), focus: document.activeElement.id,
      inView: r.top >= bar.bottom - 1 && r.bottom <= innerHeight && title.contains(document.elementFromPoint(r.left + 7, r.top + 4)) };
  }, id);
}

async function readingInk(page) {
  return page.$eval(ui.scene, canvas => {
    const copy = new OffscreenCanvas(canvas.width, canvas.height);
    const pen = copy.getContext('2d', { willReadFrequently: true });
    pen.drawImage(canvas, 0, 0);
    const { width, height } = copy;
    const bounds = canvas.getBoundingClientRect();
    const rects = [...document.querySelectorAll('.ed-paper > .ed-prose, .ed-paper > .ed-index')].map(node => node.getBoundingClientRect());
    const pixels = pen.getImageData(0, 0, width, height).data;
    const inside = rects.map(() => ({ total: 0, ink: 0 }));
    let outside = 0, hash = 2166136261;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4, opacity = pixels[i + 3];
      const left = bounds.left + x * bounds.width / width, top = bounds.top + y * bounds.height / height;
      const index = rects.findIndex(r => left >= r.left + 2 && left <= r.right - 2 && top >= r.top + 2 && top <= r.bottom - 2);
      if (index >= 0) { inside[index].total++; if (opacity >= 12) inside[index].ink++; }
      else if (opacity >= 12) { outside++; hash = Math.imul(hash ^ i ^ opacity, 16777619); }
    }
    return { inside, outside, hash: hash >>> 0 };
  });
}

async function article(page, result, width, theme, lang, capture) {
  await options(page, width, theme);
  await open(page, `${lang === 'en' ? '/en' : ''}/insights-memory-hierarchy.html`);
  await reveal(page, '.ed-paper > .ed-index');
  result.initial = await readingInk(page);
  await sleep(280);
  result.second = await readingInk(page);
  for (const sample of [result.initial, result.second]) assert.ok(sample.inside.some(row => row.total > 500) && sample.inside.every(row => row.ink === 0), 'Background enters a reading panel');
  if (width >= 1100) assert.notEqual(result.initial.hash, result.second.hash, 'Outside article backdrop remained static');
  await shot(page, `${width}-${lang}-${theme}-article-toc.png`, capture, result);
  await traceMotion(page, null, 1950);
  const anchor = await clickArticleAnchor(page, 5);
  result.arrival = await waitForArticleTitle(page, anchor);
  result.trace = await page.evaluate(() => window.__labTrace);
  const positions = new Set(result.trace.filter(row => row.anchor === anchor).map(row => row.y));
  assert.ok(positions.size >= 2, 'TOC did not pass through multiple scroll positions');
  assert.ok(result.arrival.inView && result.arrival.focus === anchor, 'TOC target title or focus is obscured');
  await shot(page, `${width}-${lang}-${theme}-article-title.png`, capture, result);
  if (width >= 1100) {
    await traceMotion(page, null, 1850);
    const first = await clickArticleAnchor(page, 2);
    await page.waitForFunction(id => document.documentElement.dataset.anchorTravel === id, wait, first);
    const last = await clickArticleAnchor(page, 8);
    result.quick = await waitForArticleTitle(page, last);
    result.quickTrace = await page.evaluate(() => window.__labTrace);
    assert.ok(result.quick.inView && result.quick.focus === last);
    assert.ok(new Set(result.quickTrace.filter(row => row.anchor === last).map(row => row.y)).size >= 2, 'Fast anchor replacement jumped to the last destination');
    const jumps = result.quickTrace.slice(1).map((row, index) => Math.abs(row.y - result.quickTrace[index].y));
    const spread = Math.max(...result.quickTrace.map(row => row.y)) - Math.min(...result.quickTrace.map(row => row.y));
    assert.ok(Math.max(...jumps) < spread * .55, 'Fast anchor replacement introduced a discontinuous jump');
  }
}
async function fastLab(page, result, width, reduce, capture) {
  await options(page, width, 'dark', reduce);
  await open(page, '/#position');
  await reveal(page, ui.figure);
  await activate(page, step(0));
  await sleep(260);
  const initial = await labState(page);
  await page.evaluate(({ figure, step }) => {
    const node = document.querySelector(figure);
    const begin = performance.now();
    const rows = [];
    window.__labFast = rows;
    const scan = time => {
      const box = node.getBoundingClientRect();
      const notes = document.querySelector('#position [role="status"]').getBoundingClientRect();
      rows.push({ ms: +(time - begin).toFixed(1), selected: document.querySelector(`${step}[aria-pressed="true"]`)?.dataset.labStep,
        text: node.textContent, width: box.width, height: box.height, noteTop: notes.top + scrollY });
      if (time - begin < 800) requestAnimationFrame(scan);
    };
    requestAnimationFrame(scan);
  }, ui);
  await sleep(55);
  if (page.viewport().hasTouch) {
    for (const index of [1, 2, 3]) { await activate(page, step(index)); await sleep(70); }
  } else {
    for (const key of ['End', 'Home', 'End']) { await page.keyboard.press(key); await sleep(70); }
  }
  await sleep(720);
  const final = await labState(page);
  const trace = await page.evaluate(() => window.__labFast);
  assert.deepEqual(final.active, ['3']);
  assert.notEqual(initial.note, final.note);
  const intermediate = new Set(trace.filter(row => row.selected === '3').slice(0, 14).map(row => row.text));
  result.states = { final: final.active[0], distinctEarlyFrames: intermediate.size, frames: trace.length,
    minimumHeight: Math.min(...trace.map(row => row.height)), maximumHeight: Math.max(...trace.map(row => row.height)),
    noteMovement: Math.max(...trace.map(row => row.noteTop)) - Math.min(...trace.map(row => row.noteTop)) };
  result.frameLog = trace.map(({ text, ...row }) => ({ ...row, glyphs: digest(text).slice(0, 14) }));
  assert.ok(reduce ? intermediate.size === 1 : intermediate.size >= 2, 'Unexpected visual frames during the rapid workbench sequence');
  assert.equal(result.states.maximumHeight, result.states.minimumHeight, 'Rapid switching resized the artwork');
  assert.ok(result.states.noteMovement <= 2, 'Rapid switching shifted the note');
  await shot(page, `${width}${reduce ? '-reduce' : ''}-lab-final-state.png`, capture, result);
}

async function runSuite(mode) {
  const release = await releaseInfo();
  if (process.env.ALETHIC_LAB_RELEASE) assert.equal(release.css.split('/')[2], process.env.ALETHIC_LAB_RELEASE, 'Preview serves a different build');
  const capture = mode === '--ready';
  const filter = process.env.ALETHIC_LAB_CHECKS ? new RegExp(process.env.ALETHIC_LAB_CHECKS) : null;
  const browser = await launch();
  const report = { origin, release, browser: await browser.version(), mode, referenceWidth: reference, startedAt: new Date().toISOString(), checks: [] };
  const reportName = capture ? 'report.json' : 'rehearsal.json';
  await mkdir(out, { recursive: true });
  async function run(name, task) {
    if (filter && !filter.test(name)) return null;
    const context = await browser.createBrowserContext();
    const result = { name, browserErrors: [] };
    try {
      const page = await context.newPage();
      await page.setRequestInterception(true);
      page.on('request', request => {
        const url = new URL(request.url());
        const run = url.origin === new URL(origin).origin && url.pathname === '/recruitment/api/auth/me'
          ? request.respond({ status: 200, contentType: 'application/json', body: '{}' }) : request.continue();
        void run.catch(() => {});
      });
      watch(page, result.browserErrors);
      await task(page, result);
      assert.deepEqual(result.browserErrors, []);
      result.status = 'pass';
    } catch (error) {
      result.status = 'fail';
      result.issue = error.stack || String(error);
      process.exitCode = 1;
    } finally { await context.close(); }
    report.checks.push(result);
    report.summary = { passed: report.checks.filter(check => check.status === 'pass').length, failed: report.checks.filter(check => check.status === 'fail').length };
    await save(reportName, report);
    console.log(`${result.status.toUpperCase()} ${name}${result.issue ? ` — ${result.issue.split('\n')[0]}` : ''}`);
    return result;
  }
  try {
    const tours = [];
    for (const [width, theme, device] of [[1440, 'light', 'desktop'], [390, 'dark', 'mobile']]) {
      const result = await run(`${device}-tour`, (page, result) => pageMotion(page, result, width, theme, false, capture));
      if (result && capture) tours.push(result);
    }
    if (capture && tours.length) await save('timeline.json', { origin, release, browser: report.browser, tours });
    await run('certificates', (page, result) => certificatePDFs(page, result, capture));
    for (const width of widths) for (const theme of themes) for (const lang of locales) {
      const settings = { lang, theme, width, capture };
      await run(`lab-${width}-${lang}-${theme}`, (page, result) => lab(page, result, settings));
      await run(`awards-${width}-${lang}-${theme}`, (page, result) => award(page, result, settings));
      await run(`projects-${width}-${lang}-${theme}`, (page, result) => projects(page, result, settings));
    }
    for (const [width, theme] of [[1440, 'light'], [1440, 'dark'], [390, 'dark']]) {
      await run(`menus-${width}-${theme}`, (page, result) => menus(page, result, width, theme, capture));
    }
    for (const [width, reduce] of [[1440, false], [1440, true], [390, false]]) {
      await run(`cursor-${width}-${reduce ? 'reduce' : 'default'}`, (page, result) => cursor(page, result, width, reduce, capture));
    }
    for (const [width, theme, lang] of [[1440, 'dark', 'en'], [390, 'light', 'zh']]) {
      await run(`lab-${width}-${lang}-${theme}-reduce`, (page, result) => lab(page, result, { width, theme, lang, reduce: true, capture }));
    }
    await run('scroll-reduce', (page, result) => pageMotion(page, result, 390, 'light', true, false));
    await run('quick-lab-1440', (page, result) => fastLab(page, result, 1440, false, capture));
    await run('quick-lab-390', (page, result) => fastLab(page, result, 390, false, capture));
    await run('quick-lab-390-reduce', (page, result) => fastLab(page, result, 390, true, capture));
    await run('intro-plate-parity', (page, result) => baselinePlates(page, result, capture));
    for (const [width, theme, lang] of [[390, 'dark', 'zh'], [1440, 'light', 'en']]) {
      await run(`award-medals-${width}`, (page, result) => awardPreview(page, result, width, theme, lang, capture));
      await run(`organization-wires-${width}`, (page, result) => organizationWires(page, result, width, theme, lang, capture));
      await run(`article-reading-${width}`, (page, result) => article(page, result, width, theme, lang, capture));
      for (const reduce of [false, true]) await run(`drawer-${width}-${reduce ? 'reduce' : 'default'}`, (page, result) => drawer(page, result, width, reduce, capture));
    }
    await run('build-identity', async () => assert.deepEqual(await releaseInfo(), release));
  } finally { await browser.close(); }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const mode = process.argv[2] || '--help';
  if (mode === '--help') console.log('Usage: node scripts/lab-qa.mjs --measure | --ready. --ready saves continuous MP4s and PNGs. Set ALETHIC_LAB_REFERENCE_WIDTH to change 1852px.');
  else {
    assert.ok(['--measure', '--ready'].includes(mode), `Unknown mode ${mode}`);
    assert.ok(Number.isInteger(reference) && reference >= 320 && reference <= 3840, 'Invalid screenshot-reference width');
    await runSuite(mode);
  }
}
