// ================================================================
// CINEMATICS (player-directed) — atmosphere that never takes control
// away. When Poseidon telegraphs a wave, the WHOLE SEA rises: shader
// distortion and wave speed surge through the telegraph and assault,
// then ease back to calm. (Rim-breaker blobs tried and removed — the
// sea itself is the actor now.) Plus the slow zoom-out breath.
// ================================================================

function initCinematics(state) {
  // (island wake streaks and bow-foam arcs tried and removed by player
  // direction — painted geometry reads as glyphs, not water. The coast
  // foam, whitecap streaks, and the wave field itself carry the flow.)
  R.cine = { pulseT0: -99 };
  Events.on('waveTelegraph', () => { R.cine.pulseT0 = R.cine.now || 0; });
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
    // reflection distortion is what makes panning read as boiling water:
    // damp it hard while the camera is being moved by ANY gesture, ease
    // back when the eye rests
    const moving = R.userMovingCam && performance.now() - R.userMovingCam < 300;
    const targetDist = 3.2 * (1 + env * 1.2) * (moving ? 0.1 : 1);
    if (R.distortSm === undefined) R.distortSm = targetDist;
    R.distortSm += (targetDist - R.distortSm) * Math.min(1, dt * 6);
    R.seaMesh.material.uniforms.distortionScale.value = R.distortSm;
  }

  // lee wakes trail downwind of each island, breathing with the wind
  // telegraph breath: ease out ~15% and back over the warning. The
  // player's own pinch always wins — the pulse is a multiplier applied
  // at camera time, never a change to their chosen zoom.
  // the fog of war billows on its own slow clock
  if (R.shroudMat) R.shroudMat.uniforms.fogTime.value += dt;

  const p = t / T;
  R.zoomPulse = (p >= 0 && p <= 1) ? 1 + 0.15 * Math.sin(Math.PI * p) : 1;
  if (R.zoomPulse !== R.lastZoomPulse) {
    R.lastZoomPulse = R.zoomPulse;
    updateCamera();   // the camera only refreshes on input; the breath needs its own
  }
}
