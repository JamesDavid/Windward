// ================================================================
// MAIN — boot, match lifecycle, the frame loop.
// ================================================================

let STATE = null;
let lastFrame = 0;

function startMatch(seedStr, theme, demo) {
  Events.clear();
  // RIDE THE WAVES mirrors the presentation only: you still run the
  // network game (side A in the sim); the skin, ships, and names swap
  // so your roads are Poseidon's sea-lanes and the enemy is the Guild.
  R.themeSea = theme === 'sea';
  STATE = newGameState(seedStr);
  STATE.theme = theme || 'air';
  STATE.demo = !!demo;
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

  // WATCH mode: the computer demonstrates the whole loop; the player
  // spectates (pan/zoom still work), and any TAP returns to the title
  if (STATE.demo) {
    if (STATE.tut) { STATE.tut.active = false; }
    document.getElementById('skipbtn').classList.add('hidden');
    initDemo(STATE);
    let pill = document.getElementById('demopill');
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'demopill';
      pill.style.cssText = 'position:fixed; bottom:calc(env(safe-area-inset-bottom, 0px) + 16px); ' +
        'left:50%; transform:translateX(-50%); z-index:44; background:rgba(10,15,20,0.88); ' +
        'border:1px solid rgba(217,164,65,0.6); border-radius:12px; padding:8px 16px; ' +
        'font-size:12px; letter-spacing:2px; color:var(--gold); pointer-events:none;';
      document.body.appendChild(pill);
    }
    pill.textContent = 'DEMONSTRATION · TAP TO RETURN';
    pill.style.display = 'block';
  } else {
    const pill = document.getElementById('demopill');
    if (pill) pill.style.display = 'none';
  }
}

function exitDemo() {
  const pill = document.getElementById('demopill');
  if (pill) pill.style.display = 'none';
  STATE = null;
  document.getElementById('startscreen').classList.remove('hidden');
}

// ---- the demonstrator: the same naive player the balance sweeps use,
// plus a camera that drifts between the frontier and any live fight ----
function initDemo(state) {
  const gt = state.greatTemple.A.cell;
  const choke = state.map.islands.find(i => i.role === 'chokepoint');
  const supply = state.map.islands.find(i => i.role === 'supplyA');
  state.demoCtl = {
    nextAct: 1, lastGun: -99,
    camX: worldX(gt[0]), camZ: worldZ(gt[1]), zoom: 1.15,
    gt, choke, supply
  };
}

