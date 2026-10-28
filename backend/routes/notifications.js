const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');

// Helper to create notification
async function createNotification(userId, title, message = '', type = 'info') {
  try {
    const insertSQL = 'INSERT INTO notifications (userId, title, message, type, isRead, created_at) VALUES (?,?,?,?,0,?)';
    const now = new Date().toISOString().slice(0,19).replace('T',' ');
    await db.execute(insertSQL, [userId, title, message, type, now]);
  } catch (err) {
    console.error('createNotification error:', err);
  }
}

// GET /api/notifications — list for logged-in user (newest first)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM notifications WHERE userId = ? ORDER BY created_at DESC', [req.user.id]);
    res.json(rows);
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/notifications/:id/read — mark one as read
// PATCH /api/notifications/read-all — mark all as read for user
router.patch('/read-all', authMiddleware, async (req, res) => {
  try {
    await db.execute('UPDATE notifications SET isRead = 1 WHERE userId = ?', [req.user.id]);
    res.json({ message: 'All marked as read.' });
  } catch (err) {
    console.error('Mark all notifications read error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/notifications/:id/read — mark one as read
router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.execute('UPDATE notifications SET isRead = 1 WHERE id = ? AND userId = ?', [id, req.user.id]);
    res.json({ message: 'Marked as read.' });
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
module.exports.createNotification = createNotification;
