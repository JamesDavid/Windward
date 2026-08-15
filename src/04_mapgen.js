// ================================================================
// MAP GENERATION — deterministic per seed (§20A).
// Fixed: 12x20 grid, corner opposition, nine islands, role counts.
// Generated: exact island cells, reserves, exposed island, wind field.
// Any invariant failure re-rolls (same seed, next nonce); after
// MAX_REROLLS the baked golden seed ships instead.
// ================================================================

// Zones: each island role draws its center from an authored region.
// Player (Aeolus, 'A') owns the bottom-left; Poseidon ('P') top-right.
// The Great Temple and Supply islands are mirrored through the map center
// (then perturbed); the contested interior and the neutrals are grown
// independently inside mirror-image zones, which lets the growth step
// guarantee island separation by construction.
// seed: 'h'/'v' grows the island from a 2-cell line instead of a point;
// pull: growth bias target, used to line the hop-chain stepping stones up.
// The island-hop chain (Great Temple -> supply -> neutral -> east sacred ->
// chokepoint) is what gives the map its priced-safety route (§20.3). Each
// chain island is pulled toward its neighbour; the separation boundary
// stops growth at exactly a two-cell water gap, which is one island hop.
// The corner clusters use absolute offsets (they must fit inside the Great
// Temple's influence radius); the contested interior stretches with the map,
// and stepping-stone filler islands are grown to keep the chain hoppable.
function buildZones() {
  const W = CONFIG.Grid.WIDTH, H = CONFIG.Grid.HEIGHT;
  const fz = (f) => Math.round(f * (H - 1));
  const cx = Math.floor(W / 2);
  return {
    greatTempleA: { x0: 2, x1: 3, z0: H - 4, z1: H - 3, lo: 8, hi: 9, seed: 'h', pull: [[4, H - 3]] },
    supplyA:      { x0: 7, x1: Math.min(9, W - 3), z0: H - 3, z1: H - 2, lo: 5, hi: 6, seed: 'h', pull: [[5, H - 3], [9, H - 4]] },
    sacredA:      { x0: 0, x1: 1, z0: fz(0.26), z1: fz(0.36), lo: 4, hi: 5 },
    sacredP:      { x0: W - 2, x1: W - 1, z0: fz(0.41), z1: fz(0.46), lo: 5, hi: 6, seed: 'v', pull: [[W - 2, fz(0.55)], [W - 4, fz(0.44)]] },
    chokepoint:   { x0: cx, x1: cx, z0: fz(0.45), z1: fz(0.51), lo: 4, hi: 5, seed: 'h', pull: [[cx + 1, fz(0.51)]] },
    neutralA:     { x0: W - 3, x1: W - 1, z0: fz(0.62), z1: fz(0.66), lo: 4, hi: 5, seed: 'h', pull: [[W - 3, fz(0.73)], [W - 2, fz(0.56)]] },
    neutralP:     { x0: 0, x1: 1, z0: fz(0.5), z1: fz(0.6), lo: 4, hi: 5 }
  };
}
let MAP_ZONES = buildZones();

// distances the spec authored for its 12x20 reference map scale with size
function mapScale() {
  return (CONFIG.Grid.WIDTH + CONFIG.Grid.HEIGHT) / (CONFIG.Grid.REF_WIDTH + CONFIG.Grid.REF_HEIGHT);
}

// influence radii scale with the map so the temple leapfrog survives
// larger archipelagos (used by generation, economy, and gameplay alike)
function influenceRadius(kind) {
  const base = kind === 'great' ? CONFIG.Influence.GREAT_TEMPLE_RADIUS : CONFIG.Influence.TEMPLE_RADIUS;
  return Math.round(base * mapScale());
}

// Diagnostic counters (dev only; harmless at runtime).
const MAPGEN_STATS = { growFail: {}, mirrorFail: {} };

function mirrorCell(x, z) {
  return [CONFIG.Grid.WIDTH - 1 - x, CONFIG.Grid.HEIGHT - 1 - z];
}

