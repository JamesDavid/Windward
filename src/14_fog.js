// ================================================================
// FOG AND VISION (§14B) — terrain is never fogged; enemy craft need
// live vision; enemy structures and segments, once seen, stay drawn
// at their last known state. Both sides obey the same rules.
// ================================================================

let fogAccum = 0;

function computeVision(state, side) {
  const vis = new Set();
  const add = (cx, cz, r) => {
    for (let z = Math.max(0, Math.floor(cz - r)); z <= Math.min(CONFIG.Grid.HEIGHT - 1, Math.ceil(cz + r)); z++) {
      for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(CONFIG.Grid.WIDTH - 1, Math.ceil(cx + r)); x++) {
        if (dist2d(x, z, cx, cz) <= r) vis.add(cellKey(x, z));
      }
    }
  };
  const V = CONFIG.Vision;
  const gt = state.greatTemple[side];
  if (gt.hp > 0) add(gt.cell[0], gt.cell[1], V.TEMPLE);
  for (const st of state.structures) {
    if (st.owner !== side || st.hp <= 0) continue;
    add(st.cell[0], st.cell[1], st.type === 'temple' ? V.TEMPLE : V.STRUCTURE);
  }
  for (const s of state.segments.values()) {
    if (s.owner !== side) continue;
    const m = segMid(s);
    add(m[0], m[1], V.SEGMENT);
  }
  for (const h of state.haulers) {
    if (h.owner === side && h.state !== 'dead') add(h.pos[0], h.pos[1], V.HAULER);
  }
  const p = state.priests[side];
  if (p && p.state !== 'dead') add(p.pos[0], p.pos[1], V.HAULER);
  return vis;
}

function fogTick(state, dt) {
  fogAccum += dt;
  if (fogAccum < 0.4 && state.vision.A.size) return;   // throttled
  fogAccum = 0;
  for (const side of ['A', 'P']) {
    state.vision[side] = computeVision(state, side);
    // exploration: ground once seen stays lifted (the shroud is one-way)
    if (side === 'A') {
      if (!state.explored) state.explored = new Set();
      for (const k of state.vision.A) state.explored.add(k);
    }
    // memory: enemy structures and segments currently in sight are remembered
    if (CONFIG.Vision.REMEMBER_STRUCTURES) {
      const foe = side === 'A' ? 'P' : 'A';
      const mem = state.memory[side];
      for (const st of state.structures) {
        if (st.owner === foe && st.hp > 0 && state.vision[side].has(cellKey(st.cell[0], st.cell[1]))) {
          mem.set('st:' + st.id, state.time);
        }
      }
      for (const s of state.segments.values()) {
        if (s.owner !== foe) continue;
        const m = segMid(s);
        if (state.vision[side].has(cellKey(Math.round(m[0]), Math.round(m[1])))) mem.set('seg:' + s.key, state.time);
      }
    }
  }
}
