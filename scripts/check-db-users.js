require('dotenv').config();
const db = require('../backend/config/db');

(async function(){
  try {
    const [rows] = await db.execute('SELECT id, name, email, role FROM users LIMIT 50');
    if (!rows.length) {
      console.log('No users found in `users` table.');
      process.exit(0);
    }
    console.log('Users in database:');
    rows.forEach(r => console.log(`- ${r.id}: ${r.name} <${r.email}> (${r.role})`));
    process.exit(0);
  } catch (err) {
    console.error('Error querying users table:', err.message || err);
    console.error('Check that MySQL is running and .env DB_* values are correct.');
    process.exit(2);
  }
})();