// Grow an organic blob of `size` cells from seed cells, avoiding `forbidden`.
// `pull` (optional [x,z]) biases growth toward a point, used to make the
// island-hop stepping stones actually line up into a chain.
function growBlob(rng, seeds, size, forbidden, pull) {
  const cells = [];
  const inBlob = new Set();
  for (const [sx, sz] of seeds) {
    const k = cellKey(sx, sz);
    if (!inBounds(sx, sz) || forbidden.has(k) || inBlob.has(k)) continue;
    cells.push([sx, sz]); inBlob.add(k);
  }
  if (!cells.length) return cells;
  let guard = 200;
  while (cells.length < size && guard-- > 0) {
    // Candidate cells adjacent to the blob, preferring ones hugging it
    // (2+ blob neighbours) so islands come out roughly round.
    const cand = [];
    for (const [x, z] of cells) {
      for (const [dx, dz] of DIRS4) {
        const nx = x + dx, nz = z + dz, k = cellKey(nx, nz);
        if (!inBounds(nx, nz) || inBlob.has(k) || forbidden.has(k)) continue;
        let nb = 0;
        for (const [ex, ez] of DIRS4) if (inBlob.has(cellKey(nx + ex, nz + ez))) nb++;
        let w = nb * nb + 0.5;
        if (pull) {
          let pd = Infinity;
          for (const [px, pz] of pull) pd = Math.min(pd, Math.abs(nx - px) + Math.abs(nz - pz));
          w *= 4 / (1 + pd);
        }
        cand.push({ x: nx, z: nz, k, w });
      }
    }
    if (!cand.length) break;
    let total = 0;
    for (const c of cand) total += c.w;
    let pick = rng() * total;
    let chosen = cand[cand.length - 1];
    for (const c of cand) { pick -= c.w; if (pick <= 0) { chosen = c; break; } }
    cells.push([chosen.x, chosen.z]);
    inBlob.add(chosen.k);
  }
  return cells;
}

// Cells within `sep` (Chebyshev) of an island, used to keep islands apart.
function forbiddenAround(cells, sep) {
  const out = new Set();
  for (const [x, z] of cells) {
    for (let dx = -sep; dx <= sep; dx++) {
      for (let dz = -sep; dz <= sep; dz++) out.add(cellKey(x + dx, z + dz));
    }
  }
  return out;
}

function blobCenter(cells) {
  let sx = 0, sz = 0;
  for (const [x, z] of cells) { sx += x; sz += z; }
  return [sx / cells.length, sz / cells.length];
}

// Pick plot cells for an island: "inland" cells with the most land
// neighbours, never the cells that overlook the crossings.
function pickPlots(rng, cells, count, landSet) {
  const scored = cells.map(([x, z]) => {
    let land = 0;
    for (const [dx, dz] of DIRS4) if (landSet.has(cellKey(x + dx, z + dz))) land++;
    return { x, z, land, r: rng() };
  });
  scored.sort((a, b) => (b.land - a.land) || (a.r - b.r));
  return scored.slice(0, count).map(p => ({ x: p.x, z: p.z, structure: null }));
}

