// Evolution worker: evaluates a slice of genomes. Reads a JSON job file
// {jobs: [{idx, genome, seeds}], maxT}, prints one JSON line of results.
'use strict';
const fs = require('fs');
const { runMatch, fitness, loadPatched } = require('./ga_lib');

const { jobs, maxT, ddaStartTier } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = [];
for (const job of jobs) {
  let total = 0;
  const outs = [];
  for (const seed of job.seeds) {
    const G = loadPatched([]);
    const r = runMatch(G, seed, job.genome, maxT, null, ddaStartTier);
    total += fitness(r);
    outs.push(r.outcome[0] + (r.outcome === 'win' ? Math.round(r.t) : ''));
  }
  out.push({ idx: job.idx, fit: total / job.seeds.length, outs });
}
process.stdout.write(JSON.stringify(out));
