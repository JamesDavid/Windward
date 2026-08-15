// ================================================================
// ECONOMY (§11, §33A.2, §33D) — two resources. Supply is mined into
// island stockpiles and credited only on delivery; Favor accrues from
// uncontested influence. The Great Temple provides a small baseline.
// ================================================================

function economyTick(state, dt) {
  // continuous accruals, granted in INCOME_TICK batches for readable pulses
  state.incomeTimer += dt;
  if (state.incomeTimer >= CONFIG.Economy.INCOME_TICK_SECONDS) {
    state.incomeTimer -= CONFIG.Economy.INCOME_TICK_SECONDS;
    for (const side of ['A', 'P']) {
      if (state.greatTemple[side].hp <= 0) continue;
      let supply = CONFIG.Economy.TEMPLE_SUPPLY_PER_10S;
      let favor = CONFIG.Economy.TEMPLE_FAVOR_PER_10S;
      // influence Favor: 1 per 4 uncontested cells covered by a supported
      // island Temple (§11.2). The Great Temple's own influence mints no
      // Favor — ground must be taken and held for the god to be honoured.
      let cells = 0;
      for (const isl of state.map.islands) {
        if (isl.role.startsWith('greatTemple')) continue;
        if (!islandConducts(state, isl, side) || !islandSupported(state, isl, side)) continue;
        const r = CONFIG.Influence.TEMPLE_RADIUS;
        const [tx, tz] = isl.temple.cell;
        for (let z = Math.max(0, Math.floor(tz - r)); z <= Math.min(CONFIG.Grid.HEIGHT - 1, Math.ceil(tz + r)); z++) {
          for (let x = Math.max(0, Math.floor(tx - r)); x <= Math.min(CONFIG.Grid.WIDTH - 1, Math.ceil(tx + r)); x++) {
            const k = cellKey(x, z);
            if (dist2d(x, z, tx, tz) <= r && !state.influence.contested.has(k)) cells++;
          }
        }
      }
      favor += Math.floor(cells / CONFIG.Influence.FAVOR_CELL_DIVISOR) *
        CONFIG.Influence.FAVOR_PER_10S_PER_4_CELLS;
      if (state.wave.wrath) favor = Math.round(favor * CONFIG.Wrath.FAVOR_MULT);
      state.res[side].supply += supply;
      state.res[side].favor += favor;
      if (side === 'A') Events.emit('income', { supply, favor });
    }
  }

  // mining into local stockpiles (§33D.1) — only while controlled, connected
  // or not (stockpiles pile up at severed islands; that is the visual)
  for (const isl of state.map.islands) {
    if (isl.role.startsWith('greatTemple')) continue;
    if (!isl.owner || isl.minedOut) continue;
    if (!(isl.temple && isl.temple.owner === isl.owner && isl.temple.hp > 0 && isl.temple.buildProgress >= 1)) continue;
    const mined = Math.min(CONFIG.Mining.RATE_PER_SECOND * dt, isl.reserve);
    isl.reserve -= mined;
    isl.stockpile += mined;
    if (isl.reserve <= 0) {
      isl.reserve = 0;
      isl.minedOut = true;
      Events.emit('islandDepleted', { island: isl });
    }
  }
}

// Hydrogen unlock (§33E): fleet-wide, instant, one purchase.
function buyHydrogen(state, side) {
  const T = CONFIG.Tech;
  if (state.hydrogen[side]) return false;
  const r = state.res[side];
  if (r.supply < T.HYDROGEN_COST_SUPPLY || r.favor < T.HYDROGEN_COST_FAVOR) return false;
  r.supply -= T.HYDROGEN_COST_SUPPLY;
  r.favor -= T.HYDROGEN_COST_FAVOR;
  state.hydrogen[side] = true;
  for (const h of state.haulers) {
    if (h.owner === side) h.capacity = CONFIG.Hauler.HYDROGEN_CAPACITY;
  }
  Events.emit('hydrogenUnlocked', { side });
  return true;
}

function haulerCapacity(state, side) {
  return state.hydrogen[side] ? CONFIG.Hauler.HYDROGEN_CAPACITY : CONFIG.Hauler.HOTAIR_CAPACITY;
}

// Fleet cap: yards support 2 each; the Great Temple counts as a yard (§14.7.6).
function fleetCap(state, side) {
  let cap = state.greatTemple[side].hp > 0 ? CONFIG.Yard.GREAT_TEMPLE_SUPPORTS : 0;
  for (const st of state.structures) {
    if (st.owner === side && st.type === 'yard' && st.hp > 0 && st.buildProgress >= 1) cap += CONFIG.Yard.SUPPORTS;
  }
  return cap;
}
