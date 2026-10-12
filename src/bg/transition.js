const ease = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

export function createTransition(canvas) {
  const ctx = canvas.getContext("2d");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let busy = false;
  let raf = 0;
  let timer = 0;
  let width = 0;
  let height = 0;
  const resize = () => {
    width = innerWidth;
    height = innerHeight;
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize);

  const draw = (k) => {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    if (k <= 0) return;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--paper").trim();
    ctx.fillRect(0, height * (1 - k), width, height * k + 1);
  };
  const animate = (from, to, duration) => new Promise((resolve) => {
    const start = performance.now();
    const step = () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      const progress = Math.min(1, (performance.now() - start) / duration);
      draw(from + (to - from) * ease(progress));
      if (progress >= 1) { resolve(); return; }
      raf = requestAnimationFrame(step);
      timer = setTimeout(step, 100);
    };
    step();
  });
  return {
    async run(midCb) {
      busy = true;
      try {
        if (ctx && !motion.matches) await animate(0, 1, 360);
        await midCb?.();
        if (ctx && !motion.matches) await animate(1, 0, 480);
      } finally {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
        draw(0);
        busy = false;
      }
    },
    get busy() { return busy; },
  };
}
