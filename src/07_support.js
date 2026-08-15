// ================================================================
// SUPPORT & PROGRESSIVE COLLAPSE (§9, §10, §35, §36)
// Every segment must trace to an anchor through the network. A branch
// that loses support frays, then unbinds one segment at a time from
// the severed edge inward. Reconnection cancels everything instantly.
// ================================================================

// Full support recalculation for one side. Called after placement,
// destruction, capture, and reconnection (§35).
function recalcSupport(state, side) {
  const segs = segsOfSide(state, side);
  const byCell = new Map();
  for (const s of segs) {
    for (const c of [s.a, s.b]) {
      const k = cellKey(c[0], c[1]);
      if (!byCell.has(k)) byCell.set(k, []);
      byCell.get(k).push(s);
    }
  }

  const supportedCells = new Set();
  const reachedSegs = new Set();
  const gt = state.greatTemple[side];
  const frontier = [];
  const pushCell = (k) => {
    if (supportedCells.has(k)) return;
    supportedCells.add(k);
    frontier.push(k);
  };
  if (gt.hp > 0) pushCell(cellKey(gt.cell[0], gt.cell[1]));

  const conductedIslands = new Set();
  while (frontier.length) {
    const k = frontier.pop();
    const [x, z] = keyCell(k);
    // island conduction: a standing complete friendly temple bridges the island
    const isl = islandAt(state, x, z);
    if (isl && !conductedIslands.has(isl.id) && islandConducts(state, isl, side)) {
      conductedIslands.add(isl.id);
      for (const [cx, cz] of isl.cells) pushCell(cellKey(cx, cz));
    }
    const list = byCell.get(k);
    if (!list) continue;
    for (const s of list) {
      if (reachedSegs.has(s.id)) continue;
      reachedSegs.add(s.id);
      pushCell(cellKey(s.a[0], s.a[1]));
      pushCell(cellKey(s.b[0], s.b[1]));
    }
  }

  if (!state.supportedCells) state.supportedCells = {};
  state.supportedCells[side] = supportedCells;

  let restored = false, severed = false;
  for (const s of segs) {
    if (reachedSegs.has(s.id)) {
      if (s.supportState !== 'SUPPORTED') restored = true;
      s.supportState = 'SUPPORTED';
      s.unsupportedSince = null;
      s.collapseAt = null;
    } else if (s.unsupportedSince === null) {
      s.unsupportedSince = state.time;
      severed = true;
    }
  }
  assignCollapseTimers(state, side, supportedCells);
  if (restored) {
    state.stats.reconnections++;
    Events.emit('networkRestored', { side });
  }
  if (severed) Events.emit('networkSevered', { side });
  refreshInfluence(state);
}

