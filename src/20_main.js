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
    for (const m of R.segMeshes.values()) R.scene.remove(m);
    R.segMeshes.clear();
    for (const rec of R.structMeshes.values()) R.scene.remove(rec.grp);
    R.structMeshes.clear();
    for (const rec of R.craftMeshes.values()) R.scene.remove(rec.grp);
    R.craftMeshes.clear();
    for (const rec of R.islandBars.values()) { R.scene.remove(rec.heap); R.scene.remove(rec.bar); }
    R.islandBars.clear();
    for (const f of R.fx) if (f.mesh) R.scene.remove(f.mesh);
    R.fx = [];
    for (const c of R.whitecaps) R.scene.remove(c.mesh);
    for (const s of R.smoke) R.scene.remove(s.mesh);
  }
  buildMapMeshes(STATE);
  buildShroud(STATE);
  refreshInfluenceView(STATE);

  // opening state: a priest and one hauler on each side (§14.7.6, §14.8)
  spawnPriest(STATE, 'A');
  spawnPriest(STATE, 'P');
  for (let i = 0; i < CONFIG.Hauler.START_COUNT; i++) {
    spawnHauler(STATE, 'A');
    spawnHauler(STATE, 'P');
  }

  initAI(STATE);
  initFlow(STATE);
  initFxEvents(STATE);
  wireAudio();
  initUI(STATE);
  initCodex(STATE);
  wireGameEvents(STATE);
  fogTick(STATE, 1);

  // open on the home temple; the map scrolls (drag to pan)
  const gt = STATE.greatTemple.A.cell;
  panCameraTo(worldX(gt[0]), worldZ(gt[1]) - 1.5);

  document.getElementById('startscreen').classList.add('hidden');
  document.getElementById('endscreen').classList.add('hidden');
}

function wireGameEvents(state) {
  Events.on('networkSevered', ({ side }) => {
    if (side === 'A' && !state.tutorial.seenSever) {
      state.tutorial.seenSever = true;
      showTutorialLine('“The binding is cut. Take another path before the wind remembers.”', 5000, 'sever1');
    }
  });
  Events.on('networkRestored', ({ side }) => {
    if (side === 'A') flashTicker('NETWORK RESTORED');
    refreshInfluenceView(state);
  });
  Events.on('segmentDestroyed', () => refreshInfluenceView(state));
  Events.on('piecePlaced', ({ side }) => { if (side === 'P') refreshInfluenceView(state); });
  Events.on('islandClaimed', () => refreshInfluenceView(state));
  Events.on('templeFallen', () => refreshInfluenceView(state));
  Events.on('structureComplete', () => refreshInfluenceView(state));
  Events.on('hydrogenUnlocked', ({ side }) => { if (side === 'A') buildHand(state); });
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
    economyTick(state, dt);
    structuresTick(state, dt);
    updateTransit(state, dt);
    combatTick(state, dt);
    wavesTick(state, dt);
    aiTick(state, dt);
    fogTick(state, dt);
    collapseTick(state);
    flowTick(state);
  }
  refreshHUD(state);
  refreshActionMarkers(state);
  syncStructures(state);
  syncMovers(state);
  syncIslandBars(state);
  syncGreatTemples(state);
  syncShroud(state);
  fxTick(state, dt);
  cinematicTick(state, dt);
  renderTick(state, dt);
}

// Dev handle (also used by the hidden tuning overlay; harmless to ship).
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'WD', { get: () => ({ state: STATE, startMatch }) });
}

// (The seven-card lore carousel is retired by player direction — one
// short paragraph lives directly in the start screen markup instead.)

// ---- boot ----
window.addEventListener('DOMContentLoaded', () => {
  const seedInput = document.getElementById('seedinput');
  seedInput.value = makeSeedString();
  document.getElementById('startbtn').addEventListener('click', () => {
    audioInit();
    const seed = (seedInput.value || makeSeedString()).trim().toLowerCase();
    startMatch(seed);
  });
  document.getElementById('resetbtn').addEventListener('click', () => {
    startMatch(makeSeedString());
  });
  requestAnimationFrame(frame);
});
