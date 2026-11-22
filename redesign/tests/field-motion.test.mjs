import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ambientCells, ambientSignal, characterGrid, inkPulse, inkGlyph, mountField, openerPhase, probeFalloff,
} from '../src/field.mjs';

const spread = values => Math.max(...values) - Math.min(...values);

test('held wordmark varies in intensity and glyph without thinning the silhouette past a plus', () => {
  const times = Array.from({ length: 15 }, (_, i) => 0.2 + i * 0.22);
  for (const start of [0, 5.4, 10.8, 16.2]) {
    const pulses = times.map(t => {
      assert.equal(openerPhase(start + t).transit, 0);
      return inkPulse(26, 18, 2.1, start + t);
    });
    assert.ok(spread(pulses) > 0.35);
    assert.deepEqual([...new Set(pulses.map(pulse => inkGlyph(4, pulse)))].sort(), [3, 4]);
    assert.deepEqual([0, 1, 2, 3].map(density => inkGlyph(density, 0)), [0, 1, 2, 3]);
  }
});

test('the background lattice covers desktop margins and portrait mobile, with sparse stable positions', () => {
  for (const [width, height] of [[3440, 1440], [1440, 900], [390, 844], [844, 390]]) {
    const grid = characterGrid(width, height);
    const { cells, left, right, top, bottom } = ambientCells(width, height, grid);
    assert.equal(cells.length, new Set(cells.map(({ col, row }) => `${col},${row}`)).size);
    assert.ok(grid.x + left * grid.dx < grid.dx);
    assert.ok(width - (grid.x + right * grid.dx) < grid.dx);
    assert.ok(grid.y + top * grid.dy < grid.dy);
    assert.ok(height - (grid.y + bottom * grid.dy) < grid.dy);
    const occupancy = cells.length / ((right - left + 1) * (bottom - top + 1));
    assert.ok(occupancy > 0.16 && occupancy < 0.34);
  }
});

test('ambient intensity changes smoothly across successive frames during a hold', () => {
  for (const [col, row, phase] of [[-12, 0, 0.1], [6, 13, 2.6], [90, 44, 3.7]]) {
    const values = Array.from({ length: 100 }, (_, frame) => ambientSignal(col, row, phase, frame / 30));
    assert.ok(spread(values) > 0.18);
    assert.ok(values.every((value, i) => value >= 0 && value <= 1 && (!i || Math.abs(value - values[i - 1]) < 0.05)));
  }
});

test('a fractional pointer perturbs the neighborhood, including empty corners, with bounded influence', () => {
  const center = [-6.25, -3.75];
  assert.equal(probeFalloff(...center, center, 6), 1);
  assert.ok(probeFalloff(-6, -4, center, 6) > 0.9);
  assert.ok(probeFalloff(-4, -2, center, 6) > probeFalloff(-2, -1, center, 6));
  assert.equal(probeFalloff(0, 0, center, 6), 0);
  assert.equal(probeFalloff(0, 0, null, 6), 0);
});

test('mounted field listens for motion changes without polling the media query during frames', t => {
  const scheduled = new Map();
  const colors = new Set();
  let motionChanged, themeChanged, paints = 0, reads = 0, nextId = 0, reduced = false;
  let ink = '#222c61';
  const pen = {
    setTransform() {},
    clearRect() { paints++; colors.clear(); },
    fillText() { colors.add(this.fillStyle); },
  };
  const bounds = () => ({ left: 0, top: 0, right: 390, bottom: 844, width: 390, height: 844 });
  const canvas = { getContext: () => pen, getBoundingClientRect: bounds };
  const section = Object.assign(new EventTarget(), {
    dataset: {}, getBoundingClientRect: bounds,
    querySelector: selector => selector === 'canvas' ? canvas : new EventTarget(),
  });
  const doc = Object.assign(new EventTarget(), {
    documentElement: { lang: 'en' }, hidden: false, querySelector: () => section,
  });
  const globals = {
    document: doc, window: { devicePixelRatio: 1 }, addEventListener() {},
    getComputedStyle: () => ({ getPropertyValue: name => name === '--opening-ink' ? ink : '' }),
    requestAnimationFrame: callback => (scheduled.set(++nextId, callback), nextId),
    cancelAnimationFrame: id => scheduled.delete(id),
    ResizeObserver: class { observe() {} },
    IntersectionObserver: class { observe() {} },
    MutationObserver: class { constructor(callback) { themeChanged = callback; } observe() {} },
  };
  for (const [name, value] of Object.entries(globals)) {
    const property = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => property ? Object.defineProperty(globalThis, name, property) : delete globalThis[name]);
  }
  mountField({
    still: () => { reads++; return reduced; },
    motionChange: callback => { motionChanged = callback; },
  });
  const advance = time => {
    const callbacks = [...scheduled.values()];
    scheduled.clear();
    for (const callback of callbacks) callback(time);
  };
  const initialReads = reads;
  const now = performance.now();
  const initialPaints = paints;
  advance(now + 50);
  advance(now + 100);
  assert.equal(reads, initialReads);
  assert.ok(paints > initialPaints);

  reduced = true;
  motionChanged();
  assert.equal(scheduled.size, 0);
  assert.ok(colors.has(ink));
  const staticPaints = paints;
  ink = '#e4eaff';
  themeChanged();
  assert.equal(paints, staticPaints + 1);
  assert.ok(colors.has(ink));
  assert.equal(scheduled.size, 0);

  reduced = false;
  motionChanged();
  assert.equal(scheduled.size, 1);
});
