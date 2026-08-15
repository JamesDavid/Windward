// ================================================================
// UI — DOM HUD, hand of pieces, tap-driven placement (§8.1).
// Tap piece -> sockets light -> tap socket -> preview -> tap preview
// to cycle -> CONFIRM. Cancel by tapping elsewhere. No dragging.
// ================================================================

const UI = {
  mode: 'idle',            // idle | placing
  pieceIdx: -1,
  socket: null,
  placements: [],
  orient: 0,
  els: {}
};

function initUI(state) {
  const $ = id => document.getElementById(id);
  UI.els = {
    supply: $('supply'), favor: $('favor'), seedchip: $('seedchip'), waveinfo: $('waveinfo'),
    hand: $('hand'), confirm: $('btn-confirm'), cancel: $('btn-cancel'),
    discard: $('btn-discard'), tech: $('btn-tech'),
    banner: $('banner'), tutorial: $('tutorial'), ticker: $('ticker'),
    powTailwind: $('pow-tailwind'), powWindwall: $('pow-windwall'),
    priestchip: $('priestchip'), buildmenu: $('buildmenu'), codex: $('codex')
  };
  UI.els.seedchip.textContent = state.seed;

  buildHand(state);

  UI.els.confirm.addEventListener('click', () => confirmPlacement(state));
  UI.els.cancel.addEventListener('click', () => cancelPlacement());
  UI.els.discard.addEventListener('click', () => discardPiece(state));
  UI.els.tech.addEventListener('click', () => {
    if (buyHydrogen(state, 'A')) {
      showBanner('THE LIGHT AIR', 'Iron filings and sour wine. The fleet is reborn.');
      UI.els.tech.disabled = true;
    } else flashTicker('NEEDS 25 SUPPLY AND 6 FAVOR');
  });
  UI.els.powTailwind.addEventListener('click', () => {
    if (!castTailwind(state)) flashTicker('NOT ENOUGH FAVOR');
  });
  UI.els.powWindwall.addEventListener('click', () => {
    if (state.res.A.favor < CONFIG.Powers.WIND_WALL.FAVOR) { flashTicker('NOT ENOUGH FAVOR'); return; }
    UI.windwallArmed = !UI.windwallArmed;
    UI.els.powWindwall.classList.toggle('armed', UI.windwallArmed);
    if (UI.windwallArmed) flashTicker('TAP AN ENDPOINT TO SHELTER');
  });
  UI.els.priestchip.classList.remove('hidden');
  UI.els.priestchip.addEventListener('click', () => {
    const p = state.priests.A;
    if (p) panCameraTo(worldX(p.pos[0]), worldZ(p.pos[1]));
  });

  // pan vs tap: a drag beyond the threshold pans the camera; a clean
  // press-and-release is a tap
  const canvas = R.renderer.domElement;
  const pan = { active: false, panned: false, sx: 0, sy: 0, ground: null, target: null };
  canvas.addEventListener('pointerdown', (e) => {
    pan.active = true;
    pan.panned = false;
    pan.sx = e.clientX; pan.sy = e.clientY;
    pan.ground = pickGround(e.clientX, e.clientY);
    pan.target = { ...R.camTarget };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pan.active) return;
    const moved = Math.hypot(e.clientX - pan.sx, e.clientY - pan.sy);
    if (!pan.panned && moved < CONFIG.Render.TAP_DRAG_THRESHOLD_PX) return;
    pan.panned = true;
    if (!pan.ground) return;
    const now = pickGround(e.clientX, e.clientY);
    if (!now) return;
    R.camTarget.x = R.camTarget.x + (pan.ground.x - now.x);
    R.camTarget.z = R.camTarget.z + (pan.ground.z - now.z);
    updateCamera();
    pan.ground = pickGround(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointerup', (e) => {
    const wasTap = pan.active && !pan.panned;
    pan.active = false;
    if (wasTap) onTap(state, e);
  });
  canvas.addEventListener('pointercancel', () => { pan.active = false; });
}

