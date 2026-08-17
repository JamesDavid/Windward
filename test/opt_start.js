// Starting-currency grid: how much Supply and Favor the match opens
// with. usage: node test/opt_start.js
'use strict';
const { sweep } = require('./opt_lib');

const cells = [];
for (const s of [40, 70, 100, 140]) {
  for (const f of [40, 70, 100, 140]) {
    cells.push({
      label: 'start supply ' + s + ' favor ' + f,
      patches: [[/START_SUPPLY: \d+, START_FAVOR: \d+/, 'START_SUPPLY: ' + s + ', START_FAVOR: ' + f]]
    });
  }
}
console.log('==== starting currency (supply x favor) ====');
sweep(cells);
