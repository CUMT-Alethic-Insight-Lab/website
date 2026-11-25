import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bitmapWord, openerPhase, characterGrid, snapCell, rewriteDensity,
  latinMask, transitionFrame, handoffFrame,
} from '../src/field.mjs';

const cell = (column, row, grid) => row * grid.stride + column;

test('the wordmark uses explicit bitmaps with open space between letters', () => {
  const { width, pixels } = bitmapWord('ALETHIC');
  assert.equal(width, 41);
  for (const word of ['INSIGHT', 'FIND', 'FORM', 'REVEAL', 'TRUTH']) {
    assert.ok(bitmapWord(word).pixels.length > 0);
  }
  assert.ok(pixels.some(([x, y]) => x === 2 && y === 0));
  assert.ok(pixels.some(([x, y]) => x === 0 && y === 3));
  assert.ok(!pixels.some(([x]) => x === 5));
  assert.equal(new Set(pixels.map(pixel => pixel.join(','))).size, pixels.length);
});

test('the three readable holds repeat without a departure deadline', () => {
  assert.deepEqual(openerPhase(-0.005), { scene: 0, transit: 0 });
  for (let loop = 0; loop < 10; loop++) {
    for (let scene = 0; scene < 3; scene++) {
      const start = (loop * 3 + scene) * 5.4;
      for (const time of [0, 1, 3.79]) assert.deepEqual(openerPhase(start + time), { scene, transit: 0 });
      assert.equal(openerPhase(start + 4.6).transit, 0.5);
    }
  }
});

test('one responsive lattice aligns both edges and guides and snaps input to the nearest cell', () => {
  for (const [width, height] of [[320, 640], [390, 844], [844, 390], [1440, 900], [1920, 1080]]) {
    const grid = characterGrid(width, height);
    const { x, y, dx, dy, columns, rows, rails, stride } = grid;
    const span = Math.min(width * 0.91, 1520);
    assert.ok(Math.abs(x + columns * dx - (width + span) / 2) < 1e-9);
    assert.equal(columns % rails, 0);
    assert.equal(stride, columns + 1);
    assert.deepEqual(snapCell(x + 10.49 * dx, y + 12.51 * dy, grid), [10, 13]);
    assert.deepEqual(snapCell(-1, height + 1, grid), [0, rows - 1]);
    const ink = latinMask(['ALETHIC', 'INSIGHT'], grid);
    assert.equal(ink.length, rows * stride);
    assert.ok(ink.some(Boolean));
    assert.ok(ink.every((on, i) => !on || (i % stride > 0 && i % stride < columns && Math.floor(i / stride) < grid.baseline)));
  }
});

test('density steps through space, dot, colon, plus and hash in either direction', () => {
  const times = [0, .22, .43, .65, 1];
  assert.deepEqual(times.map(t => rewriteDensity(0, 4, t)), [0, 1, 2, 3, 4]);
  assert.deepEqual(times.map(t => rewriteDensity(4, 0, t)), [4, 3, 2, 1, 0]);
});

test('transition rewrites cells in row order and never adds ink outside the two masks', () => {
  const grid = characterGrid(1440, 900);
  const from = new Uint8Array(grid.stride * grid.rows);
  const to = new Uint8Array(from.length);
  const row = 9, col = 14;
  const early = cell(col, row, grid), late = cell(col, row + 12, grid);
  const shared = cell(col, row + 6, grid), writing = cell(col + 2, row + 6, grid);
  from[early] = from[late] = from[shared] = to[shared] = to[writing] = 4;
  assert.deepEqual(transitionFrame(from, to, grid, 0), from);
  assert.deepEqual(transitionFrame(from, to, grid, 1), to);
  const seen = new Set();
  for (let step = 0; step <= 100; step++) {
    const frame = transitionFrame(from, to, grid, step / 100);
    assert.ok(frame[early] <= frame[late]);
    assert.equal(frame[shared], 4);
    assert.ok(frame.every((density, i) => density === 0 || from[i] || to[i]));
    seen.add(frame[writing]);
  }
  assert.deepEqual([...seen], [0, 1, 2, 3, 4]);
});

test('handoff removes only existing ink and writes ticks at fixed baseline guide columns', () => {
  const grid = characterGrid(1440, 900);
  const { baseline, columns, rails, stride } = grid;
  const from = latinMask(['ALETHIC', 'INSIGHT'], grid);
  assert.deepEqual(handoffFrame(from, grid, 0), from);
  const partial = handoffFrame(from, grid, .55);
  assert.ok(partial.some((density, i) => from[i] && density === 0));
  assert.ok(partial.some((density, i) => from[i] && density === 4));
  const end = handoffFrame(from, grid, 1);
  assert.ok(end.every((density, i) => !density || Math.floor(i / stride) >= baseline - 3));
  for (let guide = 0; guide <= rails; guide++) {
    const col = guide * columns / rails;
    assert.equal(end[cell(col, baseline, grid)], 3);
    assert.equal(end[cell(col, baseline - 3, grid)], 2);
  }
  assert.deepEqual(handoffFrame(from, grid, .55), partial);
});
