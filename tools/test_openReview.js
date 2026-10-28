const fs = require('fs');
const vm = require('vm');
const path = require('path');
const rel = 'frontend/js/company.js';
const p = path.join(process.cwd(), rel);
const src = fs.readFileSync(p, 'utf8');
const start = src.indexOf('function openReviewModal');
const endMarker = 'async function reviewApplication';
const end = src.indexOf(endMarker, start);
if (start === -1 || end === -1) { console.error('Markers not found'); process.exit(1); }
const snippet = src.slice(start, end);
console.log('Snippet:');
console.log(snippet);
try {
  new vm.Script(snippet, { filename: rel });
  console.log('Snippet parsed OK');
} catch (e) {
  console.error('Snippet parse error:');
  console.error(e.stack);
}
