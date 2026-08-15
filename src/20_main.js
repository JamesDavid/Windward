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
      showTutorialLine('“The binding is cut. Take another path before the wind remembers.”', 6000);
    }
  });
  Events.on('networkRestored', ({ side }) => {
    if (side === 'A') showBanner('NETWORK RESTORED', 'The wind remembers its road.');
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
  syncStructures(state);
  syncMovers(state);
  syncIslandBars(state);
  syncGreatTemples(state);
  syncShroud(state);
  fxTick(state, dt);
  renderTick(state, dt);
}

// Dev handle (also used by the hidden tuning overlay; harmless to ship).
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'WD', { get: () => ({ state: STATE, startMatch }) });
}

// The backstory plays on the title screen, above the call to action (§4).
const INTRO_LORE = [
  'Aeolus once gave Odysseus the winds, tied inside a leather bag. Within sight of home, his crew opened it — they thought it held gold. The winds escaped, and never fully returned.',
  'For generations the escaped winds have tangled around these islands, snagging on headlands, rushing the straits. The sea stayed the only road — and every crossing paid Poseidon its honour.',
  'Then the shipwrights found the light air: iron filings and sour wine, sealed in a bronze retort, give off an air that will not stay down. Lift was worked out in a foundry. No god was consulted.',
  'But lift is not travel. A full envelope rises, then goes wherever the sky is going. To steer, a crew must bind a wind — and the only winds loose here are Aeolus’ own.',
  'So the guild took a patron. They keep his rites; he grants the currents. And Poseidon watches cargo cross without asking him for calm water. He is not insulted. He is being forgotten.'
];
let loreIdx = 0, loreTimer = null;
function cycleLore() {
  const el = document.getElementById('lorecycle');
  if (!el || document.getElementById('startscreen').classList.contains('hidden')) return;
  el.style.opacity = 0;
  setTimeout(() => {
    el.textContent = INTRO_LORE[loreIdx % INTRO_LORE.length];
    el.style.opacity = 1;
    loreIdx++;
  }, 700);
  loreTimer = setTimeout(cycleLore, 8000);
}

// ---- boot ----
window.addEventListener('DOMContentLoaded', () => {
  const seedInput = document.getElementById('seedinput');
  seedInput.value = makeSeedString();
  cycleLore();
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
