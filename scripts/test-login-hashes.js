const bcrypt = require('bcryptjs');
const db = require('../backend/config/db');

const checks = [
  { role: 'Uni Admin', email: 'admin@riphah.edu.pk', password: 'Salam123' },
  { role: 'Sys Admin', email: 'sysadmin@riphah.edu.pk', password: 'Salam321' },
  { role: 'Student', email: 'student@riphah.edu.pk', password: 'password' },
  { role: 'Company', email: 'company@techcorp.com', password: 'password' }
];

(async () => {
  try {
    for (const c of checks) {
      const [rows] = await db.execute('SELECT id, email, password, role, accountStatus, status FROM users WHERE LOWER(email)=LOWER(?) LIMIT 1', [c.email]);
      if (!rows.length) {
        console.log(`${c.role} - ${c.email}: NOT FOUND`);
        continue;
      }
      const user = rows[0];
      const ok = bcrypt.compareSync(c.password, user.password);
      console.log(`${c.role} - ${c.email}: found id=${user.id}, role=${user.role}, accountStatus=${user.accountStatus||''}, status=${user.status||''} => password match: ${ok}`);
    }
    process.exit(0);
  } catch (err) {
    console.error('Error testing logins:', err.message || err);
    process.exit(2);
  }
})();
