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
    hand: $('hand'), confirm: $('btn-confirm'), cancel: $('btn-cancel'), rotate: $('btn-rotate'),
    discard: $('btn-discard'), tech: $('btn-tech'),
    banner: $('banner'), tutorial: $('tutorial'), ticker: $('ticker'),
    powTailwind: $('pow-tailwind'), powWindwall: $('pow-windwall'),
    priestchip: $('priestchip'), buildmenu: $('buildmenu'), codex: $('codex')
  };
  UI.els.seedchip.textContent = state.seed;

  buildHand(state);

  UI.els.confirm.addEventListener('click', () => confirmPlacement(state));
  UI.els.rotate.addEventListener('click', () => cyclePlacement(state));
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
  const pan = { active: false, panned: false, sx: 0, sy: 0, ground: null };
  const pointers = new Map();     // two-finger pinch (zoom) and twist (rotate)
  let pinch = null;
  const gestureVals = () => {
    const [a, b] = [...pointers.values()];
    return {
      d: Math.hypot(a.x - b.x, a.y - b.y),
      ang: Math.atan2(b.y - a.y, b.x - a.x)
    };
  };
  canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
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
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const g = gestureVals();
      R.camZoom = clamp(pinch.zoom0 * (pinch.d0 / Math.max(20, g.d)), 0.75, 2.6);
      let da = g.ang - pinch.a0;
      R.camAz = pinch.az0 + da;
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
    updateCamera();
    pan.ground = pickGround(e.clientX, e.clientY);
  });
  const release = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    const wasTap = pan.active && !pan.panned && e.type === 'pointerup';
    pan.active = false;
    if (wasTap) onTap(state, e);
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
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
  if (!sockets.length) {
    flashTicker('NOWHERE TO BUILD FROM — EXTEND ANOTHER WAY');
  } else if (sockets.length === 1) {
    // only one place it can go (the opening move): step straight to preview
    selectSocket(state, sockets[0]);
    flashTicker('TAP THE GHOST TO TURN IT · CONFIRM TO BIND');
  } else {
    flashTicker('TAP A GLOWING SOCKET');
  }
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
  if (!UI.hintedCycle) {
    UI.hintedCycle = true;
    flashTicker('TAP THE GHOST TO TURN IT · CONFIRM TO BIND');
  }
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
  if (UI.structMode) {
    const { type, at } = UI.structMode;
    const why = whyNotBuild(state, 'A', type, at);
    if (why) { flashTicker(why); cancelPlacement(); return; }
    buildStructure(state, 'A', type, at);
    cancelPlacement();
    return;
  }
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

function setConfirmVisible(v) {
  UI.els.confirm.classList.toggle('hidden', !v);
  UI.els.cancel.classList.toggle('hidden', !v);
  // TURN only shows when the piece has more than one legal orientation here
  UI.els.rotate.classList.toggle('hidden', !v || !UI.placements || UI.placements.length < 2);
  if (v) UI.els.confirm.textContent = 'CONFIRM';
}

// ---- taps on the world ----
function onTap(state, e) {
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
      showStructPreview(state, 'A', UI.structMode.type, site.cell);
      return;
    }
    cancelPlacement();
    return;
  }
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
  vane: 'short range, hits all around', bolt: 'long range, one target',
  shield: 'absorbs hits for allies behind', temple: 'claims isle, spreads influence',
  yard: 'lets you build 2 more haulers', priest: 'must stand here to found temples',
  hauler: 'carries mined ore home'
};

function menuButton(label, cost, fn, disabledReason, descKey) {
  const btn = document.createElement('button');
  const desc = MENU_DESC[descKey] ? '<span style="font-size:9px; opacity:0.75; line-height:1.1; display:block; max-width:70px">' + MENU_DESC[descKey] + '</span>' : '';
  btn.innerHTML = label + desc + (cost ? '<b>' + cost + ' ⚇</b>' : '');
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
  vane: 'CHAIN VANE (radial gun)', bolt: 'BOLT BATTERY (long gun)', shield: 'AEGIS SCREEN (shield)',
  temple: 'TEMPLE', yard: 'MOORING YARD (builds haulers)', mast: 'SIPHON MAST (his anti-air)'
};
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
    const who = st.owner === 'A' ? '' : 'HIS ';
    return who + (STRUCT_NAMES[st.type] || st.type.toUpperCase()) +
      (st.buildProgress < 1 ? ' — RAISING' : '') + ' · ' + Math.ceil(st.hp) + ' HP';
  }
  const isl = islandAt(state, cell[0], cell[1]);
  if (isl) {
    let s = ISLAND_NAMES[isl.role] || 'AN ISLAND';
    if (!isl.role.startsWith('greatTemple')) {
      s += isl.owner ? (isl.owner === 'A' ? ' — YOURS' : ' — HIS') : ' — UNCLAIMED';
      if (isl.reserve > 0) s += ' · ORE ' + Math.floor(isl.reserve);
      else if (isl.minedOut) s += ' · MINED OUT';
      if (isl.stockpile > 1) s += ' · PILE ' + Math.floor(isl.stockpile);
    }
    return s;
  }
  return null;
}

