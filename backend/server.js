const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

let db;
try {
  db = require('./config/db');
} catch (err) {
  console.error('\nFailed to load database module (./config/db).');
  console.error('Error:', err.message || err);
  console.error('Ensure you have installed dependencies: run `npm install dotenv mysql2` in the project root.\n');
  process.exit(1);
}
// Ensure password_resets table exists on startup
(async () => {
  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS password_resets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      token VARCHAR(128) UNIQUE,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log('✅ password_resets table verified/created.');
  } catch (err) {
    console.error('❌ Error creating password_resets table:', err);
  }
})();

// Ensure users table has lockout columns
(async () => {
  try {
    await db.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INT DEFAULT 0");
    await db.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until DATETIME DEFAULT NULL");
    // Ensure uploadedFiles.base64 can store large files (LONGTEXT)
    db.execute('ALTER TABLE uploadedFiles MODIFY COLUMN base64 LONGTEXT')
      .then(() => console.log('✅ uploadedFiles base64 column ready'))
      .catch(() => {});
    // Ensure self_found_internships.offer_letter_doc can store long base64 payloads
    db.execute('ALTER TABLE self_found_internships MODIFY COLUMN offer_letter_doc LONGTEXT')
      .then(() => console.log('✅ self_found_internships.offer_letter_doc column adjusted'))
      .catch(() => {});
    console.log('✅ users table lockout columns verified/added.');
  } catch (err) {
    console.error('❌ Error adding lockout columns to users table:', err);
  }
})();
// Ensure internships table has override_reason column for admin override storage
(async () => {
  try {
    await db.execute("ALTER TABLE internships ADD COLUMN IF NOT EXISTS override_reason TEXT DEFAULT NULL");
    console.log('✅ internships.override_reason column verified/added.');
  } catch (err) {
    console.error('❌ Error adding override_reason column to internships table:', err);
  }
})();
// InternBridge v4 — Backend Server
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// Scheduled tasks
try {
  const cron = require('node-cron');
  // Run daily at 02:00 server time to close expired internships
  cron.schedule('0 2 * * *', async () => {
    try {
      console.log('[cron] Running daily job: closing expired internships');
      const [result] = await db.execute("UPDATE internships SET status = 'closed' WHERE deadline < NOW() AND status = 'open'");
      // result may vary by driver; log affectedRows if present
      if (result && (result.affectedRows !== undefined)) console.log(`[cron] Closed ${result.affectedRows} expired internships.`);
      else console.log('[cron] Daily close job completed.');
    } catch (err) {
      console.error('[cron] Error closing expired internships:', err);
    }
  }, { scheduled: true, timezone: process.env.CRONTZ || 'UTC' });
} catch (e) {
  console.warn('node-cron not available — scheduled job skipped. Install node-cron to enable daily cleanup.');
}

// Initialize email subsystem (verifies SMTP at startup)
const { init: initEmail } = require('./utils/email');

const allowedOrigin = process.env.APP_URL;
app.use(cors({
  origin(origin, callback) {
    if (!origin || !allowedOrigin || origin === allowedOrigin) return callback(null, true);
    return callback(new Error('Origin not allowed'));
  }
}));
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/internships',  require('./routes/internships'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/admin',        require('./routes/admin'));
app.use('/api/profile',      require('./routes/profile'));
app.use('/api/self-found',   require('./routes/selfFound'));
app.use('/api/notifications', require('./routes/notifications'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '4.0', time: new Date().toISOString() }));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

async function seedDevelopmentAccounts() {
  if (process.env.NODE_ENV === 'production') return;

  const demoAccounts = [
    { name: 'University Admin', email: 'admin@riphah.edu.pk', password: 'Salam123', role: 'university', university: 'Riphah International University', department: 'Faculty of Computing', status: 'verified', accountStatus: 'verified' },
    { name: 'System Admin', email: 'sysadmin@riphah.edu.pk', password: 'Salam321', role: 'sysadmin', university: null, department: null, status: 'verified', accountStatus: 'verified' },
    { name: 'Ahmed Raza', email: 'student@riphah.edu.pk', password: 'password', role: 'student', university: 'Riphah International University', department: 'Faculty of Computing', status: 'verified', accountStatus: 'verified' },
    { name: 'TechCorp Pvt Ltd', email: 'company@techcorp.com', password: 'password', role: 'company', university: null, department: null, status: 'verified', accountStatus: 'verified' }
  ];

  for (const account of demoAccounts) {
    const [existing] = await db.execute('SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [account.email]);
    if (existing.length) continue;

    await db.execute(
      `INSERT INTO users
        (name,email,password,role,university,department,status,accountStatus,registeredAt)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [account.name, account.email, bcrypt.hashSync(account.password, 10), account.role,
        account.university, account.department, account.status, account.accountStatus,
        new Date().toISOString()]
    );
  }
}

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error.' });
});

async function startServer() {
  try {
    await seedDevelopmentAccounts();
  } catch (err) {
    console.error('Development demo seed failed:', err.message);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 InternBridge v4 listening on port ${PORT}`);
  });

  initEmail();
}

startServer();
