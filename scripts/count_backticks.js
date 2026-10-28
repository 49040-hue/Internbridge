const fs = require('fs');
const path = 'frontend/js/company.js';
try {
  const s = fs.readFileSync(path, 'utf8');
  const count = s.split('`').length - 1;
  console.log('backtick count:', count);
} catch (e) {
  console.error('error reading file', e.message);
  process.exit(1);
}