function generateOnce(rng) {
  const MG = CONFIG.MapGen;
  MAP_ZONES = buildZones();
  // Islands are kept MIN_ISLAND_SEPARATION apart (min cell distance >= 3,
  // i.e. two water cells between coasts — exactly an island-hop gap).
  const SEP = MG.MIN_ISLAND_SEPARATION - 1;

  const islands = [];
  let forbidden = new Set();

  const grow = (role, side) => {
    const zone = MAP_ZONES[role];
    let placed = null;
    for (let attempt = 0; attempt < 14 && !placed; attempt++) {
      const cx = zone.x0 + Math.floor(rng() * (zone.x1 - zone.x0 + 1));
      const cz = zone.z0 + Math.floor(rng() * (zone.z1 - zone.z0 + 1));
      if (forbidden.has(cellKey(cx, cz))) continue;
      const size = zone.lo + Math.floor(rng() * (zone.hi - zone.lo + 1));
      const seeds = zone.seed === 'h' ? [[cx, cz], [cx + 1, cz]]
        : zone.seed === 'v' ? [[cx, cz], [cx, cz + 1]]
        : [[cx, cz]];
      const cells = growBlob(rng, seeds, size, forbidden, zone.pull || null);
      if (cells.length >= zone.lo) placed = cells;
    }
    if (!placed) { MAPGEN_STATS.growFail[role] = (MAPGEN_STATS.growFail[role] || 0) + 1; return false; }
    islands.push({ role, side, cells: placed });
    forbidden = new Set([...forbidden, ...forbiddenAround(placed, SEP)]);
    return true;
  };

  // One shared displacement for the whole mirrored half, so Poseidon's
  // temple and supply island keep their relative geometry (and his supply
  // island stays inside his influence radius).
  const sidePx = Math.round((rng() * 2 - 1) * MG.ASYMMETRY_CELLS);
  const sidePz = Math.round((rng() * 2 - 1) * MG.ASYMMETRY_CELLS);
  const mirror = (srcRole, role, side) => {
    const src = islands.find(i => i.role === srcRole);
    for (const [ox, oz] of [[sidePx, sidePz], [0, 0]]) {   // perturbed first, plain mirror as fallback
      const cells = src.cells.map(([x, z]) => {
        const [mx, mz] = mirrorCell(x, z);
        return [mx + ox, mz + oz];
      });
      if (cells.every(([x, z]) => inBounds(x, z) && !forbidden.has(cellKey(x, z)))) {
        islands.push({ role, side, cells });
        forbidden = new Set([...forbidden, ...forbiddenAround(cells, SEP)]);
        return true;
      }
    }
    MAPGEN_STATS.mirrorFail[role] = (MAPGEN_STATS.mirrorFail[role] || 0) + 1;
    return false;
  };

  // Player economic corner, then its mirror, then the contested interior,
  // then the neutrals squeezed into what remains.
  if (!grow('greatTempleA', 'A')) return null;
  if (!grow('supplyA', 'A')) return null;
  if (!mirror('greatTempleA', 'greatTempleP', 'P')) return null;
  if (!mirror('supplyA', 'supplyP', 'P')) return null;
  if (!grow('sacredA', 'N')) return null;
  if (!grow('chokepoint', 'N')) return null;
  if (!grow('neutralA', 'N')) return null;
  if (!grow('sacredP', 'N')) return null;
  if (!grow('neutralP', 'N')) return null;
  if (islands.length !== 9) return null;

  // Stepping stones: on maps larger than the reference, the hop chain's
  // gaps stretch beyond hop range. Grow small filler islands midway along
  // any over-long link (island count scales with map size).
  const minCellDist = (A, B) => {
    let best = Infinity;
    for (const [ax, az] of A.cells) for (const [bx, bz] of B.cells) {
      best = Math.min(best, Math.max(Math.abs(ax - bx), Math.abs(az - bz)));
    }
    return best;
  };
  {
    const byRole = {};
    for (const isl of islands) byRole[isl.role] = isl;
    const chainRoles = ['greatTempleA', 'supplyA', 'neutralA', 'sacredP', 'chokepoint'];
    const chainIslands = chainRoles.map(r => byRole[r]);
    for (let i = 0; i < chainIslands.length - 1; i++) {
      let guard = 4;
      while (minCellDist(chainIslands[i], chainIslands[i + 1]) > MG.FILLER_GAP_MAX && guard-- > 0) {
        const A = chainIslands[i], B = chainIslands[i + 1];
        const mid = [Math.round((A.center ? A.center[0] : blobCenter(A.cells)[0]) + (blobCenter(B.cells)[0] - blobCenter(A.cells)[0]) / 2),
                     Math.round((blobCenter(A.cells)[1] + blobCenter(B.cells)[1]) / 2)];
        let placed = null;
        for (let attempt = 0; attempt < 10 && !placed; attempt++) {
          const jx = mid[0] + Math.round((rng() * 2 - 1) * 2);
          const jz = mid[1] + Math.round((rng() * 2 - 1) * 2);
          if (!inBounds(jx, jz) || forbidden.has(cellKey(jx, jz))) continue;
          const size = MG.FILLER_SIZE_LO + Math.floor(rng() * (MG.FILLER_SIZE_HI - MG.FILLER_SIZE_LO + 1));
          const cells = growBlob(rng, [[jx, jz]], size, forbidden,
            [blobCenter(A.cells).map(Math.round), blobCenter(B.cells).map(Math.round)]);
          if (cells.length >= MG.FILLER_SIZE_LO) placed = cells;
        }
        if (!placed) break;
        const filler = { role: 'filler', side: 'N', cells: placed };
        islands.push(filler);
        forbidden = new Set([...forbidden, ...forbiddenAround(placed, SEP)]);
        chainIslands.splice(i + 1, 0, filler);
      }
    }
    // scattered extras: one per SCATTER_PER_CELLS beyond the reference area
    const extra = Math.max(0, Math.floor(
      (CONFIG.Grid.WIDTH * CONFIG.Grid.HEIGHT - CONFIG.Grid.REF_WIDTH * CONFIG.Grid.REF_HEIGHT) / MG.SCATTER_PER_CELLS));
    for (let i = 0; i < extra; i++) {
      for (let attempt = 0; attempt < 12; attempt++) {
        const jx = 1 + Math.floor(rng() * (CONFIG.Grid.WIDTH - 2));
        const jz = Math.round(CONFIG.Grid.HEIGHT * (0.18 + rng() * 0.64));
        if (!inBounds(jx, jz) || forbidden.has(cellKey(jx, jz))) continue;
        const size = MG.FILLER_SIZE_LO + Math.floor(rng() * (MG.FILLER_SIZE_HI - MG.FILLER_SIZE_LO + 1));
        const cells = growBlob(rng, [[jx, jz]], size, forbidden, null);
        if (cells.length < MG.FILLER_SIZE_LO) continue;
        islands.push({ role: 'filler', side: 'N', cells });
        forbidden = new Set([...forbidden, ...forbiddenAround(cells, SEP)]);
        break;
      }
    }
    islands.hopChain = chainIslands;   // consumed by the bridging pass below
  }

  // Bridge the island-hop chain: each consecutive pair must offer a straight
  // two-cell water hop (aligned cells exactly 3 apart). Where growth left the
  // pair misaligned, extend one island by a lobe cell to line the hop up.
  {
    const chainIslands = islands.hopChain;
    const allCells = () => islands.flatMap(i => i.cells.map(([x, z]) => ({ x, z, isl: i })));
    const hopAligned = (A, B) => {
      for (const [ax, az] of A) for (const [bx, bz] of B) {
        if ((ax === bx && Math.abs(az - bz) === 3) || (az === bz && Math.abs(ax - bx) === 3)) return true;
      }
      return false;
    };
    for (let ci = 0; ci < chainIslands.length - 1; ci++) {
      const I = chainIslands[ci], J = chainIslands[ci + 1];
      let guard = 3;
      while (!hopAligned(I.cells, J.cells) && guard-- > 0) {
        // candidate: a cell adjacent to I (or J), exactly 3 straight from a
        // cell of the partner, at least 3 (Chebyshev) from every other island
        let added = false;
        for (const [grown, partner] of [[I, J], [J, I]]) {
          const inGrown = new Set(grown.cells.map(([x, z]) => cellKey(x, z)));
          outer:
          for (const [px, pz] of partner.cells) {
            for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) {
              const cx = px + dx, cz = pz + dz;
              if (!inBounds(cx, cz) || inGrown.has(cellKey(cx, cz))) continue;
              const touches = DIRS4.some(([ex, ez]) => inGrown.has(cellKey(cx + ex, cz + ez)));
              if (!touches) continue;
              let clear = true;
              for (const c of allCells()) {
                if (c.isl === grown) continue;
                const cheb = Math.max(Math.abs(c.x - cx), Math.abs(c.z - cz));
                if (cheb < MG.MIN_ISLAND_SEPARATION) { clear = false; break; }
              }
              if (!clear) continue;
              grown.cells.push([cx, cz]);
              added = true;
              break outer;
            }
          }
          if (added) break;
        }
        if (!added) break;
      }
      if (!hopAligned(I.cells, J.cells)) return null;   // chain unfixable; reroll
    }
  }

  // 3. Land / water maps.
  const land = new Set();
  for (const isl of islands) for (const [x, z] of isl.cells) land.add(cellKey(x, z));

  // 4. Reserves — mirrored identically so corner totals match (invariant 9),
  //    varied per seed within the variance budget.
  const reserveRoll = { supply: 1 + (rng() * 2 - 1) * MG.RESERVE_VARIANCE,
                        neutral: 1 + (rng() * 2 - 1) * MG.RESERVE_VARIANCE,
                        sacred: 1 + (rng() * 2 - 1) * MG.RESERVE_VARIANCE,
                        choke: 1 + (rng() * 2 - 1) * MG.RESERVE_VARIANCE };
  for (const isl of islands) {
    if (isl.role.startsWith('greatTemple')) isl.reserve = Infinity;
    else if (isl.role.startsWith('supply')) isl.reserve = Math.round(CONFIG.Mining.RESERVE_CORNER * reserveRoll.supply);
    else if (isl.role.startsWith('neutral')) isl.reserve = Math.round(CONFIG.Mining.RESERVE_CORNER * reserveRoll.neutral);
    else if (isl.role === 'chokepoint') isl.reserve = Math.round(CONFIG.Mining.RESERVE_INTERIOR * reserveRoll.choke);
    else if (isl.role === 'filler') isl.reserve = Math.round(CONFIG.Mining.RESERVE_CORNER * MG.FILLER_RESERVE_MULT * reserveRoll.neutral);
    else isl.reserve = Math.round(CONFIG.Mining.RESERVE_INTERIOR * reserveRoll.sacred);
  }

  // 5. Ids, centers, plots. One random non-temple island gets a third plot.
  const extraPlotIdx = 1 + Math.floor(rng() * 7);
  islands.forEach((isl, i) => {
    isl.id = i;
    isl.center = blobCenter(isl.cells);
    // The cell a Great Temple stands on (and routes measure from): the
    // island cell nearest the blob's centroid.
    let best = isl.cells[0], bd = Infinity;
    for (const [x, z] of isl.cells) {
      const d = dist2d(x, z, isl.center[0], isl.center[1]);
      if (d < bd) { bd = d; best = [x, z]; }
    }
    isl.templeCell = best;
    const isTempleIsle = isl.role.startsWith('greatTemple');
    let plotCount = isTempleIsle ? CONFIG.Structures.PLOTS_PER_TEMPLE : CONFIG.Structures.PLOTS_PER_ISLAND;
    if (!isTempleIsle && i === extraPlotIdx) plotCount++;
    isl.plots = pickPlots(rng, isl.cells, Math.min(plotCount, isl.cells.length), land);
  });

  // 6. The exposed interior island: whichever interior island satisfies the
  //    over-water invariants (checked later); rng sets the preference order
  //    among the sacred pair, with the chokepoint as the final candidate.
  const sacredIds = islands.filter(i => i.role === 'sacredA' || i.role === 'sacredP').map(i => i.id);
  const chokeId = islands.find(i => i.role === 'chokepoint').id;
  const exposedPreference = (rng() < 0.5 ? sacredIds : sacredIds.slice().reverse()).concat([chokeId]);

  // 7. Wind: a cross-map shear front. On the player's outbound axis (home
  //    toward the interior) the wind blows outbound; the bearing rotates
  //    steadily with perpendicular offset from that axis, so a return
  //    corridor a few cells to the side rides a genuinely different wind.
  //    This is what makes circuits out-earn spurs (§21A.3, §21A.6).
  const W = CONFIG.Wind, G = CONFIG.Grid;
  const ccx = (G.WIDTH - 1) / 2, ccz = (G.HEIGHT - 1) / 2;
  const home = islands.find(i => i.role === 'greatTempleA');
  const axisAngle = Math.atan2(ccz - home.center[1], ccx - home.center[0]);
  const perp = [-Math.sin(axisAngle), Math.cos(axisAngle)];
  const shearSign = rng() < 0.5 ? 1 : -1;
  const shearRad = (MG.WIND_SHEAR_DEG_PER_CELL * Math.PI / 180) * shearSign;
  const noiseAmp = MG.WIND_NOISE_DEGREES * Math.PI / 180;
  const coarse = [];
  for (let z = 0; z < 3; z++) { coarse.push([]); for (let x = 0; x < 3; x++) coarse[z].push((rng() * 2 - 1) * noiseAmp); }
  const windAngles = [];
  for (let fz = 0; fz < W.FIELD_H; fz++) {
    const row = [];
    for (let fx = 0; fx < W.FIELD_W; fx++) {
      const gx = (fx / (W.FIELD_W - 1)) * (G.WIDTH - 1);
      const gz = (fz / (W.FIELD_H - 1)) * (G.HEIGHT - 1);
      const u = (gx - ccx) * perp[0] + (gz - ccz) * perp[1];   // perpendicular offset from the axis
      const clampRad = MG.WIND_SHEAR_CLAMP_DEG * Math.PI / 180;
      let ang = axisAngle + clamp(shearRad * u, -clampRad, clampRad);
      // smooth noise (bilinear over the 3x3 coarse grid)
      const nx = (fx / (W.FIELD_W - 1)) * 2, nz = (fz / (W.FIELD_H - 1)) * 2;
      const x0 = Math.floor(Math.min(nx, 1.999)), z0 = Math.floor(Math.min(nz, 1.999));
      const tx = nx - x0, tz = nz - z0;
      ang += lerp(lerp(coarse[z0][x0], coarse[z0][x0 + 1], tx), lerp(coarse[z0 + 1][x0], coarse[z0 + 1][x0 + 1], tx), tz);
      row.push(ang);
    }
    windAngles.push(row);
  }

  return {
    islands, land,
    windAngles,
    exposedPreference,
    exposedIslandId: exposedPreference[0],   // validator may swap to [1]
    isLand: (x, z) => land.has(cellKey(x, z)),
    isWater: (x, z) => inBounds(x, z) && !land.has(cellKey(x, z))
  };
}

