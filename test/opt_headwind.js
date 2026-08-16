// Sweep: how hard should headwinds punish? AIR_MIN/AIR_MAX widen the
// with-wind vs against-wind speed spread. usage: node test/opt_headwind.js
'use strict';
const { sweep } = require('./opt_lib');

sweep([
  { lo: 0.70, hi: 1.35 },   // current
  { lo: 0.55, hi: 1.45 },
  { lo: 0.40, hi: 1.55 }
].map(v => ({
  label: `air ${v.lo}-${v.hi}`,
  patches: [
    [/AIR_MIN: [\d.]+/, 'AIR_MIN: ' + v.lo],
    [/AIR_MAX: [\d.]+/, 'AIR_MAX: ' + v.hi]
  ]
})));
