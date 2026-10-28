require('dotenv').config();
let mysql;
try {
  mysql = require('mysql2/promise');
} catch (err) {
  console.error('\nMissing module: mysql2 is required but not installed.');
  console.error('Install it with: npm install mysql2');
  throw err;
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
