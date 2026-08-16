// ================================================================
// RENDERER — Three.js scene. Mythic Hellenic bronzepunk, portrait,
// fixed oblique camera, no rotation. All geometry procedural; the
// grid is invisible, the layers must read at a glance (§21, §31).
// ================================================================

const Palette = {
  sea: 0x104b58, seaDeep: 0x0e4652,
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

// A tileable ripple texture painted at boot: layered sine swells with a
// little seeded chop, in the sea palette. Zero assets, pure canvas.
function makeSeaTexture() {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const rng = mulberry32(0x5EA);
  const img = ctx.createImageData(S, S);
  const base = { r: 0x10, g: 0x4b, b: 0x58 };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x / S) * Math.PI * 2, v = (y / S) * Math.PI * 2;
      let h = Math.sin(u * 3 + Math.sin(v * 2) * 1.3) * 0.5
        + Math.sin(v * 5 + Math.sin(u * 4) * 0.8) * 0.3
        + Math.sin((u + v) * 7) * 0.2;
      h += (rng() - 0.5) * 0.25;
      const crest = clamp(h * 0.5 + 0.5, 0, 1);
      const lift = 0.82 + crest * 0.45;   // crests lighten, troughs deepen
      const i = (y * S + x) * 4;
      img.data[i] = Math.min(255, base.r * lift + crest * 14);
      img.data[i + 1] = Math.min(255, base.g * lift + crest * 20);
      img.data[i + 2] = Math.min(255, base.b * lift + crest * 22);
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  return tex;
}

// A tileable NORMAL map for the real water shader, generated at boot —
// layered periodic swells; gradients become per-pixel normals. Zero
// image assets: the shader is three.js's own (vendor/Water.js), the
// texture is ours.
function makeWaterNormals() {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(S, S);
  const height = (u, v) =>
    Math.sin(u * 3 + Math.sin(v * 2) * 1.7) * 0.5 +
    Math.sin(v * 5 + Math.sin(u * 4) * 1.1) * 0.32 +
    Math.sin((u + v) * 8 + Math.sin(u * 2) * 0.9) * 0.2 +
    Math.sin((u * 2 - v * 3)) * 0.14;
  const TAU = Math.PI * 2;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = (x / S) * TAU, v = (y / S) * TAU;
      const e = TAU / S;
      const hx = height(u + e, v) - height(u - e, v);
      const hy = height(u, v + e) - height(u, v - e);
      // pack the gradient as a tangent-space normal
      const nx = -hx * 2.2, ny = -hy * 2.2, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * S + x) * 4;
      img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(cv);
}

