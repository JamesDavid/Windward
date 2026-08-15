// Full-match headless simulation: scripted player + real AI + waves.
// Catches runtime errors across systems and sanity-checks the arc.
'use strict';
const { loadSandbox } = require('./harness');
const G = loadSandbox(['01_config.js', '02_util.js', '03_wind.js', '04_mapgen.js',
  '05_state.js', '06_network.js', '07_support.js', '08_economy.js', '09_haulers.js',
  '10_structures.js', '11_combat.js', '12_waves.js', '13_ai.js', '14_fog.js', '15_powers.js']);

function die(msg) { console.error('FAIL', msg); process.exit(1); }

const state = G.newGameState('simtest1');
G.recalcSupport(state, 'A');
G.recalcSupport(state, 'P');
G.refreshInfluence(state);
G.spawnPriest(state, 'A');
G.spawnPriest(state, 'P');
G.spawnHauler(state, 'A');
G.spawnHauler(state, 'P');
G.initAI(state);
G.fogTick(state, 1);

const events = {};
for (const name of ['waveLaunched', 'islandClaimed', 'convoyLost', 'networkSevered',
  'networkRestored', 'segmentDestroyed', 'structureDestroyed', 'delivery', 'craftDestroyed']) {
  G.Events.on(name, () => { events[name] = (events[name] || 0) + 1; });
}

// scripted player: claim the supply island, defend home before wave 1,
// then push toward the interior with guns along the way
const gt = state.greatTemple.A.cell;
const choke = state.map.islands.find(i => i.role === 'chokepoint');
const supply = state.map.islands.find(i => i.role === 'supplyA');
let nextAct = 1;
let lastGun = -99;
function playerAct(t) {
  // priest to the supply island, then temple
  const p = state.priests.A;
  if (p.state === 'idle' && !supply.temple && p.islandId !== supply.id) {
    G.sendPriest(state, 'A', supply);
  } else if (p.state === 'idle' && p.islandId === supply.id && !supply.temple) {
    const plotIdx = supply.plots.findIndex(pl => !pl.structure);
    if (plotIdx >= 0 && state.res.A.supply >= G.CONFIG.Structures.TEMPLE.COST) {
      G.buildStructure(state, 'A', 'temple', { site: 'plot', islandId: supply.id, plotIdx, cell: [supply.plots[plotIdx].x, supply.plots[plotIdx].z] });
    }
  }
  // routes: first reach the supply island, then push toward the chokepoint
  const target = supply.temple && supply.temple.buildProgress >= 1 ? choke.center : supply.center;
  const type = state.hand[0];
  const gunUp = state.structures.some(s => s.owner === 'A' && (s.type === 'bolt' || s.type === 'vane'));
  const saveForGun = !gunUp && t > 20;   // keep 10 supply back for the first battery
  const saveForTemple = !supply.temple ? G.CONFIG.Structures.TEMPLE.COST : 0;
  if (state.res.A.supply >= G.pieceCost(type) + (saveForGun ? 10 : 0) + saveForTemple) {
    let bestP = null, bestD = Infinity;
    for (const sock of G.getSockets(state, 'A')) {
      for (const pl of G.legalPlacements(state, 'A', type, sock)) {
        const far = pl.segs[pl.segs.length - 1][1];
        const d = Math.abs(far[0] - target[0]) + Math.abs(far[1] - target[1]);
        if (d < bestD) { bestD = d; bestP = pl; }
      }
    }
    if (bestP) {
      G.placePiece(state, 'A', type, bestP.segs);
      state.hand[0] = G.drawPiece();
    }
  }
  // home defence first: a Chain Vane on a home plot before wave 1
  const homeIsl = state.gtA;
  const homeVane = state.structures.some(s => s.owner === 'A' && s.type === 'vane' && s.islandId === homeIsl.id);
  if (!homeVane && t > 16 && state.res.A.supply >= 7) {
    const pi = homeIsl.plots.findIndex(pl => !pl.structure);
    if (pi >= 0) G.buildStructure(state, 'A', 'vane', { site: 'plot', islandId: homeIsl.id, plotIdx: pi, cell: [homeIsl.plots[pi].x, homeIsl.plots[pi].z] });
  }
  // guard each claimed island with a vane on its spare plot
  for (const isl of state.map.islands) {
    if (isl.owner !== 'A' || isl.role.startsWith('greatTemple')) continue;
    const guarded = state.structures.some(s => s.owner === 'A' && s.type === 'vane' && s.islandId === isl.id);
    if (!guarded && state.res.A.supply >= 7 + 4) {
      const pi = isl.plots.findIndex(pl => !pl.structure);
      if (pi >= 0) G.buildStructure(state, 'A', 'vane', { site: 'plot', islandId: isl.id, plotIdx: pi, cell: [isl.plots[pi].x, isl.plots[pi].z] });
    }
  }
  // then a forward battery every 40 s
  if (t - lastGun > 40 && homeVane) {
    const ends = G.getSockets(state, 'A').filter(s => s.kind === 'end' && !G.structureAt(state, s.cell[0], s.cell[1]));
    ends.sort((a, b) =>
      (Math.abs(b.cell[0] - gt[0]) + Math.abs(b.cell[1] - gt[1])) -
      (Math.abs(a.cell[0] - gt[0]) + Math.abs(a.cell[1] - gt[1])));
    if (ends.length && state.res.A.supply >= 10) {
      if (G.buildStructure(state, 'A', 'bolt', { site: 'endpoint', cell: ends[0].cell })) lastGun = t;
    }
  }
  G.buyHauler(state, 'A');
}

const dt = 0.1;
let steps = 0;
for (let t = 0; t < 480 && !state.over; t += dt) {
  state.time = t;
  state.wind.tick(dt);
  G.economyTick(state, dt);
  G.structuresTick(state, dt);
  G.updateTransit(state, dt);
  G.combatTick(state, dt);
  G.wavesTick(state, dt);
  G.aiTick(state, dt);
  G.fogTick(state, dt);
  G.collapseTick(state);
  if (t >= nextAct) { nextAct = t + 2.5; playerAct(t); }
  if (state.greatTemple.A.hp <= 0) state.over = 'lose';
  if (state.greatTemple.P.hp <= 0) state.over = 'win';
  steps++;
}

console.log('simulated', steps, 'steps; events:', JSON.stringify(events));
console.log('player: supply', Math.floor(state.res.A.supply), 'favor', Math.floor(state.res.A.favor),
  'segments', [...state.segments.values()].filter(s => s.owner === 'A').length,
  'structures', state.structures.filter(s => s.owner === 'A').length,
  'gtA hp', Math.floor(state.greatTemple.A.hp));
console.log('poseidon: segments', [...state.segments.values()].filter(s => s.owner === 'P').length,
  'structures', state.structures.filter(s => s.owner === 'P').length,
  'temples', G.poseidonTempleCount(state), 'craft alive', state.craft.length,
  'outcome', state.over || 'timeout');

// the scripted player is intentionally naive; it must survive deep into the
// match but need not win. Nine waves fire when the match lasts that long.
if (!events.waveLaunched || events.waveLaunched < 5) die('expected 5+ waves, got ' + (events.waveLaunched || 0));
if (!events.craftDestroyed) die('guns never killed a craft');
if (!events.delivery) die('no deliveries ever happened');
if (!events.islandClaimed) die('nobody claimed an island');
if (!events.segmentDestroyed) die('no combat ever touched a segment');
console.log('sim: all checks passed');
