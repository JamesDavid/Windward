// Gauntlet math (§33C): unbroken coverage kills an airship; a gap lets it
// recover. Three masts in a chain vs two with a gap, same corridor.
'use strict';
const { loadSandbox } = require('./harness');
const G = loadSandbox(['01_config.js', '02_util.js', '03_wind.js', '04_mapgen.js',
  '05_state.js', '06_network.js', '07_support.js', '08_economy.js', '09_haulers.js',
  '10_structures.js', '11_combat.js', '12_waves.js', '13_ai.js', '14_fog.js', '15_powers.js']);

function die(msg) { console.error('FAIL', msg); process.exit(1); }

function runGauntlet(mastCols) {
  const state = G.newGameState('wndwrd1');
  G.recalcSupport(state, 'A');
  G.recalcSupport(state, 'P');
  G.refreshInfluence(state);

  // a straight open-water corridor for the hauler to fly: pick a mid-map row
  const z = Math.round(CONFIG_H() / 2) + 2;
  const cells = [];
  for (let x = 0; x < G.CONFIG.Grid.WIDTH; x++) {
    if (!state.map.land.has(G.cellKey(x, z))) cells.push([x, z]);
  }
  const run = longestRun(cells);
  if (run.length < 9) die('no long open row at z=' + z + ' (len ' + run.length + ')');
  const path = run.slice(0, 10);

  // corridor segments so the hauler has a road (support irrelevant here:
  // we drive the path directly, but legIntact wants live segments)
  for (let i = 0; i < path.length - 1; i++) {
    const seg = G.makeSegment(state, 'A', path[i], path[i + 1]);
    seg.supportState = 'SUPPORTED';
    state.segments.set('A:' + seg.key, seg);
  }

  // a parallel Poseidon lane one row down, with masts on the given columns
  const lz = z + 1;
  for (let i = 0; i < path.length - 1; i++) {
    const a = [path[i][0], lz], b = [path[i + 1][0], lz];
    const seg = G.makeSegment(state, 'P', a, b);
    seg.supportState = 'SUPPORTED';
    state.segments.set('P:' + seg.key, seg);
  }
  for (const col of mastCols) {
    const cell = [path[col][0], lz];
    const stats = G.structureStats('P', 'mast');
    state.structures.push({
      id: 9000 + col, owner: 'P', type: 'mast', cell, site: 'endpoint',
      islandId: null, plotIdx: null,
      hp: stats.hp, maxHp: stats.hp, buildProgress: 1, buildTime: 0,
      ports: 0, dps: stats.dps, range: stats.range, radius: 0,
      arc: Math.PI * 2, turn: 2, intercept: 0, facing: 0, lastHitAt: -99
    });
  }

  const h = G.spawnHauler(state, 'A');
  h.pos = [path[0][0], path[0][1]];
  h.path = path;
  h.legIndex = 0; h.legT = 0;
  h.state = 'toIsland';
  h.targetIsland = null;

  G.fogTick(state, 1);
  const dt = 0.05;
  for (let t = 0; t < 40 && h.state !== 'dead'; t += dt) {
    state.time = t;
    G.updateTransit(state, dt);
    G.combatTick(state, dt);
    G.fogTick(state, dt);
    if (h.state === 'dwelling' || h.legIndex >= h.path.length - 2) break;   // made it through
  }
  return { survived: h.state !== 'dead', hull: Math.round(h.hull) };
}

function CONFIG_H() { return G.CONFIG.Grid.HEIGHT; }
function longestRun(cells) {
  let best = [], cur = [];
  for (let i = 0; i < cells.length; i++) {
    if (!cur.length || cells[i][0] === cur[cur.length - 1][0] + 1) cur.push(cells[i]);
    else { if (cur.length > best.length) best = cur; cur = [cells[i]]; }
  }
  return cur.length > best.length ? cur : best;
}

// mast range 3 from one row off covers ~5.6 corridor cells, so a true
// recovery gap needs the pair at the corridor's far ends
const chain = runGauntlet([2, 4, 6]);       // continuous coverage
const gapped = runGauntlet([0, 9]);         // a recovery gap in the middle
console.log('chain of three:', chain, '| gapped pair:', gapped);
if (chain.survived) die('a three-mast chain should kill a hauler (hull ' + chain.hull + ')');
if (!gapped.survived) die('a gapped pair should let the hauler recover');
console.log('gauntlet: continuous coverage kills, the gap is the whole game — ok');
