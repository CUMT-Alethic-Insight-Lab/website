export function fieldLayout(width, height) {
  const rails = width < 760 ? 4 : 12;
  const span = Math.min(width * 0.91, 1520);
  const columns = Math.max(rails === 4 ? 52 : 36, Math.round(span / (11 * rails)) * rails);
  const dx = span / columns;
  const dy = dx * (rails === 4 ? 1.28 : 1.48);
  const rows = Math.floor((height * 0.92) / dy);
  return { rails, columns, rows, dx, dy, x: (width - span) / 2, y: (height - rows * dy) / 2 };
}

export function cellNoise(index, salt) {
  let value = Math.imul(index + 7, 0x9e3779b1) ^ Math.imul(salt + 11, 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  return ((value ^ (value >>> 15)) >>> 0) / 4294967296;
}

export function drawProgress(value) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - t * 2);
}
