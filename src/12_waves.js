// ================================================================
// WAVES (§16, §16A, §17, §18) — nine authored, telegraphed assaults.
// Waves launch from Poseidon's temple nearest the player's forward
// holdings; strength scales with his temple count, floored so he
// always attacks. Wave 5 is the scripted strike on the most forward
// player structure. Wave 8 is the Age of Wrath.
// ================================================================

function waveInterval(index) {
  const W = CONFIG.Waves;
  if (index + 1 >= W.LATE_FROM_WAVE) return W.INTERVAL_LATE;
  if (index + 1 >= W.MID_FROM_WAVE) return W.INTERVAL_MID;
  return W.INTERVAL_EARLY;
}

// Poseidon's standing complete island temples
function poseidonTempleCount(state) {
  let n = 0;
  for (const isl of state.map.islands) {
    if (isl.temple && isl.temple.owner === 'P' && isl.temple.hp > 0 && isl.temple.buildProgress >= 1) n++;
  }
  return n;
}

function waveStrength(state) {
  const W = CONFIG.Waves;
  return clamp(W.STRENGTH_BASE + W.STRENGTH_PER_TEMPLE * poseidonTempleCount(state), W.STRENGTH_MIN, W.STRENGTH_MAX);
}

// the player's most forward holding (largest distance from their temple)
function forwardHolding(state) {
  const gt = state.greatTemple.A.cell;
  let best = gt, bd = -1;
  for (const st of state.structures) {
    if (st.owner !== 'A' || st.hp <= 0) continue;
    const d = Math.abs(st.cell[0] - gt[0]) + Math.abs(st.cell[1] - gt[1]);
    if (d > bd) { bd = d; best = st.cell; }
  }
  for (const s of state.segments.values()) {
    if (s.owner !== 'A') continue;
    const d = Math.abs(s.a[0] - gt[0]) + Math.abs(s.a[1] - gt[1]);
    if (d > bd) { bd = d; best = s.a; }
  }
  return best;
}

// wave origin: his conducting temple nearest the player's forward holdings,
// else his Great Temple (§16A.3)
function waveOrigin(state) {
  const fwd = forwardHolding(state);
  let best = null, bd = Infinity;
  for (const isl of state.map.islands) {
    if (isl.temple && isl.temple.owner === 'P' && isl.temple.hp > 0 && isl.temple.buildProgress >= 1) {
      const d = dist2d(isl.temple.cell[0], isl.temple.cell[1], fwd[0], fwd[1]);
      if (d < bd) { bd = d; best = { cell: isl.temple.cell, island: isl }; }
    }
  }
  if (!best) best = { cell: state.greatTemple.P.cell, island: state.gtP };
  return best;
}

// nearest water cell to a cell (spawn point / approach goal)
function nearestWater(state, cell, avoid) {
  let frontier = [[cell[0], cell[1]]];
  const seen = new Set([cellKey(cell[0], cell[1])]);
  while (frontier.length) {
    const next = [];
    for (const [x, z] of frontier) {
      if (!state.map.land.has(cellKey(x, z))) return [x, z];
      for (const [dx, dz] of DIRS4) {
        const k = cellKey(x + dx, z + dz);
        if (!inBounds(x + dx, z + dz) || seen.has(k)) continue;
        seen.add(k);
        next.push([x + dx, z + dz]);
      }
    }
    frontier = next;
  }
  return cell;
}

