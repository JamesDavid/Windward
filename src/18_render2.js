// ================================================================
// RENDERER, PART 2 — structures, ships, craft, the priest, effects,
// and fog-of-war presentation. One chassis per side (§14A.2):
// every Aeolus structure is a tethered balloon, every Poseidon
// structure a moored barge; four payloads each.
// ================================================================

R.fx = [];
R.islandBars = new Map();

function makeChassis(side, onLand) {
  const grp = new THREE.Group();
  if (side === 'A') {
    // tethered balloon: envelope + slung gondola + tether
    const env = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 10, 8),
      new THREE.MeshLambertMaterial({ color: Palette.ivory }));
    env.scale.set(1.25, 1, 1);
    env.position.y = 0.95;
    const gond = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.09, 0.12),
      new THREE.MeshLambertMaterial({ color: Palette.bronze }));
    gond.position.y = 0.62;
    const tether = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, onLand ? 0.5 : 0.6, 0.015),
      new THREE.MeshBasicMaterial({ color: 0x9c8b6a }));
    tether.position.y = 0.3;
    grp.add(env, gond, tether);
    grp.userData.envelope = env;
  } else {
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.1, 0.34),
      new THREE.MeshLambertMaterial({ color: 0x274046 }));
    hull.position.y = 0.07;
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.05, 0.26),
      new THREE.MeshLambertMaterial({ color: 0x37585e }));
    deck.position.y = 0.14;
    grp.add(hull, deck);
  }
  return grp;
}

function makePayload(side, type, stats) {
  const grp = new THREE.Group();
  const trim = new THREE.MeshLambertMaterial({ color: side === 'A' ? Palette.gold : Palette.poseidonGlow });
  const dark = new THREE.MeshLambertMaterial({ color: Palette.bronze });
  const y = side === 'A' ? 0.62 : 0.2;
  switch (type) {
    case 'vane': {
      for (let i = 0; i < 4; i++) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.05), i % 2 ? trim : dark);
        arm.position.y = y + 0.1;
        arm.rotation.y = (i / 4) * Math.PI;
        grp.add(arm);
      }
      break;
    }
    case 'bolt': case 'mast': {
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.08), dark);
      barrel.position.set(0.14, y + 0.06, 0);
      grp.add(barrel);
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.1), trim);
      tip.position.set(0.3, y + 0.06, 0);
      grp.add(tip);
      grp.userData.rotates = true;
      break;
    }
    case 'shield': {
      const arc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12, 1, true, -Math.PI / 3, (2 * Math.PI) / 3),
        new THREE.MeshLambertMaterial({
          color: side === 'A' ? Palette.aeolusGlow : Palette.poseidonGlow,
          transparent: true, opacity: 0.4, side: THREE.DoubleSide
        }));
      arc.position.y = y + 0.1;
      arc.rotation.y = Math.PI / 2;
      grp.add(arc);
      grp.userData.rotates = true;
      break;
    }
    case 'temple': {
      const stone = new THREE.MeshLambertMaterial({ color: side === 'A' ? Palette.ivory : Palette.poseidonStone });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.1, 8), stone);
      base.position.y = 0.1;
      for (let i = 0; i < 5; i++) {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 5), stone);
        const a = (i / 5) * Math.PI * 2;
        col.position.set(Math.cos(a) * 0.22, 0.3, Math.sin(a) * 0.22);
        grp.add(col);
      }
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.2, 8), trim);
      roof.position.y = 0.52;
      grp.add(base, roof);
      break;
    }
    case 'yard': {
      for (const dx of [-0.2, 0.2]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), dark);
        post.position.set(dx, 0.24, 0);
        grp.add(post);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.05, 0.08), trim);
      beam.position.y = 0.44;
      grp.add(beam);
      break;
    }
  }
  return grp;
}

function structVisibleToPlayer(state, st) {
  if (st.owner === 'A') return 'full';
  const k = cellKey(st.cell[0], st.cell[1]);
  if (state.vision.A.has(k)) return 'full';
  if (state.memory.A.has('st:' + st.id)) return 'dim';
  return 'hidden';
}

