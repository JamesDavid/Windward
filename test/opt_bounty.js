// Kill-bounty scale: how much Favor a craft kill pays the defender.
// usage: node test/opt_bounty.js
'use strict';
const { sweep } = require('./opt_lib');

console.log('==== craft bounty scale ====');
sweep([0.5, 1, 2].map(m => ({
  label: 'bounty x' + m,
  patches: [[/CRAFT_FAVOR: \{ transport: \d+, siphon: \d+, heavy: \d+ \}/,
    'CRAFT_FAVOR: { transport: ' + Math.max(1, Math.round(2 * m)) +
    ', siphon: ' + Math.max(1, Math.round(3 * m)) +
    ', heavy: ' + Math.max(1, Math.round(5 * m)) + ' }']]
})));
