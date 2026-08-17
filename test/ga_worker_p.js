// Poseidon-evolution worker: evaluates a slice of P genomes against the
// CHAMPION Aeolus. Job file: {jobs: [{idx, genome, seeds}], champion, maxT}.
'use strict';
const fs = require('fs');
const { runMatch, fitnessP, scaleP, loadPatched } = require('./ga_lib');

const { jobs, champion, maxT } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = [];
for (const job of jobs) {
  let total = 0;
  const outs = [];
  const overrides = scaleP(job.genome);
  for (const seed of job.seeds) {
    const G = loadPatched([]);
    const r = runMatch(G, seed, champion, maxT, overrides);
    total += fitnessP(r);
    // from Poseidon's chair: w = player felled, j = judged for P,
    // s = judged (settled) for the player, v = player killed his GT
    outs.push(r.outcome === 'lose' ? 'w' + Math.round(r.t)
      : r.outcome === 'arbitrationLoss' ? 'j'
      : r.outcome === 'arbitration' ? 's'
      : r.outcome === 'win' ? 'v' : r.outcome[0]);
  }
  out.push({ idx: job.idx, fit: total / job.seeds.length, outs });
}
process.stdout.write(JSON.stringify(out));
