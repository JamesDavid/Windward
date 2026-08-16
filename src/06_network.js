// ================================================================
// NETWORK — segments, piece templates, sockets, placement legality.
// The route graph is discrete and data-driven; rendering hides the grid.
// ================================================================

// ---- piece templates ----
// Local space: the socket (attachment node) is (0,0); "forward" is (0,-1).
// A template is a list of segments [[ax,az],[bx,bz]]; T is a tree.
const PIECE_TEMPLATES = {
  SHORT: [[[0, 0], [0, -1]], [[0, -1], [0, -2]]],
  LONG:  [[[0, 0], [0, -1]], [[0, -1], [0, -2]], [[0, -2], [0, -3]]],
  L:     [[[0, 0], [0, -1]], [[0, -1], [0, -2]], [[0, -2], [-1, -2]]],
  S:     [[[0, 0], [0, -1]], [[0, -1], [-1, -1]], [[-1, -1], [-1, -2]]],
  T:     [[[0, 0], [0, -1]], [[0, -1], [-1, -1]], [[0, -1], [1, -1]]],
  // long-stem T: reaches further before it branches
  TT:    [[[0, 0], [0, -1]], [[0, -1], [0, -2]], [[0, -2], [-1, -2]], [[0, -2], [1, -2]]],
  // the Cross: a full four-way junction — three fresh nubs from one bind
  X:     [[[0, 0], [0, -1]], [[0, -1], [-1, -1]], [[0, -1], [1, -1]], [[0, -1], [0, -2]]]
};

// All distinct orientations (4 rotations x mirror) of a template.
function pieceOrientations(type) {
  const rot = ([x, z]) => [-z, x];
  const mir = ([x, z]) => [-x, z];
  const variants = [];
  const seen = new Set();
  for (const mirror of [false, true]) {
    let segs = PIECE_TEMPLATES[type].map(([a, b]) => [a.slice(), b.slice()]);
    if (mirror) segs = segs.map(([a, b]) => [mir(a), mir(b)]);
    for (let r = 0; r < 4; r++) {
      const sig = segs.map(([a, b]) => segKey(a[0], a[1], b[0], b[1])).sort().join(';');
      if (!seen.has(sig)) {
        seen.add(sig);
        variants.push(segs.map(([a, b]) => [a.slice(), b.slice()]));
      }
      segs = segs.map(([a, b]) => [rot(a), rot(b)]);
    }
  }
  return variants;
}
const PIECE_ORIENTATIONS = {};
for (const t of ['SHORT', 'LONG', 'L', 'S', 'T', 'TT', 'X']) PIECE_ORIENTATIONS[t] = pieceOrientations(t);

// ---- segment factory ----
function makeSegment(state, side, a, b) {
  const isAir = side === 'A';
  const key = segKey(a[0], a[1], b[0], b[1]);
  const overWater = !state.map.land.has(cellKey(a[0], a[1])) && !state.map.land.has(cellKey(b[0], b[1]));
  // lee-shore shelter for sea lanes: within LEE_SHORE_CELLS of any coast (§33B.2a)
  let sheltered = false;
  if (!isAir) {
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    outer:
    for (let dz = -CONFIG.Segments.LEE_SHORE_CELLS - 1; dz <= CONFIG.Segments.LEE_SHORE_CELLS + 1; dz++) {
      for (let dx = -CONFIG.Segments.LEE_SHORE_CELLS - 1; dx <= CONFIG.Segments.LEE_SHORE_CELLS + 1; dx++) {
        const cx = Math.round(mx + dx), cz = Math.round(mz + dz);
        if (!inBounds(cx, cz) || !state.map.land.has(cellKey(cx, cz))) continue;
        if (Math.max(Math.abs(cx - mx), Math.abs(cz - mz)) <= CONFIG.Segments.LEE_SHORE_CELLS + 0.5) {
          sheltered = true; break outer;
        }
      }
    }
  }
  return {
    id: eid(), key, owner: side,
    a: a.slice(), b: b.slice(),
    hp: isAir ? CONFIG.Segments.AIR_HP : CONFIG.Segments.SEA_HP,
    maxHp: isAir ? CONFIG.Segments.AIR_HP : CONFIG.Segments.SEA_HP,
    supportState: 'SUPPORTED',
    unsupportedSince: null,
    collapseAt: null,
    overWater, sheltered
  };
}

function segsOfSide(state, side) {
  const out = [];
  for (const s of state.segments.values()) if (s.owner === side) out.push(s);
  return out;
}

// Cells covered by a side's network (segment endpoints).
function networkCells(state, side) {
  const cells = new Set();
  for (const s of state.segments.values()) {
    if (s.owner !== side) continue;
    cells.add(cellKey(s.a[0], s.a[1]));
    cells.add(cellKey(s.b[0], s.b[1]));
  }
  return cells;
}

