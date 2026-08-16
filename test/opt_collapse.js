// Sweep: collapse tempo (seconds per segment of the unbinding march).
// usage: node test/opt_collapse.js
'use strict';
const { sweep } = require('./opt_lib');

sweep([1.5, 2.0, 2.5, 3.0].map(v => ({
  label: 'segment interval ' + v,
  patches: [[/SEGMENT_INTERVAL: [\d.]+/, 'SEGMENT_INTERVAL: ' + v]]
})));
