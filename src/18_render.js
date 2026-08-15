// ================================================================
// RENDERER — Three.js scene. Mythic Hellenic bronzepunk, portrait,
// fixed oblique camera, no rotation. All geometry procedural; the
// grid is invisible, the layers must read at a glance (§21, §31).
// ================================================================

const Palette = {
  sea: 0x16606e, seaDeep: 0x0e4652,
  limestone: 0xede2c8, limestoneShade: 0xd8c9a8,
  canopy: 0x5d8f56, canopyDark: 0x47714a,
  ivory: 0xf5ecd7, gold: 0xd9a441, bronze: 0x8c6a2f,
  aeolusGlow: 0xffe9b0, poseidonGlow: 0x37c8d6,
  poseidonStone: 0x2e4f55, lane: 0x0f3d46,
  frayed: 0x8a8578, collapsing: 0xc25a4a,
  socket: 0xffd977, danger: 0xd9534f
};

const R = {
  renderer: null, scene: null, camera: null,
  segMeshes: new Map(),       // 'side:key' -> mesh
  structMeshes: new Map(),
  craftMeshes: new Map(),
  socketGroup: null, previewGroup: null, influenceGroup: null,
  whitecaps: [], trees: [], smoke: [],
  islandGroup: null,
  raycaster: null, groundPlane: null,
  initialized: false
};

function worldX(gx) { return gx - (CONFIG.Grid.WIDTH - 1) / 2; }
function worldZ(gz) { return gz - (CONFIG.Grid.HEIGHT - 1) / 2; }
function gridFromWorld(wx, wz) {
  return [Math.round(wx + (CONFIG.Grid.WIDTH - 1) / 2), Math.round(wz + (CONFIG.Grid.HEIGHT - 1) / 2)];
}

function initRenderer() {
  const canvas = document.getElementById('gl');
  R.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  R.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  R.renderer.outputEncoding = THREE.sRGBEncoding;
  R.scene = new THREE.Scene();
  R.scene.background = new THREE.Color(0x0d3540);
  R.scene.fog = new THREE.Fog(0x0d3540, 26, 44);

  R.camera = new THREE.PerspectiveCamera(CONFIG.Render.CAM_FOV, 1, 0.1, 100);
  R.raycaster = new THREE.Raycaster();
  R.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  const sun = new THREE.DirectionalLight(0xfff2dd, 1.05);
  sun.position.set(6, 14, 4);
  R.scene.add(sun);
  R.scene.add(new THREE.HemisphereLight(0xcfe8ef, 0x2a4a3a, 0.75));

  // the Aegean
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 64),
    new THREE.MeshLambertMaterial({ color: Palette.sea })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = 0;
  R.scene.add(sea);

  R.socketGroup = new THREE.Group();
  R.previewGroup = new THREE.Group();
  R.influenceGroup = new THREE.Group();
  R.islandGroup = new THREE.Group();
  R.scene.add(R.socketGroup, R.previewGroup, R.influenceGroup, R.islandGroup);

  onResize();
  window.addEventListener('resize', onResize);
  R.initialized = true;
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  R.renderer.setSize(w, h, false);
  R.camera.aspect = w / h;
  // fixed oblique portrait framing: pull back until the whole map fits
  const fit = Math.max(1, (9 / 16) / (w / h) * 0.92);
  R.camera.position.set(0, CONFIG.Render.CAM_HEIGHT * fit, CONFIG.Render.CAM_BACK * fit);
  R.camera.lookAt(0, 0, CONFIG.Render.CAM_LOOK_Z);
  R.camera.updateProjectionMatrix();
}

