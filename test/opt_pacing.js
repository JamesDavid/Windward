// Sweep: wave pacing multiplier on first-wave time and all intervals.
// usage: node test/opt_pacing.js
'use strict';
const { sweep } = require('./opt_lib');

sweep([0.8, 1.0, 1.25].map(m => ({
  label: 'pacing x' + m,
  patches: [
    [/FIRST_AT: [\d.]+/, 'FIRST_AT: ' + (45 * m).toFixed(1)],
    [/INTERVAL_EARLY: [\d.]+/, 'INTERVAL_EARLY: ' + (55 * m).toFixed(1)],
    [/INTERVAL_MID: [\d.]+/, 'INTERVAL_MID: ' + (45 * m).toFixed(1)],
    [/INTERVAL_LATE: [\d.]+/, 'INTERVAL_LATE: ' + (35 * m).toFixed(1)]
  ]
})));
