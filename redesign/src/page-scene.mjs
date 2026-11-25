import { cellNoise, drawProgress } from './coordinates.mjs';
import { characterGrid, drawEntryRelay, sceneRegister } from './field.mjs';

const TAU = Math.PI * 2;
const GLYPHS = '.:-=+*#%@';
const SIGNAL_GLYPHS = '01|';
const REWRITE_MS = 320;
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const mix = (a, b, t) => a + (b - a) * t;
const OPTION = '[data-scene-option], .project-path a[href], [data-pick-object] .object-control, [data-direction], [data-team], [data-award], [data-agreement], [data-stage-link], [data-stage], [role="tab"], select, input[type="radio"]';
const SELECTED = '[aria-selected="true"], [aria-pressed="true"], [aria-current]:not([aria-current="false"]), [data-active]:not([data-active="false"]), [data-selected]:not([data-selected="false"]), :checked';
const READING = '.story-intro, .story-content, .topic-lead, .ed-prose, .ed-index, .ed-meeting, '
  + '.project-main, .project-evidence, .project-directory, .cut-figure, .topic-switch, '
  + '[data-scene-quiet], figure, details, nav, aside, pre, table, form';
const CHROME = '[data-site-header], .site-header, .mast, .site-nav-flyout, body > footer';

// The largest clear rectangles are obtained from a histogram of unmasked grid cells.
// The crop preserves a usable aspect ratio for the whole drawing.
function findArtBox(quiet, columns, rows, pitchX, pitchY, bounds, preferred, mobile) {
  const heights = new Uint16Array(columns);
  const stack = new Uint16Array(columns);
  const left = clamp(Math.ceil(bounds.left / pitchX), 0, columns);
  const right = clamp(Math.floor(bounds.right / pitchX), 0, columns);
  const top = clamp(Math.ceil(bounds.top / pitchY), 0, rows);
  const bottom = clamp(Math.floor(bounds.bottom / pitchY), 0, rows);
  const minWidth = mobile ? 134 : 208;
  const minHeight = mobile ? 76 : 118;
  let best = null;
  for (let row = top; row < bottom; row++) {
    let depth = 0;
    for (let col = left; col <= right; col++) {
      const height = col === right || quiet[row * columns + col] ? 0 : heights[col] + 1;
      if (col < right) heights[col] = height;
      while (depth && heights[stack[depth - 1]] > height) {
        const startHeight = heights[stack[--depth]] * pitchY;
        const startX = (depth ? stack[depth - 1] + 1 : left) * pitchX;
        const spanX = col * pitchX - startX;
        const spanY = Math.min(startHeight, preferred.height, spanX / 1.1);
        const boxWidth = Math.min(spanX, preferred.width, spanY * 3.45);
        const boxHeight = Math.min(spanY, boxWidth / 1.1);
        if (boxWidth < minWidth || boxHeight < minHeight) continue;
        const endY = (row + 1) * pitchY;
        const x = clamp(preferred.x, startX + boxWidth / 2, col * pitchX - boxWidth / 2);
        const y = clamp(preferred.y, endY - startHeight + boxHeight / 2, endY - boxHeight / 2);
        const distance = Math.abs(x - preferred.x) / preferred.width + Math.abs(y - preferred.y) / preferred.height;
        const score = boxWidth * boxHeight / (1 + distance * 0.55);
        if (!best || score > best.score) best = { x, y, width: boxWidth, height: boxHeight, score };
      }
      if (col < right) stack[depth++] = col;
    }
  }
  return best;
}

export function projectArtBox(anchor, top) {
  return anchor && { ...anchor, y: anchor.y + top };
}

export function rewriteInk(from, to, progress, rank) {
  const local = drawProgress(clamp((progress - rank * 0.35) / 0.65));
  return mix(from, to, local);
}

const themes = {
  'about.html': 'ribbon', 'structure.html': 'organization', 'research.html': 'directions',
  'focus.html': 'lens', 'projects.html': 'pipeline', 'awards.html': 'medal',
  'agreement.html': 'braid', 'documents.html': 'pages', 'meeting.html': 'timeline',
  'join.html': 'gate', 'people.html': 'network', 'insights-memory-hierarchy.html': 'spectrum',
  'flued.html': 'pipeline-cut', 'flued-architecture.html': 'pipeline-readout', 'flued-demo.html': 'pipeline-byte',
  'flued-evidence.html': 'pipeline-readout', 'flued-experiments.html': 'pipeline-readout',
};

export function sceneKind(file) {
  return Object.hasOwn(themes, file) ? themes[file] : 'contours';
}

const researchMotifs = {
  nlp: 'nlp-segments', llm: 'nlp-segments', cv: 'cv-framing', vlm: 'multimodal-fusion',
  mllm: 'multimodal-fusion', multimodal: 'multimodal-fusion', rl: 'rl-reward-loop',
  agent: 'agent-path', memory: 'memory-retrieval', infra: 'infra-bus',
};

