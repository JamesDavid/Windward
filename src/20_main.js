// ================================================================
// MAIN — boot, match lifecycle, the frame loop.
// ================================================================

let STATE = null;
let lastFrame = 0;

function startMatch(seedStr) {
  Events.clear();
  STATE = newGameState(seedStr);
  recalcSupport(STATE, 'A');
  recalcSupport(STATE, 'P');
  refreshInfluence(STATE);
  if (!R.initialized) initRenderer();
  else {
    // clear dynamic meshes from the previous match
    for (const m of R.segMeshes.values()) R.scene.remove(m);
    R.segMeshes.clear();
  }
  buildMapMeshes(STATE);
  refreshInfluenceView(STATE);
  initUI(STATE);
  wireGameEvents(STATE);
  document.getElementById('startscreen').classList.add('hidden');
  document.getElementById('endscreen').classList.add('hidden');
}

function wireGameEvents(state) {
  Events.on('networkSevered', () => {
    if (!state.tutorial.seenSever) {
      state.tutorial.seenSever = true;
      showTutorialLine('“The binding is cut. Take another path before the wind remembers.”', 6000);
    }
  });
  Events.on('networkRestored', ({ side }) => {
    if (side === 'A') showBanner('NETWORK RESTORED', 'The wind remembers its road.');
    refreshInfluenceView(state);
  });
  Events.on('segmentDestroyed', () => refreshInfluenceView(state));
  Events.on('piecePlaced', ({ side }) => { if (side === 'P') refreshInfluenceView(state); });
}

function frame(t) {
  requestAnimationFrame(frame);
  if (!STATE) return;
  const dt = Math.min(0.1, (t - lastFrame) / 1000 || 0.016);
  lastFrame = t;
  const state = STATE;
  if (!state.over) {
    state.time += dt;
    state.wind.tick(dt);
    collapseTick(state);
  }
  refreshHUD(state);
  renderTick(state, dt);
}

// Dev handle (also used by the hidden tuning overlay; harmless to ship).
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'WD', { get: () => ({ state: STATE, startMatch }) });
}

// ---- boot ----
window.addEventListener('DOMContentLoaded', () => {
  const seedInput = document.getElementById('seedinput');
  seedInput.value = makeSeedString();
  document.getElementById('startbtn').addEventListener('click', () => {
    const seed = (seedInput.value || makeSeedString()).trim().toLowerCase();
    startMatch(seed);
  });
  document.getElementById('resetbtn').addEventListener('click', () => {
    startMatch(makeSeedString());
  });
  requestAnimationFrame(frame);
});
