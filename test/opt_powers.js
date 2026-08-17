// Divine-power pricing and the hydrogen refit — sweepable now that the
// trial player actually casts and buys. usage: node test/opt_powers.js
'use strict';
const { sweep } = require('./opt_lib');

console.log('==== tailwind favor x wind wall favor ====');
const cells = [];
for (const tw of [2, 3, 5]) {
  for (const ww of [3, 4, 6]) {
    cells.push({
      label: 'tailwind ' + tw + ' wall ' + ww,
      patches: [
        [/TAILWIND:  \{ FAVOR: \d+/, 'TAILWIND:  { FAVOR: ' + tw],
        [/WIND_WALL: \{ FAVOR: \d+/, 'WIND_WALL: { FAVOR: ' + ww]
      ]
    });
  }
}
sweep(cells);

console.log('==== hydrogen refit price ====');
sweep([[15, 4], [25, 6], [40, 10]].map(([s, f]) => ({
  label: 'hydrogen ' + s + '+' + f,
  patches: [[/Tech: \{ HYDROGEN_COST_SUPPLY: \d+, HYDROGEN_COST_FAVOR: \d+ \}/,
    'Tech: { HYDROGEN_COST_SUPPLY: ' + s + ', HYDROGEN_COST_FAVOR: ' + f + ' }']]
})));