function initRenderer() {
  const canvas = document.getElementById('gl');
  R.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  R.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  R.scene = new THREE.Scene();
  R.scene.background = new THREE.Color(0x0d3540);
  R.scene.fog = new THREE.Fog(0x0d3540, 17, 32);

  R.camera = new THREE.PerspectiveCamera(CONFIG.Render.CAM_FOV, 1, 0.1, 100);
  R.raycaster = new THREE.Raycaster();
  R.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  const sun = new THREE.DirectionalLight(0xfff2dd, 0.95);
  sun.position.set(6, 14, 4);
  R.scene.add(sun);
  R.scene.add(new THREE.HemisphereLight(0xbcdce4, 0x27453a, 0.5));

  // the Aegean. Preferred: three.js's own Water shader (vendored, MIT —
  // rules allow rights-cleared libraries) with OUR generated normal map:
  // live planar reflections, sun glare, per-pixel waves. Fallback if the
  // vendor file is absent: the original Phong bump sea.
  if (THREE.Water) {
    const normals = makeWaterNormals();
    normals.wrapS = normals.wrapT = THREE.RepeatWrapping;
    const sea = new THREE.Water(
      new THREE.PlaneGeometry(CONFIG.Grid.WIDTH * 4, CONFIG.Grid.HEIGHT * 3),
      {
        textureWidth: 512, textureHeight: 512,
        waterNormals: normals,
        sunDirection: new THREE.Vector3(6, 14, 4).normalize(),
        sunColor: 0xfff2dd,
        waterColor: 0x1e7b8a,
        distortionScale: 3.2,
        fog: true
      });
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = 0;
    sea.material.uniforms.size.value = 4;   // wave tiling across the plane
    R.scene.add(sea);
    R.seaMesh = sea;
    R.seaTex = null;
    R.waterShader = true;
    // upgrade to the canonical three.js wave normals, MIRRORED LOCALLY in
    // /vendor (never fetched from a CDN at runtime). If the browser
    // refuses file:// images as WebGL textures, the generated map above
    // simply stays — the sea never depends on the network or the file.
    new THREE.TextureLoader().load('vendor/waternormals.jpg', (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      // the Water shader exposes the map as `normalSampler` (the
      // `waterNormals` name exists only as a constructor option)
      const u = sea.material.uniforms.normalSampler;
      if (u) u.value = tex;
    }, undefined, () => { });
  } else {
    const seaTex = makeSeaTexture();
    seaTex.wrapS = seaTex.wrapT = THREE.RepeatWrapping;
    seaTex.repeat.set(CONFIG.Grid.WIDTH * 0.7, CONFIG.Grid.HEIGHT * 0.55);
    const seaGeo = new THREE.PlaneGeometry(CONFIG.Grid.WIDTH * 4, CONFIG.Grid.HEIGHT * 3, 40, 60);
    const sea = new THREE.Mesh(
      seaGeo,
      new THREE.MeshPhongMaterial({
        color: 0xaad4d8, map: seaTex,
        bumpMap: seaTex, bumpScale: 0.2,
        specular: 0x2e5560, shininess: 22
      })
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = 0;
    R.scene.add(sea);
    R.seaTex = seaTex;
    R.seaMesh = sea;
  }

  R.socketGroup = new THREE.Group();
  R.previewGroup = new THREE.Group();
  R.influenceGroup = new THREE.Group();
  R.islandGroup = new THREE.Group();
  R.actionGroup = new THREE.Group();
  R.scene.add(R.socketGroup, R.previewGroup, R.influenceGroup, R.islandGroup, R.actionGroup);

  onResize();
  window.addEventListener('resize', onResize);
  R.initialized = true;
}

// The map is larger than the screen on purpose: the camera keeps its
// fixed oblique angle and the player pans by dragging. Fog of war and
// room to build both come from the viewport being a window, not a wall.
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  R.renderer.setSize(w, h, false);
  R.camera.aspect = w / h;
  R.camera.updateProjectionMatrix();
  updateCamera();
}

function updateCamera() {
  if (!R.camTarget) R.camTarget = { x: 0, z: 0 };
  const fit = Math.max(1, (9 / 16) / (R.camera.aspect) * 0.92);
  const t = R.camTarget;
  const mx = (CONFIG.Grid.WIDTH - 1) / 2 + CONFIG.Render.PAN_MARGIN;
  const mz = (CONFIG.Grid.HEIGHT - 1) / 2 + CONFIG.Render.PAN_MARGIN;
  t.x = clamp(t.x, -mx, mx);
  t.z = clamp(t.z, -mz, mz + 1);
  // pinch zoom and two-finger rotation orbit the same fixed tilt
  if (R.camZoom === undefined) { R.camZoom = 1; R.camAz = 0; }
  R.camZoom = clamp(R.camZoom, 0.75, 2.6);
  const zoomFx = R.camZoom * (R.zoomPulse || 1);   // telegraph breath rides on top
  // three-finger tilt: trade height for distance around the same target
  const tilt = clamp(R.camTilt || 1, 0.65, 1.35);
  const back = CONFIG.Render.CAM_BACK * fit * zoomFx * (2 - tilt);
  const h = CONFIG.Render.CAM_HEIGHT * fit * zoomFx * tilt;
  R.camera.position.set(
    t.x + Math.sin(R.camAz || 0) * back,
    h,
    t.z + Math.cos(R.camAz || 0) * back);
  R.camera.lookAt(t.x, 0, t.z);
  // atmospheric depth cue scales with zoom so zooming out never fogs
  // ground the player could see up close
  if (R.scene && R.scene.fog) {
    const d = Math.hypot(back, h);
    R.scene.fog.near = d * 1.12;
    R.scene.fog.far = d * 2.1;
  }
}

