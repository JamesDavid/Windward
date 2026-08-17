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

// Poseidon's loadout wears its own names (player-directed): same
// numbers, different god. Powers, upgrade, and structure labels all
// follow the chosen side.
const STRUCT_LABELS = {
  air: { vane: 'CHAIN<br>VANE', bolt: 'BOLT<br>BATTERY', shield: 'AEGIS<br>SCREEN', yard: 'MOORING<br>YARD' },
  sea: { vane: 'STORM<br>DRUM', bolt: 'LANCE<br>BATTERY', shield: 'BULWARK<br>WARD', yard: 'SHIP<br>YARD' }
};
function structLabel(type) { return STRUCT_LABELS[R.themeSea ? 'sea' : 'air'][type]; }

function initUI(state) {
  const $ = id => document.getElementById(id);
  UI.els = {
    supply: $('supply'), favor: $('favor'), seedchip: $('seedchip'), waveinfo: $('waveinfo'),
    hand: $('hand'), confirm: $('btn-confirm'), cancel: $('btn-cancel'), rotate: $('btn-rotate'), rotateL: $('btn-rotate-l'),
    banner: $('banner'), tutorial: $('tutorial'), ticker: $('ticker'),
    priestchip: $('priestchip'), buildmenu: $('buildmenu'), codex: $('codex')
  };
  UI.els.seedchip.textContent = state.seed;
  wireDismissables();

  buildHand(state);

  UI.els.confirm.addEventListener('click', () => confirmPlacement(state));
  UI.els.rotate.addEventListener('click', () => cyclePlacement(state, 1));
  UI.els.rotateL.addEventListener('click', () => cyclePlacement(state, -1));
  UI.els.cancel.addEventListener('click', () => cancelPlacement());
  // (the powers bar is gone, player-directed: Tailwind and the Wall live
  // in the context menu where they are valid actions; the fleet upgrade
  // lives in the yard dialog)
  UI.els.priestchip.classList.remove('hidden');
  UI.els.priestchip.addEventListener('click', () => {
    const p = state.priests.A;
    if (p) panCameraTo(worldX(p.pos[0]), worldZ(p.pos[1]));
  });

  // pan vs tap: a drag beyond the threshold pans the camera; a clean
  // press-and-release is a tap
  const canvas = R.renderer.domElement;
  const pan = { active: false, panned: false, sx: 0, sy: 0, ground: null };
  const pointers = new Map();     // two-finger pinch (zoom) and twist (rotate)
  let pinch = null;
  let tilt3 = null;               // three-finger vertical swipe adjusts the tilt
  const avgY = () => [...pointers.values()].reduce((s, p) => s + p.y, 0) / pointers.size;
  const gestureVals = () => {
    const [a, b] = [...pointers.values()];
    return {
      d: Math.hypot(a.x - b.x, a.y - b.y),
      ang: Math.atan2(b.y - a.y, b.x - a.x)
    };
  };
  // desktop mouse: wheel zooms; right-drag orbits (horizontal) and
  // tilts (vertical); left button taps and pans as always
  let rdrag = null;
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    R.camZoom = clamp((R.camZoom || 1) * Math.exp(e.deltaY * 0.0012), 0.75, 2.6);
    R.userMovingCam = performance.now();
    updateCamera();
  }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button === 2) {
      rdrag = { x: e.clientX, y: e.clientY, az0: R.camAz || 0, tilt0: R.camTilt || 1 };
      return;
    }
    // ghost-pointer defense: a missed pointerup (finger slid off-screen,
    // palm touch, browser stole the gesture) used to leave a dead entry
    // here forever — every later touch then read as a multi-finger
    // gesture and map taps never fired again. A PRIMARY touch means no
    // other finger is truly down: purge whatever the map still holds.
    if (e.isPrimary) {
      pointers.clear();
      pinch = null;
      tilt3 = null;
    }
    // capture guarantees WE receive the matching up/cancel
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 3) {
      pinch = null;
      tilt3 = { y0: avgY(), tilt0: R.camTilt || 1 };
      pan.active = false;
      pan.panned = true;
      return;
    }
    if (pointers.size === 2) {
      const g = gestureVals();
      pinch = { d0: g.d, a0: g.ang, zoom0: R.camZoom || 1, az0: R.camAz || 0 };
      pan.active = false;
      pan.panned = true;   // suppress the tap on release
      return;
    }
    pan.active = true;
    pan.panned = false;
    pan.sx = e.clientX; pan.sy = e.clientY;
    pan.ground = pickGround(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (rdrag && (e.buttons & 2)) {
      R.camAz = rdrag.az0 + (e.clientX - rdrag.x) * 0.006;
      R.camTilt = clamp(rdrag.tilt0 - (e.clientY - rdrag.y) / 280, 0.65, 1.35);
      R.userMovingCam = performance.now();
      updateCamera();
      return;
    }
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (tilt3 && pointers.size === 3) {
      // swipe up = higher eye (more top-down); swipe down = lower and
      // more oblique. Applied in updateCamera as height vs distance.
      R.camTilt = clamp(tilt3.tilt0 - (avgY() - tilt3.y0) / 280, 0.65, 1.35);
      R.userMovingCam = performance.now();
      updateCamera();
      return;
    }
    if (pinch && pointers.size === 2) {
      const g = gestureVals();
      R.camZoom = clamp(pinch.zoom0 * (pinch.d0 / Math.max(20, g.d)), 0.75, 2.6);
      let da = g.ang - pinch.a0;
      R.camAz = pinch.az0 + da;
      R.userMovingCam = performance.now();
      updateCamera();
      return;
    }
    if (!pan.active) return;
    const moved = Math.hypot(e.clientX - pan.sx, e.clientY - pan.sy);
    if (!pan.panned && moved < CONFIG.Render.TAP_DRAG_THRESHOLD_PX) return;
    pan.panned = true;
    if (!pan.ground) return;
    const now = pickGround(e.clientX, e.clientY);
    if (!now) return;
    R.camTarget.x = R.camTarget.x + (pan.ground.x - now.x);
    R.camTarget.z = R.camTarget.z + (pan.ground.z - now.z);
    R.userMovingCam = performance.now();   // the water calms while the eye moves
    updateCamera();
    pan.ground = pickGround(e.clientX, e.clientY);
  });
  const release = (e) => {
    if (e.pointerType === 'mouse' && e.button === 2) { rdrag = null; return; }
    pointers.delete(e.pointerId);
    if (pointers.size < 3) tilt3 = null;
    if (pointers.size < 2) pinch = null;
    const wasTap = pan.active && !pan.panned && e.type === 'pointerup' && e.button === 0;
    pan.active = false;
    if (wasTap) onTap(state, e);
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 3) tilt3 = null;
    if (pointers.size < 2) pinch = null;
  });
  // app backgrounded mid-gesture: forget everything
  const forgetAll = () => {
    pointers.clear();
    pinch = null;
    tilt3 = null;
    pan.active = false;
  };
  window.addEventListener('blur', forgetAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) forgetAll(); });
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