// ---------------------------------------------------------------
// Validation invariants (§20A.5). Each returns true when satisfied.
// ---------------------------------------------------------------

function islandByRole(map, role) { return map.islands.find(i => i.role === role); }
function cellSet(cells) { return new Set(cells.map(([x, z]) => cellKey(x, z))); }

// Longest contiguous over-water run along a path of cells.
function maxWaterRun(map, path) {
  let run = 0, best = 0;
  for (const [x, z] of path) {
    if (!map.land.has(cellKey(x, z))) { run++; best = Math.max(best, run); }
    else run = 0;
  }
  return best;
}

// Shortest path whose over-water runs never exceed maxRun (state BFS).
function safePathLength(map, fromCells, toSet, maxRun) {
  const seen = new Set();
  let frontier = [];
  for (const [x, z] of fromCells) {
    const s = cellKey(x, z) + ':0';
    if (!seen.has(s)) { seen.add(s); frontier.push([x, z, 0]); }
  }
  let d = 0;
  while (frontier.length) {
    for (const [x, z] of frontier) if (toSet.has(cellKey(x, z))) return d;
    const next = [];
    for (const [x, z, run] of frontier) {
      for (const [dx, dz] of DIRS4) {
        const nx = x + dx, nz = z + dz;
        if (!inBounds(nx, nz)) continue;
        const water = !map.land.has(cellKey(nx, nz));
        const nrun = water ? run + 1 : 0;
        if (nrun > maxRun) continue;
        const s = cellKey(nx, nz) + ':' + nrun;
        if (seen.has(s)) continue;
        seen.add(s); next.push([nx, nz, nrun]);
      }
    }
    frontier = next; d++;
  }
  return -1;
}

