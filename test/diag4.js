'use strict';
const { loadSandbox } = require('./harness');
const G = loadSandbox(['01_config.js', '02_util.js', '03_wind.js', '04_mapgen.js']);
const MG = G.CONFIG.MapGen;

let shown = 0;
for (let s = 0; s < 60 && shown < 4; s++) {
  const rng = G.mulberry32(G.hashString('g' + s));
  const map = G.generateOnce(rng);
  if (!map) continue;
  const v = G.validateMap(map);
  if (!v.fails.some(f => f.startsWith('exposed'))) continue;
  shown++;
  const gtA = map.islands.find(i => i.role === 'greatTempleA');
  const choke = map.islands.find(i => i.role === 'chokepoint');
  const target = new Set(choke.cells.map(([x, z]) => G.cellKey(x, z)));
  const direct = G.bfsDistance([gtA.templeCell], target, null);
  const safe = G.safePathLength(map, [gtA.templeCell], target, MG.SAFE_ROUTE_OVERWATER_MAX);
  console.log('--- seed g' + s, 'fails:', v.fails.join(' '));
  console.log('choke: direct', direct, 'safe', safe, 'need>=', (direct * MG.SAFE_ROUTE_LENGTH_MULT).toFixed(1), 'temple@', gtA.templeCell);
  const roleChar = {};
  map.islands.forEach(i => {
    const c = { greatTempleA: 'A', greatTempleP: 'P', supplyA: 's', supplyP: 'S', neutralA: 'n', neutralP: 'N', sacredA: 'x', sacredP: 'X', chokepoint: 'C' }[i.role];
    for (const [cx, cz] of i.cells) roleChar[cx + ',' + cz] = c;
  });
  for (let z = 0; z < G.CONFIG.Grid.HEIGHT; z++) {
    let row = '';
    for (let x = 0; x < G.CONFIG.Grid.WIDTH; x++) row += roleChar[x + ',' + z] || '.';
    console.log(row);
  }
}