// ---------------- static map ----------------
function buildMapMeshes(state) {
  R.islandGroup.clear();
  R.whitecaps = [];
  R.trees = [];
  R.smoke = [];

  const cellGeo = new THREE.BoxGeometry(1.0, CONFIG.Render.ISLAND_HEIGHT, 1.0);
  const beachGeo = new THREE.BoxGeometry(1.12, CONFIG.Render.ISLAND_HEIGHT * 0.45, 1.12);
  for (const isl of state.map.islands) {
    const grp = new THREE.Group();
    const stoneMat = new THREE.MeshLambertMaterial({ color: Palette.limestone });
    const beachMat = new THREE.MeshLambertMaterial({ color: Palette.limestoneShade });
    const rngIsl = mulberry32(hashString(state.seed + ':isl' + isl.id));
    for (const [cx, cz] of isl.cells) {
      const beach = new THREE.Mesh(beachGeo, beachMat);
      beach.position.set(worldX(cx), CONFIG.Render.ISLAND_HEIGHT * 0.2, worldZ(cz));
      grp.add(beach);
      const rock = new THREE.Mesh(cellGeo, stoneMat);
      rock.position.set(worldX(cx), CONFIG.Render.ISLAND_HEIGHT / 2 + 0.02, worldZ(cz));
      rock.scale.set(0.94 + rngIsl() * 0.1, 0.9 + rngIsl() * 0.25, 0.94 + rngIsl() * 0.1);
      grp.add(rock);
      // trees lean with the wind (a mandated wind tell, §21A.5)
      if (rngIsl() < 0.45 && !isl.plots.some(p => p.x === cx && p.z === cz)) {
        const tree = new THREE.Mesh(
          new THREE.ConeGeometry(0.16 + rngIsl() * 0.08, 0.34 + rngIsl() * 0.2, 6),
          new THREE.MeshLambertMaterial({ color: rngIsl() < 0.5 ? Palette.canopy : Palette.canopyDark })
        );
        tree.position.set(
          worldX(cx) + (rngIsl() - 0.5) * 0.55,
          CONFIG.Render.ISLAND_HEIGHT + 0.16,
          worldZ(cz) + (rngIsl() - 0.5) * 0.55);
        grp.add(tree);
        R.trees.push({ mesh: tree, gx: cx, gz: cz });
      }
    }
    // plots: bronze discs
    for (const p of isl.plots) {
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.34, 0.05, 12),
        new THREE.MeshLambertMaterial({ color: Palette.bronze })
      );
      disc.position.set(worldX(p.x), CONFIG.Render.ISLAND_HEIGHT + 0.05, worldZ(p.z));
      grp.add(disc);
    }
    R.islandGroup.add(grp);
  }

  // the two Great Temples
  for (const side of ['A', 'P']) {
    const gt = state.greatTemple[side];
    const grp = new THREE.Group();
    const isA = side === 'A';
    const stone = new THREE.MeshLambertMaterial({ color: isA ? Palette.ivory : Palette.poseidonStone });
    const trim = new THREE.MeshLambertMaterial({ color: isA ? Palette.gold : Palette.poseidonGlow });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.6, 0.16, 10), stone);
    base.position.y = 0.08;
    grp.add(base);
    for (let i = 0; i < 6; i++) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), stone);
      const a = (i / 6) * Math.PI * 2;
      col.position.set(Math.cos(a) * 0.36, 0.4, Math.sin(a) * 0.36);
      grp.add(col);
    }
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.3, 10), trim);
    roof.position.y = 0.78;
    grp.add(roof);
    grp.position.set(worldX(gt.cell[0]), CONFIG.Render.ISLAND_HEIGHT + 0.04, worldZ(gt.cell[1]));
    R.islandGroup.add(grp);
    gt.mesh = grp;
    // temple smoke plume (wind tell)
    const puffMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });
    for (let i = 0; i < 3; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.07 + i * 0.03, 6, 5), puffMat.clone());
      puff.position.copy(grp.position);
      R.scene.add(puff);
      R.smoke.push({ mesh: puff, base: grp.position.clone(), phase: i / 3, gx: gt.cell[0], gz: gt.cell[1] });
    }
  }

  // whitecaps: the primary wind readout over water
  const capMat = new THREE.MeshBasicMaterial({ color: 0xdff3f2, transparent: true, opacity: 0.0 });
  const capGeo = new THREE.PlaneGeometry(0.34, 0.07);
  const rngCaps = mulberry32(hashString(state.seed + ':caps'));
  for (let i = 0; i < CONFIG.Render.WHITECAP_COUNT; i++) {
    let gx, gz, tries = 20;
    do { gx = rngCaps() * (CONFIG.Grid.WIDTH - 1); gz = rngCaps() * (CONFIG.Grid.HEIGHT - 1); }
    while (state.map.land.has(cellKey(Math.round(gx), Math.round(gz))) && tries-- > 0);
    const cap = new THREE.Mesh(capGeo, capMat.clone());
    cap.rotation.x = -Math.PI / 2;
    cap.position.set(worldX(gx), 0.02, worldZ(gz));
    R.scene.add(cap);
    R.whitecaps.push({ mesh: cap, gx, gz, phase: rngCaps() });
  }
}