function distToLandGrid(map) {
  const G = CONFIG.Grid;
  const grid = [];
  for (let z = 0; z < G.HEIGHT; z++) {
    grid.push([]);
    for (let x = 0; x < G.WIDTH; x++) {
      let best = Infinity;
      for (const k of map.land) {
        const [lx, lz] = keyCell(k);
        best = Math.min(best, Math.max(Math.abs(lx - x), Math.abs(lz - z)));
      }
      grid[z].push(best);
    }
  }
  return grid;
}

function validateMap(map) {
  const MG = CONFIG.MapGen;
  const fails = [];
  const gtA = islandByRole(map, 'greatTempleA'), gtP = islandByRole(map, 'greatTempleP');
  const interior = map.islands.filter(i => ['sacredA', 'sacredP', 'chokepoint'].includes(i.role));

  // 1. a supply island fully inside each Great Temple's influence radius
  for (const [gt, supplyRole] of [[gtA, 'supplyA'], [gtP, 'supplyP']]) {
    const sup = islandByRole(map, supplyRole);
    const ok = sup.cells.every(([x, z]) => dist2d(x, z, gt.center[0], gt.center[1]) <= influenceRadius('great'));
    if (!ok) fails.push('supply-in-influence:' + supplyRole);
  }

  // 2. routes from the player's home reach the nearest interior island in
  // 8..12 reference-map cells, measured from the Great Temple and scaled
  // with map size.
  {
    let best = Infinity;
    for (const isl of interior) {
      const d = bfsDistance([gtA.templeCell], cellSet(isl.cells), null);
      if (d >= 0) best = Math.min(best, d);
    }
    const s = mapScale();
    if (best < Math.floor(MG.HOME_TO_INTERIOR_MIN * s) || best > Math.ceil(MG.HOME_TO_INTERIOR_MAX * s)) {
      fails.push('home-to-interior:' + best);
    }
  }

  // 3 + 4. exposed island: the straight route (a shortest path — nothing
  // obstructs air routes) crosses >=5 contiguous over-water cells, and the
  // island-hopping alternate with water runs <=2 costs >=1.4x the length.
  let exposedOk = false;
  for (const candidate of map.exposedPreference) {
    const isl = map.islands[candidate];
    const target = cellSet(isl.cells);
    const directLen = bfsDistance([gtA.templeCell], target, null);
    if (directLen < 0) continue;
    // monotone staircase from the temple to the island's nearest cell
    let near = isl.cells[0], nd = Infinity;
    for (const [x, z] of isl.cells) {
      const d = Math.abs(x - gtA.templeCell[0]) + Math.abs(z - gtA.templeCell[1]);
      if (d < nd) { nd = d; near = [x, z]; }
    }
    const line = [];
    {
      let [x, z] = gtA.templeCell;
      const [tx, tz] = near;
      while (x !== tx || z !== tz) {
        const dx = tx - x, dz = tz - z;
        if (Math.abs(dx) >= Math.abs(dz)) x += Math.sign(dx); else z += Math.sign(dz);
        line.push([x, z]);
      }
    }
    if (maxWaterRun(map, line) < MG.EXPOSED_OVERWATER_MIN) continue;
    const safeLen = safePathLength(map, [gtA.templeCell], target, MG.SAFE_ROUTE_OVERWATER_MAX);
    if (safeLen < 0) continue;
    if (safeLen < directLen * MG.SAFE_ROUTE_LENGTH_MULT) continue;
    map.exposedIslandId = candidate;
    exposedOk = true;
    break;
  }
  if (!exposedOk) fails.push('exposed-island-routes');

  // 5. the chokepoint's surrounding strait is >=80% open water
  const choke = islandByRole(map, 'chokepoint');
  {
    const chokeCells = cellSet(choke.cells);
    let water = 0, total = 0;
    const R = MG.CHOKEPOINT_REGION_RADIUS;
    for (let z = 0; z < CONFIG.Grid.HEIGHT; z++) {
      for (let x = 0; x < CONFIG.Grid.WIDTH; x++) {
        if (dist2d(x, z, choke.center[0], choke.center[1]) > R) continue;
        if (chokeCells.has(cellKey(x, z))) continue;
        total++;
        if (!map.land.has(cellKey(x, z))) water++;
      }
    }
    if (total === 0 || water / total < MG.CHOKEPOINT_OVERWATER_FRACTION) fails.push('chokepoint-water');
  }

  // 6. circuits are worthwhile: the outbound bearing scores differently on
  // the direct corridor than on the best return corridor, and a viable
  // return alignment exists.
  {
    const wind = new WindField(map.windAngles);
    const exposed = map.islands[map.exposedIslandId];
    const dx = exposed.center[0] - gtA.center[0], dz = exposed.center[1] - gtA.center[1];
    const L = Math.hypot(dx, dz);
    const out = [dx / L, dz / L];
    const perp = [-out[1], out[0]];
    const midX = (exposed.center[0] + gtA.center[0]) / 2, midZ = (exposed.center[1] + gtA.center[1]) / 2;
    const wDirect = wind.at(midX, midZ);
    const dOut = wDirect.x * out[0] + wDirect.z * out[1];
    let bestRet = -Infinity, dOutAtRet = 0;
    for (const off of [-5, -4, -3, -2, 2, 3, 4, 5]) {
      const px = midX + perp[0] * off, pz = midZ + perp[1] * off;
      if (!inBounds(Math.round(px), Math.round(pz))) continue;
      const w = wind.at(px, pz);
      const ret = -(w.x * out[0] + w.z * out[1]);   // alignment homeward
      if (ret > bestRet) { bestRet = ret; dOutAtRet = w.x * out[0] + w.z * out[1]; }
    }
    if (dOut < MG.CIRCUIT_MIN_ALIGNMENT) fails.push('circuit-outbound');
    if (bestRet < MG.CIRCUIT_MIN_ALIGNMENT) fails.push('circuit-return');
    if (Math.abs(dOut - dOutAtRet) < MG.CIRCUIT_DOT_SEPARATION) fails.push('circuit-separation');
  }

  // 7. corner-to-corner (temple to temple) shortest path >= 18, scaled
  {
    const d = bfsDistance([gtA.templeCell], new Set([cellKey(gtP.templeCell[0], gtP.templeCell[1])]), null);
    if (d < Math.floor(MG.CORNER_TO_CORNER_MIN * mapScale())) fails.push('corner-to-corner:' + d);
  }

  // 8. no two islands within MIN_ISLAND_SEPARATION cells (Chebyshev)
  for (let i = 0; i < map.islands.length; i++) {
    for (let j = i + 1; j < map.islands.length; j++) {
      let best = Infinity;
      for (const [ax, az] of map.islands[i].cells) {
        for (const [bx, bz] of map.islands[j].cells) {
          best = Math.min(best, Math.max(Math.abs(ax - bx), Math.abs(az - bz)));
        }
      }
      if (best < CONFIG.MapGen.MIN_ISLAND_SEPARATION) { fails.push('separation:' + i + ',' + j); }
    }
  }

  // 9. near-corner reserve totals within 5%
  {
    const sumA = map.islands.filter(i => ['supplyA', 'neutralA'].includes(i.role)).reduce((s, i) => s + i.reserve, 0);
    const sumP = map.islands.filter(i => ['supplyP', 'neutralP'].includes(i.role)).reduce((s, i) => s + i.reserve, 0);
    if (Math.abs(sumA - sumP) > Math.max(sumA, sumP) * 0.05) fails.push('reserve-balance');
  }

  // 10. each Great Temple has an island-shielded approach: another island
  // close enough to shield a fallback route.
  for (const gt of [gtA, gtP]) {
    const near = map.islands.some(i => i !== gt &&
      dist2d(i.center[0], i.center[1], gt.center[0], gt.center[1]) <= MG.SHIELD_ISLAND_MAX_DIST + CONFIG.MapGen.ISLAND_SIZE_MAX / 2);
    if (!near) fails.push('shielded-approach:' + gt.role);
  }

  // 11. an open channel (water >1 cell from any coast) connects the halves,
  // so Poseidon's network can never be entirely sheltered (§33B.2a).
  {
    const dl = distToLandGrid(map);
    const open = new Set();
    for (let z = 0; z < CONFIG.Grid.HEIGHT; z++) {
      for (let x = 0; x < CONFIG.Grid.WIDTH; x++) {
        if (!map.land.has(cellKey(x, z)) && dl[z][x] > CONFIG.Segments.LEE_SHORE_CELLS) open.add(cellKey(x, z));
      }
    }
    // connected open components; need one spanning both halves with enough cells
    const seen = new Set();
    let ok = false;
    for (const start of open) {
      if (seen.has(start)) continue;
      const comp = [];
      const stack = [start];
      seen.add(start);
      while (stack.length) {
        const k = stack.pop();
        comp.push(k);
        const [x, z] = keyCell(k);
        for (const [ddx, ddz] of DIRS4) {
          const nk = cellKey(x + ddx, z + ddz);
          if (open.has(nk) && !seen.has(nk)) { seen.add(nk); stack.push(nk); }
        }
      }
      const half = (CONFIG.Grid.HEIGHT - 1) / 2;
      const spansA = comp.some(k => keyCell(k)[1] > half + 3);
      const spansP = comp.some(k => keyCell(k)[1] < half - 3);
      if (comp.length >= MG.OPEN_CHANNEL_MIN_CELLS && spansA && spansP) { ok = true; break; }
    }
    if (!ok) fails.push('open-channel');
  }

  // 12. the temple leapfrog must be able to reach Poseidon's corner: the
  // claim graph (islands claimable within influence of already-claimed
  // ground, starting from the player's Great Temple) must include an
  // island whose temple influence lets a Bolt Battery reach his temple.
  // Without this, the game's win condition is geometrically impossible.
  {
    const rTemple = influenceRadius('temple');
    const rGreat = influenceRadius('great');
    const nodes = map.islands.filter(i => !i.role.startsWith('greatTemple'));
    const plotsOf = isl => (isl.plots && isl.plots.length) ? isl.plots.map(p => [p.x, p.z]) : [isl.templeCell];
    const reach = new Set();
    let frontier = [];
    for (const isl of nodes) {
      if (plotsOf(isl).some(p => dist2d(p[0], p[1], gtA.templeCell[0], gtA.templeCell[1]) <= rGreat)) {
        reach.add(isl.id);
        frontier.push(isl);
      }
    }
    while (frontier.length) {
      const next = [];
      for (const cur of frontier) {
        for (const other of nodes) {
          if (reach.has(other.id)) continue;
          const hop = plotsOf(cur).some(cp => plotsOf(other).some(op =>
            dist2d(op[0], op[1], cp[0], cp[1]) <= rTemple));
          if (hop) { reach.add(other.id); next.push(other); }
        }
      }
      frontier = next;
    }
    const boltRange = CONFIG.Structures.BOLT_DIR.RANGE;
    const winnable = nodes.some(isl => reach.has(isl.id) &&
      plotsOf(isl).some(p => dist2d(p[0], p[1], gtP.templeCell[0], gtP.templeCell[1]) <= rTemple + boltRange - 0.5));
    if (!winnable) fails.push('win-reachability');
  }

  return { ok: fails.length === 0, fails };
}

// ---------------------------------------------------------------
// Entry point. Same seed string -> same map, always.
// ---------------------------------------------------------------
function generateMap(seedStr, allowFallback = true) {
  const MG = CONFIG.MapGen;
  for (let nonce = 0; nonce < MG.MAX_REROLLS; nonce++) {
    const rng = mulberry32(hashString(seedStr + ':' + nonce));
    const map = generateOnce(rng);
    if (!map) continue;
    const v = validateMap(map);
    if (v.ok) {
      map.seed = seedStr;
      map.nonce = nonce;
      return map;
    }
  }
  if (allowFallback && seedStr !== MG.GOLDEN_SEED) return generateMap(MG.GOLDEN_SEED, false);
  return null;   // a judge must never see this; the golden seed is verified
}
