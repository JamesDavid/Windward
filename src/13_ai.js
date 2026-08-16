// ================================================================
// POSEIDON AI (§29) — not a general solver. He grows lanes toward
// scored islands one visible piece at a time, founds temples with his
// priest, raises masts along contested straits, and reroutes (with a
// cooldown) when the player cuts him. Waves are authored separately.
// ================================================================

function initAI(state) {
  state.ai = {
    plan: null,                // list of cells toward the objective
    objectiveIsland: null,
    placeAt: 0,
    decideAt: 0,
    mastAt: CONFIG.AI.MAST_INTERVAL,
    rerouteBlockedUntil: 0,
    avoidCells: new Map(),     // cellKey -> until (recently cut ground)
    badObjectives: new Map()   // islandId -> until (planning there failed)
  };
  // his Great Temple is defended by two authored structures (§13A.4)
  const isl = state.gtP;
  for (let i = 0; i < Math.min(2, isl.plots.length); i++) {
    const type = i === 0 ? 'bolt' : 'vane';
    const stats = structureStats('P', type);
    const plot = isl.plots[i];
    const st = {
      id: eid(), owner: 'P', type, cell: [plot.x, plot.z], site: 'plot',
      islandId: isl.id, plotIdx: i,
      hp: stats.hp, maxHp: stats.hp, buildProgress: 1, buildTime: 0,
      ports: 0, dps: stats.dps, range: stats.range || stats.radius || 0,
      radius: stats.radius || 0, arc: stats.arc || Math.PI * 2, turn: stats.turn || 2,
      intercept: 0, facing: defaultFacing(state, 'P', [plot.x, plot.z]), lastHitAt: -99
    };
    state.structures.push(st);
    plot.structure = st;
  }
  Events.on('segmentDestroyed', ({ seg, cause }) => {
    if (seg.owner !== 'P' || cause === 'collapse') return;
    // a successful player cut: he avoids the cut ground for the cooldown
    // (rebuilding elsewhere continues — a total freeze let one gun stall
    // him forever), and pauses briefly to read as a reaction
    state.ai.rerouteBlockedUntil = state.time + CONFIG.Waves.AI_REROUTE_DELAY * 2;
    state.ai.plan = null;
    state.ai.avoidCells.set(cellKey(seg.a[0], seg.a[1]), state.time + CONFIG.Waves.AI_REROUTE_COOLDOWN * 2);
    state.ai.avoidCells.set(cellKey(seg.b[0], seg.b[1]), state.time + CONFIG.Waves.AI_REROUTE_COOLDOWN * 2);
  });
}

// score islands worth taking (§29): influence gain, reserves, proximity
function aiScoreIsland(state, isl) {
  if (isl.role.startsWith('greatTemple')) return -1;
  if (isl.temple && isl.temple.hp > 0) return -1;             // taken (his or claimed rival ground)
  const bad = state.ai && state.ai.badObjectives;
  if (bad && bad.has(isl.id) && state.time < bad.get(isl.id)) return 0.1;
  let score = 0;
  // his waves need his lanes near the player: ground toward the enemy is
  // worth a nudge — but only a nudge, or he rushes the player's own corner
  // instead of consolidating the middle
  const dPlayer = dist2d(isl.center[0], isl.center[1], state.greatTemple.A.cell[0], state.greatTemple.A.cell[1]);
  score += Math.max(0, 22 - dPlayer) * 0.1;
  // uncontested ground his temple would newly cover
  let overlap = 0;
  for (let dz = -CONFIG.Influence.TEMPLE_RADIUS; dz <= CONFIG.Influence.TEMPLE_RADIUS; dz++) {
    for (let dx = -CONFIG.Influence.TEMPLE_RADIUS; dx <= CONFIG.Influence.TEMPLE_RADIUS; dx++) {
      const x = Math.round(isl.center[0]) + dx, z = Math.round(isl.center[1]) + dz;
      if (!inBounds(x, z)) continue;
      if (dist2d(x, z, isl.center[0], isl.center[1]) > CONFIG.Influence.TEMPLE_RADIUS) continue;
      if (state.influence.A.has(cellKey(x, z))) overlap++;
    }
  }
  score += overlap * (CONFIG.AI.TEMPLE_PRIORITY_OVERLAP ? 0.8 : 0.2);
  score += Math.min(isl.reserve / 20, 8);
  const d = dist2d(isl.center[0], isl.center[1], state.greatTemple.P.cell[0], state.greatTemple.P.cell[1]);
  score += Math.max(0, 14 - d) * 0.5;
  return score;
}

