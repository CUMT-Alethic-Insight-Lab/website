const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;

export function initScene(canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return { mount() {}, update() {}, setActive() {}, resize() {}, destroy() {} };

  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const fine = matchMedia("(pointer: fine)");
  const mobile = matchMedia("(max-width: 760px)");
  let host = null;
  let w = 1;
  let h = 1;
  let raf = 0;
  let active = false;
  let disposed = false;
  let last = 0;
  let started = performance.now();
  /* Runtime quality ladder: when frames run long the scene steps down
   * (fewer particles → no ambience → dpr 1) and climbs back when fast. */
  let quality = 0;
  let perfAcc = 0;
  let perfN = 0;
  let lastRaw = 0;
  let perfCooldown = 0;
  const QUALITY_DRAW = [1, 0.66, 0.45, 0.3];
  const seenHosts = new WeakSet();
  let state = { from: "mark", to: "mark", mix: 0, focus: false, energy: 0, dock: 0 };
  let inkSprite;
  let accentSprite;
  const cache = new Map();
  const lowPower = (navigator.deviceMemory && navigator.deviceMemory < 4) || navigator.hardwareConcurrency < 4;
  const count = Math.round((mobile.matches ? 3000 : 8000) * (lowPower ? 0.72 : 1));
  const particles = Array.from({ length: count }, (_, i) => {
    const a = i * 2.399963;
    const r = Math.sqrt((i + 0.5) / count);
    return { x: 0, y: 0, vx: 0, vy: 0, a, r, seed: ((i * 137) % 997) / 997,
      size: i % 61 === 0 ? 7.5 : i % 4 === 0 ? 2.1 : 3.4 + ((i * 17) % 19) / 12 };
  });
  const mouse = { x: -1000, y: -1000 };
  const mark = new Image();
  mark.src = "/mark.svg";
  /* Ink bounding box of mark.svg, measured once so narrow screens can lay
   * the A glyph out by its real ink instead of the svg's square frame. */
  let inkBox = null;
  const markInkBox = () => {
    if (inkBox) return inkBox;
    if (!mark.complete || !mark.naturalWidth) return null;
    const S = 160;
    const off = document.createElement("canvas");
    off.width = off.height = S;
    const cc = off.getContext("2d", { willReadFrequently: true });
    cc.drawImage(mark, 0, 0, S, S);
    const d = cc.getImageData(0, 0, S, S).data;
    let x0 = S;
    let x1 = -1;
    for (let yy = 0; yy < S; yy++) {
      for (let xx = 0; xx < S; xx++) {
        const j = (yy * S + xx) * 4;
        const lum = d[j] * 0.2126 + d[j + 1] * 0.7152 + d[j + 2] * 0.0722;
        /* Same threshold as target sampling: the svg's full-bleed dark
         * background rect is opaque but not ink. */
        if (d[j + 3] > 130 && lum > 110) {
          if (xx < x0) x0 = xx;
          if (xx > x1) x1 = xx;
        }
      }
    }
    inkBox = x1 < 0 ? { x0: 0.2, x1: 0.8 } : { x0: x0 / S, x1: (x1 + 1) / S };
    return inkBox;
  };

  const sprite = (color) => {
    const off = document.createElement("canvas");
    off.width = off.height = 48;
    const c = off.getContext("2d");
    const gradient = c.createRadialGradient(24, 24, 0, 24, 24, 24);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.32, color);
    gradient.addColorStop(1, "transparent");
    c.fillStyle = gradient;
    c.fillRect(0, 0, 48, 48);
    return off;
  };
  const colors = () => {
    const css = getComputedStyle(document.documentElement);
    inkSprite = sprite(css.getPropertyValue("--ink").trim());
    accentSprite = sprite(css.getPropertyValue("--accent").trim());
    wake();
  };

  const text = (c, value, x, y, maxWidth, size, weight = 600) => {
    c.font = `${weight} ${size}px "IBM Plex Sans", "Microsoft YaHei", system-ui, sans-serif`;
    const measured = c.measureText(value).width;
    if (measured > maxWidth) {
      size *= maxWidth / measured;
      c.font = `${weight} ${size}px "IBM Plex Sans", "Microsoft YaHei", system-ui, sans-serif`;
    }
    c.fillText(value, x, y);
  };

  const sample = (key) => {
    if (cache.has(key)) return cache.get(key);
    const off = document.createElement("canvas");
    off.width = Math.ceil(w);
    off.height = Math.ceil(h);
    const c = off.getContext("2d", { willReadFrequently: true });
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillStyle = "#fff";
    const short = Math.min(w, h);
    const en = document.documentElement.dataset.lang === "en";
    let direct = null;
    const drawBrand = (cy) => {
      c.textAlign = "left";
      const rest = "lethic Insight";
      const font = (s) => `600 ${s}px "IBM Plex Sans", "Microsoft YaHei", system-ui, sans-serif`;
      let size = short * 0.34;
      c.font = font(size);
      let restWidth = c.measureText(rest).width;
      let side = size * 1.48;
      let advance = side * 0.55;
      let total = advance + restWidth;
      const maxTotal = w * 0.78;
      if (total > maxTotal) {
        size *= maxTotal / total;
        c.font = font(size);
        restWidth = c.measureText(rest).width;
        side = size * 1.48;
        advance = side * 0.55;
        total = advance + restWidth;
      }
      const startX = (w - total) / 2;
      if (mark.complete && mark.naturalWidth) {
        c.drawImage(mark, startX - side * 0.225, cy - 0.41 * size - 0.245 * side, side, side);
      } else {
        c.fillText("A", startX + advance * 0.2, cy);
      }
      c.fillText(rest, startX + advance, cy);
      c.textAlign = "center";
    };
    if (key === "mark") {
      if (mark.complete && mark.naturalWidth) {
        const size = short * 1.28;
        c.drawImage(mark, (w - size) / 2, (h - size) / 2, size, size);
      } else {
        text(c, "A", w / 2, h / 2, w * 0.6, short * 0.75);
      }
    } else if (key === "name") {
      text(c, en ? "Alethic Insight" : "真知灼见", w / 2, h / 2, w * 0.78, short * 0.38);
    } else if (key === "brandName") {
      drawBrand(h / 2);
    } else if (key === "risenCn") {
      drawBrand(h * 0.38);
      text(c, "真知灼见", w / 2, h * 0.62, w * 0.62, short * 0.2);
    } else if (key === "slogan") {
      if (mobile.matches) {
        /* One Chinese line like desktop: the freed particle budget goes to
         * the two English lines, keeping stroke density even across all
         * three lines. */
        text(c, "由繁得构，由构显真", w / 2, h * 0.37, w * 0.92, short * 0.2);
        text(c, "From noise, structure.", w / 2, h * 0.53, w * 0.96, short * 0.084, 700);
        text(c, "From structure, aletheia.", w / 2, h * 0.61, w * 0.96, short * 0.084, 700);
      } else {
        text(c, "由繁得构，由构显真", w / 2, h * 0.39, w * 0.8, short * 0.2);
        text(c, "From noise, structure. From structure, aletheia.", w / 2, h * 0.55, w * 0.8, short * 0.082);
      }
    } else if (key === "AI") {
      const ink = mobile.matches ? markInkBox() : null;
      if (ink && mark.complete && mark.naturalWidth) {
        /* Narrow screens: fit and center the A+I pair as one measured group
         * instead of the wide-screen fixed anchors. */
        const iFont = (g) => `600 ${(g * 0.95) / 0.7}px "IBM Plex Sans", "Microsoft YaHei", system-ui, sans-serif`;
        let glyphH = short * 0.5;
        c.font = iFont(glyphH);
        const fit = Math.min(1, (w * 0.88) / ((glyphH / 0.51) * (ink.x1 - ink.x0) + glyphH * 0.13 + c.measureText("I").width));
        glyphH *= fit;
        const baseline = h * 0.5 + glyphH * 0.5;
        const side = glyphH / 0.51;
        const aW = side * (ink.x1 - ink.x0);
        const gap = glyphH * 0.13;
        c.font = iFont(glyphH);
        const iW = c.measureText("I").width;
        const startX = (w - aW - gap - iW) / 2;
        c.drawImage(mark, startX + aW / 2 - ((ink.x0 + ink.x1) / 2) * side, baseline - 0.755 * side, side, side);
        c.textBaseline = "alphabetic";
        c.fillText("I", startX + aW + gap + iW / 2, baseline - glyphH * 0.05);
        c.textBaseline = "middle";
      } else {
        const glyphH = short * 0.5;
        const baseline = h * 0.5 + glyphH * 0.5;
        if (mark.complete && mark.naturalWidth) {
          const side = glyphH / 0.51;
          c.drawImage(mark, w * 0.38 - side / 2, baseline - 0.755 * side, side, side);
        } else {
          text(c, "A", w * 0.38, h / 2, w * 0.2, glyphH / 0.7);
        }
        c.textBaseline = "alphabetic";
        c.font = `600 ${(glyphH * 0.95) / 0.7}px "IBM Plex Sans", "Microsoft YaHei", system-ui, sans-serif`;
        c.fillText("I", w * 0.62, baseline - glyphH * 0.05);
        c.textBaseline = "middle";
      }
    } else if (key === "stars") {
      direct = [];
      const n = 7200;
      for (let i = 0; i < n; i++) {
        direct.push({ x: ((i * 0.7548777) % 1) * w, y: ((i * 0.5698403) % 1) * h, accent: i % 8 === 0 });
      }
    } else if (key === "truth") {
      const lines = en ? ["From noise, structure.", "From structure, aletheia."] : ["由繁得构", "由构显真"];
      lines.forEach((line, i) => text(c, line, w / 2, h * (0.36 + i * 0.28), w * 0.72, short * 0.24));
    } else if (key === "directions") {
      const words = ["LLM", "CV", "VLM", "RL", "Agent", "Memory", "Infra"];
      words.forEach((word, i) => {
        const row = i < 3 ? 0 : i < 5 ? 1 : 2;
        const col = row === 0 ? i : row === 1 ? i - 3 : i - 5;
        const columns = row === 0 ? 3 : 2;
        /* On mobile the art is a top band above the copy: keep the words
         * packed into the band's upper two-thirds. */
        const y = mobile.matches ? h * (0.16 + row * 0.24) : h * (0.28 + row * 0.22);
        text(c, word, w * (0.12 + (col + 0.5) * 0.76 / columns), y, w * (row === 0 ? 0.21 : 0.32), short * 0.115);
      });
    } else if (key === "bytes") {
      ["0 1 0 1 1", "1 0 1 0 0", "0 0 1 1 0"].forEach((line, i) => text(c, line, w / 2, h * (0.30 + i * 0.20), w * 0.68, short * 0.115));
    } else if (key === "bits") {
      const fs = mobile.matches ? 14 : Math.max(11, short * 0.062);
      c.font = `600 ${fs}px ${JSON.stringify("IBM Plex Mono")}, monospace`;
      c.textAlign = "left";
      const cols = mobile.matches ? Math.max(10, Math.floor(w / 36)) : Math.max(14, Math.floor(w / Math.max(28, short * 0.085)));
      const rows = mobile.matches ? Math.max(9, Math.floor(h / 32)) : Math.max(14, Math.floor(h / Math.max(22, short * 0.072)));
      const cellW = w / cols;
      const cellH = h / rows;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const seed = (row * 17 + col * 31 + row * col * 7) % 23;
          const value = seed % 2 ? "01" : "10";
          c.fillText(value, col * cellW + cellW * 0.16, row * cellH + cellH * 0.5);
        }
      }
    } else if (key === "noise") {
      c.font = `600 ${Math.max(9, short * 0.045)}px ${JSON.stringify("IBM Plex Mono")}, monospace`;
      c.textAlign = "left";
      const cols = Math.max(10, Math.floor(w / Math.max(30, short * 0.11)));
      const rows = Math.max(12, Math.floor(h / Math.max(20, short * 0.075)));
      const cellW = w / cols;
      const cellH = h / rows;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const seed = (row * 43 + col * 19 + row * col * 11) % 29;
          if (seed < 17) c.fillText(seed % 2 ? "0" : "1", col * cellW + cellW * 0.3, row * cellH + cellH * 0.5);
        }
      }
    } else {
      const value = key === "award" ? (en ? "1st" : "一等奖") : key;
      text(c, value, w / 2, h / 2, w * 0.78, short * 0.43);
    }
    let points = direct;
    if (!points) {
      const data = c.getImageData(0, 0, off.width, off.height).data;
      points = [];
      /* Mobile runs 3000 particles against the same glyph area, so sample
       * coarser to keep each inked pixel claimed by multiple particles. */
      const step = mobile.matches ? Math.max(3, Math.round(short / 130)) : Math.max(2, Math.round(short / 215));
      for (let y = 0; y < off.height; y += step) {
        for (let x = 0; x < off.width; x += step) {
          const j = (y * off.width + x) * 4;
          const lum = data[j] * 0.2126 + data[j + 1] * 0.7152 + data[j + 2] * 0.0722;
          if (data[j + 3] > 130 && lum > 110) points.push({ x, y, accent: data[j + 2] > data[j] + 40 });
        }
      }
    }
    if (!points.length) points.push({ x: w / 2, y: h / 2, accent: true });
    for (let i = points.length - 1; i > 0; i--) {
      const j = Math.floor(((i * 0.618034) % 1) * (i + 1));
      [points[i], points[j]] = [points[j], points[i]];
    }
    cache.set(key, points);
    return points;
  };

  const resize = () => {
    if (!host || disposed) return;
    const nw = Math.max(1, host.clientWidth);
    const nh = Math.max(1, host.clientHeight);
    const dpr = quality >= 3 ? 1 : Math.min(mobile.matches ? 1.75 : 2, devicePixelRatio || 1);
    if (nw === w && nh === h && canvas.width === Math.round(nw * dpr)) return;
    w = nw;
    h = nh;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cache.clear();
    particles.forEach((p) => {
      p.sx = ((p.seed * 7.13) % 1) * w;
      p.sy = ((p.seed * 3.71) % 1) * h;
      p.x = p.sx;
      p.y = p.sy;
      p.vx = p.vy = 0;
    });
    wake();
  };

  function frame(now) {
    raf = 0;
    if (disposed || !active || document.hidden || !host) return;
    const rawDt = now - (lastRaw || now - 16.67);
    lastRaw = now;
    perfAcc += rawDt;
    perfN++;
    if (perfN >= 90) {
      const avg = perfAcc / perfN;
      perfAcc = 0;
      perfN = 0;
      if (now > perfCooldown) {
        if (avg > 26 && quality < 3) {
          quality++;
          perfCooldown = now + 1500;
          if (quality === 3) resize();
        } else if (avg < 13 && quality > 0) {
          quality--;
          perfCooldown = now + 8000;
          if (quality === 2) resize();
        }
      }
    }
    const dt = clamp((now - (last || now - 16.67)) / 16.67, 0.2, 2);
    last = now;
    const reduced = motion.matches;
    const still = state.mix >= 0.5 ? state.to : state.from;
    const from = sample(reduced ? still : state.from);
    const to = sample(reduced ? still : state.to);
    const mix = reduced ? 1 : clamp(state.mix);
    const boot = reduced ? 1 : clamp((now - started) / 1400);
    const gather = 1 - Math.pow(1 - boot, 3);
    const breathe = reduced || state.focus || lowPower || quality >= 2 ? 1 : 1 + Math.sin(now * 0.0008) * 0.012;
    const energy = reduced ? 0 : Math.max(Math.sin(mix * Math.PI) * 0.075, state.energy || 0);
    const rect = host.getBoundingClientRect();
    const logo = state.dock ? document.querySelector(".brand img")?.getBoundingClientRect() : null;
    const dock = clamp(state.dock);
    const damping = Math.pow(0.76, dt);
    const drawCount = Math.max(600, Math.floor(particles.length * QUALITY_DRAW[quality]));
    const stride = particles.length / drawCount;
    ctx.clearRect(0, 0, w, h);
    for (let k = 0; k < drawCount; k++) {
      const i = Math.min(particles.length - 1, Math.floor(k * stride));
      const p = particles[i];
      const a = from[Math.floor(i * from.length / particles.length)];
      const b = to[Math.floor(i * to.length / particles.length)];
      let tx = lerp(a.x, b.x, mix);
      let ty = lerp(a.y, b.y, mix);
      const angle = p.a + now * 0.00018;
      tx = w / 2 + (tx - w / 2) * breathe + Math.cos(angle) * w * energy * p.r;
      ty = h / 2 + (ty - h / 2) * breathe + Math.sin(angle) * h * energy * p.r;
      tx = lerp(p.sx ?? w / 2, tx, gather);
      ty = lerp(p.sy ?? h / 2, ty, gather);
      if (logo) {
        const scale = lerp(1, 0.05, dock);
        tx = (tx - w / 2) * scale + lerp(w / 2, logo.x + logo.width / 2 - rect.x, dock);
        ty = (ty - h / 2) * scale + lerp(h / 2, logo.y + logo.height / 2 - rect.y, dock);
      }
      if (!reduced && fine.matches && !state.focus && !state.dock) {
        const dx = tx - mouse.x;
        const dy = ty - mouse.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 130 && distance > 0) {
          const push = Math.pow(1 - distance / 130, 2) * 30;
          tx += dx / distance * push;
          ty += dy / distance * push;
        }
      }
      if (reduced) {
        p.x = tx;
        p.y = ty;
      } else {
        p.vx = (p.vx + (tx - p.x) * 0.055 * dt) * damping;
        p.vy = (p.vy + (ty - p.y) * 0.055 * dt) * damping;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      const accent = (mix < 0.5 ? a.accent : b.accent) || i % 83 === 0;
      const size = p.size * (mobile.matches ? 0.77 : 1) * (state.focus ? 1.05 : 1);
      const jitter = reduced || quality >= 2 ? 0 : Math.sin(now * 0.001 + p.a) * 0.35;
      ctx.globalAlpha = (p.size < 2 ? 0.46 : 0.85) * (0.35 + 0.65 * gather) * (state.dock ? 1 - clamp((state.dock - 0.70) / 0.25) : 1);
      ctx.drawImage(accent ? accentSprite : inkSprite, p.x - size + jitter, p.y - size, size * 2, size * 2);
    }
    ctx.globalAlpha = 1;
    if (!reduced) raf = requestAnimationFrame(frame);
  }

  function wake() {
    if (!disposed && active && !document.hidden && !raf) raf = requestAnimationFrame(frame);
  }
  const pointerMove = (e) => {
    if (!host) return;
    const r = host.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  };
  const pointerLeave = () => { mouse.x = mouse.y = -1000; };
  const visibility = () => {
    last = 0;
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else wake();
  };
  const observer = new MutationObserver((records) => {
    if (records.some((r) => r.attributeName === "data-lang")) cache.clear();
    colors();
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-lang"] });
  const sizeObserver = new ResizeObserver(resize);
  mark.onload = () => { inkBox = null; cache.clear(); wake(); };
  document.fonts?.ready.then(() => { if (!disposed) { cache.clear(); wake(); } });
  motion.addEventListener("change", wake);
  document.addEventListener("visibilitychange", visibility);
  colors();

  return {
    mount(nextHost) {
      if (host === nextHost) return;
      host?.removeEventListener("pointermove", pointerMove);
      host?.removeEventListener("pointerleave", pointerLeave);
      sizeObserver.disconnect();
      host = nextHost;
      host.append(canvas);
      host.addEventListener("pointermove", pointerMove, { passive: true });
      host.addEventListener("pointerleave", pointerLeave);
      sizeObserver.observe(host);
      w = h = 0;
      const kind = host.closest("[data-narrative-stage]")?.dataset.narrativeStage;
      if (kind === "intro" && !seenHosts.has(host)) started = performance.now();
      else started = performance.now() - 1400;
      seenHosts.add(host);
      pointerLeave();
      resize();
    },
    resize,
    update(next) { state = { ...state, ...next }; wake(); },
    setActive(value) {
      active = value;
      canvas.hidden = !value;
      if (!active) { cancelAnimationFrame(raf); raf = 0; last = 0; }
      else wake();
    },
    destroy() {
      disposed = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      sizeObserver.disconnect();
      host?.removeEventListener("pointermove", pointerMove);
      host?.removeEventListener("pointerleave", pointerLeave);
      motion.removeEventListener("change", wake);
      document.removeEventListener("visibilitychange", visibility);
      mark.onload = null;
      canvas.remove();
    },
  };
}
