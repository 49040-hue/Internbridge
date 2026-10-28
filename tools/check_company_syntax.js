const fs = require('fs');
const vm = require('vm');
const path = require('path');
const rel = 'frontend/js/company.js';
const p = path.join(process.cwd(), rel);
try {
  const src = fs.readFileSync(p, 'utf8');
  new vm.Script(src, { filename: rel });
  console.log(rel + ': OK');
} catch (e) {
  console.error(rel + ': PARSE ERROR');
  console.error(e.stack);
  process.exit(1);
}
