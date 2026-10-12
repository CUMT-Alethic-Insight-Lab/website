export function initCursor() {
  const fine = matchMedia("(pointer: fine)");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let cleanup = () => {};

  const mount = () => {
    cleanup();
    cleanup = () => {};
    if (!fine.matches || motion.matches) return;
    const layer = document.createElement("div");
    layer.id = "cursor-layer";
    layer.setAttribute("aria-hidden", "true");
    const ring = document.createElement("div");
    ring.className = "cursor-ring";
    const dot = document.createElement("div");
    dot.className = "cursor-dot";
    layer.append(ring, dot);
    document.body.append(layer);
    document.documentElement.classList.add("has-custom-cursor");
    let x = innerWidth / 2;
    let y = innerHeight / 2;
    let rx = x;
    let ry = y;
    let scale = 1;
    let hot = false;
    let pressed = false;
    let raf = 0;
    let last = 0;
    const move = (event) => {
      if (event.pointerType === "touch") return;
      x = event.clientX;
      y = event.clientY;
      layer.style.opacity = "1";
      hot = !!event.target.closest?.("a,button,summary,input,select,textarea,[data-hover]");
      ring.classList.toggle("hot", hot);
    };
    const down = () => { pressed = true; ring.classList.add("pressed"); };
    const up = () => { pressed = false; ring.classList.remove("pressed"); };
    const leave = () => { layer.style.opacity = "0"; up(); };
    const loop = (now) => {
      raf = 0;
      const dt = Math.min(2, (now - (last || now - 16.67)) / 16.67);
      last = now;
      const k = 1 - Math.pow(0.83, dt);
      rx += (x - rx) * k;
      ry += (y - ry) * k;
      scale += ((pressed ? 0.75 : hot ? 1.8 : 1) - scale) * k;
      dot.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
      ring.style.transform = `translate3d(${rx}px,${ry}px,0) translate(-50%,-50%) scale(${scale})`;
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };
    const visibility = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("blur", leave);
    document.documentElement.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", visibility);
    raf = requestAnimationFrame(loop);
    cleanup = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("blur", leave);
      document.documentElement.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", visibility);
      document.documentElement.classList.remove("has-custom-cursor");
      layer.remove();
    };
  };
  fine.addEventListener("change", mount);
  motion.addEventListener("change", mount);
  mount();
  return () => {
    cleanup();
    fine.removeEventListener("change", mount);
    motion.removeEventListener("change", mount);
  };
}
