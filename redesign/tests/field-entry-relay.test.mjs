import test from 'node:test';
import assert from 'node:assert/strict';
import { characterGrid, entryRelay } from '../src/field.mjs';

const cover = (width, height, offset) => ({ left: 0, top: -offset, right: width, bottom: height - offset, width, height });
const workbench = (left, top, offset) => ({ left, top: top - offset, width: 360 });

test('the relay follows the same reversible path as the document advances', () => {
  const grid = characterGrid(1440, 900);
  const compute = offset => entryRelay(grid, cover(1440, 900, offset), workbench(65, 1374, offset), false);
  const forward = [80, 260, 430, 550, 720, 885].map(compute);
  assert.deepEqual(forward, [885, 720, 550, 430, 260, 80].map(compute).reverse());
  assert.equal(forward[0].stage, 'baseline');
  assert.ok(forward[0].head.col > forward[1].head.col);
  assert.ok(forward[2].head.row < forward[3].head.row);
  assert.ok(forward[3].head.row < forward[4].head.row);
  assert.equal(forward.at(-1).stage, 'settled');
  assert.ok(forward.at(-1).head.col > forward[4].head.col);
});

test('each traveling glyph lands on the original column and row after projection to either canvas', () => {
  const grid = characterGrid(390, 844);
  for (const offset of [95, 310, 440, 610, 819, 900]) {
    const box = cover(390, 844, offset);
    const signal = entryRelay(grid, box, workbench(17.55, 1334, offset), false);
    for (const cell of signal.cells) {
      assert.ok(Math.abs((cell.x - box.left - grid.x) / grid.dx - cell.col) < 1e-9);
      assert.ok(Math.abs((cell.y - box.top - grid.y) / grid.dy - cell.row) < 1e-9);
    }
  }
});

test('reduced motion uses permanent marks at identical document addresses', () => {
  const grid = characterGrid(390, 844);
  const addresses = offset => entryRelay(grid, cover(390, 844, offset), workbench(17.55, 1334, offset), true)
    .cells.map(({ col, row, glyph, alpha }) => ({ col, row, glyph, alpha }));
  assert.deepEqual(addresses(0), addresses(425));
  assert.deepEqual(addresses(425), addresses(844));
});
