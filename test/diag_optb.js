// Diagnose the optb turtling anomaly: timeline stats vs the reference seed.
'use strict';
const { loadSandbox } = require('./harness');
const G = loadSandbox(['01_config.js', '02_util.js', '03_wind.js', '04_mapgen.js',
  '05_state.js', '06_network.js', '07_support.js', '08_economy.js', '09_haulers.js',
  '10_structures.js', '11_combat.js', '12_waves.js', '13_ai.js', '14_fog.js', '15_powers.js']);

for (const seed of ['simtest1', 'optb']) {
  const state = G.newGameState(seed);
  G.recalcSupport(state, 'A'); G.recalcSupport(state, 'P');
  G.refreshInfluence(state);
  G.spawnPriest(state, 'A'); G.spawnPriest(state, 'P');
  G.spawnHauler(state, 'A'); G.spawnHauler(state, 'P');
  G.initAI(state); G.fogTick(state, 1);

  const gt = state.greatTemple.A.cell;
  const choke = state.map.islands.find(i => i.role === 'chokepoint');
  const supply = state.map.islands.find(i => i.role === 'supplyA');
const segTouches = (pl) => [...state.segments.values()].some(s => s.owner === 'A' && ((s.a[0] === pl.x && s.a[1] === pl.z) || (s.b[0] === pl.x && s.b[1] === pl.z)));
  console.log('=== ' + seed + ': gtA', gt, 'supplyA@', supply.center, 'choke@', choke.center,
    'islands', state.map.islands.length);
  let nextAct = 1, lastGun = -99, priestFails = 0, placeFails = 0;
  const act = (t) => {
    const p = state.priests.A;
    if (p.state === 'idle' && !supply.temple && p.islandId !== supply.id) {
      if (!G.sendPriest(state, 'A', supply)) priestFails++;
    } else if (p.state === 'idle' && p.islandId === supply.id && !supply.temple &&
      state.res.A.supply >= G.CONFIG.Structures.TEMPLE.COST) {
      const pi = supply.plots.findIndex(pl => !pl.structure && !segTouches(pl));
      if (pi >= 0) G.buildStructure(state, 'A', 'temple', { site: 'plot', islandId: supply.id, plotIdx: pi, cell: [supply.plots[pi].x, supply.plots[pi].z] });
    }
    const target = supply.temple && supply.temple.buildProgress >= 1 ? choke.center : supply.center;
    const type = state.hand[0];
    if (state.res.A.favor >= G.pieceCost(type)) {
      let bestP = null, bestD = Infinity;
      for (const sock of G.getSockets(state, 'A')) {
        for (const pl of G.legalPlacements(state, 'A', type, sock)) {
          const far = pl.segs[pl.segs.length - 1][1];
          const d = Math.abs(far[0] - target[0]) + Math.abs(far[1] - target[1]);
          if (d < bestD) { bestD = d; bestP = pl; }
        }
      }
      if (bestP) { G.placePiece(state, 'A', type, bestP.segs); state.hand[0] = G.drawPiece(); }
      else placeFails++;
    }
    if (t - lastGun > 40) {
      const ends = G.getSockets(state, 'A').filter(s => s.kind === 'end' && !G.structureAt(state, s.cell[0], s.cell[1]));
      ends.sort((a, b) =>
        (Math.abs(b.cell[0] - gt[0]) + Math.abs(b.cell[1] - gt[1])) -
        (Math.abs(a.cell[0] - gt[0]) + Math.abs(a.cell[1] - gt[1])));
      if (ends.length && state.res.A.supply >= 10) {
        if (G.buildStructure(state, 'A', 'bolt', { site: 'endpoint', cell: ends[0].cell })) lastGun = t;
      }
    }
    G.buyHauler(state, 'A');
  };

  let deliveries = 0;
  G.Events.on('delivery', () => deliveries++);
  const dt = 0.1;
  for (let t = 0; t < 480 && !state.over; t += dt) {
    state.time = t;
    state.wind.tick(dt);
    G.economyTick(state, dt); G.structuresTick(state, dt); G.updateTransit(state, dt);
    G.combatTick(state, dt); G.wavesTick(state, dt); G.aiTick(state, dt);
    G.fogTick(state, dt); G.collapseTick(state);
    if (t >= nextAct) { nextAct = t + 2.5; act(t); }
    if (state.greatTemple.A.hp <= 0) state.over = 'lose';
    if (state.greatTemple.P.hp <= 0) state.over = 'win';
    if (Math.round(t * 10) % 600 === 0 && t > 1) {
      const segsA = [...state.segments.values()].filter(s => s.owner === 'A').length;
      const segsP = [...state.segments.values()].filter(s => s.owner === 'P').length;
      console.log('  t=' + Math.round(t), 'segsA', segsA, 'segsP', segsP,
        'tmplP', G.poseidonTempleCount(state), 'tmplA', state.map.islands.filter(i => i.temple && i.temple.owner === 'A' && i.temple.hp > 0).length,
        'craft', state.craft.length, 'gtA', Math.round(state.greatTemple.A.hp),
        'del', deliveries, 'res', Math.round(state.res.A.supply) + '/' + Math.round(state.res.A.favor),
        'aiObj', state.ai.objective ? JSON.stringify(state.ai.objective.type || state.ai.objective) : 'none',
        'pf', priestFails, 'plf', placeFails);
    }
  }
  console.log('  outcome:', state.over || 'timeout');
}