function panCameraTo(wx, wz) {
  R.camTarget = { x: wx, z: wz };
  updateCamera();
}

// ---------------- static map ----------------
function buildMapMeshes(state) {
  R.islandGroup.clear();
  R.whitecaps = [];
  R.trees = [];
  R.smoke = [];
  R.foam = [];

  // depth tint: bright turquoise shallows near every coast, darkening to
  // deep water offshore — painted into the sea mesh's vertex colours.
  // (The real water shader owns its own colour; skip when active.)
  if (!R.waterShader) {
    const dl = distToLandGrid(state.map);
    const geo = R.seaMesh.geometry;
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const deep = new THREE.Color(0x6e9aa4);
    const shallow = new THREE.Color(0xd8fff0);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i);
      const wz = -pos.getY(i);            // plane is rotated -90deg about X
      const gx = Math.round(wx + (CONFIG.Grid.WIDTH - 1) / 2);
      const gz = Math.round(wz + (CONFIG.Grid.HEIGHT - 1) / 2);
      let d = 5;
      if (gx >= 0 && gx < CONFIG.Grid.WIDTH && gz >= 0 && gz < CONFIG.Grid.HEIGHT) d = dl[gz][gx];
      const t = clamp((d - 0.6) / 3.2, 0, 1);
      tmp.copy(shallow).lerp(deep, t);
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    R.seaMesh.material.vertexColors = true;
    R.seaMesh.material.needsUpdate = true;
  }

  // foam laps every coastline edge
  {
    const foamGeo = new THREE.PlaneGeometry(0.96, 0.13);
    const rngFoam = mulberry32(hashString(state.seed + ':foam'));
    for (const isl of state.map.islands) {
      for (const [cx, cz] of isl.cells) {
        for (const [dx, dz] of DIRS4) {
          const nx = cx + dx, nz = cz + dz;
          if (!inBounds(nx, nz) || state.map.land.has(cellKey(nx, nz))) continue;
          const strip = new THREE.Mesh(foamGeo,
            new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3 }));
          strip.rotation.x = -Math.PI / 2;
          strip.rotation.z = dx !== 0 ? Math.PI / 2 : 0;
          strip.position.set(worldX(cx) + dx * 0.56, 0.055, worldZ(cz) + dz * 0.56);
          R.islandGroup.add(strip);
          R.foam.push({ mesh: strip, phase: rngFoam() * Math.PI * 2, axis: dx !== 0 ? 'x' : 'z', dir: dx + dz });
        }
      }
    }
  }

  const cellGeo = new THREE.BoxGeometry(1.0, CONFIG.Render.ISLAND_HEIGHT, 1.0);
  const beachGeo = new THREE.BoxGeometry(1.12, CONFIG.Render.ISLAND_HEIGHT * 0.45, 1.12);
  for (const isl of state.map.islands) {
    const grp = new THREE.Group();
    const stoneMat = new THREE.MeshLambertMaterial({ color: Palette.limestone });
    // the island's base tints with its allegiance (updated per frame)
    const beachMat = new THREE.MeshLambertMaterial({ color: Palette.limestoneShade });
    isl.beachMat = beachMat;
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
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.26, 10), trim);
    roof.position.y = 0.76;
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

  // the wind map: persistent streaks over every stretch of water, always
  // flowing with the live field — the sea IS the wind instrument
  const capMat = new THREE.MeshBasicMaterial({ color: 0xdff3f2, transparent: true, opacity: 0.0 });
  const capGeo = new THREE.PlaneGeometry(0.6, 0.045);
  const rngCaps = mulberry32(hashString(state.seed + ':caps'));
  const waterCells = CONFIG.Grid.WIDTH * CONFIG.Grid.HEIGHT - state.map.land.size;
  const capCount = Math.round(waterCells / CONFIG.Render.WHITECAP_PER_CELLS);
  for (let i = 0; i < capCount; i++) {
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
  if (isAir) {
    // wind motes drifting along the ribbon — faster where aligned (§21A.5)
    grp.userData.motes = [];
    for (let i = 0; i < CONFIG.Render.RIBBON_PARTICLES; i++) {
      const mote = new THREE.Mesh(
        new THREE.SphereGeometry(0.035, 5, 4),
        new THREE.MeshBasicMaterial({ color: 0xfff6dd, transparent: true, opacity: 0.9 }));
      mote.position.y = 0.06;
      grp.add(mote);
      grp.userData.motes.push({ mesh: mote, phase: i / CONFIG.Render.RIBBON_PARTICLES });
    }
  }
  grp.position.set((ax + bx) / 2, y, (az + bz) / 2);
  grp.rotation.y = -Math.atan2(bz - az, bx - ax);
  grp.userData.mat = mat;
  grp.userData.isAir = isAir;
  grp.userData.seg = seg;
  grp.userData.len = len;
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
    // fog: enemy segments need vision, or memory at reduced brightness (§14B.2)
    const segVis = typeof segmentVisibility === 'function' ? segmentVisibility(state, s) : 'full';
    mesh.visible = segVis !== 'hidden';
    const mat = mesh.userData.mat;
    const isAir = mesh.userData.isAir;
    if (segVis === 'dim') {
      mat.color.setHex(0x3a4d52);
      mat.emissiveIntensity = 0.05;
      mat.opacity = 0.3;
      if (mesh.userData.stripe) mesh.userData.stripe.material.opacity = 0.1;
      continue;
    }
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
    const grp = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.46, 24),
      new THREE.MeshBasicMaterial({ color: Palette.socket, transparent: true, opacity: 0.95, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    // a beacon of light so sockets read from anywhere on the map
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.09, 2.6, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: Palette.socket, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
    beam.position.y = 1.3;
    grp.add(ring, beam);
    const y = islandAtCells(state, s.cell) ? CONFIG.Render.ISLAND_HEIGHT + 0.06 : CONFIG.Render.AIR_ALTITUDE;
    grp.position.set(worldX(s.cell[0]), y, worldZ(s.cell[1]));
    grp.userData.socket = s;
    grp.userData.ring = ring;
    R.socketGroup.add(grp);
  }
}
function islandAtCells(state, cell) { return islandAt(state, cell[0], cell[1]); }
function clearSockets() { R.socketGroup.clear(); }

