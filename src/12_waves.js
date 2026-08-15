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

function waterPath(state, from, to) {
  const start = nearestWater(state, [Math.round(from[0]), Math.round(from[1])]);
  const goal = nearestWater(state, [Math.round(to[0]), Math.round(to[1])]);
  return bfsPath([start], new Set([cellKey(goal[0], goal[1])]), (x, z) => !state.map.land.has(cellKey(x, z)));
}

function spawnCraft(state, kind, origin, script) {
  const def = kind === 'transport' ? CONFIG.Craft.TRANSPORT : kind === 'siphon' ? CONFIG.Craft.SIPHON : CONFIG.Craft.HEAVY;
  const c = {
    id: eid(), kind, owner: 'P',
    pos: nearestWater(state, origin.cell).map(v => v + 0),
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
function craftPickTarget(state, c) {
  const inR = (pos, r) => dist2d(pos[0], pos[1], c.pos[0], c.pos[1]) <= r;
  if (c.script) {
    const st = state.structures.find(s => s.id === c.script.structureId && s.hp > 0);
    if (st) return { kind: 'structure', ref: st, side: 'A', pos: st.cell };
    c.script = null;
  }
  const structs = enemyStructureTargets(state, 'P');   // player structures + GT
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
    const d = dist2d(m[0], m[1], c.pos[0], c.pos[1]);
    if (d < bd) { bd = d; best = { kind: 'segment', ref: s, side: 'A', pos: m }; }
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

function updateCraft(state, c, dt) {
  if (c.dead) return;
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
    // fire (vision is implicit: it is adjacent)
    applyDamage(state, c.target, c.dps * dt, c.pos);
    if (!c.nextFxAt || state.time >= c.nextFxAt) {
      c.nextFxAt = state.time + 0.35;
      Events.emit('craftFired', { from: c.pos, to: c.target.pos, targetSide: c.target.side, kind: c.target.kind });
    }
    return;
  }
  if (!c.path) {
    c.path = waterPath(state, c.pos, c.target.pos);
    c.legIndex = 0; c.legT = 0;
    if (!c.path || c.path.length < 2) { c.path = null; return; }
  }
  // advance along water path with slight sea wind effect
  const a = c.path[c.legIndex], b = c.path[Math.min(c.legIndex + 1, c.path.length - 1)];
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) || 1;
  const mult = state.wind.multiplier(c.pos[0], c.pos[1], dx / len, dz / len, false);
  c.legT += c.speed * mult * dt;
  while (c.legT >= 1 && c.legIndex < c.path.length - 2) { c.legT -= 1; c.legIndex++; }
  const na = c.path[c.legIndex], nb = c.path[Math.min(c.legIndex + 1, c.path.length - 1)];
  c.pos = [lerp(na[0], nb[0], Math.min(c.legT, 1)), lerp(na[1], nb[1], Math.min(c.legT, 1))];
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
