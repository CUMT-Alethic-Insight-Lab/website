import { cellNoise, drawProgress, fieldLayout } from './coordinates.mjs';

const WORDMARK = ['ALETHIC', 'INSIGHT'];
const SLOGANS = [['由繁', '得构'], ['由构', '显真']];
const ENGLISH = [['FIND', 'FORM'], ['REVEAL', 'TRUTH']];
const BITMAP = {
  A: [14, 17, 17, 31, 17, 17, 17], L: [16, 16, 16, 16, 16, 16, 31],
  E: [31, 16, 16, 30, 16, 16, 31], T: [31, 4, 4, 4, 4, 4, 4],
  H: [17, 17, 17, 31, 17, 17, 17], I: [31, 4, 4, 4, 4, 4, 31],
  C: [15, 16, 16, 16, 16, 16, 15], N: [17, 25, 21, 19, 17, 17, 17],
  S: [15, 16, 16, 14, 1, 1, 30], G: [14, 17, 16, 23, 17, 17, 14],
  F: [31, 16, 16, 30, 16, 16, 16], D: [30, 17, 17, 17, 17, 17, 30],
  O: [14, 17, 17, 17, 17, 17, 14], R: [30, 17, 17, 30, 20, 18, 17],
  M: [17, 27, 21, 21, 17, 17, 17], V: [17, 17, 17, 17, 17, 10, 4],
  U: [17, 17, 17, 17, 17, 17, 14],
};
const GLYPHS = ' .:+#';
const FONT = '"Cascadia Mono", Consolas, monospace';
const HOLD_MS = 3800;
const BEAT_MS = 5400;
const PAINT_HZ = 30;
const TAU = Math.PI * 2;
const clamp = value => Math.max(0, Math.min(1, value));

export function bitmapWord(word) {
  const pixels = [];
  [...word].forEach((char, index) => BITMAP[char].forEach((bits, y) => {
    for (let x = 0; x < 5; x++) if (bits & (16 >> x)) pixels.push([index * 6 + x, y]);
  }));
  return { width: word.length * 6 - 1, pixels };
}

export function openerPhase(seconds) {
  const ms = Math.max(0, Math.round(seconds * 1000));
  const beat = Math.floor(ms / BEAT_MS);
  return { scene: beat % 3, transit: clamp((ms % BEAT_MS - HOLD_MS) / (BEAT_MS - HOLD_MS)) };
}

// The sheet edges and every navigation guide are themselves grid columns.
export function characterGrid(width, height) {
  const sheet = fieldLayout(width, height);
  const columns = Math.max(sheet.columns, sheet.rails * 5);
  const dx = sheet.columns * sheet.dx / columns;
  const dy = Math.min(dx * 1.16, height * 0.9 / 26);
  const rows = 1 + Math.floor(height * 0.9 / dy);
  return {
    x: sheet.x, y: (height - (rows - 1) * dy) / 2, dx, dy, columns, rows,
    stride: columns + 1, rails: sheet.rails, baseline: rows - 1,
  };
}

export function sceneRegister(grid, top) {
  const baseline = top + grid.y + grid.baseline * grid.dy;
  const row = Math.ceil(-baseline / grid.dy);
  return { y: baseline + row * grid.dy, row, baseline };
}

