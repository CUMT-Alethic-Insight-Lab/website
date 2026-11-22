import { createAnchorScroller } from './anchor-scroll.mjs';
import { drawProgress } from './coordinates.mjs';

const CUE = 'alethic.route.cue';
const STATE = 'alethicTravel';
const EXIT_MS = 120;
const ENTER_MS = 280;
const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export function isContentPath(path) {
  return /^\/(?:en\/)?(?:[a-z0-9][a-z0-9-]*\.html)?$/i.test(path);
}

function fragmentTarget(hash) {
  if (!hash) return null;
  try { return document.getElementById(decodeURIComponent(hash.slice(1))); }
  catch { return null; }
}

function firstHeading() {
  return document.querySelector('main h1, [data-page-title]') || document.querySelector('main, .opening a');
}

function focus(node) {
  if (!node || node.closest('[hidden], [inert]')) return;
  if (!node.matches('a[href],button,input,select,textarea,[tabindex]')) node.tabIndex = -1;
  node.focus({ preventScroll: true });
}

function markSource(node) {
  const href = node.getAttribute('href');
  const matches = [...document.querySelectorAll('a[href]')].filter(link => link.getAttribute('href') === href);
  return { id: node.id, href, index: matches.indexOf(node) };
}

function sourceNode(mark) {
  if (!mark) return null;
  const id = mark.id && document.getElementById(mark.id);
  if (id) return id;
  return [...document.querySelectorAll('a[href]')].filter(link => link.getAttribute('href') === mark.href)[mark.index] || null;
}

export function objectOrigin(rect, width, height, point) {
  const large = rect.width > width * 0.66 || rect.height > height * 0.60;
  const x = large && point ? clamp(point.x, rect.left, rect.right) : rect.left + rect.width * 0.5;
  const y = large && point ? clamp(point.y, rect.top, rect.bottom) : rect.top + rect.height * 0.5;
  return {
    x: clamp(x / width, 0.02, 0.98), y: clamp(y / height, 0.02, 0.98),
    rx: clamp(rect.width * 0.45, 19, 106), ry: clamp(rect.height * 0.55, 12, 49),
  };
}

function saveCue(cue) {
  try { sessionStorage.setItem(CUE, JSON.stringify(cue)); } catch { /* Navigation still works. */ }
}

function takeCue() {
  try {
    const cue = JSON.parse(sessionStorage.getItem(CUE));
    sessionStorage.removeItem(CUE);
    if (cue?.target === location.href && Date.now() - cue.time < 15000) return cue;
  } catch { /* There is no usable cue. */ }
  return null;
}

