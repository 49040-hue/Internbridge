const fs = require('fs');
const path = require('path');
const rel = 'frontend/js/company.js';
const p = path.join(process.cwd(), rel);
const src = fs.readFileSync(p, 'utf8');
let inSingle=false, inDouble=false, inTemplate=false, escaped=false;
let templateExprDepth = 0;
let line = 1, col = 0;
for (let i=0;i<src.length;i++){
  const ch = src[i];
  col++;
  if (ch === '\n') { line++; col = 0; }
  if (escaped) { escaped = false; continue; }
  if (ch === '\\') { escaped = true; continue; }
  if (!inTemplate && !inSingle && !inDouble) {
    // detect comments start
    if (ch === '/' && src[i+1] === '/') {
      // skip to EOL
      while (i+1 < src.length && src[i+1] !== '\n') i++;
      continue;
    }
    if (ch === '/' && src[i+1] === '*') {
      i+=2; while (i < src.length && !(src[i]==='*' && src[i+1] === '/')) { if (src[i]==='\n') {line++; col=0;} i++; }
      i++; continue;
    }
  }
  if (inTemplate) {
    // inside template literal
    if (ch === '`' && templateExprDepth === 0) {
      inTemplate = false; // close template
      continue;
    }
    if (ch === '$' && src[i+1] === '{') {
      templateExprDepth++; i++; col++; continue;
    }
    if (templateExprDepth > 0) {
      // track braces inside expression, but ignore strings inside expression
      if (ch === '{') { templateExprDepth++; continue; }
      if (ch === '}') { templateExprDepth--; continue; }
      continue;
    }
    continue; // other chars inside template
  }
  // not in template
  if (!inSingle && !inDouble && ch === '`') { inTemplate = true; templateExprDepth = 0; continue; }
  if (!inDouble && ch === "'") { inSingle = !inSingle; continue; }
  if (!inSingle && ch === '"') { inDouble = !inDouble; continue; }
}
if (inTemplate) {
  console.log('Unclosed template literal starting before EOF. Last known location line', line, 'col', col);
} else {
  console.log('All template literals appear closed.');
}
