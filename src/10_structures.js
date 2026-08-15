// ================================================================
// STRUCTURES (§14, §14.6, §14.7, §15) — guns, shields, temples, yards.
// Structures are network nodes with outgoing ports, not caps. Temples
// claim islands and crumble rival connections. Destruction of an
// inline structure always breaks its outward segment.
// ================================================================

function structureStats(side, type) {
  const S = CONFIG.Structures;
  const isA = side === 'A';
  switch (type) {
    case 'vane': {
      const d = isA ? S.VANE : S.DRUM;
      return { cost: d.COST, hp: d.HP, dps: d.DPS, radius: d.RADIUS, ports: S.PORTS_GUN, buildTime: CONFIG.BuildTimes.GUN };
    }
    case 'bolt': {
      const d = isA ? S.BOLT_DIR : S.LANCE;
      return { cost: d.COST, hp: d.HP, dps: d.DPS, range: d.RANGE, arc: d.ARC_DEG * Math.PI / 180, turn: d.TURN_DEG_S * Math.PI / 180, ports: S.PORTS_GUN, buildTime: CONFIG.BuildTimes.GUN };
    }
    case 'shield': {
      const d = isA ? S.AEGIS : S.BULWARK;
      return { cost: d.COST, hp: d.HP, intercept: d.INTERCEPT, arc: d.ARC_DEG * Math.PI / 180, ports: S.PORTS_SHIELD, buildTime: CONFIG.BuildTimes.SHIELD };
    }
    case 'temple':
      return { cost: S.TEMPLE.COST, hp: S.TEMPLE.HP, radius: S.TEMPLE.RADIUS, ports: 0, buildTime: CONFIG.BuildTimes.TEMPLE };
    case 'yard':
      return { cost: CONFIG.Yard.COST, hp: isA ? CONFIG.Yard.HP_AEOLUS : CONFIG.Yard.HP_POSEIDON, ports: 0, buildTime: CONFIG.BuildTimes.YARD };
    case 'mast': {
      // Poseidon's gauntlet piece (§33C.6): moored, AI-built, anti-air
      const d = CONFIG.Craft.SIPHON_MAST;
      return { cost: S.BOLT_DIR.COST, hp: d.HP, dps: d.DPS, range: d.RANGE, arc: Math.PI * 2, ports: 0, buildTime: CONFIG.BuildTimes.GUN };
    }
  }
}

function structureSupported(state, st) {
  if (st.hp <= 0) return false;
  if (st.site === 'plot') {
    const isl = state.map.islands[st.islandId];
    if (st.type === 'temple') {
      // a temple is its own anchor question: it needs the island connected home
      return islandSupported(state, isl, st.owner);
    }
    return islandConducts(state, isl, st.owner) && islandSupported(state, isl, st.owner);
  }
  return segmentSupportedAtCell(state, st.owner, st.cell[0], st.cell[1]);
}

// May `side` place `type` at this endpoint cell / plot? Returns a reason
// string when refused, or null when allowed.
function whyNotBuild(state, side, type, at) {
  const stats = structureStats(side, type);
  if (state.res[side].supply < stats.cost) return 'NOT ENOUGH SUPPLY';
  if (CONFIG.Influence.GATES_CONSTRUCTION && !state.influence[side].has(cellKey(at.cell[0], at.cell[1]))) return 'BEYOND YOUR INFLUENCE';
  if (at.site === 'endpoint') {
    if (type === 'temple' || type === 'yard') return 'ISLAND PLOTS ONLY';
    if (structureAt(state, at.cell[0], at.cell[1])) return 'OCCUPIED';
    if (!segmentSupportedAtCell(state, side, at.cell[0], at.cell[1])) return 'NO SUPPORTED ROUTE';
    const deg = nodeDegrees(state, side).get(cellKey(at.cell[0], at.cell[1])) || 0;
    if (deg !== 1) return 'ENDPOINTS ONLY';
  } else {
    const isl = state.map.islands[at.islandId];
    const plot = isl.plots[at.plotIdx];
    if (plot.structure) return 'PLOT OCCUPIED';
    if (type === 'temple') {
      if (isl.role.startsWith('greatTemple')) return 'HOLY GROUND';
      if (isl.temple && isl.temple.hp > 0) return 'A TEMPLE STANDS';
      if (CONFIG.Priest.REQUIRED_FOR_TEMPLE && !priestOnIsland(state, side, isl)) return 'THE PRIEST MUST BE PRESENT';
    } else {
      if (isl.owner !== side) return 'NOT YOUR ISLAND';
    }
  }
  return null;
}