// Order unsupported segments for collapse: the severed edge (nearest the
// surviving supported network) goes first, then inward (§36).
function assignCollapseTimers(state, side, supportedCells) {
  const un = segsOfSide(state, side).filter(s => s.unsupportedSince !== null);
  if (!un.length) return;

  // distance-from-supported-network over the grid
  const dist = new Map();
  let frontier = [];
  for (const k of supportedCells) { dist.set(k, 0); frontier.push(k); }
  if (!frontier.length) {
    // no anchor at all (Great Temple down): use the map edge as break origin
    for (const s of un) { dist.set(cellKey(s.a[0], s.a[1]), 0); frontier.push(cellKey(s.a[0], s.a[1])); }
  }
  let d = 0;
  while (frontier.length) {
    const next = [];
    for (const k of frontier) {
      const [x, z] = keyCell(k);
      for (const [dx, dz] of DIRS4) {
        const nk = cellKey(x + dx, z + dz);
        if (!inBounds(x + dx, z + dz) || dist.has(nk)) continue;
        dist.set(nk, d + 1);
        next.push(nk);
      }
    }
    frontier = next; d++;
  }

  // group into connected components (branches fray and collapse per branch)
  const byCell = new Map();
  for (const s of un) {
    for (const c of [s.a, s.b]) {
      const k = cellKey(c[0], c[1]);
      if (!byCell.has(k)) byCell.set(k, []);
      byCell.get(k).push(s);
    }
  }
  const seen = new Set();
  for (const s of un) {
    if (seen.has(s.id)) continue;
    const comp = [];
    const stack = [s];
    seen.add(s.id);
    while (stack.length) {
      const cur = stack.pop();
      comp.push(cur);
      for (const c of [cur.a, cur.b]) {
        for (const o of byCell.get(cellKey(c[0], c[1])) || []) {
          if (!seen.has(o.id)) { seen.add(o.id); stack.push(o); }
        }
      }
    }
    const brokeAt = Math.min(...comp.map(x => x.unsupportedSince));
    comp.sort((a, b) => {
      const da = Math.min(dist.get(cellKey(a.a[0], a.a[1])) ?? 999, dist.get(cellKey(a.b[0], a.b[1])) ?? 999);
      const db = Math.min(dist.get(cellKey(b.a[0], b.a[1])) ?? 999, dist.get(cellKey(b.b[0], b.b[1])) ?? 999);
      return da - db || a.id - b.id;
    });
    comp.forEach((seg, i) => {
      seg.collapseAt = brokeAt + CONFIG.Collapse.RESCUE_WINDOW + i * CONFIG.Collapse.SEGMENT_INTERVAL;
      seg.supportState = state.time < brokeAt + CONFIG.Collapse.RESCUE_WINDOW ? 'FRAYED' : 'COLLAPSING';
    });
  }
}

// Per-frame: advance fraying into collapse, and collapse into destruction.
function collapseTick(state) {
  for (const side of ['A', 'P']) {
    let destroyed = null;
    for (const s of segsOfSide(state, side)) {
      if (s.collapseAt === null) continue;
      if (state.time >= s.collapseAt) { destroyed = s; break; }
      if (s.supportState === 'FRAYED' &&
          state.time >= s.unsupportedSince + CONFIG.Collapse.RESCUE_WINDOW) {
        s.supportState = 'COLLAPSING';
      }
    }
    // destroy at most one per side per frame; destroySegment recalcs and
    // re-sorts the rest, keeping the inward march stable.
    if (destroyed) destroySegment(state, destroyed, 'collapse');
  }
}

// Is this island connected (through the side's supported network) home?
function islandSupported(state, isl, side) {
  const cells = state.supportedCells && state.supportedCells[side];
  if (!cells) return false;
  for (const [x, z] of isl.cells) if (cells.has(cellKey(x, z))) return true;
  return false;
}

// ================================================================
// INFLUENCE (§14.5) — projected by supported temples; gates construction.
// ================================================================
function refreshInfluence(state) {
  const inf = { A: new Set(), P: new Set() };
  const addRadius = (set, cx, cz, r) => {
    for (let z = Math.max(0, Math.floor(cz - r)); z <= Math.min(CONFIG.Grid.HEIGHT - 1, Math.ceil(cz + r)); z++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(CONFIG.Grid.WIDTH - 1, Math.ceil(cx + r)); x++) {
        if (dist2d(x, z, cx, cz) <= r) set.add(cellKey(x, z));
      }
    }
  };
  for (const side of ['A', 'P']) {
    const gt = state.greatTemple[side];
    if (gt.hp > 0) addRadius(inf[side], gt.cell[0], gt.cell[1], CONFIG.Influence.GREAT_TEMPLE_RADIUS);
    for (const isl of state.map.islands) {
      if (isl.role.startsWith('greatTemple')) continue;
      if (!islandConducts(state, isl, side)) continue;
      // anchor invariant: a disconnected temple projects nothing (§14.5.5)
      if (!islandSupported(state, isl, side)) continue;
      addRadius(inf[side], isl.temple.cell[0], isl.temple.cell[1], CONFIG.Influence.TEMPLE_RADIUS);
    }
  }
  const contested = new Set();
  for (const k of inf.A) if (inf.P.has(k)) contested.add(k);
  state.influence = { A: inf.A, P: inf.P, contested };
}
