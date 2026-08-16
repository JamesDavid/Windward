// ================================================================
// HAULERS, TRANSIT, ADRIFT, AND THE PRIEST (§12, §33C, §33D, §33G, §14.8)
// Ships follow the network and only the network. Cut the road beneath
// one and it tumbles downwind, bleeding hull, until it touches a
// supported friendly segment or dies.
// ================================================================

// A standing complete defense ON THE ROAD is solid (player-directed):
// nothing moors to it and nothing sails through it — not even its own
// side's ships. On island ground a tower doesn't seal the island; ships
// pass over open ground freely.
function blocksTransit(state, x, z) {
  const st = structureAt(state, x, z);
  return !!(st && st.hp > 0 && st.buildProgress >= 1 && st.site === 'endpoint' &&
    (st.type === 'vane' || st.type === 'bolt' || st.type === 'shield' || st.type === 'mast'));
}

// ---- network graph for transit ----
// Adjacency over cells: supported segments, plus orthogonal adjacency
// inside islands that conduct for the side (temples bridge islands).
// Cells occupied by a standing defense are excluded outright.
function buildNetGraph(state, side) {
  const adj = new Map();
  const link = (ka, kb) => {
    if (!adj.has(ka)) adj.set(ka, new Set());
    if (!adj.has(kb)) adj.set(kb, new Set());
    adj.get(ka).add(kb);
    adj.get(kb).add(ka);
  };
  for (const s of state.segments.values()) {
    if (s.owner !== side || s.supportState !== 'SUPPORTED') continue;
    if (blocksTransit(state, s.a[0], s.a[1]) || blocksTransit(state, s.b[0], s.b[1])) continue;
    link(cellKey(s.a[0], s.a[1]), cellKey(s.b[0], s.b[1]));
  }
  for (const isl of state.map.islands) {
    if (!islandConducts(state, isl, side) || !islandSupported(state, isl, side)) continue;
    for (const [x, z] of isl.cells) {
      if (blocksTransit(state, x, z)) continue;
      for (const [dx, dz] of DIRS4) {
        if (!isl.cellSet.has(cellKey(x + dx, z + dz))) continue;
        if (blocksTransit(state, x + dx, z + dz)) continue;
        link(cellKey(x, z), cellKey(x + dx, z + dz));
      }
    }
  }
  return adj;
}

function findNetPath(state, side, fromCell, toCells) {
  const adj = buildNetGraph(state, side);
  const target = new Set(toCells.map(c => cellKey(c[0], c[1])));
  const start = cellKey(fromCell[0], fromCell[1]);
  if (!adj.has(start)) return null;
  const prev = new Map([[start, null]]);
  let frontier = [start];
  while (frontier.length) {
    const next = [];
    for (const k of frontier) {
      if (target.has(k)) {
        const path = [];
        let cur = k;
        while (cur !== null) { path.push(keyCell(cur)); cur = prev.get(cur); }
        path.reverse();
        return path;
      }
      for (const n of adj.get(k) || []) {
        if (!prev.has(n)) { prev.set(n, k); next.push(n); }
      }
    }
    frontier = next;
  }
  return null;
}

// ---- shared transit-entity movement ----
// ent: {pos:[fx,fz], path, legIndex, legT, owner, kind}
function legSpeed(state, ent, a, b) {
  const isAir = ent.owner === 'A';
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) || 1;
  let mult = state.wind.multiplier((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, dx / len, dz / len, isAir);
  const base = ent.kind === 'priest' ? CONFIG.Priest.SPEED : (ent.speed || CONFIG.Hauler.SPEED);
  if (ent.owner === 'A' && state.time < state.powers.tailwindUntil) mult *= CONFIG.Powers.TAILWIND.SPEED_MULT;
  return base * mult;
}

// Does the leg the entity is riding still exist and hold? A defense
// completed mid-journey seals the road: the ship slips loose and drifts.
function legIntact(state, ent, a, b) {
  const side = ent.owner;
  if (blocksTransit(state, a[0], a[1]) || blocksTransit(state, b[0], b[1])) return false;
  const ia = islandAt(state, a[0], a[1]), ib = islandAt(state, b[0], b[1]);
  if (ia && ia === ib) return islandConducts(state, ia, side) && islandSupported(state, ia, side);
  const seg = state.segments.get(side + ':' + segKey(a[0], a[1], b[0], b[1]));
  return !!(seg && seg.supportState === 'SUPPORTED');
}

