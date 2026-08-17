// Parameterized Air-Guild strategist for evolution (player-directed:
// "optimize with genetic algorithm... so it figures out the best
// winning strategy against poseidon"). The GENOME is 14 floats in
// [0,1]; scale() maps them to gameplay ranges. Unlike the old scripted
// player, this one contains the WIN PATH: priest-claimed temple chains
// toward Poseidon's corner and aimed bolts that reach his Great Temple.
'use strict';
const { loadPatched } = require('./opt_lib');

const GENOME_RANGES = {
  vaneTime:      [5, 60],     // when the first home vane goes up
  gunEvery:      [15, 70],    // forward-gun cadence (seconds)
  gunReserve:    [5, 45],     // supply held back before gunning
  junctionBonus: [0, 4],      // piece-scoring bonus per extra prong
  expandBias:    [0, 1],      // island value: ore-rich (0) vs toward-enemy (1)
  offenseAt:     [60, 340],   // when lanes start driving at his corner
  defVanes:      [0, 2.99],   // vanes per claimed island
  shieldUse:     [0, 1],      // >0.5: shield the forward gun
  wallUse:       [0, 1],      // >0.5: Wind Wall the forward holding at telegraphs
  tailwindUse:   [0, 1],      // >0.5: Tailwind loaded convoys
  hydrogenAt:    [20, 90],    // supply threshold for the refit
  haulerTarget:  [1, 6],      // fleet size to maintain
  templeBudget:  [14, 60],    // supply reserved for the NEXT temple
  pushSpacing:   [20, 60]     // seconds between offensive gun attempts
};
const GENE_KEYS = Object.keys(GENOME_RANGES);

function scale(genome) {
  const s = {};
  GENE_KEYS.forEach((k, i) => {
    const [lo, hi] = GENOME_RANGES[k];
    s[k] = lo + Math.min(1, Math.max(0, genome[i])) * (hi - lo);
  });
  return s;
}

function randomGenome(rng) { return GENE_KEYS.map(() => rng()); }

