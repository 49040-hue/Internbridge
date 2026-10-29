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
async function ensureColumn(table, column, definition) {
  const [rows] = await db.execute(
    'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1',
    [table, column]
  );
  if (!rows.length) {
    await db.execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
    console.log(`✅ ${table}.${column} column verified/added.`);
  }
}

async function ensureStartupSchema() {
  const userColumns = [
    ['transcriptFileId', 'INT UNSIGNED NULL'],
    ['cvFileId', 'INT UNSIGNED NULL'],
    ['transcriptDoc', 'LONGTEXT NULL'],
    ['rejectionReason', 'TEXT NULL'],
    ['accountStatus', 'VARCHAR(32) NULL'],
    ['failed_attempts', 'INT NOT NULL DEFAULT 0'],
    ['locked_until', 'DATETIME NULL'],
  ];

  for (const [column, definition] of userColumns) {
    try {
      await ensureColumn('users', column, definition);
    } catch (err) {
      console.error(`❌ Error checking users.${column} column:`, err);
    }
  }

  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS uploadedFiles (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      ownerId INT UNSIGNED NOT NULL,
      fileName VARCHAR(255) NOT NULL,
      fileType VARCHAR(128) NOT NULL,
      base64 LONGTEXT NOT NULL,
      uploadedAt VARCHAR(64) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_uploaded_owner (ownerId),
      CONSTRAINT fk_uploaded_owner FOREIGN KEY (ownerId) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    console.log('✅ uploadedFiles table verified/created.');
  } catch (err) {
    console.error('❌ Error creating uploadedFiles table:', err);
  }

  try {
    await db.execute(`CREATE TABLE IF NOT EXISTS password_resets (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id INT UNSIGNED NOT NULL,
      token VARCHAR(128) NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL,
      INDEX (user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    console.log('✅ password_resets table verified/created.');
  } catch (err) {
    console.error('❌ Error creating password_resets table:', err);
  }

  try {
    await ensureColumn('internships', 'override_reason', 'TEXT NULL');
  } catch (err) {
    console.error('❌ Error checking internships.override_reason column:', err);
  }

  try {
    await db.execute('ALTER TABLE self_found_internships MODIFY COLUMN offer_letter_doc LONGTEXT');
    console.log('✅ self_found_internships.offer_letter_doc column adjusted');
  } catch (err) {
    console.error('❌ Error adjusting self_found_internships.offer_letter_doc:', err);
  }
}
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
app.use(express.json({ limit: '32mb' }));
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
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request is too large. Uploaded documents must be 10 MB or smaller.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid request data.' });
  }
  console.error(err.stack || err);
  res.status(err.statusCode >= 400 && err.statusCode < 600 ? err.statusCode : 500)
    .json({ error: 'Internal server error.' });
});

async function startServer() {
  try {
    await db.execute('SELECT 1');
    console.log('✅ DB connected (TLS)');
  } catch (err) {
    console.error('❌ DB connection failed:', err);
  }

  await ensureStartupSchema();
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