// advance along path; returns 'moving' | 'arrived' | 'adrift'
function advanceOnPath(state, ent, dt) {
  if (!ent.path || ent.legIndex >= ent.path.length - 1) return 'arrived';
  const a = ent.path[ent.legIndex], b = ent.path[ent.legIndex + 1];
  if (!legIntact(state, ent, a, b)) return 'adrift';
  ent.legT += legSpeed(state, ent, a, b) * dt;
  while (ent.legT >= 1) {
    ent.legT -= 1;
    ent.legIndex++;
    if (ent.legIndex >= ent.path.length - 1) {
      const end = ent.path[ent.path.length - 1];
      ent.pos = [end[0], end[1]];
      return 'arrived';
    }
  }
  const na = ent.path[ent.legIndex], nb = ent.path[ent.legIndex + 1];
  ent.pos = [lerp(na[0], nb[0], ent.legT), lerp(na[1], nb[1], ent.legT)];
  return 'moving';
}

// Is this entity's mooring gone? True when it sits on an island the side's
// network no longer conducts/supports, or floats with no supported segment
// nearby. The Great Temple island is always home.
function strandedHere(state, ent) {
  const isl = islandAt(state, Math.round(ent.pos[0]), Math.round(ent.pos[1]));
  if (isl) {
    if (isl.role === (ent.owner === 'A' ? 'greatTempleA' : 'greatTempleP')) return false;
    // an island is a safe mooring while ANY supported friendly route
    // touches it (a neutral island being consecrated qualifies)
    return !islandSupported(state, isl, ent.owner);
  }
  return !nearestSupportedCell(state, ent.owner, ent.pos[0], ent.pos[1], CONFIG.Adrift.REBOUND_RADIUS);
}

// nearest supported friendly segment within radius (for adrift rebound)
function nearestSupportedCell(state, side, fx, fz, radius) {
  let best = null, bd = radius;
  for (const s of state.segments.values()) {
    if (s.owner !== side || s.supportState !== 'SUPPORTED') continue;
    for (const c of [s.a, s.b]) {
      if (blocksTransit(state, c[0], c[1])) continue;   // nothing moors to a defense
      const d = Math.hypot(c[0] - fx, c[1] - fz);
      if (d <= bd) { bd = d; best = c; }
    }
  }
  return best;
}

function enterAdrift(state, ent) {
  ent.state = 'adrift';
  ent.path = null;
  Events.emit('wentAdrift', { ent });
}

function adriftTick(state, ent, dt) {
  const w = state.wind.at(ent.pos[0], ent.pos[1]);
  const mult = ent.owner === 'A' ? 1 : CONFIG.Adrift.SEA_BEARING_MULT;
  ent.pos[0] += w.x * CONFIG.Adrift.SPEED * mult * dt;
  ent.pos[1] += w.z * CONFIG.Adrift.SPEED * mult * dt;
  ent.hull -= CONFIG.Adrift.ATTRITION_PER_SECOND * dt;
  if (ent.hull <= 0 ||
      ent.pos[0] < -1 || ent.pos[0] > CONFIG.Grid.WIDTH ||
      ent.pos[1] < -1 || ent.pos[1] > CONFIG.Grid.HEIGHT) {
    return 'lost';
  }
  const cell = nearestSupportedCell(state, ent.owner, ent.pos[0], ent.pos[1], CONFIG.Adrift.REBOUND_RADIUS);
  if (cell) {
    ent.pos = [cell[0], cell[1]];
    Events.emit('rebound', { ent });
    return 'rebound';
  }
  return 'drifting';
}

// ---- haulers ----
function spawnHauler(state, side) {
  const h = {
    id: eid(), kind: 'hauler', owner: side,
    pos: state.greatTemple[side].cell.slice(),
    hull: CONFIG.Airship.HULL, maxHull: CONFIG.Airship.HULL,
    capacity: haulerCapacity(state, side),
    cargo: 0,
    state: 'idle', path: null, legIndex: 0, legT: 0,
    targetIsland: null, timer: 0, lastHitAt: -99
  };
  state.haulers.push(h);
  return h;
}