// One full match: scripted-A (genome) vs the real AI. Returns stats.
function runMatch(G, seed, genome, maxT) {
  const g = scale(genome);
  const state = G.newGameState(seed);
  G.recalcSupport(state, 'A'); G.recalcSupport(state, 'P');
  G.refreshInfluence(state);
  G.spawnPriest(state, 'A'); G.spawnPriest(state, 'P');
  G.spawnHauler(state, 'A'); G.spawnHauler(state, 'P');
  G.initAI(state);
  G.fogTick(state, 1);

  const gtP = state.greatTemple.P.cell;
  const gtA = state.greatTemple.A.cell;
  const supplyIsl = state.map.islands.find(i => i.role === 'supplyA');
  const dEnemy = (c) => Math.abs(c[0] - gtP[0]) + Math.abs(c[1] - gtP[1]);
  const normD = dEnemy(gtA) || 1;
  let lastGun = -99, lastPush = -99, nextAct = 1;

  const act = (t) => {
    const res = state.res.A;
    // ---- priest: claim a chain of islands, weighted by the genome ----
    const p = state.priests.A;
    if (p && p.state === 'idle') {
      const here = p.islandId !== null ? state.map.islands[p.islandId] : null;
      if (here && !here.role.startsWith('greatTemple') &&
        (!here.temple || here.temple.hp <= 0) &&
        res.supply >= G.CONFIG.Structures.TEMPLE.COST &&
        res.favor >= (G.CONFIG.Structures.TEMPLE.FAVOR || 0)) {
        const pi = here.plots.findIndex(pl => !pl.structure && !G.plotBlockedByQuarry(here, pl));
        const at = pi >= 0
          ? { site: 'plot', islandId: here.id, plotIdx: pi, cell: [here.plots[pi].x, here.plots[pi].z] }
          : null;
        if (at) G.buildStructure(state, 'A', 'temple', at);
      } else {
        let best = null, bs = -Infinity;
        for (const isl of state.map.islands) {
          if (isl.role.startsWith('greatTemple')) continue;
          if (isl.temple && isl.temple.hp > 0) continue;
          if (G.islandClosedTo(state, isl, 'A')) continue;
          if (!G.findNetPath(state, 'A', [Math.round(p.pos[0]), Math.round(p.pos[1])], isl.cells)) continue;
          const toward = 1 - dEnemy([Math.round(isl.center[0]), Math.round(isl.center[1])]) / normD;
          const ore = Math.min(1, (isl.reserve || 0) / 1500);
          const sc = g.expandBias * toward + (1 - g.expandBias) * ore;
          if (sc > bs) { bs = sc; best = isl; }
        }
        if (best && (p.islandId === null || best.id !== p.islandId)) G.sendPriest(state, 'A', best);
      }
    }
    // ---- pieces: toward supply, then choke, then HIS CORNER ----
    let target = supplyIsl.center;
    if (supplyIsl.temple && supplyIsl.temple.buildProgress >= 1) {
      target = t >= g.offenseAt ? gtP : (state.map.islands.find(i => i.role === 'chokepoint') || supplyIsl).center;
    }
    {
      let bestP = null, bestScore = -Infinity, bestSlot = -1;
      for (let slot = 0; slot < state.hand.length; slot++) {
        const type = state.hand[slot];
        if (res.favor < G.pieceCost(type)) continue;
        for (const sock of G.getSockets(state, 'A')) {
          for (const pl of G.legalPlacements(state, 'A', type, sock)) {
            const far = pl.segs[pl.segs.length - 1][1];
            const d = Math.abs(far[0] - target[0]) + Math.abs(far[1] - target[1]);
            const sc = -d + (G.piecePlugs(type) - 1) * g.junctionBonus;
            if (sc > bestScore) { bestScore = sc; bestP = pl; bestSlot = slot; }
          }
        }
      }
      if (bestP && res.supply >= (supplyIsl.temple ? 0 : g.templeBudget * 0.5)) {
        G.placePiece(state, 'A', state.hand[bestSlot], bestP.segs);
        state.hand[bestSlot] = G.drawPiece(bestSlot);
      }
    }
    // ---- defense: home vane, then per-island vanes ----
    const wantVane = (isl, count) =>
      state.structures.filter(s => s.owner === 'A' && s.type === 'vane' && s.islandId === isl.id && s.hp > 0).length < count;
    const placeVane = (isl) => {
      const pi = isl.plots.findIndex(pl => !pl.structure && !G.plotBlockedByQuarry(isl, pl));
      const at = pi >= 0
        ? { site: 'plot', islandId: isl.id, plotIdx: pi, cell: [isl.plots[pi].x, isl.plots[pi].z] }
        : (() => {
          const c = isl.cells.find(([x, z]) => !G.whyNotBuild(state, 'A', 'vane', { site: 'plot', islandId: isl.id, plotIdx: -1, cell: [x, z] }));
          return c ? { site: 'plot', islandId: isl.id, plotIdx: -1, cell: [c[0], c[1]] } : null;
        })();
      if (at) G.buildStructure(state, 'A', 'vane', at);
    };
    if (t > g.vaneTime && res.supply >= 7 + g.gunReserve * 0.5 && wantVane(state.gtA, 1)) placeVane(state.gtA);
    else if (res.supply >= 7 + g.gunReserve) {
      for (const isl of state.map.islands) {
        if (isl.owner !== 'A' || isl.role.startsWith('greatTemple')) continue;
        if (wantVane(isl, Math.floor(g.defVanes))) { placeVane(isl); break; }
      }
    }
    // ---- forward guns: aimed bolts that reach toward his holdings ----
    const aimAt = (cell) => {
      let tgt = gtP;
      let bd = dEnemy(cell) + 99;
      for (const st of state.structures) {
        if (st.owner !== 'P' || st.hp <= 0) continue;
        const d = Math.abs(st.cell[0] - cell[0]) + Math.abs(st.cell[1] - cell[1]);
        if (d < bd) { bd = d; tgt = st.cell; }
      }
      return Math.atan2(tgt[1] - cell[1], tgt[0] - cell[0]);
    };
    const gunAttempt = (cadenceOk, sorter) => {
      const ends = G.getSockets(state, 'A').filter(s => s.kind === 'end' && !G.structureAt(state, s.cell[0], s.cell[1]));
      ends.sort(sorter);
      if (ends.length && res.supply >= 10 + g.gunReserve) {
        return G.buildStructure(state, 'A', 'bolt', { site: 'endpoint', cell: ends[0].cell }, aimAt(ends[0].cell));
      }
      return null;
    };
    if (t - lastGun > g.gunEvery) {
      if (gunAttempt(true, (a, b) => dEnemy(a.cell) - dEnemy(b.cell))) lastGun = t;
    }
    // the kill shot: once any end stands within bolt range of his Great
    // Temple (or a defender), gun it NOW regardless of cadence
    if (t - lastPush > g.pushSpacing && t >= g.offenseAt) {
      const range = G.CONFIG.Structures.BOLT_DIR.RANGE;
      const ends = G.getSockets(state, 'A').filter(s => s.kind === 'end' &&
        !G.structureAt(state, s.cell[0], s.cell[1]) && G.dist2d(s.cell[0], s.cell[1], gtP[0], gtP[1]) <= range + 1);
      if (ends.length && res.supply >= 10) {
        if (G.buildStructure(state, 'A', 'bolt', { site: 'endpoint', cell: ends[0].cell }, aimAt(ends[0].cell))) lastPush = t;
      }
    }
    // ---- shield the forward gun ----
    if (g.shieldUse > 0.5 && res.supply >= 12 + g.gunReserve && res.favor >= 4) {
      const guns = state.structures.filter(s => s.owner === 'A' && s.type === 'bolt' && s.site === 'endpoint' && s.hp > 0);
      guns.sort((a, b) => dEnemy(a.cell) - dEnemy(b.cell));
      const fwd = guns[0];
      if (fwd && !state.structures.some(s => s.owner === 'A' && s.type === 'shield' && s.hp > 0 &&
        G.dist2d(s.cell[0], s.cell[1], fwd.cell[0], fwd.cell[1]) <= G.CONFIG.Structures.SHIELD_COVER_RADIUS)) {
        const ends = G.getSockets(state, 'A').filter(s => s.kind === 'end' &&
          !G.structureAt(state, s.cell[0], s.cell[1]) &&
          G.dist2d(s.cell[0], s.cell[1], fwd.cell[0], fwd.cell[1]) <= G.CONFIG.Structures.SHIELD_COVER_RADIUS);
        if (ends.length) G.buildStructure(state, 'A', 'shield', { site: 'endpoint', cell: ends[0].cell });
      }
    }
    // ---- powers, refit, fleet ----
    const P = G.CONFIG.Powers;
    if (g.wallUse > 0.5 && state.wave.telegraphed && res.favor >= P.WIND_WALL.FAVOR + 4) {
      let fwd = null, fd = -1;
      for (const st of state.structures) {
        if (st.owner !== 'A' || st.hp <= 0) continue;
        const d = Math.abs(st.cell[0] - gtA[0]) + Math.abs(st.cell[1] - gtA[1]);
        if (d > fd) { fd = d; fwd = st; }
      }
      if (fwd) G.castWindWall(state, fwd.cell);
    }
    if (g.tailwindUse > 0.5 && res.favor >= P.TAILWIND.FAVOR + 10 &&
      state.haulers.some(x => x.owner === 'A' && x.state === 'toHome' && x.cargo > 0)) {
      G.castTailwind(state);
    }
    if (supplyIsl.temple && res.supply >= g.hydrogenAt &&
      res.favor >= G.CONFIG.Tech.HYDROGEN_COST_FAVOR + 6) {
      G.buyHydrogen(state, 'A');
    }
    const fleet = state.haulers.filter(h => h.owner === 'A' && h.state !== 'dead').length;
    if (fleet < Math.round(g.haulerTarget)) {
      if (fleet >= G.fleetCap(state, 'A') && res.supply >= G.CONFIG.Yard.COST + 10) {
        // need another yard to moor more
        const home = state.gtA;
        const c = home.cells.find(([x, z]) => !G.whyNotBuild(state, 'A', 'yard', { site: 'plot', islandId: home.id, plotIdx: -1, cell: [x, z] }));
        if (c) G.buildStructure(state, 'A', 'yard', { site: 'plot', islandId: home.id, plotIdx: -1, cell: [c[0], c[1]] });
      } else G.buyHauler(state, 'A');
    }
  };

  const dt = 0.1;
  const cap = maxT || 720;
  for (let t = 0; t < cap && !state.over; t += dt) {
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
  }
  return {
    outcome: state.over || 'timeout',
    t: state.time,
    gtA: Math.max(0, Math.round(state.greatTemple.A.hp)),
    gtP: Math.max(0, Math.round(state.greatTemple.P.hp)),
    temples: state.map.islands.filter(i => i.temple && i.temple.owner === 'A' && i.temple.hp > 0).length,
    waves: state.wave.index
  };
}

// Fitness: WINNING dominates; fast wins beat slow ones; otherwise pay
// for damage dealt and depth survived.
function fitness(r) {
  if (r.outcome === 'win') return 1000 + (720 - r.t) + r.gtA;
  if (r.outcome === 'arbitration') return 700 + (200 - r.gtP);
  let s = (200 - r.gtP) * 2 + r.temples * 15 + r.waves * 5;
  if (r.outcome === 'lose') s -= 100;
  return s;
}

module.exports = { GENE_KEYS, GENOME_RANGES, scale, randomGenome, runMatch, fitness, loadPatched };