function researchMotif(choice) {
  const name = choice?.key?.toLowerCase().replace(/^#?direction-/, '').replace(/^ai[-_ ]/, '');
  return Object.hasOwn(researchMotifs, name) ? researchMotifs[name] : 'directions';
}

function researchStrokes(kind, { line, curve, ring, drift }) {
  function box(left, top, right, bottom, weight) {
    line([[left, top], [right, top], [right, bottom], [left, bottom], [left, top]], weight);
  }
  function head(x, y, angle, size = 0.10) {
    line([[x - size * Math.cos(angle - 0.57), y - size * Math.sin(angle - 0.57)], [x, y],
      [x - size * Math.cos(angle + 0.57), y - size * Math.sin(angle + 0.57)]], 1);
  }
  if (kind === 'nlp-segments') {
    const breaks = [[-0.89, -0.60, -0.04, 0.47, 0.88], [-0.89, -0.29, 0.02, 0.70, 0.88], [-0.89, -0.51, 0.27, 0.88]];
    for (const [row, cuts] of breaks.entries()) {
      const y = -0.57 + row * 0.53;
      for (let i = 1; i < cuts.length; i++) {
        const left = cuts[i - 1] + 0.022, right = cuts[i] - 0.022;
        box(left, y - 0.14, right, y + 0.14, 0.78 + ((row + i) % 3) * 0.08);
        for (let x = left + 0.037; x < right - 0.025; x += 0.072) {
          line([[x, y - 0.023], [x + 0.022, y - 0.023]], 0.62);
          if ((row + i) % 2) line([[x, y + 0.062], [x + 0.013, y + 0.062]], 0.48);
        }
        if (i < cuts.length - 1) line([[cuts[i], y + 0.16], [cuts[i], y + 0.34]], 0.46, -1, '|');
      }
    }
    line([[-0.88, 0.64], [-0.88, 0.74], [0.86, 0.74]], 0.74);
    head(0.86, 0.74, 0);
    return true;
  }
  if (kind === 'cv-framing') {
    for (const x of [-1, 1]) for (const y of [-1, 1]) {
      line([[x * 0.63, y * 0.75], [x * 0.90, y * 0.75], [x * 0.90, y * 0.45]], 1);
    }
    for (let r = -6; r <= 6; r++) for (let c = -10; c <= 10; c++) {
      const x = c * 0.071, y = r * 0.090;
      const shape = (x - drift) ** 2 / 0.21 + (y + 0.06 - 0.23 * Math.abs(x)) ** 2 / 0.14;
      const horizon = Math.abs(y - 0.22 + 0.33 * Math.sin(3.5 * x)) < 0.06;
      if (shape > 1 && !horizon && cellNoise((r + 6) * 21 + c + 10, 11) > 0.24) continue;
      line([[x, y], [x + 0.014, y]], shape < 0.36 ? 0.99 : shape < 1 || horizon ? 0.80 : 0.43);
    }
    box(-0.54, -0.44, 0.54, 0.45, 0.61);
    line([[-0.12, 0], [0.12, 0]], 0.92);
    line([[0, -0.15], [0, 0.15]], 0.92);
    return true;
  }
  if (kind === 'multimodal-fusion') {
    box(-0.94, -0.73, -0.62, -0.37, 0.87);
    line([[-0.92, -0.40], [-0.79, -0.60], [-0.64, -0.42]], 0.70);
    for (let i = 0; i < 4; i++) line([[-0.94, 0.36 + i * 0.10], [-0.63 + (i % 2) * 0.07, 0.36 + i * 0.10]], 0.72);
    for (let lane = -2; lane <= 2; lane++) for (const sign of [-1, 1]) {
      curve(t => [mix(-0.59, 0.27, t), sign * 0.51 * (1 - drawProgress(t)) + lane * 0.063 + drift * Math.sin(t * TAU)],
        lane === 0 ? 0.95 : sign < 0 ? 0.62 : 0.75);
    }
    box(0.24, -0.18, 0.48, 0.18, 0.93);
    for (let lane = -2; lane <= 2; lane++) line([[0.49, lane * 0.063], [0.89, lane * 0.105]], 0.70);
    head(0.89, 0, 0);
    return true;
  }
  if (kind === 'rl-reward-loop') {
    const rx = 0.76, ry = 0.68;
    for (let step = 0; step < 4; step++) {
      const start = step * TAU / 4 + 0.15;
      const end = start + TAU / 4 - 0.30;
      curve(t => { const a = mix(start, end, t); return [rx * Math.cos(a), ry * Math.sin(a)]; }, 0.87);
      head(rx * Math.cos(end), ry * Math.sin(end), Math.atan2(ry * Math.cos(end), -rx * Math.sin(end)), 0.13);
      const node = step * TAU / 4;
      ring(rx * Math.cos(node), ry * Math.sin(node), 0.053, 0.075, 0, 0.78);
    }
    const rewards = [[-0.40, 0.24], [-0.22, 0.11], [-0.10, 0.19], [0.02, -0.02], [0.18, 0.02], [0.38, -0.30]];
    line(rewards, 0.97);
    for (const [x, y] of rewards) line([[x, y + 0.06], [x, 0.30]], 0.49);
    return true;
  }
  if (kind === 'agent-path') {
    const blocks = [[-0.84, -0.64, -0.57, -0.25], [-0.84, 0.18, -0.58, 0.38], [-0.40, -0.56, -0.22, -0.15],
      [-0.34, 0.18, -0.10, 0.61], [0.10, -0.63, 0.25, 0.04], [0.13, 0.27, 0.44, 0.54], [0.58, -0.21, 0.85, 0.46]];
    for (const [x, y, right, bottom] of blocks) box(x, y, right, bottom, 0.54);
    const route = [[-0.86, 0.58], [-0.46, 0.58], [-0.46, -0.05], [-0.04, -0.05], [-0.04, 0.15],
      [0.49, 0.15], [0.49, -0.48], [0.85, -0.48]];
    line(route, 0.98);
    ring(-0.86, 0.58, 0.052, 0.068, 0, 0.90);
    head(0.85, -0.48, 0);
    return true;
  }
  if (kind === 'memory-retrieval') {
    for (let layer = 0; layer < 4; layer++) {
      const y = -0.47 + layer * 0.31, x = -0.68 + layer * 0.07;
      line([[x, y], [x + 0.82, y - 0.17], [x + 1.16, y + 0.03], [x + 0.35, y + 0.21], [x, y]], 0.72 + layer * 0.045);
      for (let i = 1; i < 8; i++) {
        line([[x + 0.16 + i * 0.09, y + 0.07 - i * 0.020], [x + 0.20 + i * 0.09, y + 0.075 - i * 0.020]], 0.61);
      }
    }
    line([[0.87, -0.67], [0.87, 0.18], [0.58, 0.18]], 0.99);
    head(0.58, 0.18, Math.PI);
    ring(0.87, -0.67, 0.055, 0.069, 0, 0.83);
    return true;
  }
  if (kind === 'infra-bus') {
    for (let rack = 0; rack < 4; rack++) {
      const x = -0.88 + rack * 0.45;
      box(x, -0.67, x + 0.34, 0.37, 0.93);
      for (let row = 0; row < 6; row++) {
        const y = -0.56 + row * 0.15;
        line([[x + 0.035, y], [x + 0.27, y]], row % 2 ? 0.65 : 0.80);
        line([[x + 0.28, y], [x + 0.305, y]], 0.96, -1, row % 2 ? '1' : '0');
      }
      line([[x + 0.17, 0.39], [x + 0.17, 0.65]], 0.89);
    }
    line([[-0.93, 0.65], [0.92, 0.65]], 0.94);
    line([[-0.93, 0.76], [0.92, 0.76]], 0.68);
    return true;
  }
  return false;
}

// Each drawing returns one plate of related strokes in shared coordinates.
export function sceneStrokes(kind, phase = 0, selection = 0, milestones = 0) {
  const strokes = [];
  const line = (points, weight = 0.75, part = -1, glyph = '') => strokes.push({ points, weight, part, glyph });
  const curve = (fn, weight, part) => line(Array.from({ length: 73 }, (_, i) => fn(i / 72)), weight, part);
  const ring = (x, y, rx, ry, turn, weight, part) => curve(t => {
    const a = TAU * t;
    return [x + rx * Math.cos(a) + turn * Math.sin(a), y + ry * Math.sin(a)];
  }, weight, part);
  const drift = Math.sin(phase) * 0.045;
  if (researchStrokes(kind, { line, curve, ring, drift })) return strokes;

  if (kind === 'ribbon' || kind === 'spectrum') {
    const spectrum = kind === 'spectrum';
    for (let i = 0; i < 19; i++) {
      const v = (i - 9) / 9;
      curve(t => {
        const u = t * 2 - 1;
        const twist = t * (spectrum ? 6.4 : 4.8) + drift * 5;
        return [u * 0.95 + v * 0.12 * Math.sin(twist),
          0.31 * Math.sin(t * 5.7 + drift * 3) + v * Math.cos(twist) * (0.30 + 0.32 * Math.abs(u))];
      }, i % 6 === 0 ? 0.95 : 0.57, i / 18);
    }
  } else if (kind === 'directions') {
    const junction = [-0.59, 0];
    line([[-0.97, 0], junction], 1);
    for (let i = 0; i < 7; i++) {
      const axis = (i - 3) / 3, endX = 0.91 - Math.abs(axis) * 0.16, endY = axis * 0.86;
      const part = i / 6;
      curve(t => [mix(junction[0], endX - 0.08, t), endY * drawProgress(t) + Math.sin(t * Math.PI) * drift], 0.84, part);
      ring(endX, endY, 0.055, 0.074, 0, 1, part);
      line([[endX - 0.022, endY], [endX + 0.022, endY]], 1, part);
    }
    ring(...junction, 0.060, 0.082, 0, 0.93);
  } else if (kind === 'organization') {
    const entry = [-0.80, -0.08], community = [0.48, -0.55], recruitment = [-0.06, 0.30];
    const society = [0.70, 0.08], lab = [0.70, 0.61];
    line([entry, [-0.45, entry[1]], [-0.45, community[1]], community], 0.83, 0);
    line([entry, [-0.45, entry[1]], [-0.45, recruitment[1]], recruitment], 0.83);
    line([recruitment, [0.30, recruitment[1]], [0.30, society[1]], society], 0.88, 0.5);
    line([recruitment, [0.30, recruitment[1]], [0.30, lab[1]], lab], 0.88, 1);
    for (const [[x, y], rw, rh, part] of [[entry, 0.10, 0.09, -1], [community, 0.18, 0.12, 0],
      [recruitment, 0.13, 0.11, -1], [society, 0.13, 0.095, 0.5], [lab, 0.13, 0.095, 1]]) {
      line([[x - rw, y - rh], [x + rw, y - rh], [x + rw, y + rh], [x - rw, y + rh], [x - rw, y - rh]], 1, part);
      line([[x - rw * 0.50, y], [x + rw * 0.50, y]], 0.86, part);
    }
  } else if (kind.startsWith('pipeline')) {
    const emphasis = { 'pipeline-byte': 0, 'pipeline-cut': 0.5, 'pipeline-readout': 1 }[kind];
    const power = (part, value) => part === emphasis ? Math.min(1, value + 0.23) : value;
    // A field of individual bytes enters a boundary lattice and leaves as a compact package.
    for (let row = 0; row < 9; row++) for (let col = 0; col < 7; col++) {
      const x = -0.98 + col * 0.076, y = (row - 4) * 0.12 + drift * Math.sin(col);
      const byte = cellNoise(row * 7 + col, 42) > 0.5 ? '1' : '0';
      line([[x, y], [x + 0.020, y]], power(0, 0.64), 0, byte);
    }
    for (let lane = -2; lane <= 2; lane++) {
      const y = lane * 0.153;
      line([[-0.47, y], [-0.23, y], [0.29, y], [0.44, y * 0.73]], power(0.5, lane ? 0.59 : 0.82), 0.5);
      for (const x of [-0.24, -0.067, 0.065, 0.25]) {
        const cut = x + drift * Math.cos(lane * 1.4);
        line([[cut, y - 0.068], [cut, y + 0.068]], power(0.5, 0.95), 0.5, '|');
      }
    }
    for (let i = 0; i < 4; i++) {
      const x = 0.45 + i * 0.027, y = -0.30 - i * 0.055;
      line([[x, y], [x + 0.36, y], [x + 0.36, y + 0.54], [x, y + 0.54], [x, y]], power(1, 0.85 - i * 0.065), 1);
      if (!i) for (let row = 1; row < 7; row++) {
        line([[x + 0.065, y + row * 0.075], [x + 0.295, y + row * 0.075]], power(1, 0.61), 1);
      }
    }
  } else if (kind === 'network') {
    const tiers = [[0, -0.70], [-0.66, 0.04], [0, 0.06], [0.66, 0.04], [-0.82, 0.59], [-0.27, 0.63], [0.27, 0.63], [0.82, 0.59]];
    const edges = [[0, 1], [0, 2], [0, 3], [1, 4], [1, 5], [2, 5], [2, 6], [3, 6], [3, 7], [4, 5], [5, 6], [6, 7]];
    for (const [a, b] of edges) {
      const [x, y] = tiers[a], [xx, yy] = tiers[b];
      curve(t => [mix(x, xx, t), mix(y, yy, t) + Math.sin(t * Math.PI) * (0.1 + drift)], 0.53, b / 7);
    }
    tiers.forEach(([x, y], i) => {
      ring(x, y, i === 0 ? 0.13 : 0.10, 0.13, 0.04, 0.97, i / 7);
      ring(x, y, 0.049, 0.065, 0, 0.77, i / 7);
    });
  } else if (kind === 'lens' || kind === 'medal' || kind === 'contours') {
    for (let i = 0; i < 16; i++) {
      const radius = 0.15 + i * 0.045;
      curve(t => {
        const a = t * TAU, tooth = kind === 'medal' ? 12 : kind === 'lens' ? 3 : 2;
        const r = radius * (1 + 0.105 * Math.cos(a * tooth + drift * 4 + selection * 0.7));
        return [r * Math.cos(a) + 0.12 * Math.sin(a), r * Math.sin(a) * 0.93];
      }, i % 4 === 0 ? 1 : 0.58, i / 15);
    }
    if (kind === 'medal') {
      line([[-0.21, 0.51], [-0.31, 0.92], [0, 0.75], [0.30, 0.91], [0.20, 0.51]], 0.95);
    } else {
      line([[-0.95, 0.29], [-0.56, 0.29], [0.56, -0.29], [0.95, -0.29]], 0.51);
    }
  } else if (kind === 'pages') {
    for (let i = 0; i < 7; i++) {
      const x = -0.77 + i * 0.10;
      const y = 0.36 - i * 0.16 + drift * Math.cos(i);
      const face = [[x, y], [x + 0.60, y - 0.26], [x + 0.94, y + 0.07], [x + 0.31, y + 0.32], [x, y]];
      line(face, i % 2 === 0 ? 0.98 : 0.70, i / 6);

      for (let j = 1; j < 5; j++) {
        line([[x + j * 0.11, y - j * 0.045], [x + 0.25 + j * 0.11, y + 0.20 - j * 0.045]], 0.45, i / 6);
      }
    }
  } else if (kind === 'braid') {
    for (let group = 0; group < 3; group++) for (let strand = 0; strand < 5; strand++) {
      curve(t => {
        const a = 5.5 * t + group * TAU / 3 + drift * 4;
        return [t * 1.89 - 0.945 + 0.07 * Math.cos(a), Math.sin(a) * (0.39 + strand * 0.04)];
      }, strand === 0 ? 1 : 0.58, group / 2);
    }
  } else if (kind === 'timeline') {
    for (let lane = 0; lane < 9; lane++) curve(t => {
      const x = t * 1.9 - 0.95;
      const y = 0.24 * Math.cos(t * 6 + drift * 3) + (lane - 4) * 0.083;
      return [x, y];
    }, lane === 4 ? 0.92 : 0.50);
    for (let i = 0; i < milestones; i++) {
      const t = milestones > 1 ? i / (milestones - 1) : 0.5;
      const x = mix(-0.82, 0.82, t), y = 0.24 * Math.cos((x + 0.95) / 1.9 * 6 + drift * 3);
      for (let j = 0; j < 4; j++) ring(x, y, 0.055 + 0.024 * j, 0.095 + 0.047 * j, 0.032, 0.96 - j * 0.13, t);
    }
  } else if (kind === 'gate') {
    for (let i = 0; i < 13; i++) {
      const t = i / 12, r = 0.93 - 0.69 * t;
      line([[-r + 0.20 * t, 0.73 - 0.53 * t], [-r + 0.20 * t, -0.61 + 0.42 * t],
        [r + 0.20 * t, -0.73 + 0.55 * t + drift], [r + 0.20 * t, 0.69 - 0.54 * t]],
      i % 4 === 0 ? 1 : 0.62, t);
    }
  }
  return strokes;
}

function readChoice(control, main) {
  if (!control || !main.contains(control) || control.disabled || control.getAttribute('aria-disabled') === 'true') return null;
  if (control.matches('select')) {
    const options = [...control.options].filter(option => !option.disabled && !option.hidden);
    const index = options.indexOf(control.selectedOptions[0]);
    return index < 0 ? null : { index, count: options.length, key: control.value };
  }
  const name = control.getAttribute('name');
  const selector = OPTION.split(', ').find(candidate => control.matches(candidate));
  if (!selector) return null;
  const group = control.closest('[data-scene-options], [role="tablist"], [data-meeting-axis], fieldset') || main;
  const options = [...group.querySelectorAll(selector)].filter(option => !option.hidden && !option.disabled
    && option.getAttribute('aria-disabled') !== 'true' && (!control.matches('input[type="radio"]') || option.name === name));
  const index = options.indexOf(control);
  return index < 0 ? null : { index, count: options.length,
    key: control.dataset.sceneOption || control.dataset.direction || control.closest('[data-pick-object]')?.id || control.id || control.getAttribute('href') || control.value || String(index) };
}

function activeChoice(main) {
  return [...main.querySelectorAll(OPTION)].find(control => !control.closest('[hidden], [inert]')
    && (control.matches(SELECTED) || (control.hash && control.hash === location.hash)))
    || main.querySelector('select');
}

function primaryControl(main) {
  const hint = main.getAttribute('data-primary');
  if (hint) {
    try {
      const target = main.querySelector(hint);
      if (target) return target;
    } catch { /* A bare ID or a URL is also valid. */ }
    return [...main.querySelectorAll('a[href]')].find(link => link.getAttribute('href') === hint)
      || [...main.querySelectorAll('[id]')].find(node => node.id === hint);
  }
  const mark = main.querySelector('[data-primary]');
  return mark?.matches('a[href], button') ? mark : mark?.querySelector('a[href], button');
}

export function mountPageScene(main, { still, motionChange }) {
  if (!main?.dataset.page || !/\.html$/i.test(main.dataset.page) || document.querySelector('canvas.page-scene')) return;
  const longform = main.matches('[data-longform]');
  if (main.dataset.page === 'index.html' && !longform) return;
  const opening = longform ? document.querySelector('.opening') : null;
  const openingCanvas = opening?.querySelector('canvas');
  const relayTarget = openingCanvas && main.querySelector('#position [data-lab-workbench]');
  const screens = longform ? [...main.querySelectorAll('.story-screen[data-scene-page]')] : [];
  const paper = main.querySelector('.ed-paper');
  const prose = paper?.querySelector(':scope > .ed-prose');
  const readingStops = prose ? [...prose.querySelectorAll('.ed-reading-stop > h2[id]')] : [];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.className = 'page-scene';
  canvas.dataset.sceneVisible = 'false';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);

  let reduced = still(), palette, width, height, dpr, pitchX, pitchY, columns, rows, mobile;
  let openerGrid, openingBox, openingHeight, originX = 0, originY = 0, worldRow = 0, paintedRow = 0;
  let anchors = new WeakMap(), signalRows = [];
  let ambientRow, articleMargin, relayBlockRects = [];
  let ambient, quiet, weights, parts, glyphs, writtenInk, writtenGlyphs, writtenAccent;
  let dirty = true, readingBlocks, freeAmbient, pointer, pulse, frame = 0, previous, lastPaint = -Infinity, time = 0;
  let hovered, focused, position = 0, chosen, cta, ctaBox, artBox, artVisible = false, choiceDirty = true;
  let currentSection = longform ? null : main, file = longform ? '' : main.dataset.page;
  let milestones = 0, direction = 'forward', artKey, rewrite, openingVisible = Boolean(opening);
  let openerDirty = Boolean(opening), frameVisible = false, pageVisible = true;
  const committed = new WeakMap();

  function paletteChange() {
    const css = getComputedStyle(canvas);
    palette = {
      ambient: css.getPropertyValue('--scene-field').trim() || '#7181b5',
      art: css.getPropertyValue('--scene-ink').trim() || '#5266a6',
      accent: css.getPropertyValue('--scene-accent').trim() || '#3548a3',
      artLimit: Number.parseFloat(css.getPropertyValue('--scene-art-limit')) || 0.72,
      signal: css.getPropertyValue('--scene-signal').trim() || '#6476a7',
      margin: css.getPropertyValue('--scene-margin').trim() || '#54688d',
      relay: (opening && getComputedStyle(opening).getPropertyValue('--opening-blue').trim()) || '#6476a7',
    };
    invalidate();
  }

  function resize() {
    const box = canvas.getBoundingClientRect();
    const openingSize = openingCanvas?.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
    if (!box.width || !box.height || (width === box.width && height === box.height && dpr === ratio
      && openingHeight === openingSize?.height)) return;
    width = box.width;
    height = box.height;
    dpr = ratio;
    openingHeight = openingSize?.height;
    mobile = width < 640;
    openerGrid = openingSize?.width && openingSize.height ? characterGrid(openingSize.width, openingSize.height) : null;
    if (openerGrid) {
      pitchX = openerGrid.dx;
      pitchY = openerGrid.dy;
      originX = openerGrid.x % pitchX;
      columns = Math.ceil(width / pitchX) + 1;
      rows = Math.ceil(height / pitchY) + 1;
    } else {
      columns = Math.max(1, Math.min(176, Math.ceil(width / (mobile ? 8 : 10))));
      rows = Math.max(1, Math.min(112, Math.ceil(height / (mobile ? 9 : 14))));
      pitchX = width / columns;
      pitchY = height / rows;
      originX = pitchX / 2;
      originY = pitchY / 2;
    }
    anchors = new WeakMap();
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.min(pitchX * 1.33, pitchY * 0.93, 15)}px ${getComputedStyle(canvas).fontFamily}`;
    const count = columns * rows;
    ambient = [];
    quiet = new Uint8Array(count);
    weights = new Float32Array(count);
    parts = new Float32Array(count);
    glyphs = new Uint8Array(count);
    writtenInk = new Float32Array(count);
    writtenGlyphs = new Uint8Array(count);
    writtenAccent = new Uint8Array(count);
    rewrite = undefined;
    delete canvas.dataset.sceneRewrite;
    ambientRow = undefined;
    openerDirty = Boolean(opening);
    invalidate();
  }

  function registerAmbient() {
    if (ambientRow === worldRow) return;
    ambientRow = worldRow;
    ambient.length = 0;
    const railStart = openerGrid ? Math.round((openerGrid.x - originX) / pitchX) : 0;
    for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
      const index = row * columns + col;
      const address = (row + worldRow + (openerGrid?.baseline ?? 0)) * 4099 + col - railStart;
      const seed = cellNoise(address, openerGrid ? 12 : 73);
      if (seed < 0.16) ambient.push({ index, phase: seed * 31, density: cellNoise(address, 81) });
    }
  }

  function setChapter(nextFile, nextSection) {
    if (!longform || (file === nextFile && currentSection === nextSection)) return;
    if (currentSection && nextSection) {
      const relation = currentSection.compareDocumentPosition(nextSection);
      direction = relation & Node.DOCUMENT_POSITION_PRECEDING ? 'reverse' : 'forward';
    }
    currentSection = nextSection;
    file = nextFile;
    hovered = focused = undefined;
    choiceDirty = true;
    openerDirty = Boolean(opening);
    invalidate();
  }

  function syncChapter(detail) {
    if (!longform) return;
    const nextFile = detail?.file ?? main.dataset.activePage ?? '';
    const section = typeof detail?.section === 'string' ? document.getElementById(detail.section) : detail?.section;
    const nextSection = section instanceof Element && main.contains(section) && section.matches('.story-screen')
      ? section : screens.find(node => node.dataset.scenePage === nextFile) || screens[0];
    if (nextSection) setChapter(nextSection.dataset.scenePage, nextSection);
  }

  function reserve(rect, margin, mask = quiet, x = originX - pitchX / 2, y = originY - pitchY / 2) {
    if (!rect.width || !rect.height || rect.right + margin < x || rect.left - margin >= x + columns * pitchX
      || rect.bottom + margin < y || rect.top - margin >= y + rows * pitchY) return;
    const left = clamp(Math.floor((rect.left - x - margin) / pitchX), 0, columns - 1);
    const right = clamp(Math.floor((rect.right - x + margin) / pitchX), 0, columns - 1);
    const top = clamp(Math.floor((rect.top - y - margin) / pitchY), 0, rows - 1);
    const bottom = clamp(Math.floor((rect.bottom - y + margin) / pitchY), 0, rows - 1);
    for (let row = top; row <= bottom; row++) mask.fill(1, row * columns + left, row * columns + right + 1);
  }

  function collectReadingBlocks() {
    if (longform) return [...main.querySelectorAll('.story-intro, .story-content, .lab-workbench, .lab-location, [data-scene-quiet]')];
    const body = main.querySelector('.reading-body');
    const blocks = [...main.querySelectorAll('.topic-lead, [data-scene-quiet]')];
    if (paper) {
      blocks.push(...paper.querySelectorAll(':scope > .ed-prose, :scope > .ed-index'));
      blocks.push(...[...body.children].filter(node => node !== paper));
    } else if (body) blocks.push(body);
    else blocks.push(...main.querySelectorAll(READING));
    return blocks;
  }

  function chapterAnchor(section, stage, blocks, headerHeight, gutter) {
    if (anchors.has(section)) return anchors.get(section);
    const slot = section.querySelector('[data-scene-art]')?.getBoundingClientRect();
    const fit = slot?.width && slot.height;
    const mask = new Uint8Array(quiet.length);
    for (const { node, rect } of blocks) {
      if (!section.contains(node)) continue;
      reserve({ left: rect.left, right: rect.right, width: rect.width, height: rect.height,
        top: rect.top - stage.top, bottom: rect.bottom - stage.top }, gutter, mask, 0, 0);
    }
    const bounds = { left: pitchX, right: width - pitchX, top: pitchY,
      bottom: Math.min(stage.height, height - headerHeight) - pitchY };
    const preferred = {
      x: fit ? slot.left + slot.width / 2 : width * (mobile ? 0.5 : 0.65),
      y: fit ? slot.top - stage.top + slot.height / 2 : bounds.bottom * 0.40,
      width: Math.min(width * (mobile ? 0.88 : 0.72), fit ? slot.width : width),
      height: Math.min(height * (mobile ? 0.38 : 0.54), fit ? slot.height : height),
    };
    const anchor = findArtBox(mask, columns, rows, pitchX, pitchY, bounds, preferred, mobile);
    anchors.set(section, anchor);
    return anchor;
  }

  function readArticleMargin(headerBottom, gutter) {
    if (!prose || !readingStops.length) return null;
    const paperBox = paper.getBoundingClientRect();
    const proseBox = prose.getBoundingClientRect();
    const left = Math.max(paperBox.left, proseBox.right + gutter);
    const right = Math.min(width, paperBox.right);
    const first = Math.ceil((left + pitchX / 2 - originX) / pitchX);
    const last = Math.floor((right - pitchX / 2 - originX) / pitchX);
    const count = Math.min(8, last - first + 1);
    const start = Math.max(headerBottom + pitchY * 2, height * 0.23);
    const firstRow = Math.ceil((start - originY) / pitchY);
    const gap = Math.max(2, Math.floor(height * 0.42 / pitchY / readingStops.length));
    const lastRow = firstRow + (readingStops.length - 1) * gap;
    if (count < 4 || paperBox.bottom <= start || paperBox.top >= originY + lastRow * pitchY) return null;

    const readingLine = Math.max(headerBottom + 44, height * 0.27);
    let active = -1;
    for (const [index, heading] of readingStops.entries()) {
      if (heading.getBoundingClientRect().top > readingLine) break;
      active = index;
    }
    return { col: Math.floor((first + last + 1 - count) / 2), count, firstRow, lastRow, gap, active,
      top: paperBox.top, bottom: paperBox.bottom };
  }

  function drawArticleMargin(draw) {
    if (!articleMargin) return;
    const { col, count, firstRow, lastRow, gap, active, top, bottom } = articleMargin;
    const write = (column, row, glyph, alpha) => {
      if (row < 0 || row >= rows || quiet[row * columns + column]) return;
      const y = originY + row * pitchY;
      const envelope = clamp((y - top) / (3 * pitchY)) * clamp((bottom - y) / (3 * pitchY));
      if (envelope) draw(originX + column * pitchX, y, glyph, envelope * alpha);
    };
    ctx.fillStyle = palette.margin;
    for (let row = firstRow - 1; row <= lastRow + 1; row++) {
      const station = (row - firstRow) % gap === 0;
      const index = (row - firstRow) / gap;
      write(col, row, station ? '+' : ':', station ? 0.58 : 0.33);
      if (!station) continue;
      const past = index < active;
      if (index === active) ctx.fillStyle = palette.accent;
      for (let offset = 1; offset < count; offset++) {
        const edge = offset === count - 1;
        write(col + offset, row, edge ? (index === active ? '#' : '+') : index === active ? '=' : '-',
          index === active ? 0.82 : past ? 0.43 : 0.30);
      }
      ctx.fillStyle = palette.margin;
    }
  }

  function readLayout() {
    quiet.fill(0);
    readingBlocks ??= collectReadingBlocks();
    const gutter = mobile ? 4 : 10;
    const blocks = readingBlocks.map(node => ({ node, rect: node.getBoundingClientRect() }));
    relayBlockRects = relayTarget ? blocks.map(({ rect }) => rect) : [];
    for (const { rect } of blocks) reserve(rect, gutter);
    let headerHeight = 0;
    let headerBottom = 0;
    for (const node of document.querySelectorAll(CHROME)) {
      const rect = node.getBoundingClientRect();
      reserve(rect, gutter);
      if (relayTarget) relayBlockRects.push(rect);
      if (node.matches('[data-site-header], .site-header, .mast')) {
        headerHeight = Math.max(headerHeight, rect.height);
        if (rect.bottom > 0 && rect.top < height) headerBottom = Math.max(headerBottom, rect.bottom);
      }
    }
    if (openingBox?.bottom > 0) {
      reserve({ left: 0, top: 0, right: width, bottom: openingBox.bottom, width, height: openingBox.bottom }, 0);
    }
    registerAmbient();
    freeAmbient = ambient.filter(({ index }) => !quiet[index]);
    articleMargin = readArticleMargin(headerBottom, gutter);
    if (articleMargin) {
      const { col, count, firstRow, lastRow, active } = articleMargin;
      canvas.dataset.sceneArticleRail = [originX + col * pitchX, originY + (firstRow - 1) * pitchY,
        count * pitchX, (lastRow - firstRow + 3) * pitchY].map(Math.round).join(',');
      canvas.dataset.sceneArticleChapter = readingStops[active]?.id || 'lead';
    } else {
      delete canvas.dataset.sceneArticleRail;
      delete canvas.dataset.sceneArticleChapter;
    }

    const section = currentSection;
    cta = primaryControl(section);
    ctaBox = cta?.getBoundingClientRect();
    const stage = (longform ? section : section.querySelector('.topic-hero') || section).getBoundingClientRect();
    // Choose in chapter coordinates once per viewport size. The live mask still tracks disclosures and sticky chrome.
    const anchor = longform && file === 'about.html' ? null : chapterAnchor(section, stage, blocks, headerHeight, gutter);
    artBox = projectArtBox(anchor, stage.top);
    artVisible = Boolean(artBox && artBox.y + artBox.height / 2 > 0 && artBox.y - artBox.height / 2 < height);
    canvas.dataset.sceneArt = artVisible ? 'placed' : 'hidden';
    if (artBox) {
      canvas.dataset.sceneArtBox = [artBox.x - artBox.width / 2, artBox.y - artBox.height / 2, artBox.width, artBox.height]
        .map(Math.round).join(',');
    } else delete canvas.dataset.sceneArtBox;
    signalRows = [];
    for (const screen of screens) {
      const box = screen === section ? stage : screen.getBoundingClientRect();
      if (box.bottom < 0 || box.top > height) continue;
      signalRows.push({ y: box.top + 2 * pitchY, kind: 'datum' });
      signalRows.push({ y: box.bottom - 3 * pitchY, kind: 'comb' });
    }
    if (openingBox && openingBox.bottom > -height * 0.34) {
      signalRows.unshift({ y: openingBox.bottom + 2 * pitchY, kind: 'comb' });
    }
    milestones = section.querySelectorAll('[data-meeting-axis] [data-stage-link], [data-timeline] [data-stage], .story-meeting-path a[href]').length;
    dirty = false;
  }

  function plot(stroke, cx, cy, rx, ry) {
    const { points, weight, part, glyph } = stroke;
    const symbol = glyph ? SIGNAL_GLYPHS.indexOf(glyph) + 1 : 0;
    for (let k = 1; k < points.length; k++) {
      const [x0, y0] = points[k - 1], [x1, y1] = points[k];
      const dx = (x1 - x0) * rx, dy = (y1 - y0) * ry;
      const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx / pitchX), Math.abs(dy / pitchY)) * 1.35));
      for (let j = 0; j <= steps; j++) {
        const x = Math.round((cx + x0 * rx + dx * j / steps - originX) / pitchX);
        const y = Math.round((cy + y0 * ry + dy * j / steps - originY) / pitchY);
        if (x < 0 || x >= columns || y < 0 || y >= rows) continue;
        const i = y * columns + x;
        if (weight < weights[i]) continue;
        weights[i] = weight;
        parts[i] = part;
        glyphs[i] = symbol;
      }
    }
  }

  function motifChanged(key, motif, now) {
    if (key === artKey) return;
    const nextDirection = artKey?.startsWith(`${file}/`) ? 'selection' : direction;
    if (!reduced && artKey) {
      rewrite = { start: now, ink: writtenInk.slice(), glyphs: writtenGlyphs.slice(), accent: writtenAccent.slice(),
        row: paintedRow, direction: nextDirection };
      canvas.dataset.sceneRewrite = nextDirection;
    }
    artKey = key;
    canvas.dataset.scenePage = file;
    canvas.dataset.scene = sceneKind(file);
    canvas.dataset.sceneMotif = motif;
  }

  function paint(now) {
    if (dirty) readLayout();
    if (choiceDirty) {
      const preview = file === 'research.html' || reduced ? null : hovered || focused;
      const known = currentSection.querySelectorAll(OPTION);
      const semantic = [...known].find(node => node.matches(SELECTED) && !node.closest('[hidden], [inert]'));
      chosen = readChoice(preview, currentSection) || readChoice(semantic, currentSection)
        || readChoice(committed.get(currentSection), currentSection) || readChoice(activeChoice(currentSection), currentSection);
      if (chosen) canvas.dataset.sceneSelection = chosen.key;
      else delete canvas.dataset.sceneSelection;
      choiceDirty = false;
    }
    const kind = sceneKind(file);
    const motif = longform && file === 'about.html' ? 'registration' : kind === 'directions' ? researchMotif(chosen) : kind;
    motifChanged(`${file}/${motif}`, motif, now);
    const target = chosen?.count > 1 ? chosen.index / (chosen.count - 1) : 0;
    position = reduced || Math.abs(position - target) < 0.006 ? target : mix(position, target, 0.24);
    const phase = reduced ? 0 : time * 0.44;
    ctx.clearRect(0, 0, width, height);
    const contact = !reduced && (pointer || pulse);
    const strength = !contact ? 0 : pointer ? 1 : 1 - drawProgress((now - pulse.at) / 620);
    if (!strength) pulse = undefined;
    const radius = mobile ? 49 : 88;
    const influence = (x, y) => !strength ? 0
      : strength * Math.max(0, 1 - ((x - contact.x) ** 2 + (y - contact.y) ** 2) / radius ** 2) ** 1.8;
    const draw = (x, y, glyph, alpha) => { ctx.globalAlpha = alpha; ctx.fillText(glyph, x, y); };

    ctx.fillStyle = palette.ambient;
    for (const { index, phase: seed, density } of freeAmbient) {
      const x = originX + (index % columns) * pitchX, y = originY + Math.floor(index / columns) * pitchY;
      const wave = 0.5 + 0.5 * Math.sin(0.024 * x - 0.014 * (worldRow + Math.floor(index / columns)) * pitchY + seed * 0.42 - phase * 2.1);
      const energy = influence(x, y);
      draw(x, y, density + wave * 0.24 > 0.96 ? ':' : '.', 0.08 + 0.19 * wave + energy * 0.31);
    }
    if (strength) {
      ctx.fillStyle = palette.accent;
      const x0 = clamp(Math.floor((contact.x - radius) / pitchX), 0, columns - 1);
      const x1 = clamp(Math.ceil((contact.x + radius) / pitchX), 0, columns - 1);
      const y0 = clamp(Math.floor((contact.y - radius) / pitchY), 0, rows - 1);
      const y1 = clamp(Math.ceil((contact.y + radius) / pitchY), 0, rows - 1);
      for (let row = y0; row <= y1; row++) for (let col = x0; col <= x1; col++) {
        if (quiet[row * columns + col]) continue;
        const x = originX + col * pitchX, y = originY + row * pitchY;
        const energy = influence(x, y) * (0.66 + 0.34 * Math.sin(phase * 7 + cellNoise(row * columns + col, 91) * TAU));
        if (energy > 0.13) draw(x, y, energy > 0.52 ? '-' : '.', energy * 0.32);
      }
    }

    ctx.fillStyle = palette.signal;
    const railStart = openerGrid ? Math.round((openerGrid.x - originX) / pitchX) : 3;
    const railStep = openerGrid ? openerGrid.columns / openerGrid.rails : Math.max(4, Math.floor(columns / 12));
    let signals = 0;
    for (const signal of signalRows) {
      const row = Math.round((signal.y - originY) / pitchY);
      if (row < 0 || row >= rows) continue;
      const y = originY + row * pitchY;
      const opacity = drawProgress(clamp(Math.min(y, height - y) / (3 * pitchY)));
      if (!opacity) continue;
      for (let col = 0; col < columns; col++) {
        const index = row * columns + col;
        if (quiet[index]) continue;
        const rail = ((col - railStart) % railStep + railStep) % railStep;
        const guide = rail === 0;
        const margin = Math.min(col, columns - col - 1);
        const edge = margin < railStart + (mobile ? 4 : 6);
        const x = originX + col * pitchX;
        if (guide || (edge && col % 2 === 0)) {
          draw(x, y, guide ? '+' : '.', (guide ? 0.50 : 0.28) * opacity);
          signals++;
        }
        if (signal.kind === 'comb' && edge && rail <= 2 && row + 1 < rows && !quiet[index + columns]) {
          draw(x, y + pitchY, guide ? ':' : '-', 0.32 * opacity);
          signals++;
        }
        if (signal.kind === 'datum' && edge && margin % 4 === 1 && row > 0 && !quiet[index - columns]) {
          draw(x, y - pitchY, ':', 0.31 * opacity);
          signals++;
        }
      }
    }
    canvas.dataset.sceneSignals = String(signals);
    drawArticleMargin(draw);
    if (relayTarget && openerGrid && file === 'about.html') {
      const padding = mobile ? 3 : 7;
      drawEntryRelay(ctx, canvas, openerGrid, openingBox, relayTarget.getBoundingClientRect(), {
        side: 'body', reduced, ink: palette.relay,
        allow: (x, y) => !relayBlockRects.some(rect => rect.width && rect.height && x > rect.left - padding
          && x < rect.right + padding && y > rect.top - padding && y < rect.bottom + padding),
      });
    } else {
      delete canvas.dataset.entryRelay;
      delete canvas.dataset.entryRelayHead;
    }

    if (!artVisible && !rewrite) {
      writtenInk.fill(0);
      ctx.globalAlpha = 1;
      paintedRow = worldRow;
      return;
    }
    weights.fill(0);
    if (artVisible) {
      const { x, y, width: spanX, height: spanY } = artBox;
      for (const stroke of sceneStrokes(motif, phase, position, milestones)) {
        plot(stroke, x, y, spanX * 0.44, spanY * 0.45);
      }
    }
    const progress = rewrite ? clamp((now - rewrite.start) / REWRITE_MS) : 1;
    const spread = Math.max(3, ((chosen?.count || 1) - 1) * 1.45);
    if (progress === 1 && rewrite) {
      rewrite = undefined;
      delete canvas.dataset.sceneRewrite;
    }
    const primary = !reduced && ctaBox && (hovered === cta || focused === cta);
    for (let index = 0; index < weights.length; index++) {
      const weight = weights[index];
      const priorIndex = rewrite ? index + (worldRow - rewrite.row) * columns : -1;
      const old = rewrite?.ink[priorIndex] || 0;
      writtenInk[index] = 0;
      if (quiet[index] || (!weight && !old)) continue;
      const x = originX + (index % columns) * pitchX, y = originY + Math.floor(index / columns) * pitchY;
      const wave = 0.5 + 0.5 * Math.sin(phase * 2.2 + x * 0.017 + y * 0.011);
      const highlight = chosen && parts[index] >= 0 ? Math.max(0, 1 - Math.abs(parts[index] - position) * spread) : 0;
      const hit = influence(x, y);
      const nearCTA = primary && Math.abs(x - (ctaBox.left + ctaBox.width / 2)) < radius * 1.65
        && Math.abs(y - (ctaBox.top + ctaBox.height / 2)) < radius * 1.65;
      const level = clamp(weight * 0.63 + wave * 0.15 + highlight * 0.12 + hit * 0.15);
      let ink = weight ? Math.min(palette.artLimit, 0.14 + 0.20 * wave + 0.29 * weight + 0.16 * highlight + hit * 0.10) : 0;
      let symbol = weight && glyphs[index] ? GLYPHS.length + glyphs[index] - 1 : Math.floor(level * (GLYPHS.length - 1));
      let accent = highlight > 0.30 || nearCTA;
      if (rewrite) {
        const vertical = rewrite.direction === 'reverse' ? 1 - y / height : y / height;
        const seed = cellNoise(index + worldRow * columns, 113);
        const rank = rewrite.direction === 'selection' ? seed : 0.43 * clamp(vertical) + 0.57 * seed;
        const step = drawProgress(clamp((progress - rank * 0.35) / 0.65));
        ink = rewriteInk(old, ink, progress, rank);
        if (old && (!weight || step < 0.5)) {
          symbol = rewrite.glyphs[priorIndex];
          accent = rewrite.accent[priorIndex];
        }
      }
      writtenInk[index] = ink;
      writtenGlyphs[index] = symbol;
      writtenAccent[index] = accent ? 1 : 0;
      if (ink < 0.007) continue;
      ctx.fillStyle = accent ? palette.accent : palette.art;
      const glyph = symbol < GLYPHS.length ? GLYPHS[symbol] : SIGNAL_GLYPHS[symbol - GLYPHS.length];
      draw(x, y, glyph, ink);
    }
    ctx.globalAlpha = 1;
    paintedRow = worldRow;
  }

  function visibility() {
    if (openerDirty && opening) {
      openingBox = openingCanvas?.getBoundingClientRect() || opening.getBoundingClientRect();
      openingVisible = openingBox.bottom >= height - 1;
      if (openerGrid) {
        const registration = sceneRegister(openerGrid, openingBox.top);
        originY = registration.y;
        worldRow = registration.row;
        canvas.dataset.sceneBaseline = registration.baseline.toFixed(2);
      }
      openerDirty = false;
    }
    const show = Boolean(currentSection && !openingVisible && (pageVisible || openingBox?.bottom > 0));
    if (show !== frameVisible) {
      frameVisible = show;
      canvas.dataset.sceneVisible = String(show);
      previous = undefined;
      if (!show) {
        ctx.clearRect(0, 0, width || 0, height || 0);
        writtenInk?.fill(0);
        artKey = '';
        canvas.dataset.sceneArt = 'hidden';
        delete canvas.dataset.sceneArtBox;
        delete canvas.dataset.sceneSignals;
        delete canvas.dataset.entryRelay;
        delete canvas.dataset.entryRelayHead;
        rewrite = undefined;
        delete canvas.dataset.sceneRewrite;
      }
    }
    return show;
  }

  function tick(now) {
    frame = 0;
    if (document.hidden || !visibility() || !width || !height || !palette) return;
    if (!reduced && previous !== undefined) time += Math.min(0.06, (now - previous) / 1000);
    previous = now;
    const interval = rewrite || pulse ? 32 : artBox ? 46 : 76;
    if (dirty || choiceDirty || reduced || now - lastPaint >= interval) {
      lastPaint = now;
      paint(now);
    }
    if (!reduced) frame = requestAnimationFrame(tick);
  }

  function invalidate() {
    dirty = true;
    if (!frame && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function controlAt(target) {
    const control = target.closest?.(OPTION);
    return control && currentSection?.contains(control) ? control : cta?.contains(target) ? cta : null;
  }
  function confirm(target) {
    if (!currentSection) return;
    const control = controlAt(target);
    if (readChoice(control, currentSection)) committed.set(currentSection, control);
    choiceDirty = true;
    invalidate();
  }
  function hoverAt(target) {
    const pick = target?.closest?.('[data-pick-object]')?.querySelector('.object-control');
    hovered = target ? controlAt(target) || (pick && currentSection?.contains(pick) ? pick : null) : null;
    choiceDirty = true;
  }
  main.addEventListener('pointerover', event => { if (event.pointerType !== 'touch') hoverAt(event.target); });
  main.addEventListener('pointerout', event => hoverAt(event.relatedTarget));
  main.addEventListener('focusin', event => {
    focused = event.target.matches(':focus-visible') ? controlAt(event.target) : null;
    choiceDirty = true;
  });
  main.addEventListener('focusout', () => { focused = null; choiceDirty = true; });
  main.addEventListener('click', event => confirm(event.target));
  main.addEventListener('input', event => confirm(event.target));
  main.addEventListener('change', event => confirm(event.target));
  addEventListener('pointermove', event => {
    if (!reduced && event.pointerType !== 'touch') pointer = { x: event.clientX, y: event.clientY };
  }, { passive: true });
  addEventListener('pointerdown', event => {
    if (!reduced && event.pointerType === 'touch') {
      pointer = undefined;
      pulse = { x: event.clientX, y: event.clientY, at: performance.now() };
    }
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => { pointer = undefined; });
  addEventListener('pointercancel', () => { pointer = pulse = undefined; });
  addEventListener('scroll', () => { openerDirty = Boolean(opening); invalidate(); }, { capture: true, passive: true });
  document.addEventListener('toggle', invalidate, true);
  document.addEventListener('load', invalidate, true);
  document.fonts?.ready.then(() => { anchors = new WeakMap(); invalidate(); });
  addEventListener('resize', resize, { passive: true });
  addEventListener('blur', () => { pointer = pulse = hovered = undefined; choiceDirty = true; });
  function syncChoice() {
    choiceDirty = true;
    invalidate();
  }
  for (const event of ['popstate', 'hashchange', 'pageshow']) addEventListener(event, () => {
    if (currentSection) committed.delete(currentSection);
    syncChapter();
    syncChoice();
  });
  main.addEventListener('objectselection', syncChoice);
  if (longform) addEventListener('alethic:chapter', event => syncChapter(event.detail), true);
  const observer = new IntersectionObserver(([entry]) => {
    pageVisible = entry.isIntersecting;
    invalidate();
  });
  observer.observe(main);
  const layoutResize = new ResizeObserver(invalidate);
  for (const node of [main, ...document.querySelectorAll('[data-site-header], body > footer')]) layoutResize.observe(node);
  new MutationObserver(records => {
    if (records.some(record => record.attributeName === 'data-active-page')) syncChapter();
    if (records.some(record => record.type === 'childList' || record.attributeName === 'data-scene-quiet')) readingBlocks = undefined;
    syncChoice();
  }).observe(main, { subtree: true, childList: true, attributes: true,
    attributeFilter: ['data-active-page', 'hidden', 'open', 'aria-selected', 'aria-pressed', 'aria-current', 'data-active',
      'data-selected', 'checked', 'disabled', 'data-primary', 'data-scene-quiet'] });
  new MutationObserver(paletteChange).observe(document.documentElement, { attributeFilter: ['data-theme'] });
  document.addEventListener('visibilitychange', () => { previous = undefined; pointer = pulse = undefined; invalidate(); });
  motionChange(() => {
    reduced = still();
    previous = undefined;
    pointer = pulse = undefined;
    if (reduced) {
      rewrite = undefined;
      delete canvas.dataset.sceneRewrite;
    }
    syncChoice();
  });
  syncChapter();
  paletteChange();
  resize();
}
