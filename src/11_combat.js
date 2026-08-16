// ================================================================
// COMBAT (§33A, §33B, §33C) — continuous, no rolls, no armour types.
// Both sides attack the other's road. Air segments are attackable only
// over open water; sea segments are sheltered within one cell of a
// coast. Shields physically absorb for what stands behind them.
// ================================================================

function angDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return Math.abs(d);
}

function overWaterPos(state, fx, fz) {
  return !state.map.land.has(cellKey(Math.round(fx), Math.round(fz)));
}

// Death pleases the gods: a downed craft pays Favor to the other side —
// whether shot from the sky or set adrift by a cut and lost to the sea.
function awardCraftBounty(state, c) {
  const foe = c.owner === 'A' ? 'P' : 'A';
  const b = CONFIG.Bounty.CRAFT_FAVOR[c.kind] || 0;
  if (b > 0) {
    state.res[foe].favor += b;
    Events.emit('bounty', { side: foe, favor: b, pos: c.pos.slice() });
  }
}

// ---- damage funnel: every hit passes through here ----
// target: {kind:'segment'|'structure'|'greatTemple'|'mover', ref, side, pos}
function applyDamage(state, target, amount, sourcePos) {
  if (state.wave.wrath) amount *= CONFIG.Wrath.DAMAGE_MULT;

  // Wind Wall (§33A.8): one endpoint, damage reduced 75%
  if (target.side === 'A' && state.time < state.powers.windwallUntil && state.powers.windwallCell) {
    const wc = state.powers.windwallCell;
    if (Math.hypot(target.pos[0] - wc[0], target.pos[1] - wc[1]) <= CONFIG.Powers.WIND_WALL.RADIUS) {
      amount *= 1 - CONFIG.Powers.WIND_WALL.DAMAGE_REDUCTION;
    }
  }

  // shields intercept for structures and segments behind them (§14.3)
  if (sourcePos && (target.kind === 'segment' || target.kind === 'structure' || target.kind === 'greatTemple')) {
    for (const sh of state.structures) {
      if (sh.type !== 'shield' || sh.owner !== target.side || sh.hp <= 0 || sh.buildProgress < 1) continue;
      if (!structureSupported(state, sh)) continue;
      if (Math.hypot(target.pos[0] - sh.cell[0], target.pos[1] - sh.cell[1]) > CONFIG.Structures.SHIELD_COVER_RADIUS) continue;
      const toAttacker = Math.atan2(sourcePos[1] - sh.cell[1], sourcePos[0] - sh.cell[0]);
      if (angDiff(toAttacker, sh.facing) > sh.arc / 2) continue;
      const absorbed = amount * sh.intercept;
      amount -= absorbed;
      damageStructure(state, sh, absorbed, 'intercept');
      break;   // one shield per hit
    }
  }

  switch (target.kind) {
    case 'segment': damageSegment(state, target.ref, amount); break;
    case 'structure': damageStructure(state, target.ref, amount, 'combat'); break;
    case 'greatTemple': {
      const gt = state.greatTemple[target.side];
      gt.hp -= amount;
      if (target.side === 'A') state.gtaLastHit = state.time;
      Events.emit('greatTempleHit', { side: target.side });
      break;
    }
    case 'mover': {
      const m = target.ref;
      let dmg = amount;
      if (m.kind === 'hauler' && state.hydrogen[m.owner]) dmg *= CONFIG.Airship.HYDROGEN_DAMAGE_MULT;
      m.hull -= dmg;
      m.lastHitAt = state.time;
      if (m.hull <= 0) {
        if (m.kind === 'priest') {
          m.state = 'dead';
          m.respawnAt = state.time + CONFIG.Priest.SUCCESSION_SECONDS;
          Events.emit('priestDead', { side: m.owner });
        } else if (m.kind === 'hauler') {
          m.state = 'dead';
          Events.emit('convoyLost', { ent: m });
        } else {
          m.dead = true;
          awardCraftBounty(state, m);
          Events.emit('craftDestroyed', { craft: m });
        }
      }
      break;
    }
  }
}

// ---- target enumeration ----
function enemyMovers(state, side) {
  const foe = side === 'A' ? 'P' : 'A';
  const out = [];
  for (const h of state.haulers) {
    if (h.owner === foe && h.state !== 'dead' && h.state !== 'idle') out.push(h);
  }
  const p = state.priests[foe];
  if (p && (p.state === 'transit' || p.state === 'adrift')) out.push(p);
  if (side === 'A') for (const c of state.craft) if (!c.dead) out.push(c);
  return out;
}

// Guns (towers, both sides) can cut any unsheltered enemy segment in range;
// CRAFT are restricted to raw open ends. Waves cannot melt a road along its
// length, but emplaced artillery keeps the lane-cutting verb — symmetric.
function enemySegments(state, side, gunSource) {
  const foe = side === 'A' ? 'P' : 'A';
  const out = [];
  for (const s of state.segments.values()) {
    if (s.owner !== foe) continue;
    if (!gunSource && !s.rawEnd) continue;            // craft: raw open ends only
    if (foe === 'A' && !s.overWater) continue;       // island crossings untouchable (§33B.1)
    if (foe === 'P' && s.sheltered) continue;         // lee shore (§33B.2a)
    out.push(s);
  }
  return out;
}

function enemyStructureTargets(state, side) {
  const foe = side === 'A' ? 'P' : 'A';
  const out = [];
  for (const st of state.structures) {
    if (st.owner === foe && st.hp > 0) out.push({ kind: 'structure', ref: st, side: foe, pos: st.cell });
  }
  const gt = state.greatTemple[foe];
  if (gt.hp > 0) out.push({ kind: 'greatTemple', ref: gt, side: foe, pos: gt.cell });
  return out;
}