// Always-on markers for every spot the player can act at: tap one and the
// context menu of pieces and buildings opens right there. Hidden while a
// ghost is being placed (the socket beacons take over).
let nextActionRefresh = 0;
function refreshActionMarkers(state) {
  if (state.time < nextActionRefresh) return;
  nextActionRefresh = state.time + 0.8;
  R.actionGroup.clear();
  const busy = typeof UI !== 'undefined' && (UI.mode === 'placing' || UI.structMode);
  if (busy || state.over) return;
  const geo = new THREE.OctahedronGeometry(0.1);
  const matAir = new THREE.MeshBasicMaterial({ color: Palette.socket, transparent: true, opacity: 0.55 });
  const matLand = new THREE.MeshBasicMaterial({ color: Palette.socket, transparent: true, opacity: 0.4 });
  for (const s of getSockets(state, 'A')) {
    const onLand = !!islandAt(state, s.cell[0], s.cell[1]);
    const m = new THREE.Mesh(geo, onLand ? matLand : matAir);
    m.position.set(worldX(s.cell[0]),
      onLand ? CONFIG.Render.ISLAND_HEIGHT + 0.42 : CONFIG.Render.AIR_ALTITUDE + 0.22,
      worldZ(s.cell[1]));
    R.actionGroup.add(m);
  }
}

