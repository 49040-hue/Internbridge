const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'frontend/js/company.js');
const src = fs.readFileSync(p, 'utf8');
let count = 0;
const positions = [];
for (let i = 0; i < src.length; i++) {
  if (src[i] === '`') {
    count++;
    const before = src.slice(0, i);
    const line = before.split('\n').length;
    positions.push({index: i, line});
  }
}
console.log('Total backticks:', count);
positions.forEach(p => console.log('` at line', p.line, 'index', p.index));
