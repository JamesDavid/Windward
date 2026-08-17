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
    nextAct: 1, lastGun: -99, lastPush: -99, lastWall: -99,
    camX: worldX(gt[0]), camZ: worldZ(gt[1]), zoom: 1.15,
    gt, choke, supply
  };
}

// The demonstrator's STRATEGY — evolved by genetic search against the
// real Poseidon AI (test/opt_evolve.js; ~750 headless matches). These
// are the champion genome's scaled values; the shape of play they
// drive: claim a temple chain toward his corner, defend what is held,
// then drive lanes at his Great Temple and gun it from range.
const DEMO_STRAT = {
  vaneTime: 12, gunEvery: 45, gunReserve: 14, junctionBonus: 1.5,
  expandBias: 0.5, offenseAt: 180, defVanes: 1, shieldUse: 1,
  wallUse: 1, tailwindUse: 1, hydrogenAt: 45, haulerTarget: 3,
  templeBudget: 24, pushSpacing: 30
};

// The demonstrator PLAYS THE UI (player-directed): it opens the real
// context menu at the spot it acts on, highlights the button it means
// to press, clicks it, and walks the same ghost -> CONFIRM flow a
// human would. Returns {cell, key, kind} or null.
function demoPlan(state) {
  const d = state.demoCtl;
  const p = state.priests.A;
  const S = DEMO_STRAT;
  const res = state.res.A;
  const gtP = state.greatTemple.P.cell;
  const dEnemy = (c) => Math.abs(c[0] - gtP[0]) + Math.abs(c[1] - gtP[1]);
  // a refused or failed action is blacklisted for a while so the
  // demonstrator moves on instead of looping (player report: it kept
  // pressing a refused CHAIN VANE)
  if (!d.bad) d.bad = new Map();
  const ok = (plan) => {
    if (!plan) return null;
    const until = d.bad.get(plan.key + '@' + plan.cell.join(','));
    return until && state.time < until ? null : plan;
  };
  const bodyCell = (isl) => {
    const isPlot = ([x, z]) => isl.plots.some(pl => pl.x === x && pl.z === z);
    return isl.cells.find(cc => !isPlot(cc)) || isl.cells[0];
  };
  const buildableCell = (isl, type) => isl.cells.find(([x, z]) =>
    !whyNotBuild(state, 'A', type, { site: 'plot', islandId: isl.id, plotIdx: -1, cell: [x, z] }));
  // signed TURN presses that swing the default facing onto a target
  const aimTurns = (cell) => {
    let tgt = gtP, bd = Infinity;
    for (const st of state.structures) {
      if (st.owner !== 'P' || st.hp <= 0) continue;
      const dd = Math.abs(st.cell[0] - cell[0]) + Math.abs(st.cell[1] - cell[1]);
      if (dd < bd) { bd = dd; tgt = st.cell; }
    }
    const want = Math.atan2(tgt[1] - cell[1], tgt[0] - cell[0]);
    const def = defaultFacing(state, 'A', cell);
    let delta = want - def;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    return Math.max(-3, Math.min(3, Math.round(delta / (Math.PI / 4))));
  };

  // 1. priest: temple where he stands, else claim the best next island
  // (value = ore vs toward-his-corner, per the evolved expandBias)
  if (p.state === 'idle') {
    const here = p.islandId !== null ? state.map.islands[p.islandId] : null;
    if (here && !here.role.startsWith('greatTemple') &&
      (!here.temple || here.temple.hp <= 0) &&
      res.supply >= CONFIG.Structures.TEMPLE.COST &&
      res.favor >= (CONFIG.Structures.TEMPLE.FAVOR || 0)) {
      const c = buildableCell(here, 'temple');
      const pl = c && ok({ cell: [c[0], c[1]], key: 'temple', kind: 'ghost' });
      if (pl) return pl;
    }
    let bestIsl = null, bs = -Infinity;
    const normD = dEnemy(d.gt) || 1;
    for (const isl of state.map.islands) {
      if (isl.role.startsWith('greatTemple')) continue;
      if (isl.temple && isl.temple.hp > 0) continue;
      if (islandClosedTo(state, isl, 'A')) continue;
      if (!findNetPath(state, 'A', [Math.round(p.pos[0]), Math.round(p.pos[1])], isl.cells)) continue;
      const toward = 1 - dEnemy([Math.round(isl.center[0]), Math.round(isl.center[1])]) / normD;
      const ore = Math.min(1, (isl.reserve || 0) / 1500);
      const sc = S.expandBias * toward + (1 - S.expandBias) * ore;
      if (sc > bs) { bs = sc; bestIsl = isl; }
    }
    if (bestIsl && (p.islandId === null || bestIsl.id !== p.islandId)) {
      const c = bodyCell(bestIsl);
      const pl = ok({ cell: [c[0], c[1]], key: 'priest', kind: 'instant' });
      if (pl) return pl;
    }
  }
  // 2. defense: home vane first, then one per claimed island (defVanes)
  const home = state.gtA;
  const vanesOn = (isl) => state.structures.filter(s => s.owner === 'A' && s.type === 'vane' && s.islandId === isl.id && s.hp > 0).length;
  if (state.time > S.vaneTime && res.supply >= 12 && vanesOn(home) < 1) {
    const c = buildableCell(home, 'vane');
    const pl = c && ok({ cell: [c[0], c[1]], key: 'vane', kind: 'ghost' });
    if (pl) return pl;
  }
  if (res.supply >= 7 + S.gunReserve) {
    for (const isl of state.map.islands) {
      if (isl.owner !== 'A' || isl.role.startsWith('greatTemple')) continue;
      if (vanesOn(isl) >= Math.floor(S.defVanes)) continue;
      const c = buildableCell(isl, 'vane');
      const pl = c && ok({ cell: [c[0], c[1]], key: 'vane', kind: 'ghost' });
      if (pl) return pl;
    }
  }
  // 2b. a mooring yard BEFORE any hauler purchase; more yards when the
  // evolved fleet target outgrows the moorings
  const fleet = state.haulers.filter(h => h.owner === 'A' && h.state !== 'dead').length;
  const yardAny = state.structures.some(s => s.owner === 'A' && s.type === 'yard' && s.hp > 0);
  const yardUp = state.structures.some(s => s.owner === 'A' && s.type === 'yard' && s.hp > 0 && s.buildProgress >= 1);
  const needYard = (!yardAny && state.time > 20) ||
    (yardUp && fleet >= fleetCap(state, 'A') && fleet < Math.round(S.haulerTarget));
  if (needYard && res.supply >= CONFIG.Yard.COST + CONFIG.Hauler.COST) {
    const c = buildableCell(home, 'yard');
    const pl = c && ok({ cell: [c[0], c[1]], key: 'yard', kind: 'ghost' });
    if (pl) return pl;
  }
  // 3. forward bolts on cadence — and the KILL SHOT: any open end within
  // range of his Great Temple gets a gun aimed square at it, now
  const ends = getSockets(state, 'A').filter(s => s.kind === 'end' && !structureAt(state, s.cell[0], s.cell[1]));
  if (state.time >= S.offenseAt && state.time - d.lastPush > S.pushSpacing && res.supply >= 10) {
    const range = CONFIG.Structures.BOLT_DIR.RANGE;
    const kill = ends.filter(s => dist2d(s.cell[0], s.cell[1], gtP[0], gtP[1]) <= range + 1);
    if (kill.length) {
      const pl = ok({ cell: kill[0].cell.slice(), key: 'bolt', kind: 'ghost', turns: aimTurns(kill[0].cell) });
      if (pl) { d.lastPush = state.time; return pl; }
    }
  }
  if (state.time - d.lastGun > S.gunEvery && res.supply >= 10 + S.gunReserve) {
    const sorted = ends.slice().sort((a, b) => dEnemy(a.cell) - dEnemy(b.cell));
    const pl = sorted.length && ok({ cell: sorted[0].cell.slice(), key: 'bolt', kind: 'ghost', turns: aimTurns(sorted[0].cell) });
    if (pl) { d.lastGun = state.time; return pl; }
  }
  // 3b. shield the forward gun (evolved: worth the coin)
  if (S.shieldUse > 0.5 && res.supply >= 12 + S.gunReserve && res.favor >= 4) {
    const guns = state.structures.filter(s => s.owner === 'A' && s.type === 'bolt' && s.site === 'endpoint' && s.hp > 0)
      .sort((a, b) => dEnemy(a.cell) - dEnemy(b.cell));
    const fwd = guns[0];
    if (fwd && !state.structures.some(s => s.owner === 'A' && s.type === 'shield' && s.hp > 0 &&
      dist2d(s.cell[0], s.cell[1], fwd.cell[0], fwd.cell[1]) <= CONFIG.Structures.SHIELD_COVER_RADIUS)) {
      const near = ends.filter(s => dist2d(s.cell[0], s.cell[1], fwd.cell[0], fwd.cell[1]) <= CONFIG.Structures.SHIELD_COVER_RADIUS);
      const pl = near.length && ok({ cell: near[0].cell.slice(), key: 'shield', kind: 'ghost' });
      if (pl) return pl;
    }
  }
  // 4. divine aid and the refit, all through the menus
  const P = CONFIG.Powers;
  if (S.wallUse > 0.5 && state.wave.telegraphed && res.favor >= P.WIND_WALL.FAVOR + 4 && state.time - (d.lastWall || -99) > 20) {
    let fwd = null, fd = -1;
    for (const st of state.structures) {
      if (st.owner !== 'A' || st.hp <= 0) continue;
      const dd = Math.abs(st.cell[0] - d.gt[0]) + Math.abs(st.cell[1] - d.gt[1]);
      if (dd > fd) { fd = dd; fwd = st; }
    }
    if (fwd) {
      const pl = ok({ cell: fwd.cell.slice(), key: 'windwall', kind: 'instant' });
      if (pl) { d.lastWall = state.time; return pl; }
    }
  }
  if (S.tailwindUse > 0.5 && res.favor >= P.TAILWIND.FAVOR + 10 && state.time >= state.powers.tailwindUntil &&
    state.haulers.some(x => x.owner === 'A' && x.state === 'toHome' && x.cargo > 0)) {
    const pl = ok({ cell: bodyCell(home), key: 'tailwind', kind: 'instant' });
    if (pl) return pl;
  }
  if (!state.hydrogen.A && res.supply >= S.hydrogenAt && res.favor >= CONFIG.Tech.HYDROGEN_COST_FAVOR + 6) {
    // the refit lives in the yard dialog: tap the yard itself
    const yard = state.structures.find(s => s.owner === 'A' && s.type === 'yard' && s.hp > 0 && s.buildProgress >= 1);
    if (yard) {
      const pl = ok({ cell: yard.cell.slice(), key: 'hydrogen', kind: 'instant' });
      if (pl) return pl;
    }
  }
  // 5. haulers to the evolved fleet target (after the yard lesson)
  if (yardUp && fleet < Math.min(Math.round(S.haulerTarget), fleetCap(state, 'A')) &&
    res.supply >= CONFIG.Hauler.COST + 10) {
    const c = bodyCell(home);
    const pl = ok({ cell: [c[0], c[1]], key: 'hauler', kind: 'instant' });
    if (pl) return pl;
  }
  // 6. lay road: supply island -> chokepoint -> HIS CORNER
  let target = d.supply.center;
  if (d.supply.temple && d.supply.temple.buildProgress >= 1) {
    target = state.time >= S.offenseAt ? gtP : d.choke.center;
  }
  {
    let bestSock = null, bestIdx = 0, bestType = null, bestScore = -Infinity;
    for (let slot = 0; slot < state.hand.length; slot++) {
      const type = state.hand[slot];
      if (res.favor < pieceCost(type)) continue;
      for (const sock of getSockets(state, 'A')) {
        const pls = legalPlacements(state, 'A', type, sock);
        for (let i = 0; i < pls.length; i++) {
          const far = pls[i].segs[pls[i].segs.length - 1][1];
          const dd = Math.abs(far[0] - target[0]) + Math.abs(far[1] - target[1]);
          const sc = -dd + (piecePlugs(type) - 1) * S.junctionBonus;
          if (sc > bestScore) { bestScore = sc; bestSock = sock; bestIdx = i; bestType = type; }
        }
      }
    }
    const pl = bestSock && ok({ cell: bestSock.cell.slice(), key: 'piece-' + bestType, kind: 'ghost', turns: Math.min(bestIdx, 3) });
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
    else if (d.turnsLeft !== 0) {
      // signed turns: negative swings left, positive swings right
      const rot = document.getElementById(d.turnsLeft > 0 ? 'btn-rotate' : 'btn-rotate-l');
      if (rot && !rot.classList.contains('hidden')) { rot.classList.add('demopress'); rot.click(); setTimeout(() => rot.classList.remove('demopress'), 400); }
      d.turnsLeft -= Math.sign(d.turnsLeft);
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
  // refuse Zeus's verdict (player-directed): the tides resume and only
  // a fallen Great Temple ends the matter now
  document.getElementById('fightonbtn').addEventListener('click', () => {
    if (!STATE || STATE.over !== 'arbitration') return;
    STATE.over = null;
    STATE.arbitrationDeclined = true;
    document.getElementById('endscreen').classList.add('hidden');
    flashTicker('THE VERDICT IS REFUSED — THE SEA COMES ON');
  });

  // ---- save / resume (player-directed: life happens on mobile) ----
  const resumeBtn = document.getElementById('resumebtn');
  const offerResume = () => {
    const snap = loadSavedMatch();
    if (snap) {
      resumeBtn.textContent = 'RESUME YOUR MATCH — WAVE ' + Math.min(snap.wave.index + 1, 99) + ' · ' + snap.seed;
      resumeBtn.classList.remove('hidden');
    } else resumeBtn.classList.add('hidden');
  };
  offerResume();
  resumeBtn.addEventListener('click', () => {
    const snap = loadSavedMatch();
    if (!snap) { resumeBtn.classList.add('hidden'); return; }
    audioInit();
    startMatch(snap.seed, snap.theme);
    applySnapshot(STATE, snap);
    // no re-tutorial mid-match, and ids must not collide with restored ones
    if (STATE.tut) { STATE.tut.active = false; }
    document.getElementById('skipbtn').classList.add('hidden');
    let maxId = 0;
    for (const e of [...STATE.structures, ...STATE.haulers, ...STATE.craft]) maxId = Math.max(maxId, e.id || 0);
    nextEntityId = Math.max(nextEntityId, maxId + 1);
    buildHand(STATE);
    refreshHUD(STATE);
    refreshInfluenceView(STATE);
    flashTicker('THE MATCH RESUMES — WAVE ' + Math.min(STATE.wave.index + 1, 99));
  });
  // leaving mid-match saves; a decided match clears its save
  const persist = () => { if (STATE && !STATE.over && !STATE.demo) saveMatch(STATE); };
  document.addEventListener('visibilitychange', () => { if (document.hidden) persist(); });
  window.addEventListener('pagehide', persist);
  setInterval(() => {
    if (STATE && STATE.over) clearSavedMatch();
    if (!STATE) offerResume();   // back at the title: refresh the offer
  }, 2000);

  requestAnimationFrame(frame);
});
