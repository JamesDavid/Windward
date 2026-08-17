// ================================================================
// SAVE / RESUME (player-directed: "this is a mobile game and life
// happens"). Leaving the page mid-match snapshots the dynamic state
// to localStorage; the title screen offers RESUME on the next visit.
// The map itself is never stored — it regenerates from the seed.
// ================================================================

const SAVE_KEY = 'windward-resume';
const SKILL_KEY = 'windward-skill';

// ---- persistent skill history (player-directed: 'posiedon remembers') --
// An exponential average of end-of-match skill AND the peak temper the
// player has ever driven him to (decaying slowly, so one great night
// doesn't haunt forever). The opening temper reads both.
function loadSkillHist() {
  const fresh = { games: 0, ema: 1, peak: 1 };
  try {
    const raw = localStorage.getItem(SKILL_KEY);
    if (!raw) return fresh;
    const v = JSON.parse(raw);
    if (v && typeof v === 'object' && v.ema !== undefined) return v;
    const f = parseFloat(raw);   // legacy single-float rating
    return isNaN(f) ? fresh : { games: 1, ema: f, peak: f };
  } catch (e) { return fresh; }
}
function startTierFromHistory() {
  const h = loadSkillHist();
  return Math.max(0, Math.min(3, Math.round((h.ema + h.peak) / 2)));
}
// outcome nudges: decisive results move a half rung, judgments a quarter
function updateSkillRating(state) {
  const h = loadSkillHist();
  const nudge = state.over === 'win' ? 0.5
    : state.over === 'arbitration' ? 0.25
    : state.over === 'arbitrationLoss' ? -0.25
    : state.over === 'lose' ? -0.5 : 0;
  const endScore = Math.max(0, Math.min(3, (state.aiTier !== undefined ? state.aiTier : 1) + nudge));
  const peakInMatch = state.ddaPeak !== undefined ? state.ddaPeak : (state.aiTier || 1);
  h.ema = h.games > 0 ? h.ema * 0.6 + endScore * 0.4 : endScore;
  h.peak = Math.max(h.peak * 0.92, peakInMatch);
  h.games = (h.games || 0) + 1;
  try { localStorage.setItem(SKILL_KEY, JSON.stringify(h)); } catch (e) { }
}

// Entities are stored as plain field copies; object references
// (island temples, plot occupancy, craft targets) are re-linked or
// re-acquired after load. Fog memory and AI plans are deliberately
// dropped: the AI replans and craft retarget within a tick or two.
function snapshotMatch(state) {
  const seg = [];
  for (const s of state.segments.values()) {
    seg.push({
      owner: s.owner, a: s.a, b: s.b, hp: s.hp,
      supportState: s.supportState, collapseAt: s.collapseAt || 0
    });
  }
  const noRefs = (ent, drop) => {
    const o = {};
    for (const k of Object.keys(ent)) {
      if (drop.includes(k)) continue;
      const v = ent[k];
      if (typeof v === 'function' || (v && typeof v === 'object' && !Array.isArray(v))) continue;
      o[k] = v;
    }
    // arrays of cells survive JSON fine
    if (ent.path) o.path = ent.path;
    return o;
  };
  return {
    v: 1,
    seed: state.seed,
    theme: state.theme || 'air',
    time: state.time,
    res: state.res,
    hydrogen: state.hydrogen,
    hand: state.hand.slice(),
    arbitrationDeclined: !!state.arbitrationDeclined,
    aiTier: state.aiTier !== undefined ? state.aiTier : 1,
    wave: {
      index: state.wave.index, nextAt: state.wave.nextAt,
      telegraphed: false, wrath: state.wave.wrath
    },
    gtHp: { A: state.greatTemple.A.hp, P: state.greatTemple.P.hp },
    powers: { tailwindUntil: state.powers.tailwindUntil },
    islands: state.map.islands.map(isl => ({
      owner: isl.owner, stockpile: isl.stockpile,
      minedOut: isl.minedOut, reserve: isl.reserve
    })),
    segments: seg,
    structures: state.structures.filter(st => st.hp > 0).map(st => noRefs(st, [])),
    haulers: state.haulers.filter(h => h.state !== 'dead').map(h => noRefs(h, [])),
    priests: {
      A: state.priests.A ? noRefs(state.priests.A, []) : null,
      P: state.priests.P ? noRefs(state.priests.P, []) : null
    },
    craft: state.craft.filter(c => !c.dead).map(c => noRefs(c, ['target', 'script'])),
    explored: state.explored ? [...state.explored] : [],
    stats: state.stats
  };
}

function saveMatch(state) {
  if (!state || state.over || state.demo) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(snapshotMatch(state))); } catch (e) { }
}

function clearSavedMatch() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
}

function loadSavedMatch() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const snap = JSON.parse(raw);
    return snap && snap.v === 1 && snap.seed ? snap : null;
  } catch (e) { return null; }
}

// Apply a snapshot onto a FRESH state built from the same seed.
function applySnapshot(state, snap) {
  state.time = snap.time;
  state.res = snap.res;
  state.hydrogen = snap.hydrogen;
  state.hand = snap.hand.slice();
  state.arbitrationDeclined = !!snap.arbitrationDeclined;
  applyAiTier(state, snap.aiTier !== undefined ? snap.aiTier : 1);
  Object.assign(state.wave, snap.wave, { origin: null });
  state.greatTemple.A.hp = snap.gtHp.A;
  state.greatTemple.P.hp = snap.gtHp.P;
  state.powers.tailwindUntil = snap.powers.tailwindUntil || 0;
  state.stats = snap.stats || state.stats;
  snap.islands.forEach((si, i) => {
    const isl = state.map.islands[i];
    if (!isl) return;
    isl.owner = si.owner;
    isl.stockpile = si.stockpile;
    isl.minedOut = si.minedOut;
    if (si.reserve !== undefined) isl.reserve = si.reserve;
    if (si.minedOut) {
      // the depleted quarry's build pad survives the save
      const [qx, qz] = isl.cells[0];
      if (!isl.plots.some(p => p.x === qx && p.z === qz)) isl.plots.push({ x: qx, z: qz, structure: null });
    }
  });
  for (const ss of snap.segments) {
    const seg = makeSegment(state, ss.owner, ss.a, ss.b);
    seg.hp = ss.hp;
    seg.supportState = ss.supportState;
    if (ss.collapseAt) seg.collapseAt = ss.collapseAt;
    state.segments.set(ss.owner + ':' + seg.key, seg);
  }
  state.structures = snap.structures;
  for (const st of state.structures) {
    // re-link plots and island temples to their structures
    if (st.islandId !== null && st.islandId !== undefined) {
      const isl = state.map.islands[st.islandId];
      if (isl) {
        if (st.plotIdx !== null && st.plotIdx >= 0) {
          while (isl.plots.length <= st.plotIdx) isl.plots.push({ x: st.cell[0], z: st.cell[1], structure: null });
          isl.plots[st.plotIdx].structure = st;
        }
        if (st.type === 'temple') isl.temple = st;
      }
    }
  }
  state.haulers = snap.haulers;
  if (snap.priests.A) state.priests.A = snap.priests.A;
  if (snap.priests.P) state.priests.P = snap.priests.P;
  state.craft = snap.craft;
  state.explored = new Set(snap.explored);
  // derived layers rebuild from what was restored
  recalcSupport(state, 'A');
  recalcSupport(state, 'P');
  refreshInfluence(state);
  fogTick(state, 1);
}
