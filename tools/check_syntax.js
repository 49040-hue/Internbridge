const fs = require('fs');
const path = require('path');
const files = [
  'frontend/js/api.js',
  'frontend/js/auth.js',
  'frontend/js/app.js',
  'frontend/js/student.js',
  'frontend/js/company.js',
  'frontend/js/university.js',
  'frontend/js/sysadmin.js'
];
const root = process.cwd();
let ok = true;
for (const rel of files) {
  const p = path.join(root, rel);
  try {
    const src = fs.readFileSync(p, 'utf8');
    new Function(src);
    console.log(`${rel}: OK`);
  } catch (e) {
    console.error(`${rel}: PARSE ERROR: ${e && e.message}`);
    ok = false;
  }
}
process.exit(ok ? 0 : 1);