// Poseidon's craft operate only in waters his lane network reaches: within
// REACH_FROM_LANES of a supported lane, a conducting island of his, or his
// Great Temple island. He must build toward the player to strike them.
function poseidonReach(state) {
  if (state.pReach && state.time - state.pReach.at < 1.0) return state.pReach.set;
  const seeds = [];
  for (const s of state.segments.values()) {
    if (s.owner === 'P' && s.supportState === 'SUPPORTED') seeds.push(s.a, s.b);
  }
  for (const isl of state.map.islands) {
    if (islandConducts(state, isl, 'P')) seeds.push(...isl.cells);
  }
  seeds.push(...state.gtP.cells);
  const R = CONFIG.Craft.REACH_FROM_LANES;
  const set = new Set();
  for (const [sx, sz] of seeds) {
    for (let dz = -Math.ceil(R); dz <= Math.ceil(R); dz++) {
      for (let dx = -Math.ceil(R); dx <= Math.ceil(R); dx++) {
        if (Math.hypot(dx, dz) > R) continue;
        const x = sx + dx, z = sz + dz;
        if (inBounds(x, z)) set.add(cellKey(x, z));
      }
    }
  }
  state.pReach = { set, at: state.time };
  return set;
}

function waterPath(state, from, to, side) {
  const start = nearestWater(state, [Math.round(from[0]), Math.round(from[1])]);
  const goal = nearestWater(state, [Math.round(to[0]), Math.round(to[1])]);
  const reach = side === 'P' ? poseidonReach(state) : null;
  return bfsPath([start], new Set([cellKey(goal[0], goal[1])]),
    (x, z) => !state.map.land.has(cellKey(x, z)) && (!reach || reach.has(cellKey(x, z))));
}

function spawnCraft(state, kind, origin, script) {
  const def = kind === 'transport' ? CONFIG.Craft.TRANSPORT : kind === 'siphon' ? CONFIG.Craft.SIPHON : CONFIG.Craft.HEAVY;
  const c = {
    id: eid(), kind, owner: 'P',
    pos: origin.cell.slice(),      // spawns on his network (lane-bound)
    hull: def.HP, maxHull: def.HP,
    dps: def.DPS, range: Math.max(def.RANGE, 1.1), speed: def.SPEED,
    path: null, legIndex: 0, legT: 0,
    target: null, retargetAt: 0,
    script: script || null,   // wave-5 scripted strike carries a fixed target
    dead: false
  };
  state.craft.push(c);
  return c;
}

function launchWave(state) {
  const W = CONFIG.Waves;
  const idx = state.wave.index;               // 0-based
  const comp = W.COMPOSITION[idx];
  const mult = waveStrength(state);
  const origin = state.wave.origin || waveOrigin(state);
  const count = comp.map(n => Math.max(n > 0 ? 1 : 0, Math.round(n * mult)));

  // wave 5's heavies are scripted onto the most forward player structure (§18)
  let scriptTarget = null;
  if (idx + 1 === 5) {
    let bd = -1;
    const gt = state.greatTemple.A.cell;
    for (const st of state.structures) {
      if (st.owner !== 'A' || st.hp <= 0 || st.site !== 'endpoint') continue;
      const d = Math.abs(st.cell[0] - gt[0]) + Math.abs(st.cell[1] - gt[1]);
      if (d > bd) { bd = d; scriptTarget = st; }
    }
  }

  for (let i = 0; i < count[0]; i++) spawnCraft(state, 'transport', origin);
  for (let i = 0; i < count[1]; i++) spawnCraft(state, 'siphon', origin);
  for (let i = 0; i < count[2]; i++) spawnCraft(state, 'heavy', origin, scriptTarget ? { structureId: scriptTarget.id } : null);

  // divine escalation (§19.2)
  if (idx + 1 >= 6) castTidalSurge(state);
  if (idx + 1 >= 7) castFogBank(state);
  if (idx + 1 === CONFIG.Wrath.WAVE) {
    state.wave.wrath = true;
    Events.emit('ageOfWrath', {});
  }
  Events.emit('waveLaunched', { index: idx });
}