function demoAct(state) {
  const d = state.demoCtl;
  const segTouches = (pl) => [...state.segments.values()].some(s => s.owner === 'A' &&
    ((s.a[0] === pl.x && s.a[1] === pl.z) || (s.b[0] === pl.x && s.b[1] === pl.z)));
  const p = state.priests.A;
  if (p.state === 'idle' && !d.supply.temple && p.islandId !== d.supply.id) sendPriest(state, 'A', d.supply);
  else if (p.state === 'idle' && p.islandId === d.supply.id && !d.supply.temple &&
    state.res.A.supply >= CONFIG.Structures.TEMPLE.COST) {
    const pi = d.supply.plots.findIndex(pl => !pl.structure && !segTouches(pl) && !plotBlockedByQuarry(d.supply, pl));
    if (pi >= 0) buildStructure(state, 'A', 'temple', { site: 'plot', islandId: d.supply.id, plotIdx: pi, cell: [d.supply.plots[pi].x, d.supply.plots[pi].z] });
  }
  const target = d.supply.temple && d.supply.temple.buildProgress >= 1 ? d.choke.center : d.supply.center;
  const type = state.hand[0];
  if (state.res.A.favor >= pieceCost(type)) {
    let bestP = null, bestD = Infinity;
    for (const sock of getSockets(state, 'A')) {
      for (const pl of legalPlacements(state, 'A', type, sock)) {
        const far = pl.segs[pl.segs.length - 1][1];
        const dd = Math.abs(far[0] - target[0]) + Math.abs(far[1] - target[1]);
        if (dd < bestD) { bestD = dd; bestP = pl; }
      }
    }
    if (bestP) { placePiece(state, 'A', type, bestP.segs); state.hand[0] = drawPiece(); buildHand(state); }
  }
  const home = state.gtA;
  if (!state.structures.some(s => s.owner === 'A' && s.type === 'vane' && s.islandId === home.id) &&
    state.time > 12 && state.res.A.supply >= 7) {
    const c = home.cells.find(([x, z]) => !structureAt(state, x, z) && !plotBlockedByQuarry(home, { x, z }));
    if (c) buildStructure(state, 'A', 'vane', { site: 'plot', islandId: home.id, plotIdx: -1, cell: [c[0], c[1]] });
  }
  if (state.time - d.lastGun > 40) {
    const ends = getSockets(state, 'A').filter(s => s.kind === 'end' && !structureAt(state, s.cell[0], s.cell[1]));
    ends.sort((a, b) =>
      (Math.abs(b.cell[0] - d.gt[0]) + Math.abs(b.cell[1] - d.gt[1])) -
      (Math.abs(a.cell[0] - d.gt[0]) + Math.abs(a.cell[1] - d.gt[1])));
    if (ends.length && state.res.A.supply >= 10) {
      if (buildStructure(state, 'A', 'bolt', { site: 'endpoint', cell: ends[0].cell })) d.lastGun = state.time;
    }
  }
  buyHauler(state, 'A');
}

function demoTick(state, dt) {
  const d = state.demoCtl;
  if (!d) return;
  if (state.time >= d.nextAct) { d.nextAct = state.time + 2.5; demoAct(state); }
  // camera director: fights first, else the frontier
  let tx = null, tz = null, tzoom = 1.25;
  const fights = state.craft.filter(c => !c.dead &&
    state.structures.some(st => st.owner === 'A' && st.hp > 0 &&
      Math.hypot(st.cell[0] - c.pos[0], st.cell[1] - c.pos[1]) < 10));
  if (fights.length) {
    let sx = 0, sz = 0;
    for (const c of fights) { sx += c.pos[0]; sz += c.pos[1]; }
    tx = worldX(sx / fights.length); tz = worldZ(sz / fights.length); tzoom = 1.0;
  } else {
    let best = null, bd = -1;
    for (const s of getSockets(state, 'A')) {
      const dd = Math.abs(s.cell[0] - d.gt[0]) + Math.abs(s.cell[1] - d.gt[1]);
      if (dd > bd) { bd = dd; best = s; }
    }
    if (best) { tx = worldX((best.cell[0] + d.gt[0]) / 2); tz = worldZ((best.cell[1] + d.gt[1]) / 2); tzoom = 1.4; }
  }
  if (tx !== null && !(R.userMovingCam && performance.now() - R.userMovingCam < 4000)) {
    d.camX += (tx - d.camX) * dt * 0.8;
    d.camZ += (tz - d.camZ) * dt * 0.8;
    d.zoom += (tzoom - d.zoom) * dt * 0.6;
    R.camZoom = d.zoom;
    panCameraTo(d.camX, d.camZ);
  }
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
    if (state.demo) demoTick(state, dt);
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
  const begin = (theme) => {
    audioInit();
    const seed = (seedInput.value || makeSeedString()).trim().toLowerCase();
    startMatch(seed, theme);
  };
  document.getElementById('startbtn').addEventListener('click', () => begin('air'));
  document.getElementById('startsea').addEventListener('click', () => begin('sea'));
  document.getElementById('startdemo').addEventListener('click', () => {
    audioInit();
    startMatch(makeSeedString(), 'air', true);
  });
  document.getElementById('resetbtn').addEventListener('click', () => {
    startMatch(makeSeedString(), STATE ? STATE.theme : 'air');
  });
  requestAnimationFrame(frame);
});
