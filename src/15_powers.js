// ================================================================
// DIVINE POWERS — Aeolus' two petitions (§19.1, §33A.8).
// Tailwind speeds the fleet for a spell; Wind Wall shelters one
// exposed endpoint. Poseidon's powers live in the wave system.
// ================================================================

function castTailwind(state) {
  const P = CONFIG.Powers.TAILWIND;
  if (state.res.A.favor < P.FAVOR) return false;
  if (state.time < state.powers.tailwindUntil) return false;
  state.res.A.favor -= P.FAVOR;
  state.powers.tailwindUntil = state.time + P.DURATION;
  Events.emit('tailwind', {});
  return true;
}

// armed by the button, then aimed with a tap on one of your endpoint
// structures or route ends
function castWindWall(state, cell) {
  const P = CONFIG.Powers.WIND_WALL;
  if (state.res.A.favor < P.FAVOR) return false;
  state.res.A.favor -= P.FAVOR;
  state.powers.windwallUntil = state.time + P.DURATION;
  state.powers.windwallCell = cell.slice();
  Events.emit('windwall', { cell });
  return true;
}
