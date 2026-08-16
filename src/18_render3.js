// ================================================================
// CINEMATICS (player-directed) — atmosphere that never takes control
// away: drifting clouds with sea shadows, Poseidon's breakers crashing
// against the rim of the arena, and a slow zoom-out breath while a wave
// is telegraphed. All original geometry; nothing blocks input.
// ================================================================

function initCinematics(state) {
  const cine = { clouds: [], breakers: [], pulseT0: -99 };
  R.cine = cine;

  // ---- clouds: sparse puff clusters riding high above the airships,
  // each dragging a soft shadow across the sea ----
  const rng = mulberry32(1234567);
  const W = CONFIG.Grid.WIDTH, H = CONFIG.Grid.HEIGHT;
  // opaque stylized puffs: transparency on overlapping spheres depth-fights
  // against the transparent sea and reads as hollow bowls
  const puffMat = new THREE.MeshLambertMaterial({ color: 0xf7f4ec });
  const shadowMat = new THREE.MeshBasicMaterial({ color: 0x06222a, transparent: true, opacity: 0.10 });
  for (let i = 0; i < 7; i++) {
    const grp = new THREE.Group();
    const n = 4 + Math.floor(rng() * 3);
    let span = 0;
    for (let p = 0; p < n; p++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.5 + rng() * 0.5, 8, 6), puffMat);
      const px = (p - (n - 1) / 2) * 0.7 + (rng() - 0.5) * 0.3;
      puff.position.set(px, (rng() - 0.5) * 0.25, (rng() - 0.5) * 0.8);
      puff.scale.y = 0.55;
      grp.add(puff);
      span = Math.max(span, Math.abs(px) + 0.6);
    }
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(span * 0.9, 12), shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    R.scene.add(grp, shadow);
    cine.clouds.push({
      grp, shadow,
      x: rng() * W, z: rng() * H,
      y: 3.4 + rng() * 1.2,
      drift: 0.10 + rng() * 0.08
    });
  }

  // ---- breakers: swells that rise and burst white against the outside
  // of the arena, all four rims — the sea besieging the sky's ground ----
  const swellMat = new THREE.MeshLambertMaterial({ color: 0x8fc9d2, transparent: true, opacity: 0.8 });
  const foamMat = new THREE.MeshBasicMaterial({ color: 0xeef7f5, transparent: true, opacity: 0 });
  const addBreaker = (gx, gz, nx, nz) => {
    // a mostly-submerged crest: only its rounded back breaks the surface
    const swell = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), swellMat);
    swell.scale.set(2.2, 0.55, 0.9);
    // foam is a flat sheet flung across the water at the crash
    const foam = new THREE.Mesh(new THREE.CircleGeometry(0.85, 10), foamMat.clone());
    foam.rotation.x = -Math.PI / 2;
    // align the long axis with the rim it strikes
    swell.rotation.y = Math.atan2(nx, nz);
    R.scene.add(swell, foam);
    cine.breakers.push({ swell, foam, gx, gz, nx, nz, phase: (gx * 7 + gz * 13) % (Math.PI * 2), speed: 0.55 + ((gx + gz) % 5) * 0.07 });
  };
  const M = 2.2;   // how far outside the rim the sea breaks
  for (let x = 0; x < W; x += 2.4) {
    addBreaker(x, -M, 0, 1);
    addBreaker(x, H - 1 + M, 0, -1);
  }
  for (let z = 0; z < H; z += 2.4) {
    addBreaker(-M, z, 1, 0);
    addBreaker(W - 1 + M, z, -1, 0);
  }

  Events.on('waveTelegraph', () => { cine.pulseT0 = cine.now || 0; });
}

function cinematicTick(state, dt) {
  if (!R.scene) return;
  if (!R.cine) initCinematics(state);
  const cine = R.cine;
  cine.now = state.time;
  const W = CONFIG.Grid.WIDTH, H = CONFIG.Grid.HEIGHT;

  // clouds ride the wind at altitude, wrapping around the arena
  for (const c of cine.clouds) {
    const w = state.wind.at(c.x, c.z);
    c.x += w.x * c.drift * dt * 3;
    c.z += w.z * c.drift * dt * 3;
    if (c.x < -3) c.x += W + 6; if (c.x > W + 3) c.x -= W + 6;
    if (c.z < -3) c.z += H + 6; if (c.z > H + 3) c.z -= H + 6;
    c.grp.position.set(worldX(c.x), c.y, worldZ(c.z));
    c.shadow.position.set(worldX(c.x + 0.8), 0.055, worldZ(c.z + 0.8));
  }

  // breakers: rise, lunge at the rim, burst to foam, slide back
  for (const b of cine.breakers) {
    const t = (state.time * b.speed + b.phase) % (Math.PI * 2);
    const surge = Math.max(0, Math.sin(t));            // 0..1 rise and fall
    const crash = Math.pow(Math.max(0, Math.sin(t - 0.5)), 6);   // sharp burst after the peak
    const lunge = surge * 0.7;
    const x = b.gx + b.nx * lunge, z = b.gz + b.nz * lunge;
    b.swell.position.set(worldX(x), -0.62 + surge * 0.42, worldZ(z));
    b.foam.position.set(worldX(x + b.nx * 0.5), 0.075, worldZ(z + b.nz * 0.5));
    b.foam.material.opacity = crash * 0.8;
    b.foam.scale.setScalar(0.55 + crash * 0.6);
  }

  // telegraph breath: ease out ~15% and back over the 8s warning. The
  // player's own pinch always wins — the pulse is a multiplier applied
  // at camera time, never a change to their chosen zoom.
  const p = (state.time - cine.pulseT0) / CONFIG.Waves.TELEGRAPH;
  R.zoomPulse = (p >= 0 && p <= 1) ? 1 + 0.15 * Math.sin(Math.PI * p) : 1;
  if (R.zoomPulse !== R.lastZoomPulse) {
    R.lastZoomPulse = R.zoomPulse;
    updateCamera();   // the camera only refreshes on input; the breath needs its own
  }
}