function castTidalSurge(state) {
  // a supernatural wave centred on the player's most forward over-water
  // structure; sheltered ground is untouched (§33B.1)
  let center = null, bd = -1;
  const gt = state.greatTemple.A.cell;
  for (const st of state.structures) {
    if (st.owner !== 'A' || st.hp <= 0 || st.site !== 'endpoint') continue;
    if (!overWaterPos(state, st.cell[0], st.cell[1])) continue;
    const d = Math.abs(st.cell[0] - gt[0]) + Math.abs(st.cell[1] - gt[1]);
    if (d > bd) { bd = d; center = st.cell; }
  }
  if (!center) return;
  const P = CONFIG.Powers.TIDAL_SURGE;
  for (const st of state.structures) {
    if (st.owner !== 'A' || st.site !== 'endpoint') continue;
    if (!overWaterPos(state, st.cell[0], st.cell[1])) continue;
    if (dist2d(st.cell[0], st.cell[1], center[0], center[1]) <= P.RADIUS) {
      applyDamage(state, { kind: 'structure', ref: st, side: 'A', pos: st.cell }, P.DAMAGE, null);
    }
  }
  for (const s of [...state.segments.values()]) {
    if (s.owner !== 'A' || !s.overWater) continue;
    const m = segMid(s);
    if (dist2d(m[0], m[1], center[0], center[1]) <= P.RADIUS) {
      applyDamage(state, { kind: 'segment', ref: s, side: 'A', pos: m }, P.DAMAGE, null);
    }
  }
  Events.emit('tidalSurge', { center });
}

function castFogBank(state) {
  // dropped on the player's densest cluster of guns
  let best = null, bs = 0;
  for (const st of state.structures) {
    if (st.owner !== 'A' || (st.type !== 'bolt' && st.type !== 'vane') || st.hp <= 0) continue;
    let n = 0;
    for (const o of state.structures) {
      if (o.owner === 'A' && (o.type === 'bolt' || o.type === 'vane') && o.hp > 0 &&
          dist2d(st.cell[0], st.cell[1], o.cell[0], o.cell[1]) <= CONFIG.Powers.FOG_BANK.RADIUS) n++;
    }
    if (n > bs) { bs = n; best = st.cell; }
  }
  if (!best) return;
  state.powers.fog = { cell: best.slice(), until: state.time + CONFIG.Powers.FOG_BANK.DURATION };
  Events.emit('fogBank', { center: best });
}

// ---- craft behaviour ----
function targetKey(t) {
  return t.kind + ':' + (t.ref && t.ref.id !== undefined ? t.ref.id : (t.ref && t.ref.key) || t.side);
}

function targetAllowed(c, t, state) {
  return !(c.avoidTargets && c.avoidTargets.has(targetKey(t)) && state.time < c.avoidTargets.get(targetKey(t)));
}

