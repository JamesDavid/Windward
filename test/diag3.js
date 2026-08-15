'use strict';
const { loadSandbox } = require('./harness');
const G = loadSandbox(['01_config.js', '02_util.js', '03_wind.js', '04_mapgen.js']);
const vm = require('vm');

// instrument grow failures by patching generateOnce via string eval is messy;
// instead replicate the exposed check with detail on real maps.
const MG = G.CONFIG.MapGen;
const detail = {};
let genOk = 0, N = 0;
for (let s = 0; s < 60; s++) {
  for (let nonce = 0; nonce < 5; nonce++) {
    N++;
    const rng = G.mulberry32(G.hashString('e' + s + ':' + nonce));
    const map = G.generateOnce(rng);
    if (!map) continue;
    genOk++;
    const gtA = map.islands.find(i => i.role === 'greatTempleA');
    for (const candidate of map.exposedPreference) {
      const isl = map.islands[candidate];
      const target = new Set(isl.cells.map(([x, z]) => G.cellKey(x, z)));
      const directLen = G.bfsDistance([gtA.templeCell], target, null);
      const sheltered = G.safePathLength(map, [gtA.templeCell], target, MG.EXPOSED_OVERWATER_MIN - 1);
      const safe = G.safePathLength(map, [gtA.templeCell], target, MG.SAFE_ROUTE_OVERWATER_MAX);
      let why = 'PASS';
      if (directLen < 0) why = 'no-direct';
      else if (sheltered >= 0 && sheltered <= directLen) why = 'sheltered-cheap';
      else if (safe < 0) why = 'no-safe';
      else if (safe < directLen * MG.SAFE_ROUTE_LENGTH_MULT) why = 'safe-too-short(' + safe + '/' + directLen + ')';
      const key = isl.role + ':' + why.replace(/\(.*/, '');
      detail[key] = (detail[key] || 0) + 1;
    }
  }
}
console.log({ N, genOk, detail });