// ---- hand ----
function drawPieceIcon(canvas, type) {
  const ctx = canvas.getContext('2d');
  const s = canvas.width;
  ctx.clearRect(0, 0, s, s);
  ctx.strokeStyle = '#f2e8cf';
  ctx.lineWidth = s / 9;
  ctx.lineCap = 'round';
  const u = s / 4.4;
  const cx = s / 2, cy = s / 2;
  ctx.beginPath();
  const seg = (a, b) => { ctx.moveTo(cx + a[0] * u, cy + a[1] * u); ctx.lineTo(cx + b[0] * u, cy + b[1] * u); };
  for (const [a, b] of PIECE_TEMPLATES[type]) seg([a[0], a[1] + 1.5], [b[0], b[1] + 1.5]);
  ctx.stroke();
}

function buildHand(state) {
  UI.els.hand.innerHTML = '';
  state.hand.forEach((type, i) => {
    const btn = document.createElement('button');
    btn.className = 'piece';
    const cv = document.createElement('canvas');
    cv.width = cv.height = 44;
    drawPieceIcon(cv, type);
    const cost = document.createElement('span');
    cost.className = 'cost';
    cost.textContent = pieceCost(type) + ' ⚇';
    btn.appendChild(cv);
    btn.appendChild(cost);
    btn.addEventListener('click', () => selectPiece(state, i));
    UI.els.hand.appendChild(btn);
  });
  refreshHand(state);
}

function refreshHand(state) {
  [...UI.els.hand.children].forEach((btn, i) => {
    btn.classList.toggle('selected', UI.mode === 'placing' && UI.pieceIdx === i);
    btn.classList.toggle('unaffordable', state.res.A.supply < pieceCost(state.hand[i]));
  });
  UI.els.discard.disabled = !(UI.mode === 'placing' && state.res.A.favor >= CONFIG.Economy.REROLL_FAVOR);
}

// ---- placement flow ----
function selectPiece(state, i) {
  if (state.over) return;
  if (state.res.A.supply < pieceCost(state.hand[i])) { flashTicker('NOT ENOUGH SUPPLY'); return; }
  UI.mode = 'placing';
  UI.pieceIdx = i;
  UI.socket = null;
  UI.placements = [];
  clearPreview();
  const sockets = getSockets(state, 'A').filter(s => legalPlacements(state, 'A', state.hand[i], s).length);
  showSockets(state, sockets);
  setConfirmVisible(false);
  refreshHand(state);
  Events.emit('uiSelectPiece', {});
}

function selectSocket(state, socket) {
  const type = state.hand[UI.pieceIdx];
  const placements = legalPlacements(state, 'A', type, socket);
  if (!placements.length) return false;
  UI.socket = socket;
  UI.placements = placements;
  UI.orient = 0;
  showPreview(state, placements[0].segs, true);
  setConfirmVisible(true);
  updateGhostMultiplier(state);
  return true;
}

function cyclePlacement(state) {
  if (!UI.placements.length) return;
  UI.orient = (UI.orient + 1) % UI.placements.length;
  showPreview(state, UI.placements[UI.orient].segs, true);
  updateGhostMultiplier(state);
  Events.emit('uiCycle', {});
}

// the placement ghost shows its wind multiplier before commit (§21A.5)
function updateGhostMultiplier(state) {
  const p = UI.placements[UI.orient];
  if (!p) return;
  let sum = 0;
  for (const [a, b] of p.segs) {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz) || 1;
    sum += state.wind.multiplier((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, dx / len, dz / len, true);
  }
  const avg = sum / p.segs.length;
  UI.els.confirm.textContent = 'CONFIRM  ×' + avg.toFixed(2);
}

function confirmPlacement(state) {
  if (UI.mode !== 'placing' || !UI.placements.length) return;
  const type = state.hand[UI.pieceIdx];
  if (placePiece(state, 'A', type, UI.placements[UI.orient].segs)) {
    state.hand[UI.pieceIdx] = drawPiece();
    buildHand(state);
    refreshInfluenceView(state);
  }
  cancelPlacement();
}

function cancelPlacement() {
  UI.mode = 'idle';
  UI.pieceIdx = -1;
  UI.socket = null;
  UI.placements = [];
  clearSockets();
  clearPreview();
  setConfirmVisible(false);
}

function discardPiece(state) {
  if (UI.mode !== 'placing') return;
  if (state.res.A.favor < CONFIG.Economy.REROLL_FAVOR) return;
  state.res.A.favor -= CONFIG.Economy.REROLL_FAVOR;
  state.hand[UI.pieceIdx] = drawPiece();
  buildHand(state);
  cancelPlacement();
}