function craftPickTarget(state, c) {
  const inR = (pos, r) => dist2d(pos[0], pos[1], c.pos[0], c.pos[1]) <= r;
  if (c.script) {
    const st = state.structures.find(s => s.id === c.script.structureId && s.hp > 0);
    if (st) return { kind: 'structure', ref: st, side: 'A', pos: st.cell };
    c.script = null;
  }
  const structs = enemyStructureTargets(state, 'P').filter(t => targetAllowed(c, t, state));
  if (c.kind === 'transport' || c.kind === 'heavy') {
    // island structures and temples first, else the Great Temple
    const pref = structs.filter(t => t.kind === 'greatTemple' || t.ref.site === 'plot' || c.kind === 'heavy');
    const pool = pref.length ? pref : structs;
    let best = null, bd = Infinity;
    for (const t of pool) {
      const d = dist2d(t.pos[0], t.pos[1], c.pos[0], c.pos[1]);
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }
  // siphon: raw air-route ends over open water, then over-water structures
  let best = null, bd = Infinity;
  for (const s of state.segments.values()) {
    if (s.owner !== 'A' || !s.overWater || !s.rawEnd) continue;
    const m = segMid(s);
    const t = { kind: 'segment', ref: s, side: 'A', pos: m };
    if (!targetAllowed(c, t, state)) continue;
    const d = dist2d(m[0], m[1], c.pos[0], c.pos[1]);
    if (d < bd) { bd = d; best = t; }
  }
  if (!best) {
    for (const t of structs) {
      if (t.kind === 'structure' && t.ref.site === 'endpoint' && overWaterPos(state, t.pos[0], t.pos[1])) {
        const d = dist2d(t.pos[0], t.pos[1], c.pos[0], c.pos[1]);
        if (d < bd) { bd = d; best = t; }
      }
    }
  }
  return best;
}

// His craft are lane-bound (player-directed rule): they travel his network
// exactly as his haulers do, halt on the lane within weapon range, and fire
// from there. Cut the lane beneath one and it goes adrift like anything else.
function shelveTarget(state, c) {
  if (!c.avoidTargets) c.avoidTargets = new Map();
  if (c.target) c.avoidTargets.set(targetKey(c.target), state.time + 12);
  c.target = null;
  c.path = null;
  c.retargetAt = state.time + 1.5;
}

function updateCraft(state, c, dt) {
  if (c.dead) return;
  if (c.state === 'adrift') {
    const r = adriftTick(state, c, dt);
    if (r === 'lost') { c.dead = true; Events.emit('craftDestroyed', { craft: c }); }
    else if (r === 'rebound') { c.state = 'hunt'; c.path = null; }
    return;
  }
  if (!c.target || state.time >= c.retargetAt ||
      (c.target.kind === 'structure' && c.target.ref.hp <= 0) ||
      (c.target.kind === 'segment' && !state.segments.has('A:' + c.target.ref.key))) {
    c.target = craftPickTarget(state, c);
    c.retargetAt = state.time + 3;
    c.path = null;
  }
  if (!c.target) return;
  const d = dist2d(c.target.pos[0], c.target.pos[1], c.pos[0], c.pos[1]);
  if (d <= c.range) {
    // a stationary attacker while engaged, moored on his own lane
    applyDamage(state, c.target, c.dps * dt, c.pos);
    if (!c.nextFxAt || state.time >= c.nextFxAt) {
      c.nextFxAt = state.time + 0.35;
      Events.emit('craftFired', { from: c.pos, to: c.target.pos, targetSide: c.target.side, kind: c.target.kind });
    }
    return;
  }
  if (!c.path) {
    // find the network cell nearest the target that his lanes reach and
    // that lies inside this craft's weapon range of it
    const adj = buildNetGraph(state, 'P');
    let bestCell = null, bd = Infinity;
    for (const k of adj.keys()) {
      const [x, z] = keyCell(k);
      const dd = dist2d(x, z, c.target.pos[0], c.target.pos[1]);
      if (dd <= c.range - 0.05 && dd < bd) { bd = dd; bestCell = [x, z]; }
    }
    if (!bestCell) { shelveTarget(state, c); return; }
    const path = findNetPath(state, 'P', [Math.round(c.pos[0]), Math.round(c.pos[1])], [bestCell]);
    if (!path || path.length < 1) { shelveTarget(state, c); return; }
    c.path = path;
    c.legIndex = 0;
    c.legT = 0;
  }
  const r = advanceOnPath(state, c, dt);
  if (r === 'adrift') { enterAdrift(state, c); c.state = 'adrift'; }
  else if (r === 'arrived') c.path = null;
}

// ---- the schedule ----
function wavesTick(state, dt) {
  const W = CONFIG.Waves;
  const w = state.wave;
  if (w.index < W.COUNT) {
    if (!w.telegraphed && state.time >= w.nextAt - W.TELEGRAPH) {
      w.telegraphed = true;
      w.origin = waveOrigin(state);
      Events.emit('waveTelegraph', { index: w.index, origin: w.origin });
    }
    if (state.time >= w.nextAt) {
      launchWave(state);
      w.index++;
      w.telegraphed = false;
      w.origin = null;
      w.nextAt += waveInterval(w.index);
    }
  }
  for (const c of state.craft) updateCraft(state, c, dt);
  state.craft = state.craft.filter(c => !c.dead);
}