// The hand is a compact read-out; building happens by tapping the map.
// Tapping a chip once arms a discard, tapping it again pays 1 Favor.
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
    cost.textContent = pieceCost(type) + ' ✦';
    btn.appendChild(cv);
    btn.appendChild(cost);
    btn.addEventListener('click', () => {
      if (UI.discardArm === i) {
        UI.discardArm = -1;
        if (state.res.A.favor < CONFIG.Economy.REROLL_FAVOR) { flashTicker('NOT ENOUGH FAVOR'); refreshHand(state); return; }
        state.res.A.favor -= CONFIG.Economy.REROLL_FAVOR;
        state.hand[i] = drawPiece(i);
        buildHand(state);
        flashTicker('THE WIND TAKES IT BACK');
      } else {
        UI.discardArm = i;
        flashTicker('TAP AGAIN TO DISCARD FOR 1 ✦');
        refreshHand(state);
      }
    });
    UI.els.hand.appendChild(btn);
  });
  UI.discardArm = -1;
  refreshHand(state);
}

function refreshHand(state) {
  [...UI.els.hand.children].forEach((btn, i) => {
    btn.classList.toggle('selected', UI.discardArm === i);
    btn.classList.toggle('unaffordable', state.res.A.favor < pieceCost(state.hand[i]));
  });
}

// ---- placement flow (entered from the map's context menu) ----
function beginPiecePlacement(state, i, socket) {
  if (state.over) return;
  if (state.res.A.favor < pieceCost(state.hand[i])) { flashTicker('NOT ENOUGH FAVOR'); return; }
  UI.mode = 'placing';
  UI.pieceIdx = i;
  UI.socket = null;
  UI.placements = [];
  clearPreview();
  clearSockets();
  selectSocket(state, socket);
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
  if (!UI.hintedCycle) {
    UI.hintedCycle = true;
    flashTicker('TAP THE GHOST TO TURN IT · CONFIRM TO BIND');
  }
  return true;
}

