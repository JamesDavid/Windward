// Loads src files into one sandbox so pure game logic runs headlessly in node.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadSandbox(files) {
  const sandbox = { console, Math, Date, Infinity, NaN };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const srcDir = path.join(__dirname, '..', 'src');
  for (const f of files) {
    const code = fs.readFileSync(path.join(srcDir, f), 'utf8');
    vm.runInContext(code, sandbox, { filename: f });
  }
  // top-level const/class bindings don't attach to the sandbox object; export the known ones
  vm.runInContext(
    'for (const n of ["CONFIG","MAP_ZONES","Events","WindField","DIRS4"]) ' +
    '{ try { globalThis[n] = eval(n); } catch (e) {} }',
    sandbox);
  return sandbox;
}

module.exports = { loadSandbox };
