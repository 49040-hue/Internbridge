const fs = require('fs');
const vm = require('vm');
const path = require('path');
const rel = 'frontend/js/company.js';
const p = path.join(process.cwd(), rel);
const src = fs.readFileSync(p, 'utf8');
const lines = src.split('\n');
let low = 1, high = lines.length;
let failLine = -1;
while (low <= high) {
  const mid = Math.floor((low + high) / 2);
  const segment = lines.slice(0, mid).join('\n');
  try {
    new vm.Script(segment, { filename: rel });
    // parse OK up to mid lines
    low = mid + 1;
  } catch (e) {
    // parse failed at or before mid
    failLine = mid;
    high = mid - 1;
  }
}
if (failLine === -1) {
  console.log('No parse error detected by binary search (file may parse fully)');
} else {
  console.log('Earliest failing line approx:', failLine);
  // print some context
  const start = Math.max(1, failLine - 8);
  const end = Math.min(lines.length, failLine + 4);
  for (let i = start; i <= end; i++) console.log(i + ': ' + lines[i-1]);
}