export function mountTravel({ still, motionChange }) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.className = 'page-scene-transfer';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.hidden = true;
  document.body.append(canvas);
  let frame = 0, pending, reduced = still(), arrivalFrame = 0;

  const anchorScroll = createAnchorScroller({still, onFinish(target, focusTarget) {
    focus(focusTarget);
    draw('hash',locator(target),ENTER_MS);
  }});

  document.addEventListener('alethic:result-ready', event => {
    const { target, focusTarget = target } = event.detail;
    if (!(target instanceof HTMLElement) || !target.isConnected) return;
    stop();
    const rect = focusTarget.getBoundingClientRect();
    const headerBottom = document.querySelector('[data-site-header]')?.getBoundingClientRect().bottom || 0;
    if (rect.top >= Math.max(0, headerBottom) && rect.bottom <= innerHeight) {
      focus(focusTarget);
      draw('result', locator(focusTarget), ENTER_MS);
    } else {
      anchorScroll.start(target, focusTarget);
    }
  });

  function clearDrawing() {
    cancelAnimationFrame(frame);
    frame = 0;
    canvas.hidden = true;
    delete canvas.dataset.travelFeedback;
  }

  function stop() {
    anchorScroll.cancel();
    if (pending) clearTimeout(pending.timer);
    pending = undefined;
    cancelAnimationFrame(arrivalFrame);
    clearDrawing();
  }

  function draw(stage, node, duration) {
    clearDrawing();
    if (!ctx || reduced || document.hidden || !node) return;
    const width = innerWidth, height = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    ctx.font = `600 ${width <= 600 ? 9 : 11}px ${getComputedStyle(canvas).fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = getComputedStyle(canvas).getPropertyValue('--transfer-ink').trim() || '#3d50a2';
    const rect = node.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > height || rect.right < 0 || rect.left > width) return;
    // Corner marks track their object as the browser scrolls.
    const pad = width <= 600 ? 6 : 9;
    const pitch = width <= 600 ? 6 : 8;
    const start = performance.now();
    canvas.hidden = false;
    canvas.dataset.travelFeedback = stage;

    function render(now) {
      const progress = clamp((now - start) / duration);
      ctx.clearRect(0, 0, width, height);
      const box = node.getBoundingClientRect();
      const left = box.left - pad, right = box.right + pad;
      const top = box.top - pad, bottom = box.bottom + pad;
      ctx.globalAlpha = 0.68 * (1 - drawProgress(progress));
      for (const [x, y, sx, sy] of [[left, top, -1, -1], [right, top, 1, -1], [left, bottom, -1, 1], [right, bottom, 1, 1]]) {
        ctx.fillText('+', x, y);
        ctx.fillText('.', x + sx * pitch, y);
        ctx.fillText('.', x, y + sy * pitch);
      }
      ctx.globalAlpha = 1;
      if (progress < 1) frame = requestAnimationFrame(render);
      else clearDrawing();
    }
    render(start);
  }

  function locator(node) {
    if (!node) return null;
    if (node.matches('h1, h2, h3, h4, a, button')) return node;
    const heading = node.querySelector('h1, h2, h3, h4, [data-page-title]');
    return heading || node;
  }

  function state(patch) {
    try { history.replaceState({ ...history.state, [STATE]: { ...history.state?.[STATE], ...patch } }, ''); }
    catch { /* The browser can restore its native focus and scroll. */ }
  }

  function focusDestination(keyboard, hash = location.hash) {
    const target = fragmentTarget(hash) || firstHeading();
    if (keyboard) focus(target);
    return target;
  }

  function arrival(restored = false) {
    stop();
    const cue = takeCue();
    if (cue) {
      state({ arrival: cue.keyboard ? location.hash || true : undefined, source: undefined });
      const target = focusDestination(cue.keyboard);
      if (!reduced) arrivalFrame = requestAnimationFrame(() => draw('in', locator(target), ENTER_MS));
      return;
    }
    const historic = restored || performance.getEntriesByType('navigation')[0]?.type === 'back_forward'
      || window.navigation?.activation?.navigationType === 'traverse';
    if (historic) restoreFocus();
  }

  function restoreFocus() {
    const record = history.state?.[STATE];
    if (!record) return;
    arrivalFrame = requestAnimationFrame(() => {
      const node = sourceNode(record.source);
      if (node) focus(node);
      else if (record.arrival) focusDestination(true, typeof record.arrival === 'string' ? record.arrival : '');
    });
  }

  document.addEventListener('click', event => {
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.shiftKey || event.metaKey) return;
    const node = event.target.closest?.('a[href], [data-pick-object] .object-control, [data-scene-option]');
    if (!node || node.closest('.opening') || node.hasAttribute('download') || (node.target && node.target !== '_self')) return;
    if (!node.matches('a[href]') || event.defaultPrevented) {
      draw('local', node, ENTER_MS);
      return;
    }
    const url = new URL(node.href, location.href);
    if (url.origin !== location.origin || !isContentPath(url.pathname)) return;
    const sameDocument = url.pathname === location.pathname && url.search === location.search;
    const target = sameDocument ? fragmentTarget(url.hash) : null;
    if (sameDocument && !target) return;
    stop();
    const keyboard = event.detail === 0;

    if (target) {
      event.preventDefault();
      if (url.hash !== location.hash) {
        state({source:markSource(node), scrollY:window.scrollY});
        history.pushState({...history.state,[STATE]:{arrival:url.hash}},'',url.href);
      }
      anchorScroll.start(target);
      return;
    }

    state({ source: markSource(node) });
    const navigate = () => {
      pending = undefined;
      saveCue({ target: url.href, time: Date.now(), keyboard });
      location.assign(url.href);
    };
    if (reduced || !ctx || document.hidden) {
      saveCue({ target: url.href, time: Date.now(), keyboard });
      return;
    }
    event.preventDefault();
    draw('out', node, EXIT_MS);
    pending = { navigate, timer: setTimeout(navigate, EXIT_MS) };
  });

  addEventListener('popstate', () => { stop(); restoreFocus(); });
  addEventListener('pagehide', stop);
  addEventListener('pageshow', event => { if (event.persisted) arrival(true); });
  addEventListener('keydown', event => { if (event.key === 'Escape' && pending) stop(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearDrawing(); });
  motionChange(() => {
    reduced = still();
    if (!reduced) return;
    anchorScroll.finish();
    clearDrawing();
    if (pending) {
      clearTimeout(pending.timer);
      pending.navigate();
    }
  });
  arrival();
}