function setConfirmVisible(v) {
  UI.els.confirm.classList.toggle('hidden', !v);
  UI.els.cancel.classList.toggle('hidden', !v);
  if (v) UI.els.confirm.textContent = 'CONFIRM';
}

// ---- taps on the world ----
function onTap(state, e) {
  if (state.over) return;
  const cell = pickCell(e.clientX, e.clientY);
  if (UI.mode === 'placing') {
    if (!cell) { cancelPlacement(); refreshHand(state); return; }
    // tapping the previewed piece cycles orientation
    if (UI.placements.length && UI.placements[UI.orient].segs.some(([a, b]) =>
      (a[0] === cell[0] && a[1] === cell[1]) || (b[0] === cell[0] && b[1] === cell[1]))) {
      cyclePlacement(state);
      return;
    }
    // tapping a lit socket
    const sockets = getSockets(state, 'A');
    const hit = sockets.find(s => s.cell[0] === cell[0] && s.cell[1] === cell[1]);
    if (hit && selectSocket(state, hit)) return;
    // elsewhere: cancel
    cancelPlacement();
    refreshHand(state);
    return;
  }
  hideBuildMenu();
  if (!cell) return;

  // armed Wind Wall aims at the tapped endpoint (§19.1)
  if (UI.windwallArmed) {
    UI.windwallArmed = false;
    UI.els.powWindwall.classList.remove('armed');
    castWindWall(state, cell);
    return;
  }
  openContextMenu(state, cell);
}

// ---- build menu / island actions ----
function hideBuildMenu() { UI.els.buildmenu.classList.add('hidden'); }

function menuButton(label, cost, fn, disabledReason) {
  const btn = document.createElement('button');
  btn.innerHTML = label + (cost ? '<b>' + cost + ' ⚇</b>' : '');
  if (disabledReason) {
    btn.disabled = true;
    btn.title = disabledReason;
  } else {
    btn.addEventListener('click', () => { fn(); hideBuildMenu(); });
  }
  return btn;
}

function openContextMenu(state, cell) {
  const [x, z] = cell;
  const menu = UI.els.buildmenu;
  menu.innerHTML = '';
  const options = [];
  const isl = islandAt(state, x, z);
  const plotIdx = isl ? isl.plots.findIndex(p => p.x === x && p.z === z) : -1;
  const deg = nodeDegrees(state, 'A').get(cellKey(x, z)) || 0;

  const tryBuild = (type, at) => () => {
    const why = whyNotBuild(state, 'A', type, at);
    if (why) { flashTicker(why); return; }
    buildStructure(state, 'A', type, at);
  };

  if (!isl && deg === 1 && !structureAt(state, x, z)) {
    const at = { site: 'endpoint', cell };
    for (const [type, label] of [['vane', 'CHAIN<br>VANE'], ['bolt', 'BOLT<br>BATTERY'], ['shield', 'AEGIS<br>SCREEN']]) {
      const why = whyNotBuild(state, 'A', type, at);
      options.push(menuButton(label, structureStats('A', type).cost, tryBuild(type, at), why));
    }
  } else if (isl && plotIdx >= 0) {
    const at = { site: 'plot', islandId: isl.id, plotIdx, cell };
    if (!isl.role.startsWith('greatTemple') && (!isl.temple || isl.temple.hp <= 0)) {
      options.push(menuButton('TEMPLE', CONFIG.Structures.TEMPLE.COST, tryBuild('temple', at),
        whyNotBuild(state, 'A', 'temple', at)));
    }
    if (isl.owner === 'A') {
      for (const [type, label] of [['vane', 'CHAIN<br>VANE'], ['bolt', 'BOLT<br>BATTERY'], ['shield', 'AEGIS<br>SCREEN'], ['yard', 'MOORING<br>YARD']]) {
        const why = whyNotBuild(state, 'A', type, at);
        options.push(menuButton(label, structureStats('A', type).cost, tryBuild(type, at), why));
      }
    }
  } else if (isl) {
    // island body: priest travel, hauler purchase at home/yarded islands
    const p = state.priests.A;
    const reachable = p && findNetPath(state, 'A', [Math.round(p.pos[0]), Math.round(p.pos[1])], isl.cells);
    options.push(menuButton('SEND<br>PRIEST', 0, () => {
      if (!sendPriest(state, 'A', isl)) flashTicker('NO SUPPORTED ROUTE REACHES IT');
    }, reachable ? null : 'NO SUPPORTED ROUTE REACHES IT'));
    const hasYard = isl.role === 'greatTempleA' ||
      state.structures.some(st => st.owner === 'A' && st.type === 'yard' && st.islandId === isl.id && st.hp > 0 && st.buildProgress >= 1);
    if (hasYard) {
      const fleet = state.haulers.filter(h => h.owner === 'A' && h.state !== 'dead').length;
      const capped = fleet >= fleetCap(state, 'A');
      options.push(menuButton('BUILD<br>HAULER', CONFIG.Hauler.COST, () => {
        if (!buyHauler(state, 'A')) flashTicker('FLEET AT CAPACITY');
      }, capped ? 'FLEET AT CAPACITY' : (state.res.A.supply < CONFIG.Hauler.COST ? 'NOT ENOUGH SUPPLY' : null)));
    }
  }

  if (!options.length) return;
  for (const o of options) menu.appendChild(o);
  menu.classList.remove('hidden');
}