function showPreview(state, segs, ok) {
  R.previewGroup.clear();
  const y = CONFIG.Render.AIR_ALTITUDE;
  for (const [a, b] of segs) {
    const ax = worldX(a[0]), az = worldZ(a[1]), bx = worldX(b[0]), bz = worldZ(b[1]);
    const len = Math.hypot(bx - ax, bz - az);
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(len + 0.14, 0.09, 0.24),
      new THREE.MeshBasicMaterial({
        color: ok ? Palette.socket : Palette.danger,
        transparent: true, opacity: 0.7
      }));
    mesh.position.set((ax + bx) / 2, y, (az + bz) / 2);
    mesh.rotation.y = -Math.atan2(bz - az, bx - ax);
    R.previewGroup.add(mesh);
  }
  // arrowheads on every open end of the ghost, so its direction reads
  const cellCount = new Map();
  for (const [a, b] of segs) {
    for (const c of [a, b]) {
      const k = cellKey(c[0], c[1]);
      cellCount.set(k, (cellCount.get(k) || 0) + 1);
    }
  }
  for (const [a, b] of segs) {
    for (const [tip, from] of [[b, a], [a, b]]) {
      if (cellCount.get(cellKey(tip[0], tip[1])) !== 1) continue;
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.15),
        new THREE.MeshBasicMaterial({ color: ok ? Palette.socket : Palette.danger, transparent: true, opacity: 0.95 }));
      gem.position.set(worldX(tip[0]), y, worldZ(tip[1]));
      gem.userData.spin = true;
      R.previewGroup.add(gem);
    }
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
  // the real water runs on shader time, paced by the wind under the camera
  if (R.waterShader) {
    const [cgx, cgz] = gridFromWorld(R.camTarget ? R.camTarget.x : 0, R.camTarget ? R.camTarget.z : 0);
    const w = state.wind.at(clamp(cgx, 0, CONFIG.Grid.WIDTH - 1), clamp(cgz, 0, CONFIG.Grid.HEIGHT - 1));
    const speed = (0.35 + Math.hypot(w.x, w.z) * 0.5) * (R.seaSurge || 1);
    R.seaMesh.material.uniforms.time.value += dt * speed;
  }
  // the sea itself streams with the wind under the camera
  if (R.seaTex) {
    const [cgx, cgz] = gridFromWorld(R.camTarget ? R.camTarget.x : 0, R.camTarget ? R.camTarget.z : 0);
    const w = state.wind.at(clamp(cgx, 0, CONFIG.Grid.WIDTH - 1), clamp(cgz, 0, CONFIG.Grid.HEIGHT - 1));
    R.seaTex.offset.x -= w.x * dt * 0.028;
    R.seaTex.offset.y += w.z * dt * 0.028;
    // low-frequency swell so coastlines visibly breathe
    const pos = R.seaMesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);   // plane local: y maps to world -z
      pos.setZ(i, 0.05 * Math.sin(x * 0.8 + state.time * 1.3) +
                  0.04 * Math.sin(y * 1.1 - state.time * 0.9));
    }
    pos.needsUpdate = true;
  }
  // whitecaps ride the wind for a few seconds, fade, and respawn at a
  // fresh spot — so the field stays evenly alive instead of pooling at
  // the rim where the sheared wind runs parallel to the edge
  if (!R.capRng) R.capRng = mulberry32(0xCAB5);
  for (const c of R.whitecaps) {
    const w = state.wind.at(c.gx, c.gz);
    c.gx += w.x * dt * 0.55;
    c.gz += w.z * dt * 0.55;
    c.life = (c.life === undefined ? 3 + c.phase * 5 : c.life) - dt;
    if (c.life <= 0 ||
        c.gx < 0 || c.gx > CONFIG.Grid.WIDTH - 1 || c.gz < 0 || c.gz > CONFIG.Grid.HEIGHT - 1) {
      let tries = 12;
      do {
        c.gx = R.capRng() * (CONFIG.Grid.WIDTH - 1);
        c.gz = R.capRng() * (CONFIG.Grid.HEIGHT - 1);
      } while (state.map.land.has(cellKey(Math.round(c.gx), Math.round(c.gz))) && tries-- > 0);
      c.life = 4 + R.capRng() * 6;
      c.phase = R.capRng();
    }
    c.phase += dt * 1.4;
    c.mesh.position.x = worldX(c.gx);
    c.mesh.position.z = worldZ(c.gz);
    c.mesh.rotation.z = -Math.atan2(w.z, w.x);
    const onLand = state.map.land.has(cellKey(Math.round(c.gx), Math.round(c.gz)));
    const fade = Math.min(1, Math.min(c.life, 1.2));
    // steady, persistent visibility with only a gentle shimmer
    c.mesh.material.opacity = onLand ? 0 : (0.22 + 0.07 * Math.sin(c.phase * Math.PI * 2)) * fade;
  }
  // foam breathes against the coasts
  for (const f of R.foam) {
    const pulse = Math.sin(state.time * 1.8 + f.phase);
    f.mesh.material.opacity = CONFIG.Render.FOAM_OPACITY * (0.45 + 0.35 * pulse);
    f.mesh.scale.y = 1 + 0.35 * pulse;
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
  // wind motes ride the corridors, faster where the wind agrees
  for (const mesh of R.segMeshes.values()) {
    const md = mesh.userData;
    if (!md.motes || !mesh.visible) continue;
    const s = md.seg;
    const dx = s.b[0] - s.a[0], dz = s.b[1] - s.a[1];
    const w = state.wind.at((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2);
    const align = (dx * w.x + dz * w.z) / (Math.hypot(dx, dz) || 1);
    const speed = 0.25 + Math.abs(align) * 0.6;
    const dir = align >= 0 ? 1 : -1;
    const active = s.supportState === 'SUPPORTED';
    for (const m of md.motes) {
      m.phase = (m.phase + dir * speed * dt + 1) % 1;
      m.mesh.position.x = (m.phase - 0.5) * md.len;
      m.mesh.material.opacity = active ? 0.5 + 0.4 * Math.sin((m.phase + state.time * 0.3) * Math.PI * 2) : 0.08;
    }
  }
  // pulse the placement affordances so they are unmissable
  const pulse = 1 + 0.13 * Math.sin(state.time * 5);
  for (const g of R.socketGroup.children) {
    if (g.userData.ring) g.userData.ring.scale.setScalar(pulse);
  }
  for (const m of R.actionGroup.children) {
    m.rotation.y += dt * 1.6;
    m.scale.setScalar(0.9 + 0.15 * Math.sin(state.time * 3 + m.position.x));
  }
  for (const m of R.previewGroup.children) {
    if (m.userData && m.userData.spin) m.rotation.y += dt * 2.5;
  }
  syncSegments(state);
  R.renderer.render(R.scene, R.camera);
}

// pointer -> ground-plane point (world coords), or null
function pickGround(clientX, clientY) {
  const rect = R.renderer.domElement.getBoundingClientRect();
  const ndc = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1);
  R.raycaster.setFromCamera(ndc, R.camera);
  const pt = new THREE.Vector3();
  if (!R.raycaster.ray.intersectPlane(R.groundPlane, pt)) return null;
  return pt;
}

// tap -> grid cell (or null)
function pickCell(clientX, clientY) {
  const pt = pickGround(clientX, clientY);
  if (!pt) return null;
  const [gx, gz] = gridFromWorld(pt.x, pt.z);
  if (!inBounds(gx, gz)) return null;
  return [gx, gz];
}
