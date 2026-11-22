import test from 'node:test';
import assert from 'node:assert/strict';
import { characterGrid, sceneRegister } from '../src/field.mjs';
import { projectArtBox, rewriteInk } from '../src/page-scene.mjs';

test('anchored artwork stays registered to the chapter during forward and reverse scroll', () => {
  const anchor = { x: 650, y: 240, width: 410, height: 210 };
  assert.deepEqual([400, 378, 356, 378, 400].map(top => projectArtBox(anchor, top)),
    [640, 618, 596, 618, 640].map(y => ({ ...anchor, y })));
});

test('a fresh rewrite starts from what was painted, including a mid-transition reversal', () => {
  const middle = rewriteInk(.7, .4, .4, .3);
  assert.ok(middle > 0 && middle < .7);
  assert.equal(rewriteInk(middle, .7, 0, .9), middle);
  assert.equal(rewriteInk(middle, .7, 1, .9), .7);
  assert.ok(rewriteInk(.7, .7, .5, .4) > .50);
});

test('the registered rows keep the opener baseline on the same document lattice', () => {
  const grid = characterGrid(1440, 900);
  const base = grid.y + grid.dy * grid.baseline;
  for (const top of [0, -350, -805, -877, -805, -350]) {
    const register = sceneRegister(grid, top);
    assert.ok(register.y >= 0 && register.y < grid.dy);
    assert.ok(Math.abs(register.y - register.row * grid.dy - top - base) < 1e-9);
  }
});
