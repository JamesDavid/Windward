// Why do haulers never deliver under the defense-blocking rule?
'use strict';
const { loadSandbox } = require('./harness');
const G = loadSandbox(['01_config.js', '02_util.js', '03_wind.js', '04_mapgen.js',
  '05_state.js', '06_network.js', '07_support.js', '08_economy.js', '09_haulers.js',
  '10_structures.js', '11_combat.js', '12_waves.js', '13_ai.js', '14_fog.js', '15_powers.js']);

const state = G.newGameState('simtest1');
G.recalcSupport(state, 'A'); G.recalcSupport(state, 'P');
G.refreshInfluence(state);
G.spawnPriest(state, 'A'); G.spawnPriest(state, 'P');
G.spawnHauler(state, 'A'); G.spawnHauler(state, 'P');
G.initAI(state); G.fogTick(state, 1);

const gt = state.greatTemple.A.cell;
const choke = state.map.islands.find(i => i.role === 'chokepoint');
const supply = state.map.islands.find(i => i.role === 'supplyA');
const segTouches = (pl) => [...state.segments.values()].some(s => s.owner === 'A' && ((s.a[0] === pl.x && s.a[1] === pl.z) || (s.b[0] === pl.x && s.b[1] === pl.z)));
let nextAct = 1, lastGun = -99;
const act = (t) => {
  const p = state.priests.A;
  if (p.state === 'idle' && !supply.temple && p.islandId !== supply.id) G.sendPriest(state, 'A', supply);
  else if (p.state === 'idle' && p.islandId === supply.id && !supply.temple &&
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
  }
  G.buyHauler(state, 'A');
};

const dt = 0.1;
for (let t = 0; t < 120; t += dt) {
  state.time = t;
  state.wind.tick(dt);
  G.economyTick(state, dt); G.structuresTick(state, dt); G.updateTransit(state, dt);
  G.combatTick(state, dt); G.wavesTick(state, dt); G.aiTick(state, dt);
  G.fogTick(state, dt); G.collapseTick(state);
  if (t >= nextAct) { nextAct = t + 2.5; act(t); }
  if (Math.round(t * 10) % 100 === 0 && t > 1) {
    const hs = state.haulers.filter(h => h.owner === 'A').map(h => h.state + '@' + h.pos.map(v => Math.round(v)) + (h.targetIsland !== null ? '->' + h.targetIsland : ''));
    const target = G.pickCollectionTarget(state, 'A');
    const idleH = state.haulers.find(h => h.owner === 'A' && h.state === 'idle');
    let pathInfo = '';
    if (idleH && target) {
      const p = G.findNetPath(state, 'A', [Math.round(idleH.pos[0]), Math.round(idleH.pos[1])], target.cells);
      pathInfo = ' path:' + (p ? p.length : 'NULL');
    }
    console.log('t=' + Math.round(t), 'haulers', JSON.stringify(hs),
      'stockTarget', target ? target.id + '(' + Math.floor(target.stockpile) + ')' : 'none', pathInfo,
      'supply', Math.round(state.res.A.supply));
  }
}
