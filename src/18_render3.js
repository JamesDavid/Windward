// ================================================================
// CINEMATICS (player-directed) — atmosphere that never takes control
// away. When Poseidon telegraphs a wave, the WHOLE SEA rises: shader
// distortion and wave speed surge through the telegraph and assault,
// then ease back to calm. (Rim-breaker blobs tried and removed — the
// sea itself is the actor now.) Plus the slow zoom-out breath.
// ================================================================

function initCinematics(state) {
  R.cine = { pulseT0: -99, wakes: [] };
  Events.on('waveTelegraph', () => { R.cine.pulseT0 = R.cine.now || 0; });

  // islands make a LEE WAKE (player-directed): foam streaks trailing
  // downwind of every island, so the flow visibly parts around land
  // instead of sliding underneath it
  for (const isl of state.map.islands) {
    let r = 1;
    for (const [x, z] of isl.cells) r = Math.max(r, Math.hypot(x - isl.center[0], z - isl.center[1]));
    const grp = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const streak = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5 - i * 0.3, 0.13),
        new THREE.MeshBasicMaterial({ color: 0xdff2ee, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false }));
      streak.rotation.x = -Math.PI / 2;
      streak.position.set(0.7 + i * 0.5, 0, (i - 1) * 0.45);
      grp.add(streak);
    }
    R.scene.add(grp);
    R.cine.wakes.push({ grp, isl, r });
  }
}

function cinematicTick(state, dt) {
  if (!R.scene) return;
  if (!R.cine) initCinematics(state);
  const cine = R.cine;
  cine.now = state.time;

  // storm envelope: swell up through the 8s telegraph, rage while the
  // wave is landing, then die down
  const T = CONFIG.Waves.TELEGRAPH;
  const t = state.time - cine.pulseT0;
  let env = 0;
  if (t >= 0) {
    if (t < T) env = t / T;
    else if (t < T + 20) env = 1;
    else if (t < T + 28) env = 1 - (t - (T + 20)) / 8;
  }
  R.seaSurge = 1 + env * 1.6;                       // wave speed multiplier
  if (R.waterShader && R.seaMesh.material.uniforms.distortionScale) {
    R.seaMesh.material.uniforms.distortionScale.value = 3.2 * (1 + env * 1.2);
  }

  // lee wakes trail downwind of each island, breathing with the wind
  for (const wk of cine.wakes) {
    const c = wk.isl.center;
    const lifted = groundLifted(state, Math.round(c[0]), Math.round(c[1]));
    wk.grp.visible = lifted;   // never leak unexplored islands via their wake
    if (!lifted) continue;
    const w = state.wind.at(c[0], c[1]);
    const ang = Math.atan2(w.z, w.x);
    wk.grp.position.set(
      worldX(c[0] + Math.cos(ang) * (wk.r + 0.3)), 0.055,
      worldZ(c[1] + Math.sin(ang) * (wk.r + 0.3)));
    wk.grp.rotation.y = -ang;
    wk.grp.children.forEach((s, i) => {
      s.material.opacity = (0.16 + 0.08 * Math.sin(state.time * 1.4 + wk.isl.id + i)) * (1 - i * 0.25);
      s.position.x = 0.6 + i * 0.5 + 0.15 * Math.sin(state.time * 2 + i * 1.7 + wk.isl.id);
    });
  }

  // telegraph breath: ease out ~15% and back over the warning. The
  // player's own pinch always wins — the pulse is a multiplier applied
  // at camera time, never a change to their chosen zoom.
  const p = t / T;
  R.zoomPulse = (p >= 0 && p <= 1) ? 1 + 0.15 * Math.sin(Math.PI * p) : 1;
  if (R.zoomPulse !== R.lastZoomPulse) {
    R.lastZoomPulse = R.zoomPulse;
    updateCamera();   // the camera only refreshes on input; the breath needs its own
  }
}
