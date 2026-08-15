'use strict';
const { loadSandbox } = require('./harness');
const G = loadSandbox(['01_config.js', '02_util.js', '03_wind.js', '04_mapgen.js',
  '05_state.js', '06_network.js', '07_support.js', '08_economy.js', '09_haulers.js',
  '10_structures.js', '11_combat.js', '12_waves.js', '13_ai.js', '14_fog.js', '15_powers.js']);

const state = G.newGameState('simtest1');
G.recalcSupport(state, 'A'); G.recalcSupport(state, 'P'); G.refreshInfluence(state);
G.spawnPriest(state, 'A'); G.spawnPriest(state, 'P');
G.spawnHauler(state, 'A'); G.spawnHauler(state, 'P');
G.initAI(state);
G.fogTick(state, 1);

const supply = state.map.islands.find(i => i.role === 'supplyA');
const dt = 0.1;
let placed = 0;
for (let t = 0; t < 120; t += dt) {
  state.time = t;
  G.economyTick(state, dt); G.structuresTick(state, dt); G.updateTransit(state, dt);
  G.combatTick(state, dt); G.wavesTick(state, dt); G.aiTick(state, dt);
  G.fogTick(state, dt); G.collapseTick(state);
  // player: straight to supply island priest test
  if (Math.abs(t - 5) < 0.05) {
    // lay corridor to supply island
    let cur = state.greatTemple.A.cell.slice();
    const to = supply.templeCell;
    let guard = 40;
    state.res.A.supply = 60;
    while ((cur[0] !== to[0] || cur[1] !== to[1]) && guard-- > 0) {
      const dx = Math.sign(to[0] - cur[0]), dz = Math.sign(to[1] - cur[1]);
      const next = dx !== 0 ? [cur[0] + dx, cur[1]] : [cur[0], cur[1] + dz];
      const seg = G.makeSegment(state, 'A', cur, next);
      state.segments.set('A:' + seg.key, seg);
      cur = next;
    }
    G.recalcSupport(state, 'A');
    console.log('corridor laid; sent:', G.sendPriest(state, 'A', supply));
  }
  const p = state.priests.A;
  if (Math.round(t * 10) % 100 === 0) {
    console.log(t.toFixed(0), 'priestA', p.state, 'at', p.pos.map(v => v.toFixed(1)).join(','),
      'islandId', p.islandId, '| P: segs', [...state.segments.values()].filter(s => s.owner === 'P').length,
      'plan', state.ai.plan ? state.ai.plan.length : null, 'supplyP', Math.floor(state.res.P.supply));
  }
  if (p.state === 'idle' && p.islandId === supply.id && !supply.temple) {
    const plotIdx = supply.plots.findIndex(pl => !pl.structure);
    const st = G.buildStructure(state, 'A', 'temple', { site: 'plot', islandId: supply.id, plotIdx, cell: [supply.plots[plotIdx].x, supply.plots[plotIdx].z] });
    if (st) console.log(t.toFixed(1), 'temple started');
  }
}
console.log('supply island owner:', supply.owner, 'stockpile', supply.stockpile.toFixed(0));
