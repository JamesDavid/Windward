// Network + support/collapse behavior tests (headless).
'use strict';
const { loadSandbox } = require('./harness');
const G = loadSandbox(['01_config.js', '02_util.js', '03_wind.js', '04_mapgen.js',
  '05_state.js', '06_network.js', '07_support.js']);

function die(msg) { console.error('FAIL', msg); process.exit(1); }

const state = G.newGameState('abc123');
G.recalcSupport(state, 'A');
G.recalcSupport(state, 'P');

// influence exists and covers the home corner
if (state.influence.A.size < 100) die('influence too small: ' + state.influence.A.size);

// sockets: at least the Great Temple
let sockets = G.getSockets(state, 'A');
if (!sockets.some(s => s.kind === 'greatTemple')) die('no great temple socket');

// grow a LINEAR chain away from the Great Temple (prefer route-end sockets,
// pick the placement whose far end maximises distance from home)
state.res.A.supply = 999;
const gtCell = state.greatTemple.A.cell;
const farOf = (segs) => Math.max(...segs.flatMap(([a, b]) => [a, b]).map(c =>
  Math.abs(c[0] - gtCell[0]) + Math.abs(c[1] - gtCell[1])));
for (let i = 0; i < 6; i++) {
  sockets = G.getSockets(state, 'A');
  const sock = sockets.find(s => s.kind === 'end') || sockets.find(s => s.kind === 'greatTemple');
  if (!sock) die('no socket at step ' + i);
  const placements = G.legalPlacements(state, 'A', 'SHORT', sock);
  if (!placements.length) die('no legal placement at step ' + i);
  placements.sort((a, b) => farOf(b.segs) - farOf(a.segs));
  if (!G.placePiece(state, 'A', 'SHORT', placements[0].segs)) die('placePiece refused');
}
const chain = [...state.segments.values()].filter(s => s.owner === 'A');
if (chain.length !== 12) die('expected 12 segments, got ' + chain.length);
if (!chain.every(s => s.supportState === 'SUPPORTED')) die('all should be supported');
console.log('ok placement and support (12-segment chain)');

// sever off-island: destroy the first fully-off-island segment; everything
// beyond it (not island-conducted) should fray
const offIsland = chain.filter(s => !G.islandAt(state, s.a[0], s.a[1]) && !G.islandAt(state, s.b[0], s.b[1]));
if (offIsland.length < 4) die('chain did not leave the island: ' + offIsland.length);
offIsland.sort((a, b) =>
  (Math.abs(a.a[0] - gtCell[0]) + Math.abs(a.a[1] - gtCell[1])) -
  (Math.abs(b.a[0] - gtCell[0]) + Math.abs(b.a[1] - gtCell[1])));
state.time = 100;
G.destroySegment(state, offIsland[0], 'test');
const frayed = [...state.segments.values()].filter(s => s.owner === 'A' && s.supportState === 'FRAYED');
if (frayed.length < 2) die('expected a frayed branch, got ' + frayed.length);
console.log('ok sever -> frayed branch of ' + frayed.length);

// collapse: one segment per interval, from the break inward, to zero
const before = [...state.segments.values()].filter(s => s.owner === 'A').length;
const expectGone = frayed.length;
let lastCount = before;
let collapsedInOrder = true;
let prevDist = -1;
G.Events.on('segmentDestroyed', ({ seg, cause }) => {
  if (cause !== 'collapse') return;
  const d = Math.min(
    Math.abs(seg.a[0] - gtCell[0]) + Math.abs(seg.a[1] - gtCell[1]),
    Math.abs(seg.b[0] - gtCell[0]) + Math.abs(seg.b[1] - gtCell[1]));
  if (d < prevDist) collapsedInOrder = false;
  prevDist = d;
});
for (let t = 100; t < 160; t += 0.5) {
  state.time = t;
  G.collapseTick(state);
}
const after = [...state.segments.values()].filter(s => s.owner === 'A').length;
if (before - after !== expectGone) die('expected ' + expectGone + ' collapsed, got ' + (before - after));
if (!collapsedInOrder) die('collapse should advance from the break inward');
console.log('ok progressive collapse, break-first order');

// reconnection cancels decay: build a fresh chain, sever mid-chain, then
// rebuild the destroyed link within the rescue window
state.time = 200;
for (let i = 0; i < 4; i++) {
  sockets = G.getSockets(state, 'A');
  const sock = sockets.find(s => s.kind === 'end') || sockets.find(s => s.kind === 'greatTemple');
  const placements = G.legalPlacements(state, 'A', 'SHORT', sock);
  placements.sort((a, b) => farOf(b.segs) - farOf(a.segs));
  if (!G.placePiece(state, 'A', 'SHORT', placements[0].segs)) die('rebuild placement refused');
}
const chain2 = [...state.segments.values()].filter(s => s.owner === 'A' &&
  !G.islandAt(state, s.a[0], s.a[1]) && !G.islandAt(state, s.b[0], s.b[1]));
chain2.sort((a, b) =>
  (Math.abs(a.a[0] - gtCell[0]) + Math.abs(a.a[1] - gtCell[1])) -
  (Math.abs(b.a[0] - gtCell[0]) + Math.abs(b.a[1] - gtCell[1])));
const cut = chain2[1];   // not the outermost, so something frays beyond it
state.time = 201;
G.destroySegment(state, cut, 'test');
const orphans = [...state.segments.values()].filter(s => s.owner === 'A' && s.supportState === 'FRAYED');
if (!orphans.length) die('cut should orphan something');
// B = supported endpoint of the cut, C = orphaned endpoint
const sup = state.supportedCells.A;
const B = sup.has(G.cellKey(cut.a[0], cut.a[1])) ? cut.a : cut.b;
const C = B === cut.a ? cut.b : cut.a;
state.time = 202;   // inside the 3 s rescue window
let reconnected = false;
for (const type of ['L', 'S', 'T', 'SHORT', 'LONG']) {
  const placements = G.legalPlacements(state, 'A', type, { cell: B, kind: 'end' });
  const hit = placements.find(p => p.segs.some(([a, b]) =>
    G.segKey(a[0], a[1], b[0], b[1]) === G.segKey(B[0], B[1], C[0], C[1])));
  if (hit) { G.placePiece(state, 'A', type, hit.segs); reconnected = true; break; }
}
if (!reconnected) die('no piece could rebuild the link');
for (const o of orphans) {
  const now = state.segments.get('A:' + o.key);
  if (!now || now.supportState !== 'SUPPORTED') die('reconnection should restore support');
  if (now.collapseAt !== null) die('decay should be cancelled');
}
console.log('ok reconnection cancels decay');

console.log('network: all checks passed');
