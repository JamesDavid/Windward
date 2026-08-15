'use strict';
const { loadSandbox } = require('./harness');
const G = loadSandbox(['01_config.js', '02_util.js', '03_wind.js', '04_mapgen.js']);

const failCounts = {};
let genNull = 0, pass = 0, total = 0;
for (let s = 0; s < 30; s++) {
  for (let nonce = 0; nonce < 10; nonce++) {
    total++;
    const rng = G.mulberry32(G.hashString('d' + s + ':' + nonce));
    const once = G.generateOnce(rng);
    if (!once) { genNull++; continue; }
    const v = G.validateMap(once);
    if (v.ok) { pass++; continue; }
    for (const f of v.fails) {
      const tag = f.split(':')[0];
      failCounts[tag] = (failCounts[tag] || 0) + 1;
    }
  }
}
console.log({ total, pass, genNull, failCounts });
