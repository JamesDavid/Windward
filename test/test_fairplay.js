// Fair-play invariant: Poseidon obeys the same connection rules the player
// does. At every point in a full match, every standing lane of his either
// BFS-traces to his Great Temple (SUPPORTED) or is visibly dying on a
// collapse timer after being cut. He never conjures a disconnected path.
'use strict';
const { loadSandbox } = require('./harness');
const G = loadSandbox(['01_config.js', '02_util.js', '03_wind.js', '04_mapgen.js',
  '05_state.js', '06_network.js', '07_support.js', '08_economy.js', '09_haulers.js',
  '10_structures.js', '11_combat.js', '12_waves.js', '13_ai.js', '14_fog.js', '15_powers.js']);

function die(msg) { console.error('FAIL', msg); process.exit(1); }

// Independent connectivity check (not trusting recalcSupport's own cache):
// walk his segment graph from his Great Temple with island conduction.
function tracesHome(state, side) {
  const segs = [...state.segments.values()].filter(s => s.owner === side);
  const byCell = new Map();
  for (const s of segs) {
    for (const c of [s.a, s.b]) {
      const k = G.cellKey(c[0], c[1]);
      if (!byCell.has(k)) byCell.set(k, []);
      byCell.get(k).push(s);
    }
  }
  const gt = state.greatTemple[side];
  const seen = new Set();
  const reached = new Set();
  const stack = [G.cellKey(gt.cell[0], gt.cell[1])];
  const conducted = new Set();
  while (stack.length) {
    const k = stack.pop();
    if (seen.has(k)) continue;
    seen.add(k);
    const [x, z] = G.keyCell(k);
    const isl = G.islandAt(state, x, z);
    if (isl && !conducted.has(isl.id) && G.islandConducts(state, isl, side)) {
      conducted.add(isl.id);
      for (const [cx, cz] of isl.cells) stack.push(G.cellKey(cx, cz));
    }
    for (const s of byCell.get(k) || []) {
      reached.add(s.id);
      stack.push(G.cellKey(s.a[0], s.a[1]));
      stack.push(G.cellKey(s.b[0], s.b[1]));
    }
  }
  return reached;
}

for (const seed of ['simtest1', 'optb', 'optc']) {
  const state = G.newGameState(seed);
  G.recalcSupport(state, 'A');
  G.recalcSupport(state, 'P');
  G.refreshInfluence(state);
  G.spawnPriest(state, 'A');
  G.spawnPriest(state, 'P');
  G.spawnHauler(state, 'A');
  G.spawnHauler(state, 'P');
  G.initAI(state);
  G.fogTick(state, 1);

  // naive scripted player (as test_sim), so his network actually gets cut
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
      const pi = supply.plots.findIndex(pl => !pl.structure && !segTouches(pl) && !G.plotBlockedByQuarry(supply, pl));
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

  const dt = 0.1;
  let checks = 0, orphanSeen = 0, dyingSeen = 0;
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
    if (t >= nextAct) { nextAct = t + 2.5; act(t); }
    if (state.greatTemple.A.hp <= 0) state.over = 'lose';
    if (state.greatTemple.P.hp <= 0) state.over = 'win';

    // every 2 sim-seconds, audit every Poseidon segment
    if (Math.round(t * 10) % 20 === 0) {
      checks++;
      const home = tracesHome(state, 'P');
      for (const s of state.segments.values()) {
        if (s.owner !== 'P') continue;
        if (home.has(s.id)) {
          if (s.supportState !== 'SUPPORTED') {
            // transiently allowed within one recalc; must carry a timer
            if (s.collapseAt === null) die(seed + ' t=' + t.toFixed(1) +
              ': connected segment marked ' + s.supportState + ' with no timer');
          }
          continue;
        }
        orphanSeen++;
        // disconnected: must be dying (FRAYED or COLLAPSING with a timer)
        if (s.supportState === 'SUPPORTED') {
          die(seed + ' t=' + t.toFixed(1) + ': segment ' + s.id + ' at [' +
            s.a + ']-[' + s.b + '] does NOT trace to his Great Temple yet is SUPPORTED');
        }
        if (s.collapseAt === null) {
          die(seed + ' t=' + t.toFixed(1) + ': orphan segment ' + s.id + ' has no collapse timer');
        }
        dyingSeen++;
      }
      // and every socket he could build from must be in his supported set
      for (const sock of G.getSockets(state, 'P')) {
        const k = G.cellKey(sock.cell[0], sock.cell[1]);
        if (!state.supportedCells.P.has(k)) {
          die(seed + ' t=' + t.toFixed(1) + ': socket ' + sock.kind + ' at ' + sock.cell +
            ' outside his supported network');
        }
      }
    }
  }
  console.log(seed + ': ' + checks + ' audits, outcome ' + (state.over || 'timeout') +
    '; disconnected-and-dying segments observed ' + dyingSeen + ' times (all timed), zero orphans kept alive');
}
console.log('fairplay: all checks passed — every Poseidon lane traces home or dies on a timer');