function syncStructures(state) {
  const seen = new Set();
  for (const st of state.structures) {
    if (st.hp <= 0) continue;
    seen.add(st.id);
    let rec = R.structMeshes.get(st.id);
    if (!rec) {
      const onLand = st.site === 'plot' || state.map.land.has(cellKey(st.cell[0], st.cell[1]));
      const grp = new THREE.Group();
      const chassis = st.type === 'temple' || st.type === 'yard' ? new THREE.Group() : makeChassis(st.owner, onLand);
      const payload = makePayload(st.owner, st.type, st);
      grp.add(chassis, payload);
      const baseY = onLand ? CONFIG.Render.ISLAND_HEIGHT : (st.owner === 'A' ? CONFIG.Render.AIR_ALTITUDE - 0.6 : 0);
      grp.position.set(worldX(st.cell[0]), baseY, worldZ(st.cell[1]));
      // progress ring while raising
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.4, 0.48, 20),
        new THREE.MeshBasicMaterial({ color: Palette.socket, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.9;
      grp.add(ring);
      R.scene.add(grp);
      rec = { grp, payload, ring, chassis };
      R.structMeshes.set(st.id, rec);
    }
    const vis = structVisibleToPlayer(state, st);
    rec.grp.visible = vis !== 'hidden';
    const dim = vis === 'dim';
    rec.grp.traverse(o => {
      if (o.material) {
        o.material.transparent = true;
        o.material.opacity = dim ? 0.3 : (o.userData && o.userData.baseOpacity) || (st.buildProgress < 1 ? 0.6 : 1);
      }
    });
    if (rec.payload.userData.rotates) rec.payload.rotation.y = -st.facing;
    // building: ring shows progress; bob balloons in the wind
    rec.ring.visible = st.buildProgress < 1;
    if (st.buildProgress < 1) rec.ring.scale.setScalar(0.4 + st.buildProgress * 0.8);
    if (rec.chassis.userData && rec.chassis.userData.envelope) {
      const w = state.wind.at(st.cell[0], st.cell[1]);
      rec.chassis.rotation.z = -w.x * 0.12;
      rec.chassis.rotation.x = w.z * 0.12;
      rec.chassis.position.y = 0.03 * Math.sin(state.time * 1.7 + st.id);
    }
    // hit flash
    if (state.time - st.lastHitAt < 0.15) rec.grp.position.y += 0.02;
  }
  for (const [id, rec] of R.structMeshes) {
    if (!seen.has(id)) {
      R.scene.remove(rec.grp);
      R.structMeshes.delete(id);
    }
  }
}

// ---- movers: haulers, priests, wave craft ----
function makeMoverMesh(m) {
  const grp = new THREE.Group();
  if (m.owner === 'A') {
    const isPriest = m.kind === 'priest';
    const env = new THREE.Mesh(
      new THREE.SphereGeometry(isPriest ? 0.24 : 0.18, 10, 8),
      new THREE.MeshLambertMaterial({ color: isPriest ? Palette.gold : Palette.ivory }));
    env.scale.set(1.5, 0.9, 0.9);
    env.position.y = 0.22;
    const gond = new THREE.Mesh(
      new THREE.BoxGeometry(isPriest ? 0.3 : 0.24, 0.07, 0.1),
      new THREE.MeshLambertMaterial({ color: Palette.bronze }));
    gond.position.y = 0.02;
    grp.add(env, gond);
    if (isPriest) {
      const banner = new THREE.Mesh(
        new THREE.PlaneGeometry(0.3, 0.1),
        new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
      banner.position.set(-0.3, 0.28, 0);
      grp.add(banner);
    }
    grp.userData.env = env;
  } else {
    // sea craft: trireme silhouettes
    const big = m.kind === 'heavy';
    const hull = new THREE.Mesh(
      new THREE.BoxGeometry(big ? 0.6 : 0.42, 0.09, big ? 0.26 : 0.18),
      new THREE.MeshLambertMaterial({ color: m.kind === 'transport' ? 0x3a5b52 : 0x22454e }));
    hull.position.y = 0.06;
    const prow = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 0.2, 5),
      new THREE.MeshLambertMaterial({ color: Palette.bronze }));
    prow.rotation.z = -Math.PI / 2;
    prow.position.set(big ? 0.36 : 0.27, 0.08, 0);
    grp.add(hull, prow);
    if (m.kind === 'siphon' || m.kind === 'priest') {
      const pipe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.05, 0.34, 6),
        new THREE.MeshLambertMaterial({ color: Palette.poseidonGlow }));
      pipe.position.y = 0.26;
      grp.add(pipe);
    }
  }
  return grp;
}

function moverY(m) {
  return m.owner === 'A' ? CONFIG.Render.AIR_ALTITUDE + 0.05 : 0.03;
}

