import assert from 'node:assert/strict';
import test from 'node:test';
import { fieldLayout, cellNoise, drawProgress } from '../src/coordinates.mjs';

test('the field registers characters and content to a responsive sheet', () => {
  assert.equal(fieldLayout(1440, 900).rails, 12);
  assert.equal(fieldLayout(390, 844).rails, 4);
  const mobile = fieldLayout(320, 680);
  assert.ok(mobile.columns >= 29);
  assert.equal(mobile.x + mobile.columns * mobile.dx / 2, 160);
});

test('registration is stable and the unfolded drawing finishes cleanly', () => {
  assert.equal(cellNoise(13, 2), cellNoise(13, 2));
  assert.notEqual(cellNoise(13, 2), cellNoise(13, 3));
  assert.equal(drawProgress(-4), 0);
  assert.equal(drawProgress(0.5), 0.5);
  assert.equal(drawProgress(2), 1);
});
