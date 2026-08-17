// Grade the evolved Poseidon population into a difficulty LADDER
// (player-directed: "save a range of genomes and actively match the
// skill of the current player"). Each candidate plays the champion
// Aeolus across seeds; tiers are chosen by the champion's win-rate
// against them: GENTLE ~85%, FAIR ~60%, STERN ~35%, CRUEL ~15%.
// usage: node test/opt_ladder.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { scaleP } = require('./ga_lib');

const POPF = JSON.parse(fs.readFileSync(path.join(__dirname, 'poseidon_pop.json'), 'utf8'));
const CHAMPION = JSON.parse(fs.readFileSync(path.join(__dirname, 'best_genome.json'), 'utf8')).genome;
const SEEDS = ['simtest1', 'optb', 'optc', 'w9iwff', 'census2', 'evoz'];
const NW = Math.max(2, Math.min(8, os.cpus().length - 2));

// candidates: the tracked best, every distinct member of the final
// population, and a couple of hand-softened variants of the best for
// the gentle end (evolution only breeds killers)
const soften = (g, f) => g.map((v, i) => v * f + (1 - f) * 0.5);
const candidates = [POPF.best.g, ...POPF.scored.map(x => x.genome),
  soften(POPF.best.g, 0.4), soften(POPF.best.g, 0.15)];
const sig = (g) => g.map(v => Math.round(v * 50)).join(',');
const seen = new Set();
const distinct = candidates.filter(g => { const s = sig(g); if (seen.has(s)) return false; seen.add(s); return true; });
console.log(distinct.length, 'distinct candidates x', SEEDS.length, 'seeds');

function evalAll(genomes) {
  const jobs = genomes.map((genome, idx) => ({ idx, genome, seeds: SEEDS }));
  const chunks = Array.from({ length: NW }, () => []);
  jobs.forEach((j, i) => chunks[i % NW].push(j));
  const tmp = path.join(os.tmpdir(), 'wind-lad-' + process.pid + '-');
  return Promise.all(chunks.filter(c => c.length).map((chunk, ci) => new Promise((res, rej) => {
    const f = tmp + ci + '.json';
    fs.writeFileSync(f, JSON.stringify({ jobs: chunk, champion: CHAMPION, maxT: 600 }));
    execFile('node', [path.join(__dirname, 'ga_worker_p.js'), f],
      { maxBuffer: 16 * 1024 * 1024, timeout: 40 * 60 * 1000 },
      (err, stdout) => {
        try { fs.unlinkSync(f); } catch (e) { }
        if (err) return rej(err);
        res(JSON.parse(stdout));
      });
  }))).then(parts => {
    const byIdx = new Map(parts.flat().map(r => [r.idx, r]));
    return genomes.map((g, i) => ({ g, ...byIdx.get(i) }));
  });
}

(async () => {
  const scored = await evalAll(distinct);
  // fitnessP is the difficulty proxy: higher = harder Poseidon
  // (outs: w=player felled, j=judged for P, s=settled for player,
  //  v=player killed his Great Temple)
  const rows = scored.map(x => ({ g: x.g, fit: x.fit, outs: x.outs }));
  rows.sort((a, b) => a.fit - b.fit);
  console.log('fitness spectrum:', rows.map(r => Math.round(r.fit)).join(', '));
  const pickAt = (frac) => rows[Math.max(0, Math.min(rows.length - 1, Math.round(frac * (rows.length - 1))))];
  const tiers = [
    { name: 'GENTLE', row: pickAt(0.05) },
    { name: 'FAIR', row: pickAt(0.35) },
    { name: 'STERN', row: pickAt(0.7) },
    { name: 'CRUEL', row: rows[rows.length - 1] }
  ];
  const out = tiers.map(t => ({
    name: t.name,
    fitnessP: Math.round(t.row.fit),
    outs: t.row.outs,
    overrides: scaleP(t.row.g)
  }));
  for (const t of out) {
    console.log(t.name, 'fitP', t.fitnessP, 'outs', t.outs.join(','));
    console.log('  ', JSON.stringify(t.overrides, (k, v) => typeof v === 'number' ? Math.round(v * 100) / 100 : v));
  }
  fs.writeFileSync(path.join(__dirname, 'poseidon_ladder.json'), JSON.stringify(out, null, 1));
  console.log('wrote test/poseidon_ladder.json');
})().catch(e => { console.error(e); process.exit(1); });