function syncMovers(state) {
  const seen = new Set();
  const movers = [];
  for (const h of state.haulers) if (h.state !== 'dead') movers.push(h);
  for (const s of ['A', 'P']) {
    const p = state.priests[s];
    if (p && p.state !== 'dead') movers.push(p);
  }
  for (const c of state.craft) if (!c.dead) movers.push(c);

  for (const m of movers) {
    seen.add(m.id);
    let rec = R.craftMeshes.get(m.id);
    if (!rec) {
      const grp = makeMoverMesh(m);
      R.scene.add(grp);
      rec = { grp, lastPos: m.pos.slice() };
      R.craftMeshes.set(m.id, rec);
    }
    // fog: enemy movers need live vision (§14B.2)
    const visible = m.owner === 'A' ||
      state.vision.A.has(cellKey(Math.round(m.pos[0]), Math.round(m.pos[1])));
    rec.grp.visible = visible;
    const dx = m.pos[0] - rec.lastPos[0], dz = m.pos[1] - rec.lastPos[1];
    if (Math.abs(dx) + Math.abs(dz) > 0.001) {
      rec.grp.rotation.y = -Math.atan2(dz, dx);
      rec.lastPos = m.pos.slice();
    }
    rec.grp.position.set(worldX(m.pos[0]), moverY(m), worldZ(m.pos[1]));
    if (m.state === 'adrift') {
      rec.grp.rotation.y += Math.sin(state.time * 3 + m.id) * 0.15;
      rec.grp.rotation.z = Math.sin(state.time * 2.2 + m.id) * 0.3;
      rec.grp.position.y += Math.sin(state.time * 4 + m.id) * 0.06;
    } else {
      rec.grp.rotation.z = 0;
    }
    // hydrogen fleets fly visibly larger envelopes (§33E)
    if (m.kind === 'hauler' && m.owner === 'A') {
      const scale = state.hydrogen.A ? 1.3 : 1.0;
      rec.grp.scale.setScalar(scale);
      // venting tell below threshold (§33C.5)
      if (rec.grp.userData !== undefined && m.hull < CONFIG.Airship.VENT_THRESHOLD) {
        rec.grp.children.forEach(ch => { if (ch.material && ch.material.color) ch.material.opacity = 0.6 + 0.3 * Math.sin(state.time * 10); });
      }
    }
  }
  for (const [id, rec] of R.craftMeshes) {
    if (!seen.has(id)) {
      R.scene.remove(rec.grp);
      R.craftMeshes.delete(id);
    }
  }
}

// ---- island economy indicators: reserve bar + stockpile heap ----
function syncIslandBars(state) {
  for (const isl of state.map.islands) {
    if (isl.role.startsWith('greatTemple')) continue;
    let rec = R.islandBars.get(isl.id);
    if (!rec) {
      const heap = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.3, 7),
        new THREE.MeshLambertMaterial({ color: Palette.gold }));
      const [hx, hz] = isl.cells[0];
      heap.position.set(worldX(hx), CONFIG.Render.ISLAND_HEIGHT, worldZ(hz));
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.05, 0.08),
        new THREE.MeshBasicMaterial({ color: 0x76d09a }));
      bar.position.set(worldX(isl.center[0]), CONFIG.Render.ISLAND_HEIGHT + 0.7, worldZ(isl.center[1]));
      R.scene.add(heap, bar);
      rec = { heap, bar, baseReserve: isl.reserve };
      R.islandBars.set(isl.id, rec);
    }
    const stockScale = clamp(isl.stockpile / 40, 0.001, 1.4);
    rec.heap.scale.setScalar(stockScale);
    rec.heap.visible = isl.stockpile > 0.5;
    const frac = rec.baseReserve > 0 ? isl.reserve / rec.baseReserve : 0;
    rec.bar.scale.x = Math.max(0.02, frac);
    rec.bar.visible = !!isl.owner && !isl.minedOut;
    rec.bar.material.color.setHex(isl.owner === 'A' ? 0x76d09a : 0x4fb6c4);
  }
}

// ---- transient effects ----
function fxSpawn(state, kind, pos, data) {
  R.fx.push({ kind, pos: pos.slice(), t0: state.time, data: data || {} });
}

function initFxEvents(state) {
  Events.on('structureDestroyed', ({ st }) => fxSpawn(state, 'boom', st.cell));
  Events.on('segmentDestroyed', ({ seg, cause }) => {
    fxSpawn(state, cause === 'collapse' ? 'unravel' : 'boom', segMid(seg), { air: seg.owner === 'A' });
  });
  Events.on('convoyLost', ({ ent }) => fxSpawn(state, 'wreck', ent.pos));
  Events.on('tidalSurge', ({ center }) => fxSpawn(state, 'surge', center));
  Events.on('fogBank', ({ center }) => fxSpawn(state, 'fogbank', center));
  Events.on('windwall', ({ cell }) => fxSpawn(state, 'windwall', cell));
  Events.on('greatTempleHit', ({ side }) => {
    const gt = state.greatTemple[side];
    if (Math.random() < 0.05) fxSpawn(state, 'boom', gt.cell);
  });
}

