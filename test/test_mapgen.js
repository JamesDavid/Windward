// Map generator checks: determinism, convergence rate, invariant coverage,
// and golden-seed search (run with --find-golden).
'use strict';
const { loadSandbox } = require('./harness');

const G = loadSandbox(['01_config.js', '02_util.js', '03_wind.js', '04_mapgen.js']);

function summarize(map) {
  return map.islands.map(i => `${i.role}@${i.center.map(v => v.toFixed(1)).join(',')}`).join(' ');
}

// 1. Determinism: same seed -> identical map.
{
  const a = G.generateMap('abc123');
  const b = G.generateMap('abc123');
  if (summarize(a) !== summarize(b) || a.nonce !== b.nonce) {
    console.error('FAIL determinism'); process.exit(1);
  }
  console.log('ok determinism (seed abc123, nonce', a.nonce + ')');
}

// 2. Convergence: how many random seeds resolve without golden fallback?
{
  let direct = 0, fallback = 0, dead = 0;
  const failCounts = {};
  const N = 200;
  for (let s = 0; s < N; s++) {
    const seed = 's' + s.toString(36);
    const map = G.generateMap(seed, false);
    if (map) { direct++; continue; }
    // count which invariants fail most, for tuning
    for (let nonce = 0; nonce < 3; nonce++) {
      const rng = G.mulberry32(G.hashString(seed + ':' + nonce));
      const once = G.generateOnce(rng);
      if (!once) { failCounts['gen-null'] = (failCounts['gen-null'] || 0) + 1; continue; }
      for (const f of G.validateMap(once).fails) {
        const tag = f.split(':')[0];
        failCounts[tag] = (failCounts[tag] || 0) + 1;
      }
    }
    fallback++;
  }
  console.log(`convergence: ${direct}/${N} seeds resolve directly, ${fallback} would fall back`);
  if (Object.keys(failCounts).length) console.log('  common failures:', failCounts);
  if (direct < N * 0.7) { console.error('FAIL convergence too low'); process.exit(1); }
}

// 3. Golden seed must pass without fallback.
{
  const map = G.generateMap(G.CONFIG.MapGen.GOLDEN_SEED, false);
  if (!map) {
    console.error('FAIL golden seed does not validate — search below');
    for (let i = 0; i < 5000; i++) {
      const seed = 'g' + i.toString(36);
      if (G.generateMap(seed, false)) { console.log('candidate golden seed:', seed); break; }
    }
    process.exit(1);
  }
  console.log('ok golden seed', G.CONFIG.MapGen.GOLDEN_SEED, '(nonce', map.nonce + ')');
}

console.log('mapgen: all checks passed');