// ---------------- segments ----------------
function segMeshKey(seg) { return seg.owner + ':' + seg.key; }

function makeSegMesh(seg) {
  const isAir = seg.owner === 'A';
  const y = isAir ? CONFIG.Render.AIR_ALTITUDE : CONFIG.Render.SEA_ALTITUDE;
  const ax = worldX(seg.a[0]), az = worldZ(seg.a[1]);
  const bx = worldX(seg.b[0]), bz = worldZ(seg.b[1]);
  const grp = new THREE.Group();
  const len = Math.hypot(bx - ax, bz - az);
  const mat = new THREE.MeshLambertMaterial({
    color: isAir ? Palette.ivory : 0x062630,
    emissive: isAir ? Palette.aeolusGlow : 0x0a3540,
    emissiveIntensity: isAir ? 0.45 : 0.55,
    transparent: true, opacity: isAir ? 0.92 : 0.9
  });
  const body = new THREE.Mesh(
    isAir ? new THREE.BoxGeometry(len + 0.14, 0.055, 0.14)
          : new THREE.BoxGeometry(len + 0.2, 0.03, 0.42),
    mat);
  grp.add(body);
  if (!isAir) {
    // bright current stripe so sea lanes read against the water
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(len + 0.18, 0.035, 0.09),
      new THREE.MeshBasicMaterial({ color: Palette.poseidonGlow, transparent: true, opacity: 0.85 }));
    stripe.position.y = 0.012;
    grp.add(stripe);
    grp.userData.stripe = stripe;
  }
  if (isAir) {
    // faint support pylons reference the corridor down toward the water
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, y, 0.015),
      new THREE.MeshBasicMaterial({ color: Palette.ivory, transparent: true, opacity: 0.16 }));
    post.position.y = -y / 2;
    grp.add(post);
  }
  grp.position.set((ax + bx) / 2, y, (az + bz) / 2);
  grp.rotation.y = -Math.atan2(bz - az, bx - ax);
  grp.userData.mat = mat;
  grp.userData.isAir = isAir;
  return grp;
}

function syncSegments(state) {
  const seen = new Set();
  for (const s of state.segments.values()) {
    const k = segMeshKey(s);
    seen.add(k);
    let mesh = R.segMeshes.get(k);
    if (!mesh) {
      mesh = makeSegMesh(s);
      R.segMeshes.set(k, mesh);
      R.scene.add(mesh);
    }
    const mat = mesh.userData.mat;
    const isAir = mesh.userData.isAir;
    const stripe = mesh.userData.stripe;
    if (s.supportState === 'SUPPORTED') {
      mat.color.setHex(isAir ? Palette.ivory : 0x062630);
      mat.emissiveIntensity = isAir ? 0.45 : 0.55;
      mat.opacity = isAir ? 0.92 : 0.9;
      if (stripe) stripe.material.opacity = 0.85;
    } else if (s.supportState === 'FRAYED') {
      mat.color.setHex(Palette.frayed);
      mat.emissiveIntensity = 0.12;
      mat.opacity = 0.55 + 0.25 * Math.sin(state.time * 9);
      if (stripe) stripe.material.opacity = 0.15;
    } else {
      mat.color.setHex(Palette.collapsing);
      mat.emissiveIntensity = 0.5 + 0.4 * Math.sin(state.time * 14);
      mat.opacity = 0.5 + 0.3 * Math.sin(state.time * 14);
      if (stripe) stripe.material.opacity = 0.1;
    }
  }
  for (const [k, mesh] of R.segMeshes) {
    if (!seen.has(k)) {
      R.scene.remove(mesh);
      R.segMeshes.delete(k);
    }
  }
}

// ---------------- sockets, preview, influence ----------------
function showSockets(state, sockets) {
  R.socketGroup.clear();
  for (const s of sockets) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.34, 20),
      new THREE.MeshBasicMaterial({ color: Palette.socket, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    const y = islandAtCells(state, s.cell) ? CONFIG.Render.ISLAND_HEIGHT + 0.06 : CONFIG.Render.AIR_ALTITUDE;
    ring.position.set(worldX(s.cell[0]), y, worldZ(s.cell[1]));
    ring.userData.socket = s;
    R.socketGroup.add(ring);
  }
}
function islandAtCells(state, cell) { return islandAt(state, cell[0], cell[1]); }
function clearSockets() { R.socketGroup.clear(); }