function fxTick(state, dt) {
  for (const f of R.fx) {
    const age = state.time - f.t0;
    if (!f.mesh) {
      let mesh = null;
      if (f.kind === 'boom') {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0xffc16e, transparent: true, opacity: 0.9 }));
      } else if (f.kind === 'unravel') {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 5),
          new THREE.MeshBasicMaterial({ color: f.data.air ? 0xf2e8cf : 0x7fd4dd, transparent: true, opacity: 0.7 }));
      } else if (f.kind === 'wreck') {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.05, 0.15),
          new THREE.MeshLambertMaterial({ color: 0x6b5b45 }));
      } else if (f.kind === 'surge') {
        mesh = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.9, 24),
          new THREE.MeshBasicMaterial({ color: 0x7fd4dd, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
        mesh.rotation.x = -Math.PI / 2;
      } else if (f.kind === 'fogbank') {
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(CONFIG.Powers.FOG_BANK.RADIUS, CONFIG.Powers.FOG_BANK.RADIUS, 0.3, 20),
          new THREE.MeshBasicMaterial({ color: 0xb8c4c6, transparent: true, opacity: 0.25 }));
      } else if (f.kind === 'windwall') {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8),
          new THREE.MeshBasicMaterial({ color: 0xfff3cf, transparent: true, opacity: 0.25 }));
      }
      const y = f.kind === 'wreck' || f.kind === 'surge' ? 0.04 : (f.data.air ? CONFIG.Render.AIR_ALTITUDE : 0.3);
      mesh.position.set(worldX(f.pos[0]), y, worldZ(f.pos[1]));
      R.scene.add(mesh);
      f.mesh = mesh;
    }
    const life = f.kind === 'wreck' ? 20 : f.kind === 'fogbank' ? CONFIG.Powers.FOG_BANK.DURATION
      : f.kind === 'windwall' ? CONFIG.Powers.WIND_WALL.DURATION : f.kind === 'surge' ? 1.4 : 0.8;
    if (age > life) {
      R.scene.remove(f.mesh);
      f.dead = true;
      continue;
    }
    if (f.kind === 'boom' || f.kind === 'unravel') {
      f.mesh.scale.setScalar(1 + age * 3);
      f.mesh.material.opacity = Math.max(0, 0.9 * (1 - age / life));
    } else if (f.kind === 'surge') {
      f.mesh.scale.setScalar(1 + age * 4);
      f.mesh.material.opacity = Math.max(0, 0.7 * (1 - age / life));
    } else if (f.kind === 'wreck') {
      f.mesh.rotation.y += dt * 0.3;
      f.mesh.material.opacity = 1;
    }
  }
  R.fx = R.fx.filter(f => !f.dead);
}

// ---- exploration shroud: unexplored terrain is dark until the player's
// reach (structures, corridors, ships) lifts it. One-way. ----
R.shroud = new Map();

function buildShroud(state) {
  for (const m of R.shroud.values()) R.scene.remove(m);
  R.shroud.clear();
  const geo = new THREE.PlaneGeometry(1.04, 1.04);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x060f14, transparent: true, opacity: CONFIG.Render.SHROUD_OPACITY
  });
  for (let z = 0; z < CONFIG.Grid.HEIGHT; z++) {
    for (let x = 0; x < CONFIG.Grid.WIDTH; x++) {
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(worldX(x), 1.55, worldZ(z));
      R.scene.add(m);
      R.shroud.set(cellKey(x, z), m);
    }
  }
}

function syncShroud(state) {
  if (!state.explored) return;
  for (const k of state.explored) {
    const m = R.shroud.get(k);
    if (m) {
      R.scene.remove(m);
      R.shroud.delete(k);
    }
  }
}

// enemy segment fog handling is layered onto syncSegments via this hook
function segmentVisibility(state, s) {
  if (s.owner === 'A') return 'full';
  const m = segMid(s);
  if (state.vision.A.has(cellKey(Math.round(m[0]), Math.round(m[1])))) return 'full';
  if (state.memory.A.has('seg:' + s.key)) return 'dim';
  return 'hidden';
}