// Node degree map for a side: cellKey -> number of touching segments.
function nodeDegrees(state, side) {
  const deg = new Map();
  for (const s of state.segments.values()) {
    if (s.owner !== side) continue;
    for (const c of [s.a, s.b]) {
      const k = cellKey(c[0], c[1]);
      deg.set(k, (deg.get(k) || 0) + 1);
    }
  }
  return deg;
}

function structureAt(state, x, z) {
  return state.structures.find(st => st.cell[0] === x && st.cell[1] === z && st.hp > 0) || null;
}

// ---- sockets: where may `side` attach a new piece? ----
// - the Great Temple (limited ports)
// - any degree-1 route node that is supported
// - a structure node with free outgoing ports (§14.0)
// - a claimed island's temple (limited ports)
function getSockets(state, side) {
  const sockets = [];
  const seen = new Set();
  const push = (cell, kind) => {
    const k = cellKey(cell[0], cell[1]);
    if (seen.has(k)) return;
    seen.add(k);
    sockets.push({ cell: [cell[0], cell[1]], kind });
  };
  const deg = nodeDegrees(state, side);
  // any cell of an island that conducts for this side (its whole coast is
  // a harbour — a channel terminal may begin anywhere the island touches)
  for (const isl of state.map.islands) {
    if (!islandConducts(state, isl, side)) continue;
    if (!isl.role.startsWith('greatTemple') && !islandSupported(state, isl, side)) continue;
    for (const [x, z] of isl.cells) push([x, z], 'island');
  }
  for (const [k, d] of deg) {
    const [x, z] = keyCell(k);
    if (seen.has(k)) continue;
    const st = structureAt(state, x, z);
    if (st && st.owner === side) {
      // structure node: 1 incoming + PORTS outgoing (§14.0)
      if (st.buildProgress >= 1 && st.ports > 0 && d < st.ports + 1 && segmentSupportedAtCell(state, side, x, z)) {
        push([x, z], 'structure');
      }
      continue;
    }
    if (d === 1 && segmentSupportedAtCell(state, side, x, z)) push([x, z], 'end');
  }
  return sockets;
}

function segmentSupportedAtCell(state, side, x, z) {
  for (const s of state.segments.values()) {
    if (s.owner !== side || s.supportState !== 'SUPPORTED') continue;
    if ((s.a[0] === x && s.a[1] === z) || (s.b[0] === x && s.b[1] === z)) return true;
  }
  return false;
}

// ---- placement legality ----
// Returns the list of legal placements for a piece at a socket:
// each { segs: [[a,b],...], cells: [...] } in world grid coords.
function legalPlacements(state, side, type, socket) {
  const out = [];
  const [sx, sz] = socket.cell;
  for (const variant of PIECE_ORIENTATIONS[type]) {
    const segs = variant.map(([a, b]) => [[a[0] + sx, a[1] + sz], [b[0] + sx, b[1] + sz]]);
    if (placementLegal(state, side, segs)) out.push({ segs });
  }
  return out;
}

function placementLegal(state, side, segs) {
  for (const [a, b] of segs) {
    for (const c of [a, b]) {
      if (!inBounds(c[0], c[1])) return false;
      // Roads are reach: route pieces are NOT influence-gated. The network
      // itself carries the right to build at its tip — pushing corridors
      // into contested and enemy waters is how ground is scouted and
      // attacked. (Supersedes §14.5.2 for route pieces, by direction.)
      // a rival's claimed island still refuses connection (§14.6.4)
      const isl = islandAt(state, c[0], c[1]);
      if (isl && islandClosedTo(state, isl, side)) return false;
    }
    // no duplicate segment on the same layer
    const key = segKey(a[0], a[1], b[0], b[1]);
    const existing = state.segments.get(side + ':' + key);
    if (existing) return false;
    // a structure node accepts no pass-through except via its ports; with
    // defense ports at 0 (player-directed) a gun/shield seals its cell —
    // no further wind path may attach to or cross it, friend or foe
    for (const c of [a, b]) {
      const st = structureAt(state, c[0], c[1]);
      if (st && st.owner !== side) return false;             // enemy structure cell blocked
      if (st && st.owner === side &&
        (st.type === 'vane' || st.type === 'bolt' || st.type === 'shield' || st.type === 'mast')) return false;
    }
  }
  return true;
}

// Commit a placement: pay, create segments, recalc support.
function placePiece(state, side, type, segs) {
  const cost = pieceCost(type);
  if (state.res[side].favor < cost) return false;
  state.res[side].favor -= cost;
  for (const [a, b] of segs) {
    const seg = makeSegment(state, side, a, b);
    state.segments.set(side + ':' + seg.key, seg);
  }
  state.stats.placed++;
  recalcSupport(state, side);
  Events.emit('piecePlaced', { side, type, segs });
  return true;
}

// Destroy a segment outright (combat, collapse, crumble).
function destroySegment(state, seg, cause) {
  state.segments.delete(seg.owner + ':' + seg.key);
  Events.emit('segmentDestroyed', { seg, cause });
  recalcSupport(state, seg.owner);
}