// plan a sheltered-preferring water path from his network to the island
function aiPlanPath(state, isl) {
  return aiPlanPathTo(state, new Set(isl.cells.map(([x, z]) => cellKey(x, z))));
}

// attack lanes: water cells within strike distance of the player's temple
// and forward structures — reaching one puts his massed craft in range
function aiAttackTargets(state) {
  const set = new Set();
  const mark = (cx, cz, r) => {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx, z = cz + dz;
        if (!inBounds(x, z)) continue;
        if (Math.hypot(dx, dz) > r) continue;
        if (state.map.land.has(cellKey(x, z))) continue;
        set.add(cellKey(x, z));
      }
    }
  };
  const gt = state.greatTemple.A;
  if (gt.hp > 0) mark(gt.cell[0], gt.cell[1], 2);
  for (const st of state.structures) {
    if (st.owner === 'A' && st.hp > 0) mark(st.cell[0], st.cell[1], 2);
  }
  return set;
}

function aiPlanPathTo(state, target) {
  // start cells: sockets of his network
  const sockets = getSockets(state, 'P');
  if (!sockets.length) return null;
  const dl = state.ai.distToLand || (state.ai.distToLand = distToLandGrid(state.map));
  const avoid = state.ai.avoidCells;
  // Dijkstra-lite with weights: sheltered water 1.0, open water 1.5 (§33B.2a),
  // island cells passable at 1.0 (a lane may land on a coast)
  const startKeys = sockets.map(s => cellKey(s.cell[0], s.cell[1]));
  const dist = new Map(startKeys.map(k => [k, 0]));
  const prev = new Map(startKeys.map(k => [k, null]));
  const queue = [...startKeys];
  while (queue.length) {
    queue.sort((a, b) => dist.get(a) - dist.get(b));
    const k = queue.shift();
    if (target.has(k)) {
      const path = [];
      let cur = k;
      while (cur !== null) { path.push(keyCell(cur)); cur = prev.get(cur); }
      return path.reverse();
    }
    const [x, z] = keyCell(k);
    for (const [dx, dz] of DIRS4) {
      const nx = x + dx, nz = z + dz, nk = cellKey(nx, nz);
      if (!inBounds(nx, nz)) continue;
      if (avoid.has(nk) && state.time < avoid.get(nk)) continue;
      const isl2 = islandAt(state, nx, nz);
      if (isl2 && islandClosedTo(state, isl2, 'P')) continue;
      // never plan an edge that retraces an existing lane (it could not be placed)
      if (state.segments.has('P:' + segKey(x, z, nx, nz))) continue;
      const water = !state.map.land.has(nk);
      const w = water ? (dl[nz][nx] <= CONFIG.Segments.LEE_SHORE_CELLS ? 1.0 : 1.5) : 1.0;
      const nd = dist.get(k) + w;
      if (nd < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nd);
        prev.set(nk, k);
        if (!queue.includes(nk)) queue.push(nk);
      }
    }
  }
  return null;
}

// place the next SHORT piece along the plan
function aiPlaceNext(state) {
  const ai = state.ai;
  if (!ai.plan || ai.plan.length < 3) { ai.plan = null; return false; }
  const [p0, p1, p2] = ai.plan;
  const segs = [[p0, p1], [p1, p2]];
  if (!placementLegal(state, 'P', segs)) { ai.plan = null; return false; }
  // p0 must still be a socket of his network
  const sockets = getSockets(state, 'P');
  if (!sockets.some(s => s.cell[0] === p0[0] && s.cell[1] === p0[1])) { ai.plan = null; return false; }
  if (!placePiece(state, 'P', 'SHORT', segs)) return false;   // cannot afford
  ai.plan = ai.plan.slice(2);
  if (ai.plan.length < 3) ai.plan = null;
  return true;
}

