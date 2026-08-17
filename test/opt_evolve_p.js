// Genetic search for POSEIDON against the champion Aeolus (player-
// directed: "genetically evolve posiedon against the genetically
// evolved Aeolus and then save a range of genomes"). Same GA shape as
// opt_evolve.js; writes the final scored population (the raw material
// for the difficulty ladder) to test/poseidon_pop.json.
// usage: node test/opt_evolve_p.js [generations] [population] [workers]
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { P_KEYS, scaleP } = require('./ga_lib');

const GENS = parseInt(process.argv[2] || '12', 10);
const POP = parseInt(process.argv[3] || '16', 10);
const NW = parseInt(process.argv[4] || String(Math.max(2, Math.min(8, os.cpus().length - 2))), 10);
const ELITE = 2, TOURN = 3, MUT_RATE = 0.3, MUT_SIGMA = 0.18, MAX_T = 600;

const CHAMPION = JSON.parse(fs.readFileSync(path.join(__dirname, 'best_genome.json'), 'utf8')).genome;

let s = 424242;
const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

const TRAIN_SEEDS = ['optb', 'optc', 'evoa', 'evob', 'evoc', 'evod', 'evoe', 'w9iwff'];

function evalPopulation(genomes, seeds) {
  const jobs = genomes.map((genome, idx) => ({ idx, genome, seeds }));
  const chunks = Array.from({ length: NW }, () => []);
  jobs.forEach((j, i) => chunks[i % NW].push(j));
  const tmp = path.join(os.tmpdir(), 'wind-gap-' + process.pid + '-');
  return Promise.all(chunks.filter(c => c.length).map((chunk, ci) => new Promise((res, rej) => {
    const f = tmp + ci + '.json';
    fs.writeFileSync(f, JSON.stringify({ jobs: chunk, champion: CHAMPION, maxT: MAX_T }));
    execFile('node', [path.join(__dirname, 'ga_worker_p.js'), f],
      { maxBuffer: 16 * 1024 * 1024, timeout: 30 * 60 * 1000 },
      (err, stdout) => {
        try { fs.unlinkSync(f); } catch (e) { }
        if (err) return rej(err);
        res(JSON.parse(stdout));
      });
  }))).then(parts => {
    const flat = parts.flat();
    const byIdx = new Map(flat.map(r => [r.idx, r]));
    return genomes.map((g, i) => ({ g, fit: byIdx.get(i).fit, outs: byIdx.get(i).outs }));
  });
}

const CKPT = path.join(__dirname, 'ga_p_checkpoint.json');

(async () => {
  let pop = [];
  let startGen = 0;
  let best = null;
  if (fs.existsSync(CKPT)) {
    const ck = JSON.parse(fs.readFileSync(CKPT, 'utf8'));
    pop = ck.pop; startGen = ck.gen; best = ck.best; s = ck.rngState;
    console.log('resumed checkpoint at gen', startGen);
  }
  for (let i = pop.length; i < POP; i++) pop.push(P_KEYS.map(() => rng()));
  // one baseline = the shipped defaults (all knobs at their config values)
  if (startGen === 0) {
    pop[0] = P_KEYS.map(k => ({
      DECISION_INTERVAL: 0.29, PLACE_INTERVAL: 0.32, GARRISON_DRUMS: 0.5,
      GARRISON_LANCES: 0.4, GUN_CADENCE: 0.5, GUN_NEAR: 0.6, MAST_INTERVAL: 0.33,
      TOWARD_PLAYER_BIAS: 0.29, ORE_BIAS: 0.41, WAVE_STRENGTH_MULT: 0.42, WAVE_INTERVAL_MULT: 0.43
    }[k]));
  }

  const t0 = Date.now();
  let lastScored = null;
  for (let gen = startGen; gen < GENS; gen++) {
    const seeds = ['simtest1',
      TRAIN_SEEDS[(gen * 2) % TRAIN_SEEDS.length],
      TRAIN_SEEDS[(gen * 2 + 1) % TRAIN_SEEDS.length]];
    const scored = await evalPopulation(pop, seeds);
    scored.sort((a, b) => b.fit - a.fit);
    lastScored = scored;
    if (!best || scored[0].fit > best.trainFit) best = { g: scored[0].g.slice(), trainFit: scored[0].fit };
    console.log('gen ' + gen, 'best', Math.round(scored[0].fit),
      'median', Math.round(scored[Math.floor(POP / 2)].fit),
      'outs', scored[0].outs.join(','),
      '(' + Math.round((Date.now() - t0) / 60000) + 'min)');
    console.log('   knobs', JSON.stringify(scaleP(scored[0].g), (k, v) => typeof v === 'number' ? Math.round(v * 100) / 100 : v));
    const next = scored.slice(0, ELITE).map(x => x.g.slice());
    while (next.length < POP) {
      const pick = () => {
        let b = null;
        for (let i = 0; i < TOURN; i++) {
          const c = scored[Math.floor(rng() * POP)];
          if (!b || c.fit > b.fit) b = c;
        }
        return b.g;
      };
      const a = pick(), b2 = pick();
      const child = a.map((v, i) => (rng() < 0.5 ? v : b2[i]));
      for (let i = 0; i < child.length; i++) {
        if (rng() < MUT_RATE) {
          const n = (rng() + rng() + rng() - 1.5) * 2 * MUT_SIGMA;
          child[i] = Math.min(1, Math.max(0, child[i] + n));
        }
      }
      next.push(child);
    }
    pop = next;
    fs.writeFileSync(CKPT, JSON.stringify({ pop, gen: gen + 1, best, rngState: s }));
  }

  // the raw material for the ladder: the whole final scored population
  fs.writeFileSync(path.join(__dirname, 'poseidon_pop.json'), JSON.stringify({
    scored: lastScored.map(x => ({ genome: x.g, trainFit: x.fit, outs: x.outs })),
    best: best,
    pKeys: P_KEYS
  }, null, 1));
  console.log('wrote test/poseidon_pop.json (best trainFit', Math.round(best.trainFit) + ')');
  try { fs.unlinkSync(CKPT); } catch (e) { }
})().catch(e => { console.error(e); process.exit(1); });
