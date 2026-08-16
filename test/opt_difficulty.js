// 2D sweep: wave difficulty ramp x gun-vs-lane cutting power.
// Ramp = (STRENGTH_PER_TEMPLE, STRENGTH_MAX) raised together so the cap
// doesn't mute the per-temple knob. usage: node test/opt_difficulty.js
'use strict';
const { sweep } = require('./opt_lib');

const RAMPS = [
  { pt: 0.10, max: 1.2 },
  { pt: 0.15, max: 1.4 },   // current
  { pt: 0.22, max: 1.7 },
  { pt: 0.30, max: 2.0 }
];
const GUN_MULTS = [0.30, 0.45, 0.65];   // 0.45 current

const cells = [];
for (const r of RAMPS) {
  for (const g of GUN_MULTS) {
    cells.push({
      label: `ramp ${r.pt}/${r.max} gun ${g}`,
      patches: [
        [/STRENGTH_PER_TEMPLE: [\d.]+/, 'STRENGTH_PER_TEMPLE: ' + r.pt],
        [/STRENGTH_MAX: [\d.]+/, 'STRENGTH_MAX: ' + r.max],
        [/GUN_VS_SEGMENT_MULT: [\d.]+/, 'GUN_VS_SEGMENT_MULT: ' + g]
      ]
    });
  }
}
sweep(cells);
