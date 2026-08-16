// ================================================================
// CINEMATICS (player-directed) — atmosphere that never takes control
// away: Poseidon's breakers crashing against the rim of the arena, and
// a slow zoom-out breath while a wave is telegraphed. All original
// geometry; nothing blocks input.
// ================================================================

function initCinematics(state) {
  // (clouds tried and removed by player direction — they sat between the
  // camera and the board and cost more readability than they earned)
  const cine = { breakers: [], pulseT0: -99 };
  R.cine = cine;
  const W = CONFIG.Grid.WIDTH, H = CONFIG.Grid.HEIGHT;

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