// Path and timing are expressed in opener cells and document scroll distance.
export function entryRelay(grid, cover, target, reduced) {
  const offset = Math.max(0, -cover.top);
  const height = cover.height;
  const start = 0.055 * height;
  const targetY = target.top - cover.top;
  const arrival = Math.max(height * 0.96, targetY - height * 0.76);
  const settle = arrival + height * 0.25;
  const lane = Math.max(Math.ceil((2 - grid.x) / grid.dx), Math.floor((target.left - cover.left - 1.7 * grid.dx - grid.x) / grid.dx));
  const lastCol = Math.round((target.left - cover.left + Math.min(target.width * 0.18, 5 * grid.dx) - grid.x) / grid.dx);
  const lastRow = Math.max(grid.baseline + 5, Math.round((targetY - 1.05 * grid.dy - grid.y) / grid.dy));
  const seamRow = Math.min(lastRow - 1, Math.round((height - grid.y) / grid.dy));
  const stages = [
    { at: start, col: Math.round(grid.columns / 2), row: grid.baseline, stage: 'baseline' },
    { at: 0.34 * height, col: lane, row: grid.baseline, stage: 'cover-edge' },
    { at: 0.55 * height, col: lane, row: seamRow, stage: 'body-edge' },
    { at: arrival - 0.11 * height, col: lane, row: lastRow, stage: 'arrival' },
    { at: arrival, col: lastCol, row: lastRow, stage: 'settled' },
  ];
  const distances = [0];
  for (let i = 1; i < stages.length; i++) {
    const from = stages[i - 1], to = stages[i];
    distances.push(distances[i - 1] + Math.abs(to.col - from.col) + Math.abs(to.row - from.row));
  }
  const cells = [];
  const raster = (col, row, glyph, alpha) => {
    if (alpha <= 0.015) return;
    cells.push({ col, row, glyph, alpha, x: cover.left + grid.x + col * grid.dx, y: cover.top + grid.y + row * grid.dy });
  };
  if (reduced) {
    for (const [i, { col, row }] of stages.entries()) raster(col, row, '+', i === stages.length - 1 ? 0.58 : 0.39);
    return { stage: 'static', cells };
  }
  if (offset < start || offset > settle) return { cells };

  let segment = stages.findIndex((point, i) => i && offset < point.at) - 1;
  if (segment < 0) segment = stages.length - 2;
  const from = stages[segment], to = stages[segment + 1];
  const fraction = clamp((offset - from.at) / (to.at - from.at));
  const head = { col: from.col + (to.col - from.col) * fraction, row: from.row + (to.row - from.row) * fraction };
  const gain = drawProgress((offset - start) / (height * 0.08)) * (1 - drawProgress((offset - arrival) / (settle - arrival)));
  const center = distances[segment] + fraction * (distances[segment + 1] - distances[segment]);
  for (let step = Math.max(0, Math.floor(center) - 3); step <= Math.min(distances.at(-1), Math.ceil(center) + 3); step++) {
    const end = distances.findIndex((distance, index) => index > 0 && step <= distance);
    const point = stages[end - 1], next = stages[end];
    const move = step - distances[end - 1];
    const distance = Math.abs(center - step);
    const alpha = gain * Math.max(0, 1 - distance / 3.8) ** 1.35;
    const glyph = distance < 0.64 ? '#' : distance < 1.55 ? '+' : distance < 2.35 ? ':' : '.';
    raster(point.col + Math.sign(next.col - point.col) * move, point.row + Math.sign(next.row - point.row) * move, glyph, alpha);
  }
  return { stage: offset >= arrival ? 'settled' : from.stage, head, cells };
}

