// The endgame siege against a DEFENDED Great Temple (player report: the
// only way to win felt like spamming Wind Walls). Sanctioned pattern:
// wall the site, raise the bolt behind it, keep the wall up while the
// bolt silences his defenders (armed-first targeting), then the temple.
// Must succeed at an honest Favor cost.
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
G.initAI(state);   // his Great Temple gets its two authored defenders
state.res.A.supply = 500;
state.res.A.favor = 200;

const defenders = () => state.structures.filter(s => s.owner === 'P' && s.hp > 0 && (s.dps || 0) > 0);
if (defenders().length < 2) die('expected authored defenders at his Great Temple');

let wallCasts = 0;
const step = (secs, wallCell) => {
  const dt = 0.1;
  for (let t = 0; t < secs; t += dt) {
    state.time += dt;
    G.economyTick(state, dt);
    G.structuresTick(state, dt);
    G.updateTransit(state, dt);
    G.combatTick(state, dt);
    G.fogTick(state, dt);
    G.collapseTick(state);
    // the besieger's discipline: keep the wall standing over the site
    if (wallCell && state.powers.windwallUntil - state.time < 1.0) {
      if (!G.castWindWall(state, wallCell)) die('ran out of Favor keeping the wall up');
      wallCasts++;
    }
  }
};

// claim toward his corner exactly as test_win does (mechanics scaffold)
const claim = (isl) => {
  const p = state.priests.A;
  p.state = 'idle';
  p.pos = [isl.cells[0][0], isl.cells[0][1]];
  p.islandId = isl.id;
  const plotIdx = isl.plots.findIndex(pl => !pl.structure);
  const st = G.buildStructure(state, 'A', 'temple', {
    site: 'plot', islandId: isl.id, plotIdx, cell: [isl.plots[plotIdx].x, isl.plots[plotIdx].z]
  });
  if (!st) return false;
  step(11);
  return isl.owner === 'A';
};
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
    const owned = state.map.islands.filter(i => i.owner === 'A' || i.role === 'greatTempleA');
    owned.sort((a, b) =>
      G.dist2d(a.center[0], a.center[1], isl.center[0], isl.center[1]) -
      G.dist2d(b.center[0], b.center[1], isl.center[0], isl.center[1]));
    const from = owned[0].temple ? owned[0].temple.cell : state.greatTemple.A.cell;
    if (!lay(from.slice(), cell.slice())) continue;
    G.recalcSupport(state, 'A');
    if (claim(isl)) progress = true;
  }
}
G.refreshInfluence(state);

// pick the siege site: influenced water in bolt range of his temple
let gunCell = null;
for (const k of state.influence.A) {
  const [x, z] = G.keyCell(k);
  if (state.map.land.has(k)) continue;
  if (G.dist2d(x, z, gtP.cell[0], gtP.cell[1]) <= G.CONFIG.Structures.BOLT_DIR.RANGE - 0.5) { gunCell = [x, z]; break; }
}
if (!gunCell) die('no siege site in range of his temple');

const nearIsl = state.map.islands.filter(i => i.owner === 'A')
  .sort((a, b) =>
    G.dist2d(a.center[0], a.center[1], gunCell[0], gunCell[1]) -
    G.dist2d(b.center[0], b.center[1], gunCell[0], gunCell[1]))[0];
if (!lay(nearIsl.temple.cell.slice(), gunCell.slice())) die('approach corridor refused');
G.recalcSupport(state, 'A');

const favorBefore = state.res.A.favor;
// the sanctioned siege: wall first, THEN raise the gun behind it
if (!G.castWindWall(state, gunCell)) die('could not cast the opening wall');
const bolt = G.buildStructure(state, 'A', 'bolt', { site: 'endpoint', cell: gunCell });
if (!bolt) die('bolt refused: ' + G.whyNotBuild(state, 'A', 'bolt', { site: 'endpoint', cell: gunCell }));

step(6, gunCell);
if (bolt.hp <= 0) die('the walled bolt died while raising (hp 0)');
if (bolt.buildProgress < 1) die('bolt never completed');

// armed-first: his defenders must fall before the temple takes real harm
step(30, gunCell);
if (defenders().length) {
  step(30, gunCell);
}
if (defenders().length) die('defenders never silenced: ' + defenders().length + ' still firing');

step(40, gunCell);
if (state.greatTemple.P.hp > 0) step(40, gunCell);
if (state.greatTemple.P.hp > 0) die('temple still stands at hp ' + Math.round(state.greatTemple.P.hp));

const wallFavor = (wallCasts + 1) * G.CONFIG.Powers.WIND_WALL.FAVOR;
if (wallFavor > 60) die('siege demanded absurd wall upkeep: ' + (wallCasts + 1) + ' casts = ' + wallFavor + ' favor');
console.log('siege: walled bolt raised under fire, defenders silenced armed-first, temple felled; ' +
  (wallCasts + 1) + ' wall casts = ' + wallFavor + ' favor of upkeep');
