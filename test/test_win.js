// Win-path mechanics: claim the eastern sacred island, push a corridor into
// contested ground near Poseidon's corner, place a Bolt Battery in range,
// and verify his Great Temple falls. (Mechanics check, not balance.)
'use strict';
const { loadSandbox } = require('./harness');
const G = loadSandbox(['01_config.js', '02_util.js', '03_wind.js', '04_mapgen.js',
  '05_state.js', '06_network.js', '07_support.js', '08_economy.js', '09_haulers.js',
  '10_structures.js', '11_combat.js', '12_waves.js', '13_ai.js', '14_fog.js', '15_powers.js']);

function die(msg) { console.error('FAIL', msg); process.exit(1); }

const state = G.newGameState('wndwrd1');
G.recalcSupport(state, 'A');
G.recalcSupport(state, 'P');
G.refreshInfluence(state);
G.spawnPriest(state, 'A');
G.spawnPriest(state, 'P');
state.res.A.supply = 500;

const step = (secs) => {
  const dt = 0.1;
  for (let t = 0; t < secs; t += dt) {
    state.time += dt;
    G.economyTick(state, dt);
    G.structuresTick(state, dt);
    G.updateTransit(state, dt);
    G.combatTick(state, dt);
    G.fogTick(state, dt);
    G.collapseTick(state);
  }
};

// route east then claim the supply island (teleporting the priest is fine
// here: we are testing claim + influence + firing, not transit)
const claim = (isl) => {
  const p = state.priests.A;
  p.state = 'idle';
  p.pos = [isl.cells[0][0], isl.cells[0][1]];
  p.islandId = isl.id;
  const plotIdx = isl.plots.findIndex(pl => !pl.structure);
  const st = G.buildStructure(state, 'A', 'temple', {
    site: 'plot', islandId: isl.id, plotIdx, cell: [isl.plots[plotIdx].x, isl.plots[plotIdx].z]
  });
  if (!st) die('temple refused on ' + isl.role + ': ' + G.whyNotBuild(state, 'A', 'temple', { site: 'plot', islandId: isl.id, plotIdx, cell: [isl.plots[plotIdx].x, isl.plots[plotIdx].z] }));
  step(11);
  if (isl.owner !== 'A') die('claim failed on ' + isl.role);
};

// lay a straight corridor between two cells (legality-checked)
const lay = (from, to) => {
  let cur = from.slice();
  let guard = 80;
  while ((cur[0] !== to[0] || cur[1] !== to[1]) && guard-- > 0) {
    const dx = Math.sign(to[0] - cur[0]), dz = Math.sign(to[1] - cur[1]);
    const next = dx !== 0 ? [cur[0] + dx, cur[1]] : [cur[0], cur[1] + dz];
    if (!state.segments.has('A:' + G.segKey(cur[0], cur[1], next[0], next[1]))) {
      if (!G.placementLegal(state, 'A', [[cur, next]])) return false;
      const seg = G.makeSegment(state, 'A', cur, next);
      state.segments.set('A:' + seg.key, seg);
    }
    cur = next;
  }
  return true;
};

// claim islands toward Poseidon's corner as the leapfrog allows: any island
// whose plot lies inside current influence is claimable — then it must be
// CONNECTED home before its temple projects influence (§14.5.5)
const gtP = state.greatTemple.P;
let progress = true;
while (progress) {
  progress = false;
  G.refreshInfluence(state);
  for (const isl of state.map.islands) {
    if (isl.role.startsWith('greatTemple') || isl.owner) continue;
    const plotIdx = isl.plots.findIndex(pl => !pl.structure);
    if (plotIdx < 0) continue;
    const cell = [isl.plots[plotIdx].x, isl.plots[plotIdx].z];
    if (!state.influence.A.has(G.cellKey(cell[0], cell[1]))) continue;
    // connect first (from the nearest owned island's temple cell), then claim
    const owned = state.map.islands.filter(i => i.owner === 'A' || i.role === 'greatTempleA');
    owned.sort((a, b) =>
      G.dist2d(a.center[0], a.center[1], isl.center[0], isl.center[1]) -
      G.dist2d(b.center[0], b.center[1], isl.center[0], isl.center[1]));
    const from = owned[0].temple ? owned[0].temple.cell : state.greatTemple.A.cell;
    if (!lay(from.slice(), cell.slice())) continue;
    G.recalcSupport(state, 'A');
    claim(isl);
    progress = true;
  }
}
G.refreshInfluence(state);
const claimed = state.map.islands.filter(i => i.owner === 'A').length;
console.log('claimed', claimed, 'islands by leapfrog');

// find a player-influenced cell within bolt range of his Great Temple
let gunCell = null;
for (const k of state.influence.A) {
  const [x, z] = G.keyCell(k);
  if (state.map.land.has(k)) continue;
  if (G.dist2d(x, z, gtP.cell[0], gtP.cell[1]) <= G.CONFIG.Structures.BOLT_DIR.RANGE - 0.5) { gunCell = [x, z]; break; }
}
if (!gunCell) die('no influenced water cell within bolt range of his temple — territorial approach impossible');

// route a corridor to that cell: lay segments straight from the nearest
// claimed island's temple (legality is what we are testing)
const nearIsl = state.map.islands
  .filter(i => i.owner === 'A')
  .sort((a, b) =>
    G.dist2d(a.center[0], a.center[1], gunCell[0], gunCell[1]) -
    G.dist2d(b.center[0], b.center[1], gunCell[0], gunCell[1]))[0];
let cur = nearIsl.temple.cell.slice();
let guard = 60;
while ((cur[0] !== gunCell[0] || cur[1] !== gunCell[1]) && guard-- > 0) {
  const dx = Math.sign(gunCell[0] - cur[0]), dz = Math.sign(gunCell[1] - cur[1]);
  const next = dx !== 0 ? [cur[0] + dx, cur[1]] : [cur[0], cur[1] + dz];
  const segs = [[cur, next]];
  if (!G.placementLegal(state, 'A', segs)) die('corridor blocked at ' + next + ' (influence gate?)');
  const seg = G.makeSegment(state, 'A', cur, next);
  state.segments.set('A:' + seg.key, seg);
  cur = next;
}
G.recalcSupport(state, 'A');

const st = G.buildStructure(state, 'A', 'bolt', { site: 'endpoint', cell: gunCell });
if (!st) die('bolt refused at range: ' + G.whyNotBuild(state, 'A', 'bolt', { site: 'endpoint', cell: gunCell }));
step(4);   // build time
if (!G.structureSupported(state, st)) die('bolt not supported');

const hpBefore = state.greatTemple.P.hp;
step(30);
if (state.greatTemple.P.hp >= hpBefore) die('bolt never damaged his Great Temple (hp ' + state.greatTemple.P.hp + ')');
if (state.greatTemple.P.hp > 0) {
  step(30);
}
if (state.greatTemple.P.hp > 0) die('Great Temple should have fallen, hp=' + state.greatTemple.P.hp);
console.log('win path: territorial approach, ranged kill, temple falls — ok');