function showPreview(state, segs, ok) {
  R.previewGroup.clear();
  for (const [a, b] of segs) {
    const y = CONFIG.Render.AIR_ALTITUDE;
    const ax = worldX(a[0]), az = worldZ(a[1]), bx = worldX(b[0]), bz = worldZ(b[1]);
    const len = Math.hypot(bx - ax, bz - az);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(len + 0.14, 0.06, 0.16),
      new THREE.MeshBasicMaterial({
        color: ok ? Palette.socket : Palette.danger,
        transparent: true, opacity: 0.55 + 0.2 * Math.sin(state.time * 6)
      }));
    mesh.position.set((ax + bx) / 2, y, (az + bz) / 2);
    mesh.rotation.y = -Math.atan2(bz - az, bx - ax);
    R.previewGroup.add(mesh);
  }
}
function clearPreview() { R.previewGroup.clear(); }

// influence edge shading: subtle tint so buildable ground reads
function refreshInfluenceView(state) {
  R.influenceGroup.clear();
  const geo = new THREE.PlaneGeometry(0.98, 0.98);
  const matA = new THREE.MeshBasicMaterial({ color: Palette.gold, transparent: true, opacity: 0.05 });
  const matC = new THREE.MeshBasicMaterial({ color: 0xd97fd9, transparent: true, opacity: 0.06 });
  for (const k of state.influence.A) {
    const [x, z] = keyCell(k);
    if (state.map.land.has(k)) continue;
    const m = new THREE.Mesh(geo, state.influence.contested.has(k) ? matC : matA);
    m.rotation.x = -Math.PI / 2;
    m.position.set(worldX(x), 0.012, worldZ(z));
    R.influenceGroup.add(m);
  }
}

// ---------------- per-frame ----------------
function renderTick(state, dt) {
  // whitecaps drift with the wind and shimmer
  for (const c of R.whitecaps) {
    const w = state.wind.at(c.gx, c.gz);
    c.gx += w.x * dt * 0.55;
    c.gz += w.z * dt * 0.55;
    if (c.gx < 0 || c.gx > CONFIG.Grid.WIDTH - 1 || c.gz < 0 || c.gz > CONFIG.Grid.HEIGHT - 1) {
      c.gx = (c.gx + CONFIG.Grid.WIDTH) % (CONFIG.Grid.WIDTH - 0.01);
      c.gz = (c.gz + CONFIG.Grid.HEIGHT) % (CONFIG.Grid.HEIGHT - 0.01);
    }
    c.phase += dt * 1.4;
    c.mesh.position.x = worldX(c.gx);
    c.mesh.position.z = worldZ(c.gz);
    c.mesh.rotation.z = -Math.atan2(w.z, w.x);
    const onLand = state.map.land.has(cellKey(Math.round(c.gx), Math.round(c.gz)));
    c.mesh.material.opacity = onLand ? 0 : 0.16 + 0.16 * Math.sin(c.phase * Math.PI * 2);
  }
  // trees lean into the wind
  for (const t of R.trees) {
    const w = state.wind.at(t.gx, t.gz);
    t.mesh.rotation.z = -w.x * 0.22;
    t.mesh.rotation.x = w.z * 0.22;
  }
  // smoke plumes stream downwind
  for (const s of R.smoke) {
    s.phase = (s.phase + dt * 0.35) % 1;
    const w = state.wind.at(s.gx, s.gz);
    const d = s.phase * 1.1;
    s.mesh.position.set(s.base.x + w.x * d, s.base.y + 0.85 + s.phase * 0.5, s.base.z + w.z * d);
    s.mesh.material.opacity = 0.32 * (1 - s.phase);
    s.mesh.scale.setScalar(0.7 + s.phase * 1.6);
  }
  syncSegments(state);
  R.renderer.render(R.scene, R.camera);
}

// tap -> grid cell (or null)
function pickCell(clientX, clientY) {
  const rect = R.renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1);
  R.raycaster.setFromCamera(ndc, R.camera);
  const pt = new THREE.Vector3();
  if (!R.raycaster.ray.intersectPlane(R.groundPlane, pt)) return null;
  const [gx, gz] = gridFromWorld(pt.x, pt.z);
  if (!inBounds(gx, gz)) return null;
  return [gx, gz];
}
