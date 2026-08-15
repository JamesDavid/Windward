'use strict';
const { loadSandbox } = require('./harness');
const G = loadSandbox(['01_config.js', '02_util.js', '03_wind.js', '04_mapgen.js']);

for (let n = 0; n < 40; n++) {
  const rng = G.mulberry32(G.hashString('viz:' + n));
  const map = G.generateOnce(rng);
  if (!map) continue;
  const v = G.validateMap(map);
  console.log('--- nonce', n, 'fails:', v.fails.join(' ') || 'NONE');
  const G2 = G.CONFIG.Grid;
  const roleChar = {};
  map.islands.forEach(i => {
    const c = { greatTempleA: 'A', greatTempleP: 'P', supplyA: 's', supplyP: 'S', neutralA: 'n', neutralP: 'N', sacredA: 'x', sacredP: 'X', chokepoint: 'C' }[i.role];
    for (const [cx, cz] of i.cells) roleChar[cx + ',' + cz] = c;
  });
  for (let z = 0; z < G2.HEIGHT; z++) {
    let row = '';
    for (let x = 0; x < G2.WIDTH; x++) row += roleChar[x + ',' + z] || '.';
    console.log(row);
  }
  // circuit numbers
  const gtA = map.islands.find(i => i.role === 'greatTempleA');
  const exposed = map.islands[map.exposedIslandId];
  console.log('exposed:', exposed.role, 'gtA temple:', gtA.templeCell);
  if (n >= 6) break;
}