function buildStructure(state, side, type, at, facing) {
  if (whyNotBuild(state, side, type, at)) return null;
  const stats = structureStats(side, type);
  state.res[side].supply -= stats.cost;
  const st = {
    id: eid(), owner: side, type,
    cell: at.cell.slice(),
    site: at.site,
    islandId: at.islandId !== undefined ? at.islandId : null,
    plotIdx: at.plotIdx !== undefined ? at.plotIdx : null,
    hp: stats.hp * CONFIG.BuildTimes.UNDER_CONSTRUCTION_HP_FRACTION,
    maxHp: stats.hp,
    buildProgress: stats.buildTime === 0 ? 1 : 0,
    buildTime: stats.buildTime,
    ports: stats.ports || 0,
    dps: stats.dps || 0,
    range: stats.range || stats.radius || 0,
    radius: stats.radius || 0,
    arc: stats.arc || 0,
    turn: stats.turn || 0,
    intercept: stats.intercept || 0,
    facing: facing !== undefined ? facing : defaultFacing(state, side, at.cell),
    lastHitAt: -99
  };
  state.structures.push(st);
  recalcSupport(state, side);   // a tower on a tip caps it (exposure changes)
  if (at.site === 'plot') {
    const isl = state.map.islands[at.islandId];
    isl.plots[at.plotIdx].structure = st;
    if (type === 'temple') {
      isl.temple = { owner: side, hp: st.hp, buildProgress: 0, cell: st.cell, structure: st };
      const p = state.priests[side];
      p.state = 'consecrating';
      p.consecrating = { islandId: isl.id, plotIdx: at.plotIdx };
      Events.emit('consecrationStarted', { side, island: isl });
    }
  }
  Events.emit('structureBuilt', { st });
  return st;
}

function defaultFacing(state, side, cell) {
  const foe = state.greatTemple[side === 'A' ? 'P' : 'A'];
  return Math.atan2(foe.cell[1] - cell[1], foe.cell[0] - cell[0]);
}

// build-progress + temple completion (the claim moment, §14.6)
function structuresTick(state, dt) {
  for (const st of state.structures) {
    if (st.hp <= 0 || st.buildProgress >= 1) continue;
    // temples only rise while the priest stands on the island (§14.8.1)
    if (st.type === 'temple') {
      const isl = state.map.islands[st.islandId];
      if (!priestOnIsland(state, st.owner, isl)) continue;
    }
    st.buildProgress = Math.min(1, st.buildProgress + dt / st.buildTime);
    if (st.buildProgress >= 1) {
      st.hp = Math.min(st.maxHp, st.hp + st.maxHp * (1 - CONFIG.BuildTimes.UNDER_CONSTRUCTION_HP_FRACTION));
      if (st.type === 'temple') completeTempleClaim(state, st);
      Events.emit('structureComplete', { st });
    }
  }
  // mirror temple hp onto island record
  for (const isl of state.map.islands) {
    if (isl.temple && isl.temple.structure) {
      isl.temple.hp = isl.temple.structure.hp;
      isl.temple.buildProgress = isl.temple.structure.buildProgress;
    }
  }
}

function completeTempleClaim(state, st) {
  const isl = state.map.islands[st.islandId];
  const side = st.owner;
  const foe = side === 'A' ? 'P' : 'A';
  isl.owner = side;
  isl.temple.buildProgress = 1;
  // crumble every opposing connection to this island, from the island inward
  for (const s of [...state.segments.values()]) {
    if (s.owner !== foe) continue;
    const touches = isl.cellSet.has(cellKey(s.a[0], s.a[1])) || isl.cellSet.has(cellKey(s.b[0], s.b[1]));
    if (touches) destroySegment(state, s, 'claim');
  }
  // rival structures on the island's plots fall with their footing
  for (const plot of isl.plots) {
    if (plot.structure && plot.structure.owner === foe) killStructure(state, plot.structure, 'claim');
  }
  recalcSupport(state, side);
  recalcSupport(state, foe);
  Events.emit('islandClaimed', { island: isl, side });
}

function damageStructure(state, st, amount, source) {
  if (st.hp <= 0) return;
  st.lastHitAt = state.time;
  st.hp -= amount;
  if (st.hp <= 0) {
    st.hp = 0;
    killStructure(state, st, source);
  }
}

function killStructure(state, st, cause) {
  st.hp = 0;
  if (st.site === 'plot' && st.islandId !== null) {
    const isl = state.map.islands[st.islandId];
    if (st.plotIdx !== null) isl.plots[st.plotIdx].structure = null;
    if (st.type === 'temple') {
      isl.temple = null;
      isl.owner = null;          // back to neutral, open to all (§14.6.5)
      Events.emit('templeFallen', { island: isl, side: st.owner });
      recalcSupport(state, 'A');
      recalcSupport(state, 'P');
    }
  } else if (st.site === 'endpoint') {
    // the explosion always destroys the outward adjacent segment (§33A.5)
    const touching = [...state.segments.values()].filter(s =>
      s.owner === st.owner &&
      ((s.a[0] === st.cell[0] && s.a[1] === st.cell[1]) || (s.b[0] === st.cell[0] && s.b[1] === st.cell[1])));
    if (touching.length) {
      const sup = state.supportedCells && state.supportedCells[st.owner];
      const outwardness = (s) => {
        // outward = endpoint farther from the supported side (falls back to temple distance)
        const other = (s.a[0] === st.cell[0] && s.a[1] === st.cell[1]) ? s.b : s.a;
        const gt = state.greatTemple[st.owner].cell;
        return Math.abs(other[0] - gt[0]) + Math.abs(other[1] - gt[1]);
      };
      touching.sort((a, b) => outwardness(b) - outwardness(a));
      const victim = touching[0];
      victim.hp -= CONFIG.Structures.DESTRUCTION_DAMAGE;
      Events.emit('structureExploded', { st });
      if (victim.hp <= 0) destroySegment(state, victim, 'explosion');
      else recalcSupport(state, st.owner);
    }
  }
  state.structures = state.structures.filter(x => x !== st);
  Events.emit('structureDestroyed', { st, cause });
}

// segments take damage too
function damageSegment(state, seg, amount) {
  seg.hp -= amount;
  if (seg.hp <= 0) destroySegment(state, seg, 'combat');
}