function segMid(s) { return [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2]; }

// visibility gate: the AI obeys fog too (§14B.5); both sides may only
// target what they can currently see
function canSee(state, side, pos) {
  return state.vision[side].has(cellKey(Math.round(pos[0]), Math.round(pos[1])));
}

// ---- gun resolution ----
function gunTick(state, st, dt) {
  if (st.hp <= 0 || st.buildProgress < 1 || (st.type !== 'vane' && st.type !== 'bolt' && st.type !== 'mast')) return;
  if (!structureSupported(state, st)) return;   // nothing fires without support (§14.4.3)
  const side = st.owner;
  let dps = st.dps, range = st.type === 'vane' ? st.radius : st.range;

  // Fog Bank halves player gun range and damage in region (§33A.8)
  if (side === 'A' && state.powers.fog && state.time < state.powers.fog.until) {
    const f = state.powers.fog;
    if (Math.hypot(st.cell[0] - f.cell[0], st.cell[1] - f.cell[1]) <= CONFIG.Powers.FOG_BANK.RADIUS) {
      dps *= CONFIG.Powers.FOG_BANK.BOLT_PENALTY;
      range *= CONFIG.Powers.FOG_BANK.BOLT_PENALTY;
    }
  }

  const inRange = (pos) => Math.hypot(pos[0] - st.cell[0], pos[1] - st.cell[1]) <= range;

  // masts and siphon-type sources cannot hit airships over land (§33C.6)
  const moverTargets = enemyMovers(state, side).filter(m => {
    if (!inRange(m.pos) || !canSee(state, side, m.pos)) return false;
    if (side === 'P' && !overWaterPos(state, m.pos[0], m.pos[1])) return false;
    return true;
  }).map(m => ({ kind: 'mover', ref: m, side: m.owner, pos: m.pos }));

  const structTargets = enemyStructureTargets(state, side).filter(t => inRange(t.pos) && canSee(state, side, t.pos));
  const segTargets = enemySegments(state, side, true)
    .filter(s => inRange(segMid(s)) && canSee(state, side, segMid(s)))
    .map(s => ({ kind: 'segment', ref: s, side: s.owner, pos: segMid(s) }));

  if (st.type === 'vane') {
    // radial: hits every valid target in radius
    const all = [...moverTargets, ...structTargets, ...segTargets];
    for (const t of all) {
      const mult = t.kind === 'segment' ? CONFIG.Structures.GUN_VS_SEGMENT_MULT : 1;
      applyDamage(state, t, dps * mult * dt, st.cell);
    }
    if (all.length && (!st.nextFxAt || state.time >= st.nextFxAt)) {
      st.nextFxAt = state.time + 0.3;
      Events.emit('gunFired', { side, from: st.cell, to: all[0].pos, targetSide: all[0].side, kind: all[0].kind });
    }
    return;
  }

  // directional: prefer craft > structures > segments, nearest first (§33A.1)
  const pick = moverTargets.concat(structTargets, segTargets)
    .sort((a, b) =>
      Math.hypot(a.pos[0] - st.cell[0], a.pos[1] - st.cell[1]) -
      Math.hypot(b.pos[0] - st.cell[0], b.pos[1] - st.cell[1]));
  // FIXED-SECTOR artillery (player-directed): the wedge aimed at
  // placement is the only ground this gun ever covers, so candidates
  // outside the sector are not targets at all
  const inSector = (t) => angDiff(
    Math.atan2(t.pos[1] - st.cell[1], t.pos[0] - st.cell[0]), st.facing) <= (st.arc || Math.PI * 2) / 2;
  const pickable = st.turn > 0 ? pick : pick.filter(inSector);
  // stable class priority; among structures, silence the guns shooting
  // back BEFORE battering the temple — sieges fail when the bolt trades
  // with a monument while the defenders shred it
  const armed = (t) => t.kind === 'structure' && (t.ref.dps || 0) > 0 ? 0 : 1;
  const target = pickable.find(t => t.kind === 'mover')
    || pickable.filter(t => t.kind === 'structure' || t.kind === 'greatTemple')
        .sort((a, b) => armed(a) - armed(b))[0]
    || pickable[0];
  if (!target) return;

  // legacy traverse path (turn > 0); fixed guns skip straight to firing
  const want = Math.atan2(target.pos[1] - st.cell[1], target.pos[0] - st.cell[0]);
  if (st.turn > 0) {
    const d = want - st.facing;
    const wrapped = Math.atan2(Math.sin(d), Math.cos(d));
    const maxTurn = st.turn * dt;
    st.facing += clamp(wrapped, -maxTurn, maxTurn);
  }
  if (angDiff(want, st.facing) <= (st.arc || Math.PI * 2) / 2) {
    const segMult = target.kind === 'segment' ? CONFIG.Structures.GUN_VS_SEGMENT_MULT : 1;
    applyDamage(state, target, dps * segMult * dt, st.cell);
    st.firingAt = target.pos.slice();
    st.lastFired = state.time;
    if (!st.nextFxAt || state.time >= st.nextFxAt) {
      st.nextFxAt = state.time + 0.25;
      Events.emit('gunFired', { side, from: st.cell, to: target.pos, targetSide: target.side, kind: target.kind });
    }
  }
}

// ---- craft attacks (transports, siphons, heavies) are resolved in the
// wave system where their movement lives; combatTick runs the guns ----
function combatTick(state, dt) {
  for (const st of state.structures) gunTick(state, st, dt);
}
