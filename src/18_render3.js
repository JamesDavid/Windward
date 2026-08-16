// ================================================================
// CINEMATICS (player-directed) — atmosphere that never takes control
// away. When Poseidon telegraphs a wave, the WHOLE SEA rises: shader
// distortion and wave speed surge through the telegraph and assault,
// then ease back to calm. (Rim-breaker blobs tried and removed — the
// sea itself is the actor now.) Plus the slow zoom-out breath.
// ================================================================

function initCinematics(state) {
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
    R.seaMesh.material.uniforms.distortionScale.value = 3.2 * (1 + env * 1.2);
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
