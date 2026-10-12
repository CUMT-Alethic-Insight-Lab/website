import { initScene } from "./scene.js";

const clamp = (n) => Math.max(0, Math.min(1, n));
const smooth = (n) => { const k = clamp(n); return k * k * (3 - 2 * k); };

/* Each stop-driven stage quantizes its scroll range into phases: one swipe
 * advances exactly one stop, and the page is held until the morph settles. */
const STAGE_STOPS = {
  projects: [0.12, 0.6],
  awards: [0.12, 0.55],
  finale: [0.06, 0.34, 0.6, 0.86],
};
const STAGE_KEYS = {
  projects: ["bits", "FLUED"],
  awards: ["noise", "award"],
  finale: ["noise", "mark", "AI", "brandName"],
};

const segmentState = (p, stops, keys) => {
  if (p <= stops[0]) return { from: keys[0], to: keys[0], mix: 0 };
  for (let i = 1; i < stops.length; i++) {
    if (p <= stops[i]) {
      return { from: keys[i - 1], to: keys[i], mix: smooth((p - stops[i - 1]) / (stops[i] - stops[i - 1])) };
    }
  }
  const last = keys[keys.length - 1];
  return { from: last, to: last, mix: 0 };
};

export function initNarrative() {
  const stages = [...document.querySelectorAll("[data-narrative-stage]")];
  if (!stages.length) return () => {};
  const canvas = document.createElement("canvas");
  canvas.id = "bg-scene";
  canvas.setAttribute("aria-hidden", "true");
  const scene = initScene(canvas);
  if (canvas.getContext("2d")) stages.forEach((stage) => stage.querySelector("[data-stage-art]").classList.add("art-ready"));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const mobile = matchMedia("(max-width: 760px)");
  const selections = new Map();
  const displayed = new Map();
  const cleanups = [];
  let active = null;
  let raf = 0;
  let disposed = false;
  let transition = null;
  let lockUntil = 0;
  let lastStepAt = 0;
  let steppingUntil = 0;
  let settleTimer = 0;
  let lastRestP = 0;
  let touchY = null;
  let introStart = null;

  const progress = (stage) => {
    const rect = stage.getBoundingClientRect();
    return clamp(-rect.top / Math.max(1, rect.height - innerHeight));
  };
  /* Mobile stages are one static block (band + copy) that scrolls away as a
   * unit, so the morph is scrubbed by the block's travel through the
   * viewport instead of by a pinned sticky range. */
  const travelProgress = (stage) => {
    const rect = stage.getBoundingClientRect();
    const raw = clamp((innerHeight - rect.top) / Math.max(1, innerHeight + rect.height));
    /* Spend the morph budget where the block is comfortably on screen:
     * idle while entering, fully formed before it starts exiting. */
    return clamp((raw - 0.13) / 0.6);
  };
  const stopScroll = (stage, stop) => {
    const rect = stage.getBoundingClientRect();
    return scrollY + rect.top + stop * Math.max(0, rect.height - innerHeight);
  };
  const defaultFormation = (stage) =>
    displayed.get(stage) || (stage.dataset.narrativeStage === "directions" ? "directions" : "mark");
  const currentFormation = (stage) => selections.get(stage) || defaultFormation(stage);

  /* A stage owns the page while its sticky art is pinned: wheel and touch
   * input then step through phases instead of scrolling past them. */
  const engagedStage = () => stages.find((stage) => {
    if (!STAGE_STOPS[stage.dataset.narrativeStage]) return false;
    /* On mobile only the finale keeps phase locking; every other stage is a
     * free-scrolling block whose morph is travel-scrubbed. */
    if (mobile.matches && stage.dataset.narrativeStage !== "finale") return false;
    const r = stage.getBoundingClientRect();
    return r.top <= 1 && r.bottom >= innerHeight - 1;
  });
  const stepStage = (stage, direction) => {
    const stops = STAGE_STOPS[stage.dataset.narrativeStage];
    const p = progress(stage);
    let target = null;
    if (direction > 0) target = stops.find((s) => s > p + 0.015) ?? null;
    else target = [...stops].reverse().find((s) => s < p - 0.015) ?? null;
    const now = performance.now();
    lockUntil = now + 950;
    lastStepAt = now;
    steppingUntil = now + 1400;
    if (target === null) {
      /* Past the last (or before the first) phase: one more swipe leaves
       * the stage entirely instead of crawling through dead scroll range. */
      const rect = stage.getBoundingClientRect();
      const exitY = direction > 0
        ? scrollY + rect.bottom - innerHeight + 2
        : scrollY + rect.top - 2;
      scrollTo({ top: Math.max(0, exitY), behavior: reduced.matches ? "instant" : "smooth" });
      return true;
    }
    lastRestP = target;
    scrollTo({ top: stopScroll(stage, target), behavior: reduced.matches ? "instant" : "smooth" });
    return true;
  };
  /* Scrolls that bypass the wheel stepper (scrollbar drags, keyboard,
   * middle-click autoscroll) settle onto a stop once the page stops
   * moving. A fast jump that crosses several phases lands on the first
   * one crossed, so no phase is silently skipped. */
  const onScrollSettle = () => {
    if (reduced.matches || disposed) return;
    if (performance.now() < steppingUntil) return;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      if (performance.now() < steppingUntil) return;
      const stage = engagedStage();
      if (!stage) return;
      const stops = STAGE_STOPS[stage.dataset.narrativeStage];
      const p = progress(stage);
      let target = null;
      if (p > lastRestP + 0.008) target = stops.find((s) => s > lastRestP + 0.008 && s <= p + 0.008) ?? null;
      else if (p < lastRestP - 0.008) target = [...stops].reverse().find((s) => s < lastRestP - 0.008 && s >= p - 0.008) ?? null;
      if (target === null) {
        target = stops.reduce((a, b) => (Math.abs(b - p) < Math.abs(a - p) ? b : a));
        if (Math.abs(target - p) < 0.008) { lastRestP = target; return; }
      }
      lastRestP = target;
      steppingUntil = performance.now() + 1400;
      scrollTo({ top: stopScroll(stage, target), behavior: "smooth" });
    }, 170);
  };
  const onWheel = (event) => {
    if (reduced.matches || Math.abs(event.deltaY) < 8) return;
    const stage = engagedStage();
    if (!stage) return;
    const now = performance.now();
    if (now < lockUntil || (now - lastStepAt < 1600 && Math.abs(event.deltaY) < 30)) {
      event.preventDefault();
      return;
    }
    if (stepStage(stage, event.deltaY > 0 ? 1 : -1)) event.preventDefault();
  };
  const onTouchStart = (event) => {
    if (reduced.matches) return;
    if (engagedStage()) touchY = event.touches[0]?.clientY ?? null;
  };
  const onTouchMove = (event) => {
    if (reduced.matches || touchY === null) return;
    const stage = engagedStage();
    if (!stage) { touchY = null; return; }
    const delta = touchY - (event.touches[0]?.clientY ?? touchY);
    if (Math.abs(delta) < 28) return;
    const now = performance.now();
    if (now >= lockUntil) stepStage(stage, delta > 0 ? 1 : -1);
    event.preventDefault();
    touchY = null;
  };
  const onTouchEnd = () => { touchY = null; };

  const render = (now = performance.now()) => {
    cancelAnimationFrame(raf);
    raf = 0;
    if (disposed) return;
    let best = null;
    let distance = Infinity;
    /* Mobile art is a static band: keep the scene alive while any of it is
     * on screen, not just while it crosses the viewport's center band. */
    const inView = (r) => mobile.matches
      ? (r.bottom > 0 && r.top < innerHeight)
      : (r.bottom > innerHeight * 0.3 && r.top < innerHeight * 0.7);
    if (active) {
      const r = active.querySelector("[data-stage-art]").getBoundingClientRect();
      if (inView(r)) best = active;
    }
    if (!best) stages.forEach((stage) => {
      const art = stage.querySelector("[data-stage-art]");
      const r = art.getBoundingClientRect();
      if (!inView(r)) return;
      const d = Math.abs((r.top + r.bottom) / 2 - innerHeight / 2);
      if (d < distance) { best = stage; distance = d; }
    });
    if (!best) {
      active = null;
      scene.setActive(false);
      return;
    }
    if (active !== best) {
      active = best;
      transition = null;
      scene.mount(best.querySelector("[data-stage-art]"));
      scene.setActive(true);
    }
    const kind = active.dataset.narrativeStage;
    let state = { from: defaultFormation(active), to: defaultFormation(active), mix: 0, focus: selections.has(active), energy: 0, dock: 0 };
    const p = reduced.matches ? STAGE_STOPS[kind]?.[0] ?? 0
      : mobile.matches && kind !== "intro" && kind !== "finale" ? travelProgress(active)
      : progress(active);
    if (kind === "intro") {
      /* Cinematic opening on a fixed timeline: star field → "AI" →
       * "Alethic Insight" → the word rises, then DOM captions take over. */
      if (introStart === null) {
        introStart = window.__introPlayed ? now - 99000 : now;
      }
      const el = reduced.matches ? 99 : (now - introStart) / 1000;
      const seq = [
        { at: 0, key: "stars", dur: 0 },
        { at: 2.0, key: "AI", dur: 2.8 },
        { at: 6.0, key: "brandName", dur: 3.2 },
        { at: 10.8, key: "risenCn", dur: 2.0 },
        { at: 15.8, key: "slogan", dur: 1.8 },
      ];
      let from = seq[0].key;
      let to = seq[0].key;
      let mix = 0;
      for (let i = 1; i < seq.length; i++) {
        if (el >= seq[i].at) {
          from = seq[i - 1].key;
          to = seq[i].key;
          mix = smooth((el - seq[i].at) / seq[i].dur);
          if (mix >= 1) { from = to; mix = 0; }
        }
      }
      state = { ...state, from, to, mix, focus: false };
      active.classList.toggle("chrome-on", el >= 18.2);
      if (el < 19.5) raf = requestAnimationFrame(render);
      else window.__introPlayed = true;
    } else if (STAGE_KEYS[kind] && !selections.has(active)) {
      state = { ...state, ...segmentState(p, STAGE_STOPS[kind], STAGE_KEYS[kind]), focus: false };
    }
    if (kind !== "intro") canvas.style.opacity = "1";
    displayed.set(active, state.mix >= 0.5 ? state.to : state.from);
    if (transition && transition.stage === active) {
      const q = reduced.matches ? 1 : clamp((now - transition.start) / 850);
      state = { ...state, from: transition.from, to: transition.to, mix: smooth(q), focus: transition.focus };
      displayed.set(active, q >= 0.5 ? transition.to : transition.from);
      if (q < 1) raf = requestAnimationFrame(render);
      else transition = null;
    }
    scene.update(state);
  };
  const schedule = () => { if (!disposed && !raf) raf = requestAnimationFrame(render); };

  const select = (stage, key, control) => {
    const previous = currentFormation(stage);
    selections.set(stage, key);
    stage.querySelectorAll("[data-formation]").forEach((el) => {
      el.classList.toggle("is-selected", el === control);
    });
    if (control?.dataset.direction) {
      const source = document.getElementById(control.dataset.direction);
      const detail = stage.querySelector("[data-direction-detail]");
      if (source && detail) {
        detail.replaceChildren(...[...source.querySelectorAll("h3,p")].map((el) => el.cloneNode(true)));
      }
    }
    if (previous === key) { transition = null; render(); return; }
    transition = { stage, from: previous, to: key, start: performance.now(), focus: true };
    render();
  };
  const reset = (stage) => {
    if (!selections.has(stage)) return;
    const from = currentFormation(stage);
    selections.delete(stage);
    stage.querySelectorAll("[data-formation]").forEach((el) => el.classList.remove("is-selected"));
    const to = defaultFormation(stage);
    if (from === to) { transition = null; render(); return; }
    transition = { stage, from, to, start: performance.now(), focus: false };
    render();
  };

  stages.forEach((stage) => {
    const controls = [...stage.querySelectorAll("[data-formation]")];
    let touchSelection = null;
    controls.forEach((control) => {
      const enter = () => select(stage, control.dataset.formation, control);
      const leave = () => {
        if (!matchMedia("(pointer: fine)").matches || document.activeElement === control) return;
        if (currentFormation(stage) === control.dataset.formation) reset(stage);
      };
      const blur = () => {
        if (!control.matches(":hover") && currentFormation(stage) === control.dataset.formation) reset(stage);
      };
      const click = (e) => {
        if (!control.dataset.direction || matchMedia("(pointer: fine)").matches || e.detail === 0) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (touchSelection !== control) {
          e.preventDefault();
          touchSelection = control;
          enter();
        }
      };
      control.addEventListener("pointerenter", enter);
      control.addEventListener("pointerleave", leave);
      control.addEventListener("focus", enter);
      control.addEventListener("blur", blur);
      control.addEventListener("click", click);
      cleanups.push(() => {
        control.removeEventListener("pointerenter", enter);
        control.removeEventListener("pointerleave", leave);
        control.removeEventListener("focus", enter);
        control.removeEventListener("blur", blur);
        control.removeEventListener("click", click);
      });
    });
  });
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-lang"] });
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("scroll", onScrollSettle, { passive: true });
  window.addEventListener("resize", schedule);
  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd, { passive: true });
  reduced.addEventListener("change", schedule);
  cleanups.push(() => window.removeEventListener("wheel", onWheel));
  cleanups.push(() => window.removeEventListener("touchstart", onTouchStart));
  cleanups.push(() => window.removeEventListener("touchmove", onTouchMove));
  cleanups.push(() => window.removeEventListener("touchend", onTouchEnd));
  render();

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    clearTimeout(settleTimer);
    cleanups.forEach((cleanup) => cleanup());
    observer.disconnect();
    window.removeEventListener("scroll", schedule);
    window.removeEventListener("scroll", onScrollSettle);
    window.removeEventListener("resize", schedule);
    reduced.removeEventListener("change", schedule);
    scene.destroy();
  };
}
