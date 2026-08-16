// Shared machinery for parameter sweeps: load the game with CONFIG text
// patches, run the scripted full match, and score match quality with the
// same composite the earlier sweeps used (comparable across sweeps).
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = ['01_config.js', '02_util.js', '03_wind.js', '04_mapgen.js',
  '05_state.js', '06_network.js', '07_support.js', '08_economy.js', '09_haulers.js',
  '10_structures.js', '11_combat.js', '12_waves.js', '13_ai.js', '14_fog.js', '15_powers.js'];

// patches: array of [regex, replacement] applied to 01_config.js text
function loadPatched(patches) {
  const sandbox = { console, Math, Date, Infinity, NaN };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const srcDir = path.join(__dirname, '..', 'src');
  for (const f of SRC) {
    let code = fs.readFileSync(path.join(srcDir, f), 'utf8');
    if (f === '01_config.js') {
      for (const [re, rep] of patches) {
        if (!re.test(code)) throw new Error('patch missed: ' + re);
        code = code.replace(re, rep);
      }
    }
    vm.runInContext(code, sandbox, { filename: f });
  }
  vm.runInContext('for (const n of ["CONFIG", "Events"]) { try { globalThis[n] = eval(n); } catch (e) {} }', sandbox);
  return sandbox;
}

function runTrial(G, seed) {
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

  const ev = {};
  for (const name of ['waveLaunched', 'islandClaimed', 'convoyLost', 'networkSevered',
    'networkRestored', 'segmentDestroyed', 'delivery', 'craftDestroyed']) {
    G.Events.on(name, () => { ev[name] = (ev[name] || 0) + 1; });
  }

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
    const homeIsl = state.gtA;
    if (!state.structures.some(s => s.owner === 'A' && s.type === 'vane' && s.islandId === homeIsl.id) &&
      t > 12 && state.res.A.supply >= 7) {
      const pi = homeIsl.plots.findIndex(pl => !pl.structure && !segTouches(pl) && !G.plotBlockedByQuarry(homeIsl, pl));
      if (pi >= 0) G.buildStructure(state, 'A', 'vane', { site: 'plot', islandId: homeIsl.id, plotIdx: pi, cell: [homeIsl.plots[pi].x, homeIsl.plots[pi].z] });
    }
    if (!state.structures.some(s => s.owner === 'A' && s.type === 'bolt' && s.islandId === homeIsl.id) &&
      t > 22 && state.res.A.supply >= 10) {
      const pi = homeIsl.plots.findIndex(pl => !pl.structure && !segTouches(pl) && !G.plotBlockedByQuarry(homeIsl, pl));
      if (pi >= 0) G.buildStructure(state, 'A', 'bolt', { site: 'plot', islandId: homeIsl.id, plotIdx: pi, cell: [homeIsl.plots[pi].x, homeIsl.plots[pi].z] });
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
  }

  const segsA = [...state.segments.values()].filter(s => s.owner === 'A').length;
  const segsP = [...state.segments.values()].filter(s => s.owner === 'P').length;
  return {
    outcome: state.over || 'timeout',
    waves: ev.waveLaunched || 0,
    gtAhp: Math.max(0, Math.round(state.greatTemple.A.hp)),
    segsA, segsP,
    temples: G.poseidonTempleCount(state),
    deliveries: ev.delivery || 0,
    kills: ev.craftDestroyed || 0,
    severed: ev.networkSevered || 0,
    restored: ev.networkRestored || 0,
    favorEnd: Math.round(state.res.A.favor),
    supplyEnd: Math.round(state.res.A.supply)
  };
}

// Match-quality score: survive deep but under pressure, both economies
// alive, real engagement, and no degenerate road spam.
function score(r) {
  let s = 0;
  s += r.waves * 3;
  if (r.outcome === 'lose' && r.waves < 5) s -= 25;
  if (r.gtAhp > 0 && r.gtAhp < 200) s += 12;
  if (r.gtAhp === 200) s -= 6;
  s += Math.min(r.kills, 20);
  s += Math.min(r.severed * 2, 12);
  s += r.restored * 4;
  s += Math.min(r.deliveries, 25);
  s += r.temples >= 1 ? 5 : -5;
  s += r.segsP >= 50 ? 5 : -5;
  if (r.segsA > 170) s -= (r.segsA - 170) * 0.15;
  if (r.segsA < 40) s -= 20;
  return Math.round(s);
}

const SEEDS = ['simtest1', 'optb', 'optc'];

function sweep(cells) {
  const rows = [];
  for (const cell of cells) {
    let total = 0;
    const per = [];
    for (const seed of SEEDS) {
      const G = loadPatched(cell.patches);
      const r = runTrial(G, seed);
      const sc = score(r);
      total += sc;
      per.push({ seed, sc, r });
    }
    rows.push({ label: cell.label, avg: Math.round(total / SEEDS.length), per });
  }
  for (const row of rows) {
    console.log('--- ' + row.label + ' => avg score ' + row.avg);
    for (const p of row.per) console.log('   ', p.seed, 'score', p.sc, JSON.stringify(p.r));
  }
  const best = rows.slice().sort((a, b) => b.avg - a.avg)[0];
  console.log('BEST:', best.label, '(avg', best.avg + ')');
  return rows;
}

module.exports = { loadPatched, runTrial, score, sweep, SEEDS };
