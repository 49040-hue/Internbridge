const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware } = require('../middleware/auth');
// free-time is now stored in MySQL table `student_free_time`

// GET /api/profile
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const { password, ...safe } = user;
    const issues = [];
    if (user.role === 'student') {
      if ((user.creditHours||0) < 60) issues.push(`Credit hours below 60 (${user.creditHours||0}/60)`);
      if ((user.cgpa||0) < 2.0) issues.push(`CGPA below 2.0 (current: ${user.cgpa||0})`);
      if (!user.electiveCourse) issues.push('No elective course listed for substitution');
      if (!user.enrolled) issues.push('Not marked as currently enrolled');
    }
    res.json({ ...safe, eligibilityIssues: issues });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/profile
router.put('/', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const fields = ['name','skills','city','description','electiveCourse','program','transcriptFileId','cvFileId','transcriptDoc','enrollmentDoc'];
    const updates = {};
    fields.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    if (Object.keys(updates).length) {
      const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      const params = [...Object.values(updates), req.user.id];
      await db.execute(`UPDATE users SET ${sets} WHERE id = ?`, params);
    }
    const [updatedRows] = await db.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    const { password, ...safe } = updatedRows[0];
    res.json(safe);
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/profile/feedback
router.get('/feedback', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM universityFeedback WHERE studentId = ?', [req.user.id]);
    if (rows.length) await db.execute('UPDATE universityFeedback SET `read` = 1 WHERE studentId = ?', [req.user.id]);
    res.json(rows);
  } catch (err) {
    console.error('Get feedback error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/profile/upload
router.post('/upload', authMiddleware, async (req, res) => {
  const { fileName, fileType, base64 } = req.body;
  if (!fileName || !fileType || !base64)
    return res.status(400).json({ error: 'fileName, fileType, and base64 are required.' });
  // Validate encoded size (reject overly large base64 payloads to avoid DB corruption)
  if (base64.length > 8 * 1024 * 1024)
    return res.status(413).json({ error: 'File too large after encoding. Max ~6MB.' });
  try {
    const uploadedAt = new Date().toISOString();
    const insertSQL = 'INSERT INTO uploadedFiles (ownerId,fileName,fileType,base64,uploadedAt) VALUES (?,?,?,?,?)';
    const [result] = await db.execute(insertSQL, [req.user.id, fileName, fileType, base64, uploadedAt]);
    const [rows] = await db.execute('SELECT * FROM uploadedFiles WHERE id = ? LIMIT 1', [result.insertId]);
    res.status(201).json({ fileId: rows[0].id, fileName: rows[0].fileName });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/profile/file/:id
router.get('/file/:id', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM uploadedFiles WHERE id = ? LIMIT 1', [parseInt(req.params.id)]);
    const file = rows[0];
    if (!file) return res.status(404).json({ error: 'File not found.' });
    if (!file.base64) return res.status(404).json({ error: 'File data missing.' });
    // Only allow owner or university/sysadmin roles to access the file
    if (file.ownerId !== req.user.id && !['university', 'sysadmin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to access this file.' });
    }
    res.json(file);
  } catch (err) {
    console.error('Get file error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/profile/free-time — save student's free time slots (stored in backend/data/free-time.json)
router.post('/free-time', authMiddleware, async (req, res) => {
  try {
    const freeTime = Array.isArray(req.body.freeTime) ? req.body.freeTime : [];
    // remove existing entries for this student
    await db.execute('DELETE FROM student_free_time WHERE student_id = ?', [req.user.id]);
    // insert new slots
    for (const slot of freeTime) {
      const day = slot.day || slot.dayOfWeek || '';
      const start = slot.startTime || slot.start || slot.from || '';
      const end = slot.endTime || slot.end || slot.to || '';
      if (!day || !start || !end) continue;
      await db.execute('INSERT INTO student_free_time (student_id, day, start_time, end_time) VALUES (?,?,?,?)', [req.user.id, day, start, end]);
    }
    res.json({ message: 'Saved.' });
  } catch (err) {
    console.error('Save free time error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/profile/free-time — retrieve student's free time slots
router.get('/free-time', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT id, day, start_time AS startTime, end_time AS endTime FROM student_free_time WHERE student_id = ? ORDER BY id ASC', [req.user.id]);
    res.json(rows || []);
  } catch (err) {
    console.error('Get free time error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