function buyHauler(state, side) {
  const alive = state.haulers.filter(h => h.owner === side && h.state !== 'dead').length;
  if (alive >= fleetCap(state, side)) return false;
  if (state.res[side].supply < CONFIG.Hauler.COST) return false;
  state.res[side].supply -= CONFIG.Hauler.COST;
  spawnHauler(state, side);   // build time abstracted to instant spawn at temple
  Events.emit('haulerBuilt', { side });
  return true;
}

// island worth collecting from, favouring big stockpiles. Haulers work
// ANY island the network connects to that is open to their side — neutral
// quarries included; a rival's claim shuts the pile away.
function pickCollectionTarget(state, side) {
  let best = null, bs = 1;   // require at least 1 in the pile
  for (const isl of state.map.islands) {
    if (!miningRights(state, isl, side)) continue;
    const claimed = state.haulers.filter(h => h.owner === side && h.targetIsland === isl.id &&
      (h.state === 'toIsland' || h.state === 'dwelling')).length;
    const score = isl.stockpile - claimed * haulerCapacity(state, side);
    if (score > bs) { bs = score; best = isl; }
  }
  return best;
}

function updateHauler(state, h, dt) {
  const side = h.owner;
  // regeneration (§33C.2)
  if (h.state !== 'adrift' && h.hull < h.maxHull && state.time - h.lastHitAt > CONFIG.Airship.REGEN_DELAY) {
    const isl = islandAt(state, Math.round(h.pos[0]), Math.round(h.pos[1]));
    const overFriendly = isl && isl.owner === side;
    h.hull = Math.min(h.maxHull, h.hull + (overFriendly ? CONFIG.Airship.MOORING_REGEN : CONFIG.Airship.REGEN_PER_SECOND) * dt);
  }

  switch (h.state) {
    case 'idle': {
      // a balloon cannot hold its mooring where the network no longer
      // reaches: stranded on a dark island, it slips loose and drifts
      if (strandedHere(state, h)) {
        h.strandedSince = h.strandedSince || state.time;
        if (state.time - h.strandedSince > CONFIG.Adrift.STRAND_GRACE) enterAdrift(state, h);
        break;
      }
      h.strandedSince = null;
      const target = pickCollectionTarget(state, side);
      if (target) {
        const path = findNetPath(state, side, [Math.round(h.pos[0]), Math.round(h.pos[1])], target.cells);
        if (path && path.length > 1) {
          h.targetIsland = target.id;
          h.path = path; h.legIndex = 0; h.legT = 0;
          h.state = 'toIsland';
        }
      }
      break;
    }
    case 'toIsland': {
      const r = advanceOnPath(state, h, dt);
      if (r === 'adrift') { enterAdrift(state, h); break; }
      if (r === 'arrived') { h.state = 'dwelling'; h.timer = CONFIG.Hauler.DWELL_SECONDS; }
      break;
    }
    case 'dwelling': {
      h.timer -= dt;
      if (h.timer <= 0) {
        const isl = state.map.islands[h.targetIsland];
        const take = Math.min(h.capacity, Math.floor(isl ? isl.stockpile : 0));
        if (isl) isl.stockpile -= take;
        h.cargo = take;
        const home = state.greatTemple[side];
        const path = findNetPath(state, side, [Math.round(h.pos[0]), Math.round(h.pos[1])], [home.cell]);
        if (path) { h.path = path; h.legIndex = 0; h.legT = 0; h.state = 'toHome'; }
        else enterAdrift(state, h);   // road home is gone
      }
      break;
    }
    case 'toHome': {
      const r = advanceOnPath(state, h, dt);
      if (r === 'adrift') { enterAdrift(state, h); break; }
      if (r === 'arrived') { h.state = 'unloading'; h.timer = CONFIG.Hauler.UNLOAD_SECONDS; }
      break;
    }
    case 'unloading': {
      h.timer -= dt;
      if (h.timer <= 0) {
        state.res[side].supply += h.cargo;
        if (h.cargo > 0) Events.emit('delivery', { side, amount: h.cargo });
        h.cargo = 0;
        h.targetIsland = null;
        h.state = 'idle';
      }
      break;
    }
    case 'adrift': {
      const r = adriftTick(state, h, dt);
      if (r === 'lost') {
        h.state = 'dead';
        Events.emit('convoyLost', { ent: h });
      } else if (r === 'rebound') {
        h.state = h.cargo > 0 ? 'toHome' : 'idle';
        if (h.state === 'toHome') {
          const path = findNetPath(state, side, [Math.round(h.pos[0]), Math.round(h.pos[1])], [state.greatTemple[side].cell]);
          if (path) { h.path = path; h.legIndex = 0; h.legT = 0; }
          else h.state = 'idle';
        }
      }
      break;
    }
  }
}

