// Genetic search for the best Air-Guild strategy vs Poseidon
// (player-directed). Tournament selection, uniform crossover, gaussian
// mutation, elitism; seeds rotate per generation to resist overfitting;
// evaluation fans out across worker processes. Writes the champion to
// test/best_genome.json with a holdout validation.
// usage: node test/opt_evolve.js [generations] [population] [workers]
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { GENE_KEYS, scale, randomGenome } = require('./ga_lib');

const GENS = parseInt(process.argv[2] || '14', 10);
const POP = parseInt(process.argv[3] || '18', 10);
const NW = parseInt(process.argv[4] || String(Math.max(2, Math.min(8, os.cpus().length - 2))), 10);
const ELITE = 2, TOURN = 3, MUT_RATE = 0.3, MUT_SIGMA = 0.18, MAX_T = 600;

let s = 1234567;
const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };

const TRAIN_SEEDS = ['optb', 'optc', 'evoa', 'evob', 'evoc', 'evod', 'evoe', 'w9iwff'];
const VALIDATE_SEEDS = ['simtest1', 'optb', 'optc', 'w9iwff', 'census2', 'evoz'];

function evalPopulation(genomes, seeds) {
  const jobs = genomes.map((genome, idx) => ({ idx, genome, seeds }));
  const chunks = Array.from({ length: NW }, () => []);
  jobs.forEach((j, i) => chunks[i % NW].push(j));
  const tmp = path.join(os.tmpdir(), 'wind-ga-' + process.pid + '-');
  return Promise.all(chunks.filter(c => c.length).map((chunk, ci) => new Promise((res, rej) => {
    const f = tmp + ci + '.json';
    fs.writeFileSync(f, JSON.stringify({ jobs: chunk, maxT: MAX_T }));
    execFile('node', [path.join(__dirname, 'ga_worker.js'), f],
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

const CKPT = path.join(__dirname, 'ga_checkpoint.json');

(async () => {
  let pop = [];
  let startGen = 0;
  let best = null;
  if (fs.existsSync(CKPT)) {
    // resume a prior run: population, generation, rng state, best
    const ck = JSON.parse(fs.readFileSync(CKPT, 'utf8'));
    pop = ck.pop; startGen = ck.gen; best = ck.best; s = ck.rngState;
    console.log('resumed checkpoint at gen', startGen);
  }
  for (let i = pop.length; i < POP; i++) pop.push(randomGenome(rng));
  // one baseline individual shaped like the current demo player
  // (fresh runs only — never clobber a resumed elite)
  if (startGen === 0) {
    pop[0] = GENE_KEYS.map(k => ({
      vaneTime: 0.13, gunEvery: 0.55, gunReserve: 0.2, junctionBonus: 0.4,
      expandBias: 0.2, offenseAt: 0.9, defVanes: 0.2, shieldUse: 0.2,
      wallUse: 0.8, tailwindUse: 0.8, hydrogenAt: 0.4, haulerTarget: 0.5,
      templeBudget: 0.3, pushSpacing: 0.5
    }[k]));
  }

  const t0 = Date.now();
  for (let gen = startGen; gen < GENS; gen++) {
    const seeds = ['simtest1',
      TRAIN_SEEDS[(gen * 2) % TRAIN_SEEDS.length],
      TRAIN_SEEDS[(gen * 2 + 1) % TRAIN_SEEDS.length]];
    const scored = await evalPopulation(pop, seeds);
    scored.sort((a, b) => b.fit - a.fit);
    if (!best || scored[0].fit > best.trainFit) best = { g: scored[0].g.slice(), trainFit: scored[0].fit };
    console.log('gen ' + gen, 'best', Math.round(scored[0].fit),
      'median', Math.round(scored[Math.floor(POP / 2)].fit),
      'outs', scored[0].outs.join(','),
      '(' + Math.round((Date.now() - t0) / 60000) + 'min)');
    console.log('   genes', JSON.stringify(scale(scored[0].g), (k, v) => typeof v === 'number' ? Math.round(v * 100) / 100 : v));
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

  console.log('==== validation on ' + VALIDATE_SEEDS.join(', ') + ' ====');
  const finalists = pop.slice(0, ELITE).concat([best.g]);
  const vals = await evalPopulation(finalists, VALIDATE_SEEDS);
  let champ = null;
  for (const v of vals) {
    console.log('finalist fit', Math.round(v.fit), 'outs', v.outs.join(','));
    if (!champ || v.fit > champ.fit) champ = v;
  }
  console.log('CHAMPION fit', Math.round(champ.fit), 'outs', champ.outs.join(','));
  console.log('CHAMPION genes', JSON.stringify(scale(champ.g), (k, v) => typeof v === 'number' ? Math.round(v * 100) / 100 : v));
  fs.writeFileSync(path.join(__dirname, 'best_genome.json'), JSON.stringify({
    genome: champ.g, scaled: scale(champ.g), fitness: champ.fit, outs: champ.outs, geneKeys: GENE_KEYS
  }, null, 2));
  console.log('wrote test/best_genome.json');
  try { fs.unlinkSync(CKPT); } catch (e) { }
})().catch(e => { console.error(e); process.exit(1); });
