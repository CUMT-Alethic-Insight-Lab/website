import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneKind, sceneStrokes } from '../src/page-scene.mjs';
import { isContentPath, objectOrigin } from '../src/travel.mjs';

const topology = file => sceneStrokes(sceneKind(file));

test('the research plate presents seven distinct direction branches from one junction', () => {
  const branches = topology('research.html').filter(stroke => stroke.points.length > 10
    && stroke.points[0][0] === -0.59 && stroke.points[0][1] === 0);
  assert.deepEqual(branches.map(branch => branch.part), Array.from({ length: 7 }, (_, index) => index / 6));
  assert.equal(new Set(branches.map(branch => branch.points.at(-1)[1])).size, 7);
});

test('community is a separate branch from the direct recruitment node for society and lab', () => {
  const connectors = topology('structure.html').filter(stroke => stroke.points.length === 4);
  assert.equal(connectors.length, 4);
  assert.deepEqual(connectors[0].points[0], connectors[1].points[0]);
  assert.deepEqual(connectors[1].points.at(-1), connectors[2].points[0]);
  assert.deepEqual(connectors[2].points[0], connectors[3].points[0]);
  assert.notDeepEqual(connectors[2].points.at(-1), connectors[3].points.at(-1));
  assert.deepEqual(connectors.map(stroke => stroke.part), [0, -1, 0.5, 1]);
});

test('project and FLUED plates share the byte, cut and readout geometry with page emphasis', () => {
  const basic = topology('projects.html');
  assert.ok(basic.some(stroke => stroke.part === 0 && stroke.glyph === '0'));
  assert.ok(basic.some(stroke => stroke.part === 0.5 && stroke.glyph === '|'));
  assert.ok(basic.some(stroke => stroke.part === 1 && stroke.points.length === 5));
  for (const [file, part] of [['flued-demo.html', 0], ['flued.html', 0.5], ['flued-architecture.html', 1]]) {
    assert.ok(topology(file).some((stroke, index) => stroke.part === part && stroke.weight > basic[index].weight));
  }
});

test('timeline markers come from the number of page controls', () => {
  const counts = [0, 1, 3, 7];
  for (const count of counts) {
    const strokes = sceneStrokes('timeline', 0, 0, count);
    assert.equal(strokes.filter(stroke => stroke.part >= 0).length, count * 4);
  }
});

test('document transitions recognize localized content and keep service navigation native', () => {
  for (const path of ['/', '/index.html', '/research.html', '/en/', '/en/index.html', '/en/about.html', '/flued-architecture.html']) {
    assert.ok(isContentPath(path), path);
  }
  for (const path of ['/login', '/account', '/recruitment/', '/awards/sample.pdf', '/recruitment/terms.html']) {
    assert.ok(!isContentPath(path), path);
  }
  const rect = { left: 60, top: 140, right: 260, bottom: 190, width: 200, height: 50 };
  const { ry, ...origin } = objectOrigin(rect, 1000, 500, { x: 63, y: 151 });
  assert.deepEqual(origin, { x: 0.16, y: 0.33, rx: 90 });
  assert.ok(Math.abs(ry - 27.5) < 1e-9);
  const splash = { left: 0, top: 0, right: 1000, bottom: 500, width: 1000, height: 500 };
  assert.deepEqual(objectOrigin(splash, 1000, 500, { x: 725, y: 382 }), { x: 0.725, y: 0.764, rx: 106, ry: 49 });
});