// ---- the priest (§14.8) ----
function spawnPriest(state, side) {
  const p = {
    id: eid(), kind: 'priest', owner: side,
    pos: state.greatTemple[side].cell.slice(),
    hull: CONFIG.Priest.HULL, maxHull: CONFIG.Priest.HULL,
    state: 'idle',                 // idle | transit | consecrating | adrift | dead
    path: null, legIndex: 0, legT: 0,
    islandId: state.greatTemple[side].island.id,
    consecrating: null,            // {islandId, plot}
    respawnAt: 0, lastHitAt: -99
  };
  state.priests[side] = p;
  return p;
}

// Tap a destination island: refused unless the side's supported network
// reaches it (§14.8.2). Returns true when he sets sail.
function sendPriest(state, side, isl) {
  const p = state.priests[side];
  if (!p || p.state === 'dead' || p.state === 'consecrating' || p.state === 'adrift') return false;
  const path = findNetPath(state, side, [Math.round(p.pos[0]), Math.round(p.pos[1])], isl.cells);
  if (!path || path.length < 1) return false;
  p.path = path; p.legIndex = 0; p.legT = 0;
  p.state = 'transit';
  p.islandId = null;
  p.targetIslandId = isl.id;
  Events.emit('priestSails', { side });
  return true;
}

function priestOnIsland(state, side, isl) {
  const p = state.priests[side];
  if (!p || p.state === 'dead' || p.state === 'adrift' || p.state === 'transit') return false;
  return isl.cellSet.has(cellKey(Math.round(p.pos[0]), Math.round(p.pos[1])));
}

function updatePriest(state, side, dt) {
  const p = state.priests[side];
  if (!p) return;
  // the priest's mooring slips too if he idles where the network is dark
  if (p.state === 'idle' && strandedHere(state, p)) {
    p.strandedSince = p.strandedSince || state.time;
    if (state.time - p.strandedSince > CONFIG.Adrift.STRAND_GRACE) enterAdrift(state, p);
  } else if (p.state === 'idle') {
    p.strandedSince = null;
  }
  switch (p.state) {
    case 'transit': {
      const r = advanceOnPath(state, p, dt);
      if (r === 'adrift') { enterAdrift(state, p); break; }
      if (r === 'arrived') {
        p.state = 'idle';
        p.islandId = p.targetIslandId;
        Events.emit('priestArrived', { side });
      }
      break;
    }
    case 'consecrating': {
      const job = p.consecrating;
      const isl = state.map.islands[job.islandId];
      // interrupted? temple destroyed mid-build is handled by structures
      if (!isl.temple || isl.temple.owner !== side) { p.state = 'idle'; p.consecrating = null; break; }
      if (isl.temple.buildProgress >= 1) { p.state = 'idle'; p.consecrating = null; }
      break;
    }
    case 'adrift': {
      const r = adriftTick(state, p, dt);
      if (r === 'lost') {
        p.state = 'dead';
        p.respawnAt = state.time + CONFIG.Priest.SUCCESSION_SECONDS;
        Events.emit('priestDead', { side });
      } else if (r === 'rebound') {
        p.state = 'idle';
        const isl = islandAt(state, Math.round(p.pos[0]), Math.round(p.pos[1]));
        p.islandId = isl ? isl.id : null;
      }
      break;
    }
    case 'dead': {
      if (state.time >= p.respawnAt) {
        p.state = 'idle';
        p.hull = p.maxHull;
        p.pos = state.greatTemple[side].cell.slice();
        p.islandId = state.greatTemple[side].island.id;
        Events.emit('priestSucceeded', { side });
      }
      break;
    }
  }
}

function updateTransit(state, dt) {
  for (const h of state.haulers) if (h.state !== 'dead') updateHauler(state, h, dt);
  updatePriest(state, 'A', dt);
  updatePriest(state, 'P', dt);
}
