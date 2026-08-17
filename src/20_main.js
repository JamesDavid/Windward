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

// ---- the demonstrator: a puppeteer that PLAYS THE REAL UI — opens the
// context menu where it acts, highlights the button it presses, and
// walks the ghost -> TURN -> CONFIRM flow a human would; the camera
// drifts between the frontier and any live fight ----
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

// The demonstrator PLAYS THE UI (player-directed): it opens the real
// context menu at the spot it acts on, highlights the button it means
// to press, clicks it, and walks the same ghost -> CONFIRM flow a
// human would. Returns {cell, key, kind} or null.
function demoPlan(state) {
  const d = state.demoCtl;
  const p = state.priests.A;
  // a refused or failed action is blacklisted for a while so the
  // demonstrator moves on instead of looping (player report: it kept
  // pressing a refused CHAIN VANE)
  if (!d.bad) d.bad = new Map();
  const ok = (plan) => {
    if (!plan) return null;
    const until = d.bad.get(plan.key + '@' + plan.cell.join(','));
    return until && state.time < until ? null : plan;
  };
  // 1. priest toward the supply island (only once a road reaches it —
  // otherwise fall through and LAY the road), then its temple
  if (p.state === 'idle' && !d.supply.temple && p.islandId !== d.supply.id &&
    findNetPath(state, 'A', [Math.round(p.pos[0]), Math.round(p.pos[1])], d.supply.cells)) {
    // SEND PRIEST lives on the island-BODY menu, not the plot menu
    const isPlot = ([x, z]) => d.supply.plots.some(pl => pl.x === x && pl.z === z);
    const c = d.supply.cells.find(cc => !isPlot(cc)) || d.supply.cells[0];
    const pl = ok({ cell: [c[0], c[1]], key: 'priest', kind: 'instant' });
    if (pl) return pl;
  }
  // a cell is only worth tapping if the build would actually be legal
  // there — whyNotBuild knows about the Great Temple's own footprint,
  // quarries, and every other refusal that used to flash OCCUPIED
  const buildableCell = (isl, type) => isl.cells.find(([x, z]) =>
    !whyNotBuild(state, 'A', type, { site: 'plot', islandId: isl.id, plotIdx: -1, cell: [x, z] }));
  if (p.state === 'idle' && p.islandId === d.supply.id && !d.supply.temple &&
    state.res.A.supply >= CONFIG.Structures.TEMPLE.COST) {
    const c = buildableCell(d.supply, 'temple');
    const pl = c && ok({ cell: [c[0], c[1]], key: 'temple', kind: 'ghost' });
    if (pl) return pl;
  }
  // 2. one home vane, early
  const home = state.gtA;
  if (state.time > 12 && state.res.A.supply >= 12 &&
    !state.structures.some(s => s.owner === 'A' && s.type === 'vane' && s.islandId === home.id)) {
    const c = buildableCell(home, 'vane');
    const pl = c && ok({ cell: [c[0], c[1]], key: 'vane', kind: 'ghost' });
    if (pl) return pl;
  }
  // 2b. a mooring yard BEFORE any hauler purchase — the Great Temple
  // itself moors two, so buying early is legal, but the demo must show
  // where haulers come from (player report: a hauler bought "without
  // having a mooring")
  if (state.time > 20 && state.res.A.supply >= CONFIG.Yard.COST + CONFIG.Hauler.COST &&
    !state.structures.some(s => s.owner === 'A' && s.type === 'yard')) {
    const c = buildableCell(home, 'yard');
    const pl = c && ok({ cell: [c[0], c[1]], key: 'yard', kind: 'ghost' });
    if (pl) return pl;
  }
  // 3. a forward bolt now and then (with a TURN for show)
  if (state.time - d.lastGun > 45 && state.res.A.supply >= 14) {
    const ends = getSockets(state, 'A').filter(s => s.kind === 'end' && !structureAt(state, s.cell[0], s.cell[1]));
    ends.sort((a, b) =>
      (Math.abs(b.cell[0] - d.gt[0]) + Math.abs(b.cell[1] - d.gt[1])) -
      (Math.abs(a.cell[0] - d.gt[0]) + Math.abs(a.cell[1] - d.gt[1])));
    const pl = ends.length && ok({ cell: ends[0].cell.slice(), key: 'bolt', kind: 'ghost', turns: 1 });
    if (pl) { d.lastGun = state.time; return pl; }
  }
  // 4. a hauler when the fleet has room — but only after the yard
  // stands, so the audience sees the mooring before the balloon
  const fleet = state.haulers.filter(h => h.owner === 'A' && h.state !== 'dead').length;
  const yardUp = state.structures.some(s => s.owner === 'A' && s.type === 'yard' && s.hp > 0 && s.buildProgress >= 1);
  if (yardUp && fleet < fleetCap(state, 'A') && state.res.A.supply >= CONFIG.Hauler.COST + 10) {
    // the BUILD HAULER button lives on the island-body menu: pick a
    // home cell that is NOT a marked plot so that branch opens
    const isPlot = ([x, z]) => home.plots.some(pl => pl.x === x && pl.z === z);
    const c = home.cells.find(cc => !isPlot(cc)) || home.cells[0];
    const pl = ok({ cell: [c[0], c[1]], key: 'hauler', kind: 'instant' });
    if (pl) return pl;
  }
  // 5. otherwise: lay a path toward the objective, through the real menu
  const target = d.supply.temple && d.supply.temple.buildProgress >= 1 ? d.choke.center : d.supply.center;
  const type = state.hand[0];
  if (state.res.A.favor >= pieceCost(type)) {
    let bestSock = null, bestIdx = 0, bestD = Infinity;
    for (const sock of getSockets(state, 'A')) {
      const pls = legalPlacements(state, 'A', type, sock);
      for (let i = 0; i < pls.length; i++) {
        const far = pls[i].segs[pls[i].segs.length - 1][1];
        const dd = Math.abs(far[0] - target[0]) + Math.abs(far[1] - target[1]);
        if (dd < bestD) { bestD = dd; bestSock = sock; bestIdx = i; }
      }
    }
    const pl = bestSock && ok({ cell: bestSock.cell.slice(), key: 'piece-' + type, kind: 'ghost', turns: Math.min(bestIdx, 3) });
    if (pl) return pl;
  }
  return null;
}