function aiTick(state, dt) {
  const ai = state.ai;
  if (state.over) return;
  if (state.time < ai.decideAt) return;
  ai.decideAt = state.time + CONFIG.AI.DECISION_INTERVAL;

  const res = state.res.P;

  // 1. priest: found temples on reached neutral islands
  const p = state.priests.P;
  if (p && p.state === 'idle') {
    const isl = p.islandId !== null ? state.map.islands[p.islandId] : null;
    if (isl && !isl.role.startsWith('greatTemple') && (!isl.temple || isl.temple.hp <= 0) &&
        res.supply >= CONFIG.Structures.TEMPLE.COST) {
      const plotIdx = isl.plots.findIndex(pl => !pl.structure);
      if (plotIdx >= 0) {
        buildStructure(state, 'P', 'temple', { site: 'plot', islandId: isl.id, plotIdx, cell: [isl.plots[plotIdx].x, isl.plots[plotIdx].z] });
      }
    } else {
      // sail to the best reachable neutral island
      let best = null, bs = 0;
      for (const cand of state.map.islands) {
        if (cand.role.startsWith('greatTemple')) continue;
        if (cand.temple && cand.temple.hp > 0) continue;
        if (!findNetPath(state, 'P', [Math.round(p.pos[0]), Math.round(p.pos[1])], cand.cells)) continue;
        const s = aiScoreIsland(state, cand) + 5;
        if (s > bs) { bs = s; best = cand; }
      }
      if (best && (p.islandId === null || best.id !== p.islandId)) sendPriest(state, 'P', best);
    }
  }

  // 2. lanes toward the best objective
  if (state.time >= ai.placeAt && state.time >= ai.rerouteBlockedUntil) {
    if (!ai.plan) {
      let best = null, bs = 0.5;
      for (const isl of state.map.islands) {
        const s = aiScoreIsland(state, isl);
        if (s > bs) {
          // already connected? then no lane needed
          const touched = [...state.segments.values()].some(seg => seg.owner === 'P' &&
            (isl.cellSet.has(cellKey(seg.a[0], seg.a[1])) || isl.cellSet.has(cellKey(seg.b[0], seg.b[1]))));
          if (touched) continue;
          bs = s; best = isl;
        }
      }
      if (best) {
        ai.objectiveIsland = best.id;
        ai.plan = aiPlanPath(state, best);
        if (!ai.plan || ai.plan.length < 3) {
          // unreachable for now: blacklist it so he tries something else
          ai.badObjectives.set(best.id, state.time + 30);
          ai.plan = null;
        }
      }
      // no island worth taking: drive an ATTACK lane toward the player so
      // the massed fleet finally has waters that reach them — but only
      // once there IS a fleet; roads ahead of the first wave would rush
      // the player before the opening breath the onboarding promises
      if (!ai.plan && state.craft.length) {
        const targets = aiAttackTargets(state);
        if (targets.size) {
          const plan = aiPlanPathTo(state, targets);
          if (plan && plan.length >= 3) ai.plan = plan;
        }
      }
    }
    // budget discipline: while he holds few temples, keep the temple fund
    // intact — lanes are worthless if he can never consecrate their ends
    if (ai.plan && res.favor >= pieceCost('SHORT')) {
      if (aiPlaceNext(state)) ai.placeAt = state.time + CONFIG.AI.PLACE_INTERVAL;
    }
  }

  // 3. economy: yards and haulers
  const cap = fleetCap(state, 'P');
  const fleet = state.haulers.filter(h => h.owner === 'P' && h.state !== 'dead').length;
  if (fleet < cap && res.supply >= CONFIG.Hauler.COST + 6) buyHauler(state, 'P');
  if (fleet >= cap && res.supply >= CONFIG.Yard.COST + CONFIG.Hauler.COST + 8) {
    // a yard on a safe owned island plot
    for (const isl of state.map.islands) {
      if (isl.owner !== 'P' || isl.role.startsWith('greatTemple')) continue;
      const plotIdx = isl.plots.findIndex(pl => !pl.structure);
      if (plotIdx >= 0 && islandSupported(state, isl, 'P')) {
        buildStructure(state, 'P', 'yard', { site: 'plot', islandId: isl.id, plotIdx, cell: [isl.plots[plotIdx].x, isl.plots[plotIdx].z] });
        break;
      }
    }
  }

  // 4. masts along contested straits (§33C.6), between waves
  if (state.time >= ai.mastAt && res.supply >= structureStats('P', 'mast').cost) {
    ai.mastAt = state.time + CONFIG.AI.MAST_INTERVAL;
    // his supported endpoint nearest a player air segment over water
    const airSegs = [...state.segments.values()].filter(s => s.owner === 'A' && s.overWater);
    if (airSegs.length) {
      const sockets = getSockets(state, 'P').filter(s => s.kind === 'end');
      let best = null, bd = Infinity;
      for (const sock of sockets) {
        if (structureAt(state, sock.cell[0], sock.cell[1])) continue;
        for (const seg of airSegs) {
          const m = segMid(seg);
          const d = dist2d(sock.cell[0], sock.cell[1], m[0], m[1]);
          if (d < bd) { bd = d; best = sock; }
        }
      }
      if (best && bd <= CONFIG.Craft.SIPHON_MAST.RANGE + 2) {
        buildStructure(state, 'P', 'mast', { site: 'endpoint', cell: best.cell });
      }
    }
  }
}