export function drawEntryRelay(ctx, canvas, grid, cover, target, options) {
  if (!target) return;
  const { side, reduced, ink, allow = () => true } = options;
  const { stage, head, cells } = entryRelay(grid, cover, target, reduced);
  if (stage) canvas.dataset.entryRelay = stage;
  else delete canvas.dataset.entryRelay;
  if (head) canvas.dataset.entryRelayHead = `${head.col.toFixed(3)},${head.row.toFixed(3)}`;
  else delete canvas.dataset.entryRelayHead;
  if (!cells.length) return;
  const local = side === 'opening';
  const offsetX = local ? cover.left : 0, offsetY = local ? cover.top : 0;
  const ascent = Math.min(grid.dx * 1.47, grid.dy * 1.27);
  ctx.save();
  if (!local && cover.bottom > 0) {
    ctx.beginPath();
    ctx.rect(0, cover.bottom, Math.max(0, cover.right), Math.max(0, innerHeight - cover.bottom));
    ctx.clip();
  }
  ctx.font = `700 ${ascent}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = ink;
  for (const { x, y, glyph, alpha } of cells) {
    if (!allow(x, y)) continue;
    if (local ? y - ascent / 2 >= cover.bottom : y + ascent / 2 <= cover.bottom) continue;
    ctx.globalAlpha = alpha;
    ctx.fillText(glyph, x - offsetX, y - offsetY);
  }
  ctx.restore();
}

export function snapCell(x, y, grid) {
  const col = Math.round((x - grid.x) / grid.dx);
  const row = Math.round((y - grid.y) / grid.dy);
  return [Math.max(0, Math.min(grid.columns, col)), Math.max(0, Math.min(grid.rows - 1, row))];
}

const blank = grid => new Uint8Array(grid.stride * grid.rows);
const indexAt = (col, row, grid) => row * grid.stride + col;

export function latinMask(lines, grid) {
  const mask = blank(grid);
  const scale = grid.columns >= 108 && grid.rows >= 41 ? 2 : 1;
  const gap = 3 * scale;
  const top = Math.round((grid.rows * 0.96 - (14 * scale + gap)) / 2);
  lines.forEach((word, line) => {
    const bitmap = bitmapWord(word);
    const left = Math.round((grid.stride - bitmap.width * scale) / 2);
    const start = top + line * (7 * scale + gap);
    for (const [x, y] of bitmap.pixels) {
      for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
        mask[indexAt(left + x * scale + sx, start + y * scale + sy, grid)] = 4;
      }
    }
  });
  return mask;
}

// Use the installed CJK font as a stencil. One raster pixel maps to one grid address.
function sloganMask(lines, grid) {
  const mask = blank(grid);
  const size = Math.min(23, Math.floor((grid.columns - 8) / 2), Math.floor((grid.rows - 8) / 2));
  const gap = 3;
  const width = size * 2 + gap;
  const left = Math.round((grid.stride - width) / 2);
  const top = Math.round((grid.rows * 0.96 - width) / 2);
  const raster = document.createElement('canvas');
  raster.width = width;
  raster.height = width;
  const pen = raster.getContext('2d', { willReadFrequently: true });
  pen.font = `900 ${size - 1}px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif`;
  pen.textAlign = 'center';
  lines.forEach((line, row) => [...line].forEach((char, col) => {
    const { actualBoundingBoxAscent, actualBoundingBoxDescent } = pen.measureText(char);
    const baseline = size / 2 + (actualBoundingBoxAscent - actualBoundingBoxDescent) / 2;
    pen.fillText(char, col * (size + gap) + size / 2, row * (size + gap) + baseline);
  }));
  const pixels = pen.getImageData(0, 0, width, width).data;
  for (let row = 0; row < width; row++) for (let col = 0; col < width; col++) {
    if (pixels[(row * width + col) * 4 + 3] >= 100) mask[indexAt(left + col, top + row, grid)] = 4;
  }
  return mask;
}

export function rewriteDensity(from, to, progress) {
  return from + Math.sign(to - from) * Math.round(Math.abs(to - from) * clamp(progress));
}

export function transitionFrame(from, to, grid, progress) {
  if (progress <= 0) return from;
  if (progress >= 1) return to;
  let first = grid.rows, last = 0;
  for (let i = 0; i < from.length; i++) {
    if (from[i] === to[i]) continue;
    const row = Math.floor(i / grid.stride);
    first = Math.min(first, row);
    last = row;
  }
  const frame = blank(grid);
  for (let row = 0; row < grid.rows; row++) {
    const delay = 0.62 * clamp((row - first) / Math.max(1, last - first));
    for (let col = 0; col < grid.stride; col++) {
      const i = indexAt(col, row, grid);
      if (!from[i] && !to[i]) continue;
      const start = delay + (to[i] > from[i] ? 0.06 : 0);
      frame[i] = rewriteDensity(from[i], to[i], (progress - start) / 0.32);
    }
  }
  return frame;
}

export function handoffFrame(from, grid, progress) {
  if (progress <= 0) return from;
  const frame = blank(grid);
  const interval = grid.columns / grid.rails;
  for (let col = 0; col <= grid.columns; col++) {
    const delay = 0.43 * col / grid.columns;
    for (let row = 0; row < grid.baseline; row++) {
      const i = indexAt(col, row, grid);
      if (from[i]) frame[i] = rewriteDensity(from[i], 0, (progress - delay - 0.27 * row / grid.baseline) / 0.28);
    }
    const guide = col % interval === 0;
    const halfGuide = col % interval === Math.floor(interval / 2);
    const write = (progress - delay - 0.22) / 0.31;
    frame[indexAt(col, grid.baseline, grid)] = rewriteDensity(0, guide ? 3 : 2, write);
    if (halfGuide || guide) {
      const length = guide ? 3 : 1;
      for (let offset = 1; offset <= length; offset++) {
        const i = indexAt(col, grid.baseline - offset, grid);
        frame[i] = Math.max(frame[i], rewriteDensity(0, 2, write - offset * 0.04));
      }
    }
  }
  return frame;
}

export function inkPulse(col, row, phase, time) {
  const sweep = Math.sin(time * 3.05 - col * 0.19 + row * 0.23);
  const ripple = Math.sin(time * 4.2 + phase);
  return 0.5 + 0.38 * sweep + 0.12 * ripple;
}

export function inkGlyph(density, pulse) {
  return density === 4 && pulse < 0.29 ? 3 : density;
}

export function ambientCells(width, height, { x, y, dx, dy }) {
  // Continue the sheet lattice to the viewport edges, even on ultrawide screens.
  const left = Math.ceil(-x / dx), right = Math.floor((width - x) / dx);
  const top = Math.ceil(-y / dy), bottom = Math.floor((height - y) / dy);
  const cells = [];
  for (let row = top; row <= bottom; row++) for (let col = left; col <= right; col++) {
    const seed = cellNoise(col + row * 4099, 12);
    if (seed >= 0.255) continue;
    const quiet = Math.abs(x + col * dx - width / 2) < width * 0.39
      && Math.abs(y + row * dy - height / 2) < height * 0.26;
    cells.push({ col, row, phase: seed / 0.255 * TAU, quiet });
  }
  return { left, right, top, bottom, cells };
}

export function ambientSignal(col, row, phase, time) {
  const band = 0.5 + 0.5 * Math.sin(col * 0.16 + row * 0.21 - time * 1.38);
  const drift = 0.5 + 0.5 * Math.sin(col * 0.04 - row * 0.1 + time * 0.91 + phase);
  return (0.12 + 0.88 * band) * (0.45 + 0.55 * drift);
}

export function probeFalloff(col, row, center, radius) {
  if (!center) return 0;
  const distanceSquared = (col - center[0]) ** 2 + (row - center[1]) ** 2;
  return Math.max(0, 1 - distanceSquared / (radius * radius)) ** 2;
}

function registration(grid) {
  const marks = blank(grid);
  const interval = grid.columns / grid.rails;
  for (let col = 0; col <= grid.columns; col++) {
    const guide = col % interval === 0;
    marks[indexAt(col, 0, grid)] = guide ? 3 : col % 2 === 0 ? 1 : 0;
    marks[indexAt(col, grid.baseline, grid)] = guide ? 3 : col % 2 === 0 ? 1 : 0;
    if (guide) for (let row = 3; row < grid.baseline - 2; row += 3) {
      if (col === 0 || col === grid.columns || row < 12 || row >= grid.baseline - 12) {
        marks[indexAt(col, row, grid)] = row % 12 === 0 ? 2 : 1;
      }
    }
  }
  return marks;
}

export function mountField({ still, motionChange }) {
  const section = document.querySelector('.opening');
  const canvas = section?.querySelector('canvas');
  const ctx = canvas?.getContext('2d', { willReadFrequently: still() });
  if (!ctx) return;
  const link = section.querySelector('a[href]');
  const relayTarget = document.documentElement.querySelector?.('#position [data-lab-workbench]');
  if (!link) return;
  const english = document.documentElement.lang.toLowerCase().startsWith('en');
  // Resolve the media query on change instead of reading it during animation frames.
  let reduced = still();
  let grid, masks, marks, ambient, phases, palette, glyphFont;
  let width = 0, height = 0, dpr = 0, visible = true;
  let raf = 0, previous, time = 0, sceneTime = 0, paintedStep = -1, paintedOffset;
  let geometryKey, frame, finished = false;
  let pointer, touch;
  let scrollProgress = 0, reported = 0, entryFrame = 0;

  function refreshPalette() {
    const style = getComputedStyle(section);
    const color = (token, fallback) => style.getPropertyValue(`--opening-${token}`).trim() || fallback;
    const dim = color('dim', '#404a79');
    const blue = color('blue', '#a2aeff');
    palette = {
      ink: color('ink', '#e4eaff'), dim, blue,
      field: color('field', blue), probe: color('probe', blue),
    };
  }

  function currentProbe(now) {
    const source = pointer || touch;
    if (!source) return null;
    const strength = pointer ? 1 : 1 - drawProgress((now - touch.at) / 550);
    if (!strength) {
      touch = null;
      return null;
    }
    const box = canvas.getBoundingClientRect();
    if (source.x < box.left || source.x > box.right || source.y < box.top || source.y > box.bottom) return null;
    return {
      center: [(source.x - box.left - grid.x) / grid.dx, (source.y - box.top - grid.y) / grid.dy],
      radius: grid.rails === 4 ? 6 : 7.5,
      strength,
    };
  }

  function paint(departure, now, force) {
    const staticFrame = reduced;
    const step = Math.floor(time * PAINT_HZ);
    const fold = Math.round(departure * 80) / 80;
    const { scene, transit } = openerPhase(staticFrame ? 0 : sceneTime);
    const rewrite = Math.round(transit * 80) / 80;
    const key = `${scene}/${rewrite}/${fold}`;
    const cover = relayTarget?.getBoundingClientRect ? canvas.getBoundingClientRect() : null;
    const relayMoved = cover && cover.top !== paintedOffset;
    if (!force && !relayMoved && (fold === 1 ? finished : step === paintedStep && key === geometryKey)) return;
    paintedOffset = cover?.top;
    paintedStep = step;
    finished = fold === 1;
    if (key !== geometryKey) {
      const writing = transitionFrame(masks[scene], masks[(scene + 1) % masks.length], grid, rewrite);
      frame = handoffFrame(writing, grid, fold);
      geometryKey = key;
    }

    const { x, y, dx, dy, columns, stride, rows, baseline } = grid;
    const fieldAlpha = 1 - 0.76 * drawProgress(fold);
    const probe = staticFrame || !fieldAlpha ? null : currentProbe(now);
    const motionTime = staticFrame ? 0 : time;
    const inkAt = (col, row) => col >= 0 && col <= columns && row >= 0 && row < rows
      && frame[indexAt(col, row, grid)];
    const draw = (glyph, col, row) => ctx.fillText(GLYPHS[glyph], x + col * dx, y + row * dy);
    ctx.clearRect(0, 0, width, height);
    ctx.font = glyphFont;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';

    if (fieldAlpha) {
      ctx.fillStyle = palette.field;
      for (const { col, row, phase, quiet } of ambient.cells) {
        if (inkAt(col, row)) continue;
        const signal = ambientSignal(col, row, phase, motionTime);
        ctx.globalAlpha = (0.09 + 0.54 * signal) * (quiet ? 0.62 : 1) * fieldAlpha;
        draw(signal > 0.62 && phase < 2.15 ? 2 : 1, col, row);
      }
    }

    if (probe) {
      const { center, radius, strength } = probe;
      const [col, row] = center;
      ctx.fillStyle = palette.probe;
      for (let j = Math.max(ambient.top, Math.ceil(row - radius)); j <= Math.min(ambient.bottom, row + radius); j++) {
        for (let i = Math.max(ambient.left, Math.ceil(col - radius)); i <= Math.min(ambient.right, col + radius); i++) {
          if (inkAt(i, j)) continue;
          const influence = probeFalloff(i, j, center, radius) * strength;
          if (influence < 0.085) continue;
          // A soft wave passes through existing and empty cells within the same radius.
          const wave = 0.5 + 0.5 * Math.sin((1 - influence) * 8 - motionTime * 5);
          ctx.globalAlpha = influence * (0.38 + 0.45 * wave) * fieldAlpha;
          draw(influence * wave > 0.66 ? 3 : influence > 0.29 ? 2 : 1, i, j);
        }
      }
    }

    ctx.fillStyle = palette.dim;
    ctx.globalAlpha = 1 - fold;
    if (fold < 1) for (let index = 0; index < marks.length; index++) {
      if (marks[index] && !frame[index]) draw(marks[index], index % stride, Math.floor(index / stride));
    }

    for (let index = 0; index < frame.length; index++) {
      const density = frame[index];
      if (!density) continue;
      const col = index % stride, row = Math.floor(index / stride);
      if (fold && row >= baseline - 3) {
        ctx.fillStyle = palette.blue;
        ctx.globalAlpha = 0.88;
        draw(density, col, row);
      } else {
        const pulse = staticFrame ? 1 : inkPulse(col, row, phases[index], motionTime);
        const influence = probe ? probeFalloff(col, row, probe.center, probe.radius) * probe.strength * fieldAlpha : 0;
        const energy = clamp(pulse + influence * 0.4);
        ctx.fillStyle = density <= 2 ? palette.blue : palette.ink;
        ctx.globalAlpha = (0.7 + 0.3 * energy) * (density <= 2 ? 0.76 : 1);
        draw(inkGlyph(density, energy), col, row);
      }
    }
    ctx.globalAlpha = 1;
    if (cover) drawEntryRelay(ctx, canvas, grid, cover, relayTarget.getBoundingClientRect(),
      { side: 'opening', reduced: staticFrame, ink: palette.blue });
  }

  function readScroll() {
    scrollProgress = clamp(-section.getBoundingClientRect().top / Math.max(1, height * 0.68));
  }

  function publish(progress) {
    if (progress === reported || (progress > 0 && progress < 1 && Math.abs(progress - reported) < 0.004)) return;
    reported = progress;
    section.dispatchEvent(new CustomEvent('alethic:handoff', { bubbles: true, detail: { progress } }));
  }

  function render(now, force = false) {
    const staticFrame = reduced;
    const departure = staticFrame ? 0 : scrollProgress;
    if (visible && !document.hidden) {
      if (!staticFrame && previous !== undefined) {
        const elapsed = Math.max(0, now - previous) / 1000;
        if (departure < 1) time += elapsed;
        if (!departure) sceneTime += elapsed;
      }
      previous = staticFrame ? undefined : now;
      paint(departure, now, force);
    }
    publish(departure);
  }

  function tick(now) {
    render(now);
    raf = requestAnimationFrame(tick);
  }

  function update() {
    previous = undefined;
    cancelAnimationFrame(raf);
    raf = 0;
    if (!visible || document.hidden || reduced) pointer = touch = null;
    if (!grid || document.hidden) return;
    render(performance.now(), true);
    if (visible && !reduced) raf = requestAnimationFrame(tick);
  }

  function size() {
    const box = canvas.getBoundingClientRect();
    const nextWidth = box.width, nextHeight = box.height;
    const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
    if (!nextWidth || !nextHeight || (nextWidth === width && nextHeight === height && nextDpr === dpr)) return;
    width = nextWidth;
    height = nextHeight;
    dpr = nextDpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    grid = characterGrid(width, height);
    masks = [latinMask(WORDMARK, grid), ...(english ? ENGLISH.map(lines => latinMask(lines, grid)) : SLOGANS.map(lines => sloganMask(lines, grid)))];
    marks = registration(grid);
    ambient = ambientCells(width, height, grid);
    phases = Float32Array.from(masks[0], (_, index) => cellNoise(index, 40) * TAU);
    glyphFont = `700 ${Math.min(grid.dx * 1.47, grid.dy * 1.27)}px ${FONT}`;
    refreshPalette();
    pointer = touch = null;
    geometryKey = undefined;
    readScroll();
    update();
    section.dataset.ready = 'true';
  }

  section.addEventListener('pointermove', event => {
    if (!reduced && event.pointerType !== 'touch') {
      pointer = { x: event.clientX, y: event.clientY };
      touch = null;
    }
  }, { passive: true });
  section.addEventListener('pointerleave', () => { pointer = null; });
  section.addEventListener('pointerdown', event => {
    if (reduced || event.pointerType !== 'touch') return;
    pointer = null;
    touch = { x: event.clientX, y: event.clientY, at: performance.now() };
  }, { passive: true });
  section.addEventListener('pointercancel', () => { pointer = touch = null; });

  function cancelEntryScroll() {
    cancelAnimationFrame(entryFrame);
    entryFrame = 0;
  }

  function goToEntry(destination) {
    cancelEntryScroll();
    const startTime = performance.now();
    const origin = scrollY;
    function advance(now) {
      const elapsed = now - startTime;
      const progress = reduced ? 1 : clamp((elapsed - 85) / 450);
      scrollTo({ top: origin + (destination - origin) * drawProgress(progress), behavior: 'instant' });
      if (progress < 1) entryFrame = requestAnimationFrame(advance);
      else cancelEntryScroll();
    }
    advance(startTime);
  }

  for (const name of ['wheel', 'touchstart', 'pagehide']) {
    addEventListener(name, cancelEntryScroll, { passive: true });
  }
  addEventListener('popstate', event => {
    cancelEntryScroll();
    const hash = location.hash;
    if (event.state?.openerScroll !== undefined && hash === (event.state.openerHash ?? '')) {
      link.focus({ preventScroll: true });
      requestAnimationFrame(() => {
        if (location.hash === hash) scrollTo({ top: event.state.openerScroll, behavior: 'instant' });
      });
    } else if (event.state?.arrivedFromOpener && hash === '#entry') {
      const entry = document.getElementById('entry');
      if (!entry) return;
      entry.focus({ preventScroll: true });
      requestAnimationFrame(() => {
        if (location.hash === hash) scrollTo({ top: scrollY + entry.getBoundingClientRect().top, behavior: 'instant' });
      });
    }
  });
  link.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.pathname && (link.pathname !== location.pathname || link.search !== location.search)) return;
    const hash = link.hash;
    const target = hash && document.getElementById(hash.slice(1));
    if (!target) return;
    event.preventDefault();
    if (location.hash !== hash) {
      history.replaceState({ ...history.state, openerScroll: scrollY, openerHash: location.hash }, '');
      history.pushState({ arrivedFromOpener: true }, '', hash);
    }
    if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    goToEntry(scrollY + target.getBoundingClientRect().top);
  });
  addEventListener('scroll', () => {
    readScroll();
    if (!raf) publish(reduced ? 0 : scrollProgress);
  }, { passive: true });
  addEventListener('resize', size, { passive: true });
  new ResizeObserver(size).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    readScroll();
    update();
  }).observe(section);
  document.addEventListener('visibilitychange', update);
  new MutationObserver(() => {
    refreshPalette();
    if (grid && visible && !document.hidden) {
      const departure = reduced ? 0 : scrollProgress;
      paint(departure, performance.now(), true);
    }
  }).observe(document.documentElement, { attributeFilter: ['data-theme'] });
  motionChange(() => {
    reduced = still();
    update();
  });
  size();
}
