// Local dev loop: `node serve.js` then open http://localhost:8080
// Serves the repo, rebuilds index.html whenever src/ or shell.html
// changes — refresh the browser to see it. Node stdlib only.
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif',
  '.json': 'application/json', '.md': 'text/plain'
};

function rebuild(why) {
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'build.js')], { stdio: 'inherit' });
    console.log('[serve] rebuilt (' + why + ')');
  } catch (e) {
    console.error('[serve] BUILD FAILED — fix it and save again');
  }
}

rebuild('startup');

// watch src/ and shell.html, debounced (editors fire multiple events)
let timer = null;
const queue = (why) => {
  clearTimeout(timer);
  timer = setTimeout(() => rebuild(why), 150);
};
fs.watch(path.join(ROOT, 'src'), (ev, file) => queue('src/' + file));
fs.watch(path.join(ROOT, 'shell.html'), () => queue('shell.html'));

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store'   // always the freshest build
    });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log('[serve] WINDWARD dev server: http://localhost:' + PORT);
  console.log('[serve] watching src/ and shell.html — refresh after saving');
});
