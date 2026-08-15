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

  R.renderer.domElement.addEventListener('pointerdown', (e) => onTap(state, e));
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
  Events.emit('uiTapWorld', { cell });
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
