require('dotenv').config();
const pool = require('../config/db');

async function run() {
  const sql = `CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    type ENUM('info','success','warning','error') DEFAULT 'info',
    isRead TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );`;
  try {
    const [result] = await pool.execute(sql);
    console.log('✅ notifications table ensured.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to run SQL:', err && err.stack || err);
    process.exit(1);
  }
}

run();
