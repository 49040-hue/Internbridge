require('dotenv').config();
let db;
try {
  db = require('./config/db');
} catch (err) {
  console.error('\nFailed to load database module (./config/db).');
  console.error('Error:', err.message || err);
  console.error('Ensure you have installed dependencies: run `npm install dotenv mysql2` in the project root.\n');
  process.exit(1);
}
// InternBridge v4 — Backend Server
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize email subsystem (verifies SMTP at startup)
const { init: initEmail } = require('./utils/email');

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/internships',  require('./routes/internships'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/admin',        require('./routes/admin'));
app.use('/api/profile',      require('./routes/profile'));
app.use('/api/self-found',   require('./routes/selfFound'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '4.0', time: new Date().toISOString() }));

app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 InternBridge v4 running at http://localhost:${PORT}`);
  console.log(`\n🔑 Default Credentials:`);
  console.log(`   Student:          student@riphah.edu.pk  / password`);
  console.log(`   Company:          company@techcorp.com   / password`);
  console.log(`   University Admin: admin@riphah.edu.pk    / Salam123`);
  console.log(`   System Admin:     sysadmin@riphah.edu.pk / Salam321\n`);
});

// Verify email transporter after server start
initEmail();
