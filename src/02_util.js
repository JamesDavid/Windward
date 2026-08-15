// ================================================================
// UTIL — seeded PRNG, seed strings, math and grid helpers.
// Everything here is deterministic and DOM-free.
// ================================================================

// mulberry32 — the only random source in the game. Never Math.random().
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a string hash -> 32-bit int, for turning seed strings into PRNG state.
function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// A fresh seed string: current time reduced to base-36 (short, shareable).
function makeSeedString() {
  return (Date.now() % 2176782336).toString(36).padStart(6, '0');
}

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist2d(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.hypot(dx, dz); }

// Grid helpers. Cells are integer (x, z) with x in [0,W), z in [0,H).
function cellKey(x, z) { return x + ',' + z; }
function keyCell(k) { const i = k.indexOf(','); return [+k.slice(0, i), +k.slice(i + 1)]; }
function inBounds(x, z) { return x >= 0 && x < CONFIG.Grid.WIDTH && z >= 0 && z < CONFIG.Grid.HEIGHT; }
const DIRS4 = [[0, -1], [1, 0], [0, 1], [-1, 0]];

// Undirected segment key between two adjacent cells, order-independent.
function segKey(ax, az, bx, bz) {
  return (ax < bx || (ax === bx && az < bz))
    ? ax + ',' + az + '|' + bx + ',' + bz
    : bx + ',' + bz + '|' + ax + ',' + az;
}

// BFS shortest path length over the grid between two sets of cells.
// passable(x,z) decides which cells may be entered. Returns -1 if unreachable.
function bfsDistance(fromCells, toSet, passable) {
  const seen = new Set();
  let frontier = [];
  for (const [x, z] of fromCells) {
    const k = cellKey(x, z);
    if (!seen.has(k)) { seen.add(k); frontier.push([x, z]); }
  }
  let d = 0;
  while (frontier.length) {
    for (const [x, z] of frontier) if (toSet.has(cellKey(x, z))) return d;
    const next = [];
    for (const [x, z] of frontier) {
      for (const [dx, dz] of DIRS4) {
        const nx = x + dx, nz = z + dz, k = cellKey(nx, nz);
        if (!inBounds(nx, nz) || seen.has(k)) continue;
        if (passable && !passable(nx, nz)) continue;
        seen.add(k); next.push([nx, nz]);
      }
    }
    frontier = next; d++;
  }
  return -1;
}

// BFS that also returns one shortest path (list of [x,z]), or null.
function bfsPath(fromCells, toSet, passable) {
  const prev = new Map();
  let frontier = [];
  for (const [x, z] of fromCells) {
    const k = cellKey(x, z);
    if (!prev.has(k)) { prev.set(k, null); frontier.push([x, z]); }
  }
  while (frontier.length) {
    const next = [];
    for (const [x, z] of frontier) {
      if (toSet.has(cellKey(x, z))) {
        const path = [];
        let k = cellKey(x, z);
        while (k !== null) { path.push(keyCell(k)); k = prev.get(k); }
        path.reverse();
        return path;
      }
      for (const [dx, dz] of DIRS4) {
        const nx = x + dx, nz = z + dz, k = cellKey(nx, nz);
        if (!inBounds(nx, nz) || prev.has(k)) continue;
        if (passable && !passable(nx, nz)) continue;
        prev.set(k, cellKey(x, z)); next.push([nx, nz]);
      }
    }
    frontier = next;
  }
  return null;
}

// Tiny event bus so systems can announce without knowing about UI/audio.
const Events = {
  handlers: {},
  on(name, fn) { (this.handlers[name] = this.handlers[name] || []).push(fn); },
  emit(name, payload) {
    const hs = this.handlers[name];
    if (hs) for (const fn of hs) fn(payload);
  },
  clear() { this.handlers = {}; }
};
