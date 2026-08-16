// Two independent 1D cost sweeps: player defense-structure costs
// (vane/bolt/aegis together) and hauler cost. usage: node test/opt_costs.js
'use strict';
const { sweep } = require('./opt_lib');

console.log('==== defense cost multiplier (vane 7 / bolt 10 / aegis 12 scaled) ====');
sweep([0.7, 1.0, 1.3].map(m => ({
  label: 'defense x' + m,
  patches: [
    [/VANE:     \{ COST: \d+/, 'VANE:     { COST: ' + Math.round(7 * m)],
    [/BOLT_DIR: \{ COST: \d+/, 'BOLT_DIR: { COST: ' + Math.round(10 * m)],
    [/AEGIS:    \{ COST: \d+/, 'AEGIS:    { COST: ' + Math.round(12 * m)]
  ]
})));

console.log('==== hauler cost ====');
sweep([5, 8, 12].map(c => ({
  label: 'hauler cost ' + c,
  patches: [[/COST: 8, BUILD_SECONDS: 6/, 'COST: ' + c + ', BUILD_SECONDS: 6']]
})));