// ---- HUD refresh ----
function refreshHUD(state) {
  UI.els.supply.textContent = Math.floor(state.res.A.supply);
  UI.els.favor.textContent = Math.floor(state.res.A.favor);
  const w = state.wave;
  if (state.over) UI.els.waveinfo.textContent = '';
  else if (w.index >= CONFIG.Waves.COUNT) UI.els.waveinfo.textContent = 'THE LAST TIDE HAS PASSED';
  else {
    const remain = Math.max(0, w.nextAt - state.time);
    UI.els.waveinfo.textContent = 'WAVE ' + (w.index + 1) + ' IN ' + Math.ceil(remain) + 's';
  }
  // priest chip (§14.8.6)
  const p = state.priests.A;
  if (p) {
    const label = p.state === 'dead' ? 'SUCCESSION ' + Math.max(0, Math.ceil(p.respawnAt - state.time)) + 's'
      : p.state === 'adrift' ? 'ADRIFT'
      : p.state === 'consecrating' ? 'CONSECRATING'
      : p.state === 'transit' ? 'UNDER WAY'
      : 'READY';
    UI.els.priestchip.innerHTML = '&#9865; PRIEST<br>' + label;
    UI.els.priestchip.classList.toggle('adrift', p.state === 'adrift' || p.state === 'dead');
  }
  // adrift fleet counter (§33G.5)
  const adrift = state.haulers.filter(h => h.owner === 'A' && h.state === 'adrift').length;
  if (adrift > 0 && !UI.lastAdrift) flashTicker('ADRIFT ×' + adrift);
  UI.lastAdrift = adrift;
  UI.els.tech.disabled = state.hydrogen.A;
  UI.els.powTailwind.disabled = state.res.A.favor < CONFIG.Powers.TAILWIND.FAVOR || state.time < state.powers.tailwindUntil;
  UI.els.powWindwall.disabled = state.res.A.favor < CONFIG.Powers.WIND_WALL.FAVOR && !UI.windwallArmed;
  refreshHand(state);
}

// ---- banners / tutorial / ticker ----
let bannerTimeout = null;
function showBanner(title, sub, poseidon) {
  const b = UI.els.banner;
  b.querySelector('.title').textContent = title;
  b.querySelector('.sub').textContent = sub || '';
  b.classList.toggle('poseidon', !!poseidon);
  b.classList.add('show');
  clearTimeout(bannerTimeout);
  bannerTimeout = setTimeout(() => b.classList.remove('show'), 4200);
}

let tutorialTimeout = null;
function showTutorialLine(text, holdMs) {
  const t = UI.els.tutorial;
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(tutorialTimeout);
  if (holdMs) tutorialTimeout = setTimeout(() => t.classList.remove('show'), holdMs);
}
function hideTutorialLine() { UI.els.tutorial.classList.remove('show'); }

let tickerTimeout = null;
function flashTicker(text) {
  UI.els.ticker.textContent = text;
  UI.els.ticker.classList.add('show');
  clearTimeout(tickerTimeout);
  tickerTimeout = setTimeout(() => UI.els.ticker.classList.remove('show'), 2600);
}