function openContextMenu(state, cell) {
  const [x, z] = cell;
  const menu = UI.els.buildmenu;
  menu.innerHTML = '';
  const options = [];
  const isl = islandAt(state, x, z);
  const plotIdx = isl ? isl.plots.findIndex(p => p.x === x && p.z === z) : -1;
  const deg = nodeDegrees(state, 'A').get(cellKey(x, z)) || 0;
  const ident = identifyCell(state, cell);
  if (ident) flashTicker(ident);

  // arming a build shows a ghost with its range, plus EVERY other legal
  // site lit up — tap any of them to move the ghost there. CONFIRM raises.
  const tryBuild = (type, at) => () => {
    const why = whyNotBuild(state, 'A', type, at);
    if (why) { flashTicker(why); return; }
    UI.structMode = { type, at };
    UI.structSites = validStructSites(state, type);
    showSockets(state, UI.structSites.map(s => ({ cell: s.cell, kind: 'site' })));
    showStructPreview(state, 'A', type, at.cell);
    setConfirmVisible(true);
    UI.els.confirm.textContent = 'RAISE  ' + structureStats('A', type).cost + ' ⚇';
  };

  if (!isl && deg === 1 && !structureAt(state, x, z)) {
    const at = { site: 'endpoint', cell };
    for (const [type, label] of [['vane', 'CHAIN<br>VANE'], ['bolt', 'BOLT<br>BATTERY'], ['shield', 'AEGIS<br>SCREEN']]) {
      const why = whyNotBuild(state, 'A', type, at);
      options.push(menuButton(label, structureStats('A', type).cost, tryBuild(type, at), why, type));
    }
  } else if (isl && plotIdx >= 0) {
    const at = { site: 'plot', islandId: isl.id, plotIdx, cell };
    if (!isl.role.startsWith('greatTemple') && (!isl.temple || isl.temple.hp <= 0)) {
      options.push(menuButton('TEMPLE', CONFIG.Structures.TEMPLE.COST, tryBuild('temple', at), whyNotBuild(state, 'A', 'temple', at), 'temple'));
    }
    if (isl.owner === 'A') {
      for (const [type, label] of [['vane', 'CHAIN<br>VANE'], ['bolt', 'BOLT<br>BATTERY'], ['shield', 'AEGIS<br>SCREEN'], ['yard', 'MOORING<br>YARD']]) {
        const why = whyNotBuild(state, 'A', type, at);
        options.push(menuButton(label, structureStats('A', type).cost, tryBuild(type, at), why, type));
      }
    }
  } else if (isl) {
    // island body: offer builds on the first free plot too, so the player
    // doesn't have to hit the small bronze disc exactly
    const freeIdx = isl.plots.findIndex(pl => !pl.structure);
    if (freeIdx >= 0) {
      const at = { site: 'plot', islandId: isl.id, plotIdx: freeIdx, cell: [isl.plots[freeIdx].x, isl.plots[freeIdx].z] };
      if (!isl.role.startsWith('greatTemple') && (!isl.temple || isl.temple.hp <= 0)) {
        options.push(menuButton('TEMPLE', CONFIG.Structures.TEMPLE.COST, tryBuild('temple', at), whyNotBuild(state, 'A', 'temple', at), 'temple'));
      }
      if (isl.owner === 'A') {
        for (const [type, label] of [['vane', 'CHAIN<br>VANE'], ['bolt', 'BOLT<br>BATTERY'], ['shield', 'AEGIS<br>SCREEN'], ['yard', 'MOORING<br>YARD']]) {
          const why = whyNotBuild(state, 'A', type, at);
          options.push(menuButton(label, structureStats('A', type).cost, tryBuild(type, at), why, type));
        }
      }
    }
    // priest travel, hauler purchase at home/yarded islands
    const p = state.priests.A;
    const reachable = p && findNetPath(state, 'A', [Math.round(p.pos[0]), Math.round(p.pos[1])], isl.cells);
    options.push(menuButton('SEND<br>PRIEST', 0, () => {
      if (!sendPriest(state, 'A', isl)) flashTicker('NO SUPPORTED ROUTE REACHES IT');
    }, reachable ? null : 'NO SUPPORTED ROUTE REACHES IT', 'priest'));
    const hasYard = isl.role === 'greatTempleA' ||
      state.structures.some(st => st.owner === 'A' && st.type === 'yard' && st.islandId === isl.id && st.hp > 0 && st.buildProgress >= 1);
    if (hasYard) {
      const fleet = state.haulers.filter(h => h.owner === 'A' && h.state !== 'dead').length;
      const capped = fleet >= fleetCap(state, 'A');
      options.push(menuButton('BUILD<br>HAULER', CONFIG.Hauler.COST, () => {
        if (!buyHauler(state, 'A')) flashTicker('FLEET AT CAPACITY');
      }, capped ? 'FLEET AT CAPACITY' : (state.res.A.supply < CONFIG.Hauler.COST ? 'NOT ENOUGH SUPPLY' : null), 'hauler'));
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
  bannerTimeout = setTimeout(() => b.classList.remove('show'), 2800);
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
