// ================================================================
// GAME STATE — the single mutable container every system reads and
// writes. Built fresh per match from a seed. DOM-free.
// ================================================================

let nextEntityId = 1;
function eid() { return nextEntityId++; }

function newGameState(seedStr) {
  const map = generateMap(seedStr);
  const wind = new WindField(map.windAngles);

  // Augment islands with runtime fields (§34).
  for (const isl of map.islands) {
    isl.owner = isl.role === 'greatTempleA' ? 'A' : isl.role === 'greatTempleP' ? 'P' : null;
    isl.temple = null;            // {owner, hp, buildProgress, cell}
    isl.stockpile = 0;
    isl.minedOut = false;
    isl.cellSet = new Set(isl.cells.map(([x, z]) => cellKey(x, z)));
    for (const p of isl.plots) p.structure = null;
  }

  const gtA = map.islands.find(i => i.role === 'greatTempleA');
  const gtP = map.islands.find(i => i.role === 'greatTempleP');

  const state = {
    seed: map.seed,
    time: 0,
    over: null,                    // null | 'win' | 'lose'
    map, wind,
    gtA, gtP,
    greatTemple: {
      A: { hp: CONFIG.Claim.GREAT_TEMPLE_HP, cell: gtA.templeCell, island: gtA },
      P: { hp: CONFIG.Claim.GREAT_TEMPLE_HP, cell: gtP.templeCell, island: gtP }
    },
    // network
    segments: new Map(),           // segKey -> segment
    structures: [],                // structure entities
    // resources (Poseidon runs a shadow economy on the same fields)
    res: {
      A: { supply: CONFIG.Economy.START_SUPPLY, favor: CONFIG.Economy.START_FAVOR },
      P: { supply: CONFIG.Economy.START_SUPPLY, favor: CONFIG.Economy.START_FAVOR }
    },
    incomeTimer: 0,
    hand: [],
    hydrogen: { A: false, P: false },
    haulers: [],
    craft: [],                     // Poseidon wave craft
    priests: { A: null, P: null },
    influence: { A: new Set(), P: new Set(), contested: new Set() },
    vision: { A: new Set(), P: new Set() },
    memory: { A: new Map(), P: new Map() },   // remembered enemy structures/segments
    wave: { index: 0, nextAt: CONFIG.Waves.FIRST_AT, telegraphed: false, origin: null, wrath: false },
    powers: { tailwindUntil: 0, tailwindSegs: null, windwallUntil: 0, windwallCell: null, fog: null },
    tutorial: { released: false, seenSever: false },
    stats: { placed: 0, reconnections: 0 }
  };

  // starting hand (deck seeded so replays of a seed match exactly)
  resetPieceDeck(map.seed);
  for (let i = 0; i < CONFIG.Pieces.HAND_SIZE; i++) state.hand.push(drawPiece(i));
  return state;
}

// The hand always holds three prong classes: an extender (one open end),
// a brancher (two open ends), and a hub (three open ends). Each slot
// redraws within its own class.
const PIECE_CATEGORIES = [
  ['SHORT', 'LONG', 'L', 'S'],   // 1 prong
  ['T', 'TT'],                   // 2 prongs
  ['X']                          // 3 prongs
];
const PIECE_TYPES = PIECE_CATEGORIES.flat();
let pieceRng = mulberry32(1);
function resetPieceDeck(seed) { pieceRng = mulberry32(hashString(seed + ':pieces')); }
function drawPiece(slot) {
  const pool = PIECE_CATEGORIES[slot === undefined ? 0 : slot % PIECE_CATEGORIES.length];
  return pool[Math.floor(pieceRng() * pool.length)];
}
function piecePlugs(type) {
  return { SHORT: 1, LONG: 1, L: 1, S: 1, T: 2, TT: 2, X: 3 }[type];
}

// Route pieces cost Favor, flat, regardless of size: the wind is not
// bought with ore — it is granted, and every binding costs the same ask.
function pieceCost(type) {
  return CONFIG.Pieces.FAVOR_COST;
}

// Which island (if any) owns this cell.
function islandAt(state, x, z) {
  const k = cellKey(x, z);
  for (const isl of state.map.islands) if (isl.cellSet.has(k)) return isl;
  return null;
}

// An island conducts support for a side when its temple (or Great Temple)
// of that side stands complete.
function islandConducts(state, isl, side) {
  if (isl.role === 'greatTempleA') return side === 'A' && state.greatTemple.A.hp > 0;
  if (isl.role === 'greatTempleP') return side === 'P' && state.greatTemple.P.hp > 0;
  return !!(isl.temple && isl.temple.owner === side && isl.temple.hp > 0 && isl.temple.buildProgress >= 1);
}

// An island is closed to a side when a standing rival temple claims it (§14.6.4).
function islandClosedTo(state, isl, side) {
  if (isl.role === 'greatTempleA') return side === 'P';
  if (isl.role === 'greatTempleP') return side === 'A';
  return !!(isl.temple && isl.temple.owner !== side && isl.temple.hp > 0 && isl.temple.buildProgress >= 1);
}
