// Wave 5 signature sequence (§18): the scripted heavy strike hits the most
// forward player structure; its explosion breaks the outward segment; the
// branch beyond frays; reconnection relights it. Authored, not hoped for.
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
state.res.A.supply = 200;

// build a long forward branch over open water toward the map centre,
// capped with a Bolt Battery — the shape the map is authored to invite
const gtA = state.greatTemple.A.cell;
const choke = state.map.islands.find(i => i.role === 'chokepoint');

// home defence, as any player alive at wave 5 would have
for (let i = 0; i < 2; i++) {
  const isl = state.gtA;
  const pi = isl.plots.findIndex(pl => !pl.structure);
  if (pi >= 0) {
    const st = G.buildStructure(state, 'A', i === 0 ? 'bolt' : 'vane',
      { site: 'plot', islandId: isl.id, plotIdx: pi, cell: [isl.plots[pi].x, isl.plots[pi].z] });
    if (st) { st.buildProgress = 1; st.hp = st.maxHp; }
  }
}
let cur = gtA.slice();
const to = [Math.round(choke.center[0]), Math.round(choke.center[1] + 3)];
let guard = 60;
while ((cur[0] !== to[0] || cur[1] !== to[1]) && guard-- > 0) {
  const dx = Math.sign(to[0] - cur[0]), dz = Math.sign(to[1] - cur[1]);
  const next = dz !== 0 ? [cur[0], cur[1] + dz] : [cur[0] + dx, cur[1]];
  const seg = G.makeSegment(state, 'A', cur, next);
  state.segments.set('A:' + seg.key, seg);
  cur = next;
}
G.recalcSupport(state, 'A');
const bolt = G.buildStructure(state, 'A', 'bolt', { site: 'endpoint', cell: cur });
if (!bolt) die('forward bolt refused: ' + G.whyNotBuild(state, 'A', 'bolt', { site: 'endpoint', cell: cur }));
bolt.buildProgress = 1; bolt.hp = bolt.maxHp;

// the corridor continues through the battery's port to a forward tail —
// the inline shape whose explosion severs everything beyond it (§14.0)
{
  let tail = cur.slice();
  for (let i = 0; i < 3; i++) {
    const next = [tail[0], tail[1] - 1];
    const seg = G.makeSegment(state, 'A', tail, next);
    state.segments.set('A:' + seg.key, seg);
    tail = next;
  }
  G.recalcSupport(state, 'A');
}

// jump the clock to wave 5
state.wave.index = 4;
state.wave.nextAt = 10;
state.time = 5;

const events = {};
let outwardBroken = false, frayedAfter = 0;
for (const name of ['structureExploded', 'networkSevered', 'structureDestroyed', 'networkRestored']) {
  G.Events.on(name, () => { events[name] = (events[name] || 0) + 1; });
}

const step = (dt) => {
  state.time += dt;
  G.economyTick(state, dt);
  G.structuresTick(state, dt);
  G.updateTransit(state, dt);
  G.combatTick(state, dt);
  G.wavesTick(state, dt);
  G.fogTick(state, dt);
  G.collapseTick(state);
};

// let the wave launch and check the script target
for (let i = 0; i < 80; i++) step(0.1);
const heavies = state.craft.filter(c => c.kind === 'heavy');
if (!heavies.length) die('wave 5 spawned no heavy strike craft');
if (!heavies.some(c => c.script && c.script.structureId === bolt.id)) {
  die('heavy strike is not scripted onto the most forward structure');
}
console.log('ok wave 5 launched,', heavies.length, 'heavies scripted onto the forward battery');

// let the strike land (generous transit budget); pause collapse destruction
// by rebuilding nothing — we want to observe the fray
let severedAt = null;
for (let i = 0; i < 1800 && !severedAt; i++) {
  step(0.1);
  if (events.networkSevered) severedAt = state.time;
}
if (!bolt.hp <= 0 && bolt.hp > 0 && !severedAt) die('heavies never severed the branch (bolt hp ' + bolt.hp + ')');
if (!events.structureExploded) die('forward structure died without exploding its outward segment');
if (!severedAt) die('explosion did not sever the network');
const frayed = [...state.segments.values()].filter(s => s.owner === 'A' && s.supportState !== 'SUPPORTED');
console.log('ok forward battery destroyed; branch frayed (' + frayed.length + ' segments unsupported)');

// the rescue: bridge from the frayed branch back to any supported cell
// (siphons may have cut several segments, so the gap can be a few cells)
const supported = state.supportedCells.A;
let best = null;
for (const s of frayed) {
  for (const end of [s.a, s.b]) {
    for (const k of supported) {
      const [sx, sz] = G.keyCell(k);
      const d = Math.abs(sx - end[0]) + Math.abs(sz - end[1]);
      if (!best || d < best.d) best = { d, from: end.slice(), to: [sx, sz] };
    }
  }
}
if (!best) die('nowhere to rescue from (frayed=' + frayed.length + ', supported=' + (supported ? supported.size : 'nil') + ')');
let cur2 = best.from.slice();
let guard2 = 12;
while ((cur2[0] !== best.to[0] || cur2[1] !== best.to[1]) && guard2-- > 0) {
  const dx = Math.sign(best.to[0] - cur2[0]), dz = Math.sign(best.to[1] - cur2[1]);
  const next = dx !== 0 ? [cur2[0] + dx, cur2[1]] : [cur2[0], cur2[1] + dz];
  if (!state.segments.has('A:' + G.segKey(cur2[0], cur2[1], next[0], next[1]))) {
    const seg = G.makeSegment(state, 'A', cur2, next);
    state.segments.set('A:' + seg.key, seg);
  }
  cur2 = next;
}
G.recalcSupport(state, 'A');
if (!events.networkRestored) die('reconnection did not restore the network');
const stillFrayed = [...state.segments.values()].filter(s => s.owner === 'A' && s.supportState !== 'SUPPORTED');
if (stillFrayed.length) die('segments still frayed after reconnection: ' + stillFrayed.length);
console.log('ok reconnection cancelled the collapse — NETWORK RESTORED');
console.log('wave5: signature sequence verified end-to-end');
