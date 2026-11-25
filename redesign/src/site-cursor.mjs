const nativeTarget = 'input, textarea, select, option, iframe, [contenteditable]:not([contenteditable="false"]), [data-native-cursor]';
const interactive = 'a[href], button:not(:disabled), summary, [data-hover]';

export function mountSiteCursor() {
  const root = document.documentElement;
  if (document.querySelector('[data-site-cursor]')) return () => {};
  const fine = matchMedia('(any-pointer: fine) and (any-hover: hover)');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const forcedColors = matchMedia('(forced-colors: active)');
  const viewport = window.visualViewport;
  const listeners = new AbortController();
  const { signal } = listeners;
  const passive = { passive: true, signal };
  const layer = document.createElement('div');
  const ring = document.createElement('div');
  const dot = document.createElement('div');
  layer.dataset.siteCursor = '';
  layer.className = 'site-cursor';
  layer.setAttribute('aria-hidden', 'true');
  ring.className = 'site-cursor-ring';
  dot.className = 'site-cursor-dot';
  layer.append(ring, dot);
  document.body.append(layer);

  let x = 0, y = 0, ringX = 0, ringY = 0, scale = 1;
  let frame = 0, hitFrame = 0, last = 0;
  let hasPointer = false, active = false, hot = false, pressed = false;

  function allowed() {
    return fine.matches && !reduce.matches && !forcedColors.matches && !document.hidden
      && (!viewport || Math.abs(viewport.scale - 1) < .01);
  }

  function reset() {
    cancelAnimationFrame(frame);
    frame = last = 0;
    active = hot = pressed = false;
    delete root.dataset.siteCursorActive;
    delete layer.dataset.pressed;
  }

  function leave() {
    hasPointer = false;
    cancelAnimationFrame(hitFrame);
    hitFrame = 0;
    reset();
  }

  function draw() {
    dot.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%) scale(${scale})`;
  }

  function wake() {
    if (active && !frame) frame = requestAnimationFrame(tick);
  }

  function tick(now) {
    frame = 0;
    if (!active) return;
    const dt = Math.min(2, (now - (last || now - 16.67)) / 16.67);
    const ease = 1 - Math.pow(.83, dt);
    const target = pressed ? .75 : hot ? 1.8 : 1;
    last = now;
    ringX += (x - ringX) * ease;
    ringY += (y - ringY) * ease;
    scale += (target - scale) * ease;
    if (Math.abs(x - ringX) + Math.abs(y - ringY) + 36 * Math.abs(target - scale) > .15) wake();
    else {
      ringX = x;
      ringY = y;
      scale = target;
      last = 0;
    }
    draw();
  }

  function hit(target) {
    if (!allowed() || !target || target.closest?.(nativeTarget)
        || x < 0 || y < 0 || x >= root.clientWidth || y >= root.clientHeight) {
      reset();
      return;
    }
    hot = Boolean(target.closest?.(interactive));
    if (!active) {
      ringX = x;
      ringY = y;
      scale = 1;
      active = true;
      draw();
      root.dataset.siteCursorActive = '';
    }
    wake();
  }

  function move(event) {
    if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') {
      leave();
      return;
    }
    if (!allowed()) return;
    hasPointer = true;
    x = event.clientX;
    y = event.clientY;
    hit(event.target);
  }

  function down(event) {
    move(event);
    if (!active || event.button !== 0) return;
    pressed = true;
    layer.dataset.pressed = '';
    wake();
  }

  function up() {
    pressed = false;
    delete layer.dataset.pressed;
    wake();
  }

  function resample() {
    if (!hasPointer || hitFrame) return;
    hitFrame = requestAnimationFrame(() => {
      hitFrame = 0;
      if (hasPointer) hit(document.elementFromPoint(x, y));
    });
  }

  window.addEventListener('pointermove', move, passive);
  window.addEventListener('pointerdown', down, passive);
  window.addEventListener('pointerup', up, passive);
  window.addEventListener('pointercancel', leave, passive);
  window.addEventListener('blur', leave, { signal });
  window.addEventListener('pagehide', leave, { signal });
  window.addEventListener('resize', leave, passive);
  window.addEventListener('wheel', event => { if (event.ctrlKey) leave(); }, passive);
  document.addEventListener('scroll', resample, { ...passive, capture: true });
  document.addEventListener('visibilitychange', leave, { signal });
  root.addEventListener('pointerleave', leave, passive);
  viewport?.addEventListener('resize', leave, passive);
  for (const query of [fine, reduce, forcedColors]) query.addEventListener('change', leave, { signal });

  return () => {
    leave();
    listeners.abort();
    layer.remove();
  };
}
