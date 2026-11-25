// Animate only deliberate section navigation. Wheel, touch and navigation
// keys immediately return control to native document scrolling.
export function createAnchorScroller({ still, onFinish }) {
  let frame = 0;
  let current = null;

  function cancel() {
    cancelAnimationFrame(frame);
    frame = 0;
    if (current) {
      delete document.documentElement.dataset.anchorTravel;
      current = null;
    }
  }

  function topFor(target) {
    if (target.id === 'top') return 0;
    const root = document.documentElement;
    const css = getComputedStyle(target);
    const margin = parseFloat(css.scrollMarginTop) || 0;
    const padding = parseFloat(getComputedStyle(root).scrollPaddingTop) || 0;
    const max = Math.max(0,root.scrollHeight - window.innerHeight);
    return Math.min(max, Math.max(0, scrollY + target.getBoundingClientRect().top - margin - padding));
  }

  function finish() {
    if (!current) return;
    const {target, focusTarget} = current;
    window.scrollTo({top:topFor(target),behavior:'instant'});
    cancel();
    onFinish(target, focusTarget);
  }

  function start(target, focusTarget = target) {
    cancel();
    const from = scrollY;
    const distance = Math.abs(topFor(target) - from);
    current = { target, focusTarget };
    if (still() || distance < 3) { finish(); return; }
    const duration = Math.min(880, Math.max(320, 260 + Math.sqrt(distance) * 7));
    const begin = performance.now();
    document.documentElement.dataset.anchorTravel = target.id;
    function step(now) {
      if (!current) return;
      const t = Math.min(1, Math.max(0, (now-begin)/duration));
      if (t === 1 || still()) { finish(); return; }
      const eased = t * t * (3 - 2*t);
      window.scrollTo({top:from + (topFor(target) - from) * eased,behavior:'instant'});
      frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
  }

  for (const event of ['wheel','touchstart','pointerdown','pagehide','popstate','blur']) {
    window.addEventListener(event,cancel,{passive:true});
  }
  window.addEventListener('keydown',event=>{
    if (['Escape','Tab','PageUp','PageDown','ArrowUp','ArrowDown','Home','End',' '].includes(event.key)) cancel();
  });
  return {start,cancel,finish};
}
