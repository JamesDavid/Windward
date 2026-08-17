// Logistics tempo: ore flow rate x opening fleet, then dwell time and
// the AI's decision cadence. usage: node test/opt_tempo.js
'use strict';
const { sweep } = require('./opt_lib');

console.log('==== mining rate x starting haulers ====');
const cells = [];
for (const rate of [1.5, 2, 3]) {
  for (const n of [1, 2]) {
    cells.push({
      label: 'mine ' + rate + '/s haulers ' + n,
      patches: [
        [/RATE_PER_SECOND: [\d.]+/, 'RATE_PER_SECOND: ' + rate],
        [/START_COUNT: \d+/, 'START_COUNT: ' + n]
      ]
    });
  }
}
sweep(cells);

console.log('==== hauler dwell seconds ====');
sweep([2, 4, 6].map(d => ({
  label: 'dwell ' + d + 's',
  patches: [[/DWELL_SECONDS: [\d.]+/, 'DWELL_SECONDS: ' + d.toFixed(1)]]
})));

console.log('==== AI decision interval ====');
sweep([1.2, 2, 3.5].map(d => ({
  label: 'ai decide ' + d + 's',
  patches: [[/DECISION_INTERVAL: [\d.]+/, 'DECISION_INTERVAL: ' + d.toFixed(1)]]
})));
