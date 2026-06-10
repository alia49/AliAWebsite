// Deterministic pixel avatars. A seed (presence hash, chat name, …) is hashed
// into a 5×5 left/right-mirrored grid. Drawn locally; no third-party service.

export function hash32(input) {
  let h = 0x811c9dc5;
  const str = String(input);
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map();

/** Returns { cells: boolean[5][5], tone: 0..3 } — tone picks a grey from the ramp. */
export function avatarFor(seed, size = 5) {
  const key = `${seed}|${size}`;
  if (cache.has(key)) return cache.get(key);
  const rand = mulberry32(hash32(seed));
  const half = Math.ceil(size / 2);
  const cells = [];
  let filled = 0;
  for (let y = 0; y < size; y += 1) {
    const row = new Array(size).fill(false);
    for (let x = 0; x < half; x += 1) {
      const on = rand() > 0.48;
      row[x] = on;
      row[size - 1 - x] = on;
      if (on) filled += 1;
    }
    cells.push(row);
  }
  // never render an empty face
  if (filled < 3) {
    cells[1][1] = true;
    cells[1][size - 2] = true;
    cells[3][half - 1] = true;
  }
  const result = { cells, tone: Math.floor(rand() * 4) };
  if (cache.size > 500) cache.clear();
  cache.set(key, result);
  return result;
}

// Foreground tones as token names (text-g-* / canvas lookups).
export const AVATAR_TONES = ['g500', 'g600', 'g700', 'ink'];
