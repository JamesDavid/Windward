// The two wind-law knobs, never swept: how much of the band is closed
// to planning (HAULER_MIN_FRAC) and how strongly a side's own bound
// channels are floored (BOUND_CHANNEL_FRAC).
// usage: node test/opt_windlaw.js
'use strict';
const { sweep } = require('./opt_lib');

const cells = [];
for (const min of [0.15, 0.28, 0.4]) {
  for (const bound of [0.25, 0.4, 0.55]) {
    cells.push({
      label: 'minfrac ' + min + ' boundfrac ' + bound,
      patches: [
        [/HAULER_MIN_FRAC: [\d.]+/, 'HAULER_MIN_FRAC: ' + min],
        [/BOUND_CHANNEL_FRAC: [\d.]+/, 'BOUND_CHANNEL_FRAC: ' + bound]
      ]
    });
  }
}
console.log('==== wind law (closure frac x bound-channel floor frac) ====');
sweep(cells);
