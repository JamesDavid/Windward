// ================================================================
// POSEIDON AI (§29) — not a general solver. He grows lanes toward
// scored islands one visible piece at a time, founds temples with his
// priest, raises masts along contested straits, and reroutes (with a
// cooldown) when the player cuts him. Waves are authored separately.
// ================================================================

// Apply a ladder tier: effective params = defaults + tier overrides.
// Called at match start (persistent skill) and silently at telegraphs
// by the dynamic matcher.
function applyAiTier(state, tier) {
  const L = CONFIG.AI.LADDER;
  state.aiTier = Math.max(0, Math.min(L.length - 1, tier));
  state.aiCfg = Object.assign({}, CONFIG.AI, L[state.aiTier].overrides);
  // remember the hottest temper this match ever reached (history feeds
  // the opening tier of future matches)
  state.ddaPeak = Math.max(state.ddaPeak || 0, state.aiTier);
}

function initAI(state) {
  // effective AI parameters: defaults from CONFIG.AI, overridable by
  // the difficulty ladder / dynamic skill matching (state.aiCfg)
  state.aiCfg = Object.assign({}, CONFIG.AI);
  state.aiTier = 1;   // FAIR until a tier is applied
  state.ai = {
    plan: null,                // list of cells toward the objective
    objectiveIsland: null,
    placeAt: 0,
    decideAt: 0,
    mastAt: CONFIG.AI.MAST_INTERVAL,
    rerouteBlockedUntil: 0,
    pauseCooldownUntil: 0,     // rate-limits the reaction pause under fire
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
    // a successful player cut: he avoids the cut ground for the cooldown.
    // The reaction PAUSE is rate-limited to once per cooldown window —
    // under sustained bombardment (cuts arriving faster than the pause
    // expires) an unlimited pause rolled forward forever and froze all
    // his building for the rest of the match (the optb turtling anomaly).
    if (state.time >= state.ai.pauseCooldownUntil) {
      state.ai.pauseCooldownUntil = state.time + CONFIG.Waves.AI_REROUTE_COOLDOWN;
      state.ai.rerouteBlockedUntil = state.time + CONFIG.Waves.AI_REROUTE_DELAY * 2;
    }
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
  score += Math.max(0, 22 - dPlayer) * ((state.aiCfg && state.aiCfg.TOWARD_PLAYER_BIAS) || 0.1);
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
  score += Math.min(isl.reserve / 20, 8) * ((state.aiCfg && state.aiCfg.ORE_BIAS) || 1);
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
  ai.decideAt = state.time + state.aiCfg.DECISION_INTERVAL;

  const res = state.res.P;

  // 1. priest: found temples on reached neutral islands
  const p = state.priests.P;
  if (p && p.state === 'idle') {
    const isl = p.islandId !== null ? state.map.islands[p.islandId] : null;
    if (isl && !isl.role.startsWith('greatTemple') && (!isl.temple || isl.temple.hp <= 0) &&
        res.supply >= CONFIG.Structures.TEMPLE.COST &&
        res.favor >= (CONFIG.Structures.TEMPLE.FAVOR || 0)) {
      const plotIdx = isl.plots.findIndex(pl => !pl.structure && !plotBlockedByQuarry(isl, pl));
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
      // the fleet has waters that reach them. From the FIRST TELEGRAPH
      // onward (player report: waves idled far away and the countdown
      // paid off with nothing) - but never before the opening breath.
      if (!ai.plan && (state.craft.length || state.wave.telegraphed || state.wave.index >= 1)) {
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
      if (aiPlaceNext(state)) ai.placeAt = state.time + state.aiCfg.PLACE_INTERVAL;
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
      const plotIdx = isl.plots.findIndex(pl => !pl.structure && !plotBlockedByQuarry(isl, pl));
      if (plotIdx >= 0 && islandSupported(state, isl, 'P')) {
        buildStructure(state, 'P', 'yard', { site: 'plot', islandId: isl.id, plotIdx, cell: [isl.plots[plotIdx].x, isl.plots[plotIdx].z] });
        break;
      }
    }
  }

  // 3.5 stationary defense (player report: he never placed guns) — he
  // GARRISONS what he takes: a drum on every claimed island, and every
  // so often a lance on the forward end nearest the player's holdings
  // capped: an uncapped garrison shredded the player's whole network
  // (22 structures, 496 segments destroyed in one sim) — he guards,
  // he does not blanket the map
  const drumCount = state.structures.filter(s => s.owner === 'P' && s.type === 'vane' && s.site === 'plot' && s.hp > 0).length;
  if (drumCount < state.aiCfg.GARRISON_DRUMS && res.supply >= structureStats('P', 'vane').cost + 14) {
    for (const isl of state.map.islands) {
      if (isl.owner !== 'P' || isl.role.startsWith('greatTemple')) continue;
      const hasGun = state.structures.some(s => s.owner === 'P' && s.islandId === isl.id && (s.dps || 0) > 0 && s.hp > 0);
      if (hasGun) continue;
      const cell = isl.cells.find(([x, z]) => !structureAt(state, x, z) && !plotBlockedByQuarry(isl, { x, z }));
      if (cell) {
        buildStructure(state, 'P', 'vane', { site: 'plot', islandId: isl.id, plotIdx: -1, cell: [cell[0], cell[1]] });
        break;   // one garrison per decision tick
      }
    }
  }
  const lanceCount = state.structures.filter(s => s.owner === 'P' && s.type === 'bolt' && s.site === 'endpoint' && s.hp > 0).length;
  if (lanceCount < state.aiCfg.GARRISON_LANCES && state.time >= (ai.gunAt || 0) && res.supply >= structureStats('P', 'bolt').cost + 20) {
    ai.gunAt = state.time + state.aiCfg.GUN_CADENCE;
    const targets = aiAttackTargets(state);
    if (targets.size) {
      // (player-directed) an endpoint gun SEALS its cell, so it must
      // never cork a through-lane: guns go only on STUBS — leaves
      // hanging off a 3+way junction — and never on the strike tip or
      // the lane he is still extending. No stub near the front? Bind a
      // T piece there to FORK one, and gun it on a quick next pass.
      const deg = new Map();
      for (const s of state.segments.values()) {
        if (s.owner !== 'P') continue;
        for (const c of [s.a, s.b]) {
          const k = cellKey(c[0], c[1]);
          deg.set(k, (deg.get(k) || 0) + 1);
        }
      }
      const distToTargets = (c) => {
        let m = Infinity;
        for (const k of targets) {
          const [x, z] = keyCell(k);
          m = Math.min(m, dist2d(c[0], c[1], x, z));
        }
        return m;
      };
      const ends = getSockets(state, 'P').filter(s => s.kind === 'end' && !structureAt(state, s.cell[0], s.cell[1]));
      let tip = null, tipD = Infinity;
      for (const e of ends) {
        const d = distToTargets(e.cell);
        if (d < tipD) { tipD = d; tip = e; }
      }
      const planTip = ai.plan && ai.plan[0];
      const isStub = (e) => {
        for (const s of state.segments.values()) {
          if (s.owner !== 'P') continue;
          const atA = s.a[0] === e.cell[0] && s.a[1] === e.cell[1];
          const atB = s.b[0] === e.cell[0] && s.b[1] === e.cell[1];
          if (!atA && !atB) continue;
          const o = atA ? s.b : s.a;
          if ((deg.get(cellKey(o[0], o[1])) || 0) >= 3) return true;
        }
        return false;
      };
      // a leaf is safe to seal unless it is the strike tip, the tip the
      // lane is still growing from, or an island's coast link. Junction
      // stubs are preferred (the intended shape); any other safe leaf
      // is second choice — nothing routes THROUGH a dead end.
      const nearLand = (c) => {
        if (islandAt(state, c[0], c[1])) return true;
        for (const [dx, dz] of DIRS4) if (islandAt(state, c[0] + dx, c[1] + dz)) return true;
        return false;
      };
      let best = null, bd = Infinity, bestJunction = false;
      for (const e of ends) {
        if (e === tip) continue;
        if (planTip && e.cell[0] === planTip[0] && e.cell[1] === planTip[1]) continue;
        if (nearLand(e.cell)) continue;
        const junction = isStub(e);
        const d = distToTargets(e.cell);
        if (junction && !bestJunction) { bd = d; best = e; bestJunction = true; }
        else if (junction === bestJunction && d < bd) { bd = d; best = e; }
      }
      if (best && bd < state.aiCfg.GUN_NEAR) {
        buildStructure(state, 'P', 'bolt', { site: 'endpoint', cell: best.cell });
      } else if (tip && tipD < 12 && res.favor >= pieceCost('T')) {
        // fork the front: the T's stem keeps the lane running toward
        // the player, its side nubs become non-blocking gun stubs
        let bestPl = null, bpd = Infinity;
        for (const pl of legalPlacements(state, 'P', 'T', tip)) {
          let far = Infinity;
          for (const [a, b] of pl.segs) far = Math.min(far, distToTargets(b), distToTargets(a));
          if (far < bpd) { bpd = far; bestPl = pl; }
        }
        if (bestPl && placePiece(state, 'P', 'T', bestPl.segs)) {
          ai.plan = null;                 // the lane will replan from the fork
          // arm the new stub NOW — at a contested front the fork can be
          // shot away before any later pass returns to it. The nearest
          // nub stays open as strike water; the farther one takes the gun.
          const count = new Map();
          for (const [a, b] of bestPl.segs) {
            for (const c of [a, b]) {
              const k = cellKey(c[0], c[1]);
              count.set(k, (count.get(k) || 0) + 1);
            }
          }
          const attach = bestPl.segs[0][0];
          const leaves = [...count.entries()]
            .filter(([k, n]) => n === 1 && k !== cellKey(attach[0], attach[1]))
            .map(([k]) => keyCell(k))
            .sort((a, b) => distToTargets(b) - distToTargets(a));
          if (leaves.length && !structureAt(state, leaves[0][0], leaves[0][1])) {
            buildStructure(state, 'P', 'bolt', { site: 'endpoint', cell: leaves[0] });
          } else {
            ai.gunAt = state.time + 8;    // fall back to a quick next pass
          }
        }
      }
    }
  }

  // 4. masts along contested straits (§33C.6), between waves
  if (state.time >= ai.mastAt && res.supply >= structureStats('P', 'mast').cost) {
    ai.mastAt = state.time + state.aiCfg.MAST_INTERVAL;
    // his supported endpoint nearest a player air segment over water
    const airSegs = [...state.segments.values()].filter(s => s.owner === 'A' && s.overWater);
    if (airSegs.length) {
      // masts seal their cell too: stub leaves only (player-directed)
      const deg = new Map();
      for (const s of state.segments.values()) {
        if (s.owner !== 'P') continue;
        for (const c of [s.a, s.b]) {
          const k = cellKey(c[0], c[1]);
          deg.set(k, (deg.get(k) || 0) + 1);
        }
      }
      const onJunction = (cell) => {
        for (const s of state.segments.values()) {
          if (s.owner !== 'P') continue;
          const atA = s.a[0] === cell[0] && s.a[1] === cell[1];
          const atB = s.b[0] === cell[0] && s.b[1] === cell[1];
          if (!atA && !atB) continue;
          const o = atA ? s.b : s.a;
          if ((deg.get(cellKey(o[0], o[1])) || 0) >= 3) return true;
        }
        return false;
      };
      const planTip = ai.plan && ai.plan[0];
      const nearLand = (c) => {
        if (islandAt(state, c[0], c[1])) return true;
        for (const [dx, dz] of DIRS4) if (islandAt(state, c[0] + dx, c[1] + dz)) return true;
        return false;
      };
      const sockets = getSockets(state, 'P').filter(s => s.kind === 'end');
      // junction stubs first; any other safe leaf second — never the
      // growing tip, never an island's coast link
      let best = null, bd = Infinity, bestJ = false;
      for (const sock of sockets) {
        if (structureAt(state, sock.cell[0], sock.cell[1])) continue;
        if (planTip && sock.cell[0] === planTip[0] && sock.cell[1] === planTip[1]) continue;
        if (nearLand(sock.cell)) continue;
        const j = onJunction(sock.cell);
        if (!j && bestJ) continue;
        let dmin = Infinity;
        for (const seg of airSegs) {
          const m = segMid(seg);
          dmin = Math.min(dmin, dist2d(sock.cell[0], sock.cell[1], m[0], m[1]));
        }
        if (j && !bestJ) { bd = dmin; best = sock; bestJ = true; }
        else if (dmin < bd) { bd = dmin; best = sock; }
      }
      if (best && bd <= CONFIG.Craft.SIPHON_MAST.RANGE + 2) {
        buildStructure(state, 'P', 'mast', { site: 'endpoint', cell: best.cell });
      }
    }
  }
}