function cyclePlacement(state, dir) {
  dir = dir || 1;
  // aiming a bolt at placement: the turn buttons traverse the wedge in
  // 45° steps, either direction
  if (UI.structMode) {
    if (UI.structMode.type !== 'bolt') return;
    UI.structMode.facing += dir * Math.PI / 4;
    showStructPreview(state, 'A', 'bolt', UI.structMode.at.cell, UI.structMode.facing);
    Events.emit('uiCycle', {});
    return;
  }
  if (!UI.placements.length) return;
  UI.orient = (UI.orient + dir + UI.placements.length) % UI.placements.length;
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
  if (UI.structMode) {
    const { type, at } = UI.structMode;
    const why = whyNotBuild(state, 'A', type, at);
    if (why) { flashTicker(why); cancelPlacement(); return; }
    buildStructure(state, 'A', type, at, UI.structMode.facing);
    cancelPlacement();
    return;
  }
  if (UI.mode !== 'placing' || !UI.placements.length) return;
  const type = state.hand[UI.pieceIdx];
  if (placePiece(state, 'A', type, UI.placements[UI.orient].segs)) {
    state.hand[UI.pieceIdx] = drawPiece(UI.pieceIdx);
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
  UI.structMode = null;
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

function setConfirmVisible(v, anchorCell) {
  UI.els.confirm.classList.toggle('hidden', !v);
  UI.els.cancel.classList.toggle('hidden', !v);
  // TURN shows when a piece has multiple orientations — or a bolt is
  // being aimed (45° traverse steps at placement, player-directed)
  const canTurn = UI.structMode ? UI.structMode.type === 'bolt'
    : (UI.placements && UI.placements.length >= 2);
  UI.els.rotate.classList.toggle('hidden', !v || !canTurn);
  UI.els.rotateL.classList.toggle('hidden', !v || !canTurn);
  document.getElementById('confirmrow').classList.toggle('shown', v);
  if (v) UI.els.confirm.textContent = 'CONFIRM';
  if (v) placeConfirmRow(anchorCell);
}

// float the CONFIRM / TURN / CANCEL row just below its ghost, by the thumb
function placeConfirmRow(anchorCell) {
  const row = document.getElementById('confirmrow');
  const cell = anchorCell || (UI.structMode && UI.structMode.at.cell) ||
    (UI.socket && UI.socket.cell);
  if (!cell) return;
  const v = new THREE.Vector3(worldX(cell[0]), 1.0, worldZ(cell[1])).project(R.camera);
  const x = (v.x + 1) / 2 * window.innerWidth;
  const y = (-v.y + 1) / 2 * window.innerHeight;
  requestAnimationFrame(() => {
    const w = row.offsetWidth || 240, h = row.offsetHeight || 44;
    row.style.left = clamp(x - w / 2, 6, window.innerWidth - w - 6) + 'px';
    row.style.top = clamp(y + 58, 60, window.innerHeight - h - 6) + 'px';
  });
}

// ---- taps on the world ----
function onTap(state, e) {
  if (state.demo) { exitDemo(); return; }
  if (state.over) return;
  const cell = pickCell(e.clientX, e.clientY);
  // float grid coords, for forgiving snap at this oblique perspective
  const pt = pickGround(e.clientX, e.clientY);
  const fx = pt ? pt.x + (CONFIG.Grid.WIDTH - 1) / 2 : -99;
  const fz = pt ? pt.z + (CONFIG.Grid.HEIGHT - 1) / 2 : -99;
  const SNAP = CONFIG.Render.TAP_SNAP_CELLS;

  if (UI.mode === 'placing') {
    if (!cell) { cancelPlacement(); refreshHand(state); return; }
    // tapping near the previewed piece cycles orientation
    if (UI.placements.length && UI.placements[UI.orient].segs.some(([a, b]) =>
      dist2d(a[0], a[1], fx, fz) < 0.75 || dist2d(b[0], b[1], fx, fz) < 0.75)) {
      cyclePlacement(state);
      return;
    }
    // snap to the nearest lit socket within reach
    const sockets = getSockets(state, 'A');
    let hit = null, hd = SNAP;
    for (const s of sockets) {
      const d = dist2d(s.cell[0], s.cell[1], fx, fz);
      if (d < hd) { hd = d; hit = s; }
    }
    if (hit && selectSocket(state, hit)) return;
    // elsewhere: cancel
    cancelPlacement();
    refreshHand(state);
    return;
  }
  hideBuildMenu();
  if (UI.structMode) {
    // tap another lit site to move the ghost there; elsewhere cancels
    let site = null, sd = SNAP;
    for (const s of (UI.structSites || [])) {
      const d = dist2d(s.cell[0], s.cell[1], fx, fz);
      if (d < sd) { sd = d; site = s; }
    }
    if (site) {
      UI.structMode.at = site;
      UI.structMode.facing = defaultFacing(state, 'A', site.cell);
      showStructPreview(state, 'A', UI.structMode.type, site.cell, UI.structMode.facing);
      return;
    }
    cancelPlacement();
    return;
  }
  if (!cell) return;

  // snap the tap to the nearest actionable spot: a socket of the network,
  // any island cell, or a structure — then open the menu at the thumb
  let snapped = cell, sd = SNAP;
  for (const s of getSockets(state, 'A')) {
    const d = dist2d(s.cell[0], s.cell[1], fx, fz);
    if (d < sd) { sd = d; snapped = s.cell.slice(); }
  }
  openContextMenu(state, snapped, e.clientX, e.clientY, fx, fz);
}

// name whatever SHIP was tapped — nothing that flies or sails stays a
// mystery, and it heads the context menu (player-directed)
function identifyUnit(state, fx, fz) {
  let best = null, bd = 0.9;
  const consider = (m, label) => {
    if (!m || m.state === 'dead' || m.dead) return;
    const d = Math.hypot(m.pos[0] - fx, m.pos[1] - fz);
    if (d < bd) { bd = d; best = { m, label }; }
  };
  for (const h of state.haulers) {
    if (h.owner === 'A') {
      consider(h, (R.themeSea ? 'YOUR HAULER TRIREME' : (state.hydrogen.A ? 'YOUR DIRIGIBLE' : 'YOUR HOT-AIR HAULER')) +
        (h.tacking ? ' — TACKING' : h.windWaitSince ? ' — WAITING ON THE WIND' : ''));
    } else if (state.vision.A.has(cellKey(Math.round(h.pos[0]), Math.round(h.pos[1])))) {
      consider(h, R.themeSea ? 'GUILD HAULER' : 'HIS HAULER');
    }
  }
  consider(state.priests.A, 'YOUR PRIEST');
  const pp = state.priests.P;
  if (pp && state.vision.A.has(cellKey(Math.round(pp.pos[0]), Math.round(pp.pos[1])))) consider(pp, R.themeSea ? 'THE GUILD PRIEST' : 'HIS PRIEST');
  for (const c of state.craft) {
    if (!state.vision.A.has(cellKey(Math.round(c.pos[0]), Math.round(c.pos[1])))) continue;
    consider(c, (R.themeSea ? 'GUILD ' : 'HIS ') + c.kind.toUpperCase() + ' CRAFT');
  }
  if (!best) return null;
  const m = best.m;
  let s = best.label;
  if (m.hull !== undefined) s += ' · ' + Math.ceil(m.hull) + ' HULL';
  if (m.cargo) s += ' · ' + Math.floor(m.cargo) + ' ORE ABOARD';
  if (m.state === 'adrift') s += ' — ADRIFT';
  else if (m.state === 'dwelling') s += ' — LOADING';
  else if (m.state === 'unloading') s += ' — DELIVERING';
  else if (m.state === 'consecrating') s += ' — CONSECRATING';
  else if (m.state === 'transit' || m.state === 'toIsland' || m.state === 'toHome') s += ' — UNDER WAY';
  return s;
}

// every legal site for a structure type, endpoints and plots alike
function validStructSites(state, type) {
  const sites = [];
  for (const sock of getSockets(state, 'A')) {
    if (sock.kind !== 'end') continue;
    const at = { site: 'endpoint', cell: sock.cell.slice() };
    if (!whyNotBuild(state, 'A', type, at)) sites.push(at);
  }
  for (const isl of state.map.islands) {
    isl.plots.forEach((pl, i) => {
      const at = { site: 'plot', islandId: isl.id, plotIdx: i, cell: [pl.x, pl.z] };
      if (!whyNotBuild(state, 'A', type, at)) sites.push(at);
    });
  }
  return sites;
}

// ---- build menu / island actions ----
function hideBuildMenu() { UI.els.buildmenu.classList.add('hidden'); }

// what each thing IS, right on the button — menus must be self-explanatory
const MENU_DESC = {
  vane: 'mid range, hits all around', bolt: 'long range; fires only in its aimed quarter',
  shield: 'bound whirlwind: absorbs hits all around', temple: 'claims isle, spreads influence',
  yard: 'lets you build 2 more haulers', priest: 'must stand here to found temples',
  hauler: 'carries mined ore home',
  salvage: 'reclaim it: half its cost back',
  hydrogen: 'whole fleet carries 2×, but bigger targets',
  salvageseg: 'unbind one segment; branches beyond may fray',
  tailwind: 'whole fleet twice as fast, 15s',
  windwall: 'shelter this spot: −75% damage, 15s'
};

function menuButton(label, cost, fn, disabledReason, descKey, favorCost) {
  const btn = document.createElement('button');
  if (descKey) btn.dataset.key = descKey;   // the demo puppeteer finds buttons by this
  const desc = MENU_DESC[descKey] ? '<span style="font-size:9px; opacity:0.75; line-height:1.1; display:block; max-width:70px">' + MENU_DESC[descKey] + '</span>' : '';
  // pricing doctrine: physical → ⚇, wind-magic → ✦, both → both shown
  const costTxt = (cost || favorCost)
    ? '<b>' + (cost ? cost + ' ⚇' : '') + (cost && favorCost ? ' + ' : '') + (favorCost ? favorCost + ' ✦' : '') + '</b>'
    : '';
  btn.innerHTML = label + desc + costTxt;
  if (disabledReason) {
    // still tappable: a tap explains WHY it is refused (mobile has no tooltips)
    btn.style.opacity = 0.4;
    btn.addEventListener('click', () => flashTicker(disabledReason));
  } else {
    btn.addEventListener('click', () => { fn(); hideBuildMenu(); });
  }
  return btn;
}

const STRUCT_NAMES = {
  vane: 'CHAIN VANE (radial gun)', bolt: 'BOLT BATTERY (long gun)', shield: 'AEGIS SCREEN (whirlwind ward)',
  temple: 'TEMPLE', yard: 'MOORING YARD (builds haulers)', mast: 'SIPHON MAST (his anti-air)'
};
const STRUCT_NAMES_SEA = {
  vane: 'STORM DRUM (radial gun)', bolt: 'LANCE BATTERY (long gun)', shield: 'BULWARK WARD (whirlpool ward)',
  temple: 'TEMPLE', yard: 'SHIPYARD (builds haulers)', mast: 'GUILD SIPHON MAST'
};
function structName(type) { return (R.themeSea ? STRUCT_NAMES_SEA : STRUCT_NAMES)[type]; }
const ISLAND_NAMES = {
  greatTempleA: 'YOUR GREAT TEMPLE', greatTempleP: 'HIS GREAT TEMPLE',
  supplyA: 'SUPPLY ISLAND', supplyP: 'HIS SUPPLY ISLAND', chokepoint: 'THE CHOKEPOINT',
  sacredA: 'A SACRED ISLE', sacredP: 'A SACRED ISLE', neutralA: 'A NEUTRAL ISLE',
  neutralP: 'A NEUTRAL ISLE', filler: 'A SKERRY'
};

// name whatever was tapped, so nothing on the board stays a mystery
function identifyCell(state, cell) {
  const st = structureAt(state, cell[0], cell[1]);
  if (st) {
    const who = st.owner === 'A' ? '' : (R.themeSea ? 'GUILD ' : 'HIS ');
    let extra = '';
    if (st.type === 'yard' && st.owner === 'A') {
      const fleet = state.haulers.filter(h => h.owner === 'A' && h.state !== 'dead').length;
      extra = ' · FLEET ' + fleet + '/' + fleetCap(state, 'A');
    }
    return who + (structName(st.type) || st.type.toUpperCase()) +
      (st.buildProgress < 1 ? ' — RAISING' : '') + ' · ' + Math.ceil(st.hp) + ' HP' + extra;
  }
  const isl = islandAt(state, cell[0], cell[1]);
  if (isl) {
    let s = ISLAND_NAMES[isl.role] || 'AN ISLAND';
    if (!isl.role.startsWith('greatTemple')) {
      s += isl.owner ? (isl.owner === 'A' ? ' — YOURS' : (R.themeSea ? ' — THE GUILD’S' : ' — HIS')) : ' — UNCLAIMED';
      if (isl.reserve > 0) s += ' · ORE ' + Math.floor(isl.reserve);
      else if (isl.minedOut) s += ' · MINED OUT';
      if (isl.stockpile > 1) s += ' · PILE ' + Math.floor(isl.stockpile);
    }
    return s;
  }
  // name a tapped route segment — his lanes especially, so it is plain
  // they obey the same law: every lane traces home or unbinds
  for (const seg of state.segments.values()) {
    const onCell = (seg.a[0] === cell[0] && seg.a[1] === cell[1]) ||
      (seg.b[0] === cell[0] && seg.b[1] === cell[1]);
    if (!onCell) continue;
    const stateTxt = seg.supportState === 'SUPPORTED' ? '' :
      (seg.supportState === 'FRAYED' ? ' — CUT · FRAYING' : ' — CUT · UNBINDING');
    if (seg.owner === 'A') return (R.themeSea ? 'YOUR SEA-LANE' : 'YOUR WIND CORRIDOR') + stateTxt;
    return (R.themeSea ? 'GUILD SKY-ROAD — TRACES HOME TO ITS TEMPLES' : 'HIS SEA-LANE — TRACES HOME TO HIS TEMPLES') + stateTxt;
  }
  // open water: name the wind that rules this spot — the four Anemoi
  // (player-directed charm; also makes the wind field legible)
  {
    const w = state.wind.at(cell[0], cell[1]);
    // the god is named for where the wind COMES FROM (map north = -z)
    const a = Math.atan2(-(-w.z), -w.x);   // reversed vector, atan2(N, E)
    const deg = ((a * 180 / Math.PI) + 360) % 360;
    const god = deg >= 45 && deg < 135 ? 'BOREAS — THE NORTH WIND'
      : deg >= 135 && deg < 225 ? 'ZEPHYRUS — THE WEST WIND'
      : deg >= 225 && deg < 315 ? 'NOTUS — THE SOUTH WIND'
      : 'EURUS — THE EAST WIND';
    const str = Math.hypot(w.x, w.z);
    return god + ' · ' + (str > 0.85 ? 'BLOWING HARD' : str > 0.5 ? 'STEADY' : 'LIGHT AIRS');
  }
}

// a chip in the context menu for a piece the player holds, placeable here
function pieceMenuButton(state, i, socket) {
  const type = state.hand[i];
  const btn = document.createElement('button');
  btn.className = 'piecechip';
  btn.dataset.key = 'piece-' + type;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 44;
  drawPieceIcon(cv, type);
  btn.appendChild(cv);
  const b = document.createElement('b');
  b.textContent = pieceCost(type) + ' ✦';
  btn.appendChild(b);
  if (state.res.A.favor < pieceCost(type)) {
    btn.style.opacity = 0.4;
    btn.addEventListener('click', () => flashTicker('NOT ENOUGH FAVOR'));
  } else {
    btn.addEventListener('click', () => {
      hideBuildMenu();
      beginPiecePlacement(state, i, socket);
    });
  }
  return btn;
}

function openContextMenu(state, cell, tapX, tapY, fx, fz) {
  const [x, z] = cell;
  const menu = UI.els.buildmenu;
  menu.innerHTML = '';
  // compact category rows above the buttons (player-directed):
  // ATTACK / SHIELD / WORKS / FAVOR / DESTROY / PATHWAYS
  const groups = { attack: [], shield: [], factory: [], rites: [], favor: [], destroy: [] };
  const GROUP_LABELS = { attack: 'ATTACK', shield: 'SHIELD', factory: 'FACTORY', rites: 'RITES', favor: 'FAVOR', destroy: 'DESTROY' };
  const isl = islandAt(state, x, z);
  const plotIdx = isl ? isl.plots.findIndex(p => p.x === x && p.z === z) : -1;
  const deg = nodeDegrees(state, 'A').get(cellKey(x, z)) || 0;
  // what was tapped heads the menu: the ship under the thumb first, then
  // whatever the ground itself is
  const unitIdent = identifyUnit(state, fx !== undefined ? fx : x, fz !== undefined ? fz : z);
  const ident = identifyCell(state, cell);

  // a mooring yard gets its own dialog: fleet actions only, no pieces
  const yardHere = structureAt(state, x, z);
  const yardMenu = !!(yardHere && yardHere.owner === 'A' && yardHere.type === 'yard' &&
    yardHere.buildProgress >= 1 && yardHere.hp > 0);
  if (yardMenu) {
    const fleet = state.haulers.filter(h => h.owner === 'A' && h.state !== 'dead').length;
    const cap = fleetCap(state, 'A');
    groups.factory.push(menuButton('BUILD<br>HAULER<br><i style="font-size:9px">' + fleet + ' / ' + cap + ' MOORED</i>',
      CONFIG.Hauler.COST, () => {
        if (!buyHauler(state, 'A')) flashTicker('FLEET AT CAPACITY');
      }, fleet >= cap ? 'FLEET AT CAPACITY — RAISE ANOTHER YARD' :
        (state.res.A.supply < CONFIG.Hauler.COST ? 'NOT ENOUGH SUPPLY' : null), 'hauler'));
    if (!state.hydrogen.A) {
      const T = CONFIG.Tech;
      const canH = state.res.A.supply >= T.HYDROGEN_COST_SUPPLY && state.res.A.favor >= T.HYDROGEN_COST_FAVOR;
      groups.factory.push(menuButton((R.themeSea ? 'DEEP<br>HULLS<b>' : 'UPGRADE<br>HYDROGEN<b>') + T.HYDROGEN_COST_SUPPLY + ' ⚇ + ' + T.HYDROGEN_COST_FAVOR + ' ✦</b>', 0, () => {
        if (buyHydrogen(state, 'A')) flashTicker(R.themeSea ? 'THE FLEET REFITS WITH DEEP HULLS' : 'THE FLEET REFITS TO HYDROGEN');
      }, canH ? null : 'NEEDS ' + T.HYDROGEN_COST_SUPPLY + ' ⚇ AND ' + T.HYDROGEN_COST_FAVOR + ' ✦', 'hydrogen'));
    }
  }

  // pieces from the hand that can be laid from this spot — appended LAST,
  // so with the menu anchored above the tap they sit closest to the thumb
  const pieceOptions = [];
  const socketHere = yardMenu ? null : getSockets(state, 'A').find(s => s.cell[0] === x && s.cell[1] === z);
  if (socketHere) {
    const offered = new Set();
    state.hand.forEach((type, i) => {
      if (offered.has(type)) return;   // one chip per shape
      if (legalPlacements(state, 'A', type, socketHere).length) {
        offered.add(type);
        pieceOptions.push(pieceMenuButton(state, i, socketHere));
      }
    });
    if (pieceOptions.length) {
      // reroll the whole hand for Favor, right here by the thumb
      const rr = document.createElement('button');
      rr.innerHTML = '&#8635;<br>REROLL<b>' + CONFIG.Economy.REROLL_FAVOR + ' ✦</b>';
      if (state.res.A.favor < CONFIG.Economy.REROLL_FAVOR) {
        rr.style.opacity = 0.4;
        rr.addEventListener('click', () => flashTicker('NOT ENOUGH FAVOR'));
      } else {
        rr.addEventListener('click', () => {
          state.res.A.favor -= CONFIG.Economy.REROLL_FAVOR;
          for (let i = 0; i < state.hand.length; i++) state.hand[i] = drawPiece(i);
          buildHand(state);
          openContextMenu(state, cell, tapX, tapY);   // fresh chips, same spot
        });
      }
      pieceOptions.push(rr);
    }
  }

  // arming a build shows a ghost with its range, plus EVERY other legal
  // site lit up — tap any of them to move the ghost there. CONFIRM raises.
  const tryBuild = (type, at) => () => {
    const why = whyNotBuild(state, 'A', type, at);
    if (why) { flashTicker(why); return; }
    // siegecraft, said once: a half-built frame inside his gun range dies
    const threatened = state.structures.some(es => es.owner === 'P' && es.hp > 0 && (es.dps || 0) > 0 &&
      Math.hypot(es.cell[0] - at.cell[0], es.cell[1] - at.cell[1]) <= (es.range || es.radius || 0) + 0.5 &&
      (state.vision.A.has(cellKey(es.cell[0], es.cell[1])) || state.memory.A.has('st:' + es.id)));
    if (threatened) showTutorialLine('His guns will tear a half-built frame apart. Arm the WIND WALL and tap this site first — the wall now shelters everything within two cells for 15 breaths.', 6200, 'siegeHint');
    UI.structMode = { type, at, facing: defaultFacing(state, 'A', at.cell) };
    UI.structSites = validStructSites(state, type);
    showSockets(state, UI.structSites.map(s => ({ cell: s.cell, kind: 'site' })));
    showStructPreview(state, 'A', type, at.cell, UI.structMode.facing);
    setConfirmVisible(true);
    const ss = structureStats('A', type);
    UI.els.confirm.textContent = 'RAISE  ' + ss.cost + ' ⚇' + (ss.favor ? ' + ' + ss.favor + ' ✦' : '');
  };

  if (!yardMenu)
  if (!isl && deg === 1 && !structureAt(state, x, z)) {
    const at = { site: 'endpoint', cell };
    for (const type of ['vane', 'bolt', 'shield']) {
      const label = structLabel(type);
      const why = whyNotBuild(state, 'A', type, at);
      const ss = structureStats('A', type);
      (type === 'shield' ? groups.shield : groups.attack)
        .push(menuButton(label, ss.cost, tryBuild(type, at), why, type, ss.favor));
    }
  } else if (isl && plotIdx >= 0) {
    const at = { site: 'plot', islandId: isl.id, plotIdx, cell };
    if (!isl.role.startsWith('greatTemple') && (!isl.temple || isl.temple.hp <= 0)) {
      groups.rites.push(menuButton('TEMPLE', CONFIG.Structures.TEMPLE.COST, tryBuild('temple', at), whyNotBuild(state, 'A', 'temple', at), 'temple', CONFIG.Structures.TEMPLE.FAVOR));
    }
    if (isl.owner === 'A') {
      for (const type of ['vane', 'bolt', 'shield', 'yard']) {
        const label = structLabel(type);
        const why = whyNotBuild(state, 'A', type, at);
        const ss = structureStats('A', type);
        (type === 'shield' ? groups.shield : type === 'yard' ? groups.factory : groups.attack)
          .push(menuButton(label, ss.cost, tryBuild(type, at), why, type, ss.favor));
      }
    }
  } else if (isl) {
    // island body: EVERY empty tile is buildable ground (player-directed
    // fortifications) — build exactly where the thumb landed
    const tappedFree = !structureAt(state, x, z) &&
      !plotBlockedByQuarry(isl, { x, z });
    const freeIdx = isl.plots.findIndex(pl => !pl.structure && !plotBlockedByQuarry(isl, pl));
    if (tappedFree || freeIdx >= 0) {
      const at = tappedFree
        ? { site: 'plot', islandId: isl.id, plotIdx: -1, cell: [x, z] }
        : { site: 'plot', islandId: isl.id, plotIdx: freeIdx, cell: [isl.plots[freeIdx].x, isl.plots[freeIdx].z] };
      if (!isl.role.startsWith('greatTemple') && (!isl.temple || isl.temple.hp <= 0)) {
        groups.rites.push(menuButton('TEMPLE', CONFIG.Structures.TEMPLE.COST, tryBuild('temple', at), whyNotBuild(state, 'A', 'temple', at), 'temple', CONFIG.Structures.TEMPLE.FAVOR));
      }
      if (isl.owner === 'A') {
        for (const type of ['vane', 'bolt', 'shield', 'yard']) {
          const label = structLabel(type);
          const why = whyNotBuild(state, 'A', type, at);
          const ss = structureStats('A', type);
          (type === 'shield' ? groups.shield : type === 'yard' ? groups.factory : groups.attack)
            .push(menuButton(label, ss.cost, tryBuild(type, at), why, type, ss.favor));
        }
      }
    }
    // priest travel, hauler purchase at home/yarded islands
    const p = state.priests.A;
    const reachable = p && findNetPath(state, 'A', [Math.round(p.pos[0]), Math.round(p.pos[1])], isl.cells);
    groups.rites.push(menuButton('SEND<br>PRIEST', 0, () => {
      if (!sendPriest(state, 'A', isl)) flashTicker('NO SUPPORTED ROUTE REACHES IT');
    }, reachable ? null : 'NO SUPPORTED ROUTE REACHES IT', 'priest'));
    const hasYard = isl.role === 'greatTempleA' ||
      state.structures.some(st => st.owner === 'A' && st.type === 'yard' && st.islandId === isl.id && st.hp > 0 && st.buildProgress >= 1);
    if (hasYard) {
      const fleet = state.haulers.filter(h => h.owner === 'A' && h.state !== 'dead').length;
      const capped = fleet >= fleetCap(state, 'A');
      groups.factory.push(menuButton('BUILD<br>HAULER', CONFIG.Hauler.COST, () => {
        if (!buyHauler(state, 'A')) flashTicker('FLEET AT CAPACITY');
      }, capped ? 'FLEET AT CAPACITY' : (state.res.A.supply < CONFIG.Hauler.COST ? 'NOT ENOUGH SUPPLY' : null), 'hauler'));
    }
  }

  // divine powers live HERE now (player-directed): Tailwind is valid
  // anywhere; the Wall shelters the very spot you tapped
  {
    const P = CONFIG.Powers;
    const twName = R.themeSea ? 'FOLLOWING<br>SEA' : 'TAILWIND';
    const twBusy = state.time < state.powers.tailwindUntil;
    const twBtn = menuButton(twName, 0, () => {
      if (castTailwind(state)) flashTicker(R.themeSea ? 'A FOLLOWING SEA RISES' : 'THE TAILWIND ANSWERS');
    }, twBusy ? 'ALREADY BLOWING' : (state.res.A.favor < P.TAILWIND.FAVOR ? 'NOT ENOUGH FAVOR' : null),
      'tailwind', P.TAILWIND.FAVOR);
    const wwName = R.themeSea ? 'BREAKWATER<br>HERE' : 'WIND WALL<br>HERE';
    const wwBtn = menuButton(wwName, 0, () => {
      if (castWindWall(state, cell)) flashTicker(R.themeSea ? 'THE BREAKWATER HOLDS THIS GROUND' : 'THE WALL STANDS OVER THIS GROUND');
    }, state.res.A.favor < P.WIND_WALL.FAVOR ? 'NOT ENOUGH FAVOR' : null,
      'windwall', P.WIND_WALL.FAVOR);
    // first-discovery shimmer, once EVER: the powers moved off the HUD,
    // so their new home glints the first time a menu shows them
    if (!seenLines().has('powShimmer')) {
      twBtn.classList.add('shimmer');
      wwBtn.classList.add('shimmer');
      UI.shimmerPending = true;
    }
    groups.favor.push(twBtn, wwBtn);
  }

  // salvage (player-directed, NetStorm-style): reclaim what stands here
  const stHere = structureAt(state, x, z);
  if (stHere && stHere.owner === 'A' && stHere.hp > 0) {
    const refund = Math.floor(structureStats('A', stHere.type).cost * CONFIG.Salvage.STRUCTURE_REFUND);
    groups.destroy.push(menuButton('SALVAGE<br>+' + refund + ' ⚇', 0, () => {
      salvageStructure(state, 'A', stHere);
      hideBuildMenu();
      flashTicker('SALVAGED +' + refund + ' ⚇');
    }, null, 'salvage'));
  } else if (!stHere) {
    const touchesOwn = [...state.segments.values()].some(s => s.owner === 'A' &&
      ((s.a[0] === x && s.a[1] === z) || (s.b[0] === x && s.b[1] === z)));
    if (touchesOwn) {
      groups.destroy.push(menuButton('UNBUILD<br>+' + CONFIG.Salvage.SEGMENT_FAVOR + ' ✦', 0, () => {
        salvageSegmentAt(state, 'A', cell);
        hideBuildMenu();
        flashTicker('SEGMENT UNBOUND +' + CONFIG.Salvage.SEGMENT_FAVOR + ' ✦');
      }, null, 'salvageseg'));
    }
  }

  const optionCount = Object.values(groups).reduce((n, g) => n + g.length, 0);
  if (!optionCount && !pieceOptions.length && !unitIdent && !ident) return;
  // identity header: the tapped ship and/or the ground itself
  if (unitIdent || ident) {
    const head = document.createElement('div');
    head.style.cssText = 'flex-basis:100%; text-align:center; font-size:11px; letter-spacing:1px; ' +
      'color:#cfe3e6; padding-bottom:3px; border-bottom:1px solid rgba(242,232,207,0.2); margin-bottom:3px;';
    head.innerHTML = (unitIdent ? '<div style="color:var(--ivory)">' + unitIdent + '</div>' : '') +
      (ident ? '<div>' + ident + '</div>' : '');
    menu.appendChild(head);
  }
  // what you can afford, right where you are choosing
  const bal = document.createElement('div');
  bal.style.cssText = 'flex-basis:100%; text-align:center; font-size:12px; letter-spacing:1px; padding-bottom:2px;';
  bal.innerHTML = '<span style="color:var(--gold)">⚇ ' + Math.floor(state.res.A.supply) +
    '</span> &nbsp;·&nbsp; <span style="color:#d5ecff">✦ ' + Math.floor(state.res.A.favor) + '</span>';
  menu.appendChild(bal);
  // categories render as COLUMNS side by side — a compact label atop
  // each stack of buttons (player-directed); pathways stay on the
  // bottom row nearest the thumb
  const colsWrap = document.createElement('div');
  colsWrap.style.cssText = 'display:flex; gap:7px; align-items:flex-start; ' +
    'flex-wrap:wrap; justify-content:center; flex-basis:100%;';
  let anyCol = false;
  for (const key of ['attack', 'shield', 'factory', 'rites', 'favor', 'destroy']) {
    const items = groups[key];
    if (!items.length) continue;
    anyCol = true;
    const col = document.createElement('div');
    col.style.cssText = 'display:flex; flex-direction:column; gap:5px; align-items:stretch;';
    const cap = document.createElement('div');
    cap.style.cssText = 'font-size:9px; letter-spacing:2.5px; text-align:center; ' +
      'color:rgba(217,164,65,0.85); border-bottom:1px solid rgba(217,164,65,0.3); padding-bottom:2px;';
    cap.textContent = GROUP_LABELS[key];
    col.appendChild(cap);
    for (const o of items) col.appendChild(o);
    colsWrap.appendChild(col);
  }
  if (anyCol) menu.appendChild(colsWrap);
  if (pieceOptions.length) {
    const cap = document.createElement('div');
    cap.style.cssText = 'flex-basis:100%; font-size:9px; letter-spacing:2.5px; ' +
      'color:rgba(217,164,65,0.85); margin:3px 0 0 3px; text-align:left;';
    cap.textContent = 'PATHWAYS';
    menu.appendChild(cap);
    for (const o of pieceOptions) menu.appendChild(o);
  }
  menu.classList.remove('hidden');
  if (UI.shimmerPending) {
    // the shimmer has now actually been seen — never again
    markSeen('powShimmer');
    UI.shimmerPending = false;
  }

  // anchor the menu just above the thumb, clamped to the screen
  if (tapX !== undefined) {
    menu.classList.add('attap');
    menu.style.visibility = 'hidden';
    requestAnimationFrame(() => {
      const w = menu.offsetWidth, h = menu.offsetHeight;
      const left = clamp(tapX - w / 2, 6, window.innerWidth - w - 6);
      const top = clamp(tapY - h - 34, 6, window.innerHeight - h - 6);
      menu.style.left = left + 'px';
      menu.style.top = top + 'px';
      menu.style.visibility = 'visible';
    });
  } else {
    menu.classList.remove('attap');
    menu.style.left = '';
    menu.style.top = '';
  }
}

// ---- HUD refresh ----
function refreshHUD(state) {
  UI.els.supply.textContent = Math.floor(state.res.A.supply);
  UI.els.favor.textContent = Math.floor(state.res.A.favor);
  const w = state.wave;
  // the wave chip narrates what is actually happening (player-directed):
  // "EIGHT SHIPS EN ROUTE" beats a bare countdown
  const NUMS = ['NO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE'];
  const alive = state.craft.filter(c => !c.dead);
  let fleetLine = '';
  if (alive.length) {
    const engaged = alive.some(c => c.target &&
      dist2d(c.target.pos[0], c.target.pos[1], c.pos[0], c.pos[1]) <= c.range + 0.3);
    const n = alive.length <= 12 ? NUMS[alive.length] : alive.length;
    fleetLine = '<br><span style="color:#7fd4dd">' + n + (alive.length === 1 ? ' SHIP ' : ' SHIPS ') +
      (engaged ? 'ATTACKING' : 'EN ROUTE') + '</span>';
  }
  if (state.over) UI.els.waveinfo.textContent = '';
  else {
    const remain = Math.max(0, w.nextAt - state.time);
    const name = w.index >= CONFIG.Waves.COUNT
      ? 'WRATH TIDE IN ' + Math.ceil(remain) + 's'   // past nine, the sea does not tire
      : 'WAVE ' + (w.index + 1) + ' IN ' + Math.ceil(remain) + 's';
    UI.els.waveinfo.innerHTML = name + fleetLine;
  }
  // keep the floating confirm row glued to its ghost through pans/zooms
  if (!UI.els.confirm.classList.contains('hidden')) placeConfirmRow();
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
  refreshHand(state);
}

// ---- banners / tutorial / ticker ----
// Every transient line is tap-to-dismiss, and story lines show once EVER
// (remembered across matches) so they never nag a returning player.
function seenLines() {
  try { return new Set(JSON.parse(localStorage.getItem('windward-seen') || '[]')); }
  catch (e) { return new Set(); }
}
function markSeen(key) {
  try {
    const s = seenLines();
    s.add(key);
    localStorage.setItem('windward-seen', JSON.stringify([...s]));
  } catch (e) { }
}

function wireDismissables() {
  for (const id of ['tutorial', 'banner', 'ticker', 'codex']) {
    const el = document.getElementById(id);
    if (el && !el.dataset.dismissWired) {
      el.dataset.dismissWired = '1';
      el.addEventListener('click', () => {
        el.classList.remove('show');
        if (id === 'codex') el.classList.add('hidden');
      });
    }
  }
}

let bannerTimeout = null;
function showBanner(title, sub, poseidon) {
  const b = UI.els.banner;
  b.querySelector('.title').textContent = title;
  b.querySelector('.sub').textContent = sub || '';
  b.classList.toggle('poseidon', !!poseidon);
  b.classList.add('show');
  clearTimeout(bannerTimeout);
  bannerTimeout = setTimeout(() => b.classList.remove('show'), 2800);
}

let tutorialTimeout = null;
function showTutorialLine(text, holdMs, onceKey) {
  if (onceKey) {
    if (seenLines().has(onceKey)) return;
    markSeen(onceKey);
  }
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