function demoHighlight(sel) {
  const btn = document.querySelector(sel);
  if (btn) btn.classList.add('demopress');
  return btn;
}

function demoTick(state, dt) {
  const d = state.demoCtl;
  if (!d) return;
  const now = state.time;
  // ---- staged puppeteering of the real UI ----
  if (!d.phase) {
    if (now >= d.nextAct) {
      const plan = demoPlan(state);
      if (plan) {
        d.plan = plan;
        // open the true context menu at the spot, at its screen position
        const v = new THREE.Vector3(worldX(plan.cell[0]), 0.4, worldZ(plan.cell[1])).project(R.camera);
        const px = (v.x + 1) / 2 * window.innerWidth;
        const py = (-v.y + 1) / 2 * window.innerHeight;
        openContextMenu(state, plan.cell, px, Math.max(140, py), plan.cell[0], plan.cell[1]);
        d.phase = 'press';
        d.phaseAt = now;
      } else d.nextAct = now + 2;
    }
  } else if (d.phase === 'press' && now - d.phaseAt > 0.9) {
    const btn = document.querySelector('#buildmenu button[data-key="' + d.plan.key + '"]');
    if (!btn || btn.dataset.refused) {
      // absent or refused: never press it — blacklist and move on
      if (d.bad) d.bad.set(d.plan.key + '@' + d.plan.cell.join(','), now + 30);
      hideBuildMenu();
      d.phase = null;
      d.nextAct = now + 1.2;
    }
    else { btn.classList.add('demopress'); d.phase = 'click'; d.phaseAt = now; }
  } else if (d.phase === 'click' && now - d.phaseAt > 0.7) {
    const btn = document.querySelector('#buildmenu button[data-key="' + d.plan.key + '"]');
    if (btn) btn.click();
    hideBuildMenu();
    if (d.plan.kind === 'instant') { d.phase = null; d.nextAct = now + 2.5; }
    else { d.phase = 'turn'; d.phaseAt = now; d.turnsLeft = d.plan.turns || 0; }
  } else if (d.phase === 'turn' && now - d.phaseAt > 0.6) {
    // the press may have failed silently (cost, ground taken): only a
    // live ghost earns a CONFIRM performance — and the failure is
    // blacklisted so the demonstrator never loops on it
    if (UI.mode !== 'placing' && !UI.structMode) {
      if (d.bad) d.bad.set(d.plan.key + '@' + d.plan.cell.join(','), now + 30);
      d.phase = null;
      d.nextAct = now + 1.5;
    }
    else if (d.turnsLeft > 0) {
      const rot = document.getElementById('btn-rotate');
      if (rot && !rot.classList.contains('hidden')) { rot.classList.add('demopress'); rot.click(); setTimeout(() => rot.classList.remove('demopress'), 400); }
      d.turnsLeft--;
      d.phaseAt = now;
    } else {
      const ok = demoHighlight('#btn-confirm');
      d.phase = ok ? 'confirm' : null;
      d.phaseAt = now;
      if (!ok) { cancelPlacement(); d.nextAct = now + 1.5; }
    }
  } else if (d.phase === 'confirm' && now - d.phaseAt > 0.7) {
    const ok = document.getElementById('btn-confirm');
    if (ok) { ok.classList.remove('demopress'); ok.click(); }
    d.phase = null;
    d.nextAct = now + 2.2;
  }
  // camera director: the spot being acted on while a menu is up,
  // else fights, else the frontier
  let tx = null, tz = null, tzoom = 1.25;
  if (d.phase && d.plan) {
    tx = worldX(d.plan.cell[0]); tz = worldZ(d.plan.cell[1]); tzoom = 1.05;
  } else {
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
  document.getElementById('menubtn').addEventListener('click', () => {
    STATE = null;
    document.getElementById('endscreen').classList.add('hidden');
    document.getElementById('startscreen').classList.remove('hidden');
  });
  requestAnimationFrame(frame);
});
