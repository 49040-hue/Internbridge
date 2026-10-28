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
    // Attach registration/CMMI document URLs for companies if uploaded
    try {
      if (user.role === 'company') {
        const [files] = await db.execute('SELECT * FROM uploadedFiles WHERE ownerId = ?', [user.id]);
        let regCertDoc = null, cmmiDoc = null;
        let regCertFileId = null, cmmiFileId = null;
        for (const f of files) {
          if (f.fileName && f.fileName.startsWith('reg-cert_')) {
            regCertDoc = `/api/profile/file/${f.id}`;
            regCertFileId = f.id;
          }
          if (f.fileName && f.fileName.startsWith('cmmi_cert_')) {
            cmmiDoc = `/api/profile/file/${f.id}`;
            cmmiFileId = f.id;
          }
        }
        safe.regCertDoc = regCertDoc;
        safe.cmmiDoc = cmmiDoc;
        safe.regCertFileId = regCertFileId;
        safe.cmmiFileId = cmmiFileId;
      }
    } catch (e) {
      console.error('Failed to fetch uploaded files for profile:', e && e.message);
    }
    const issues = [];
    if (user.role === 'student') {
      if ((user.creditHours||0) < 60) issues.push(`Credit hours below 60 (${user.creditHours||0}/60)`);
      if ((user.cgpa||0) < 2.0) issues.push(`CGPA below 2.0 (current: ${user.cgpa||0})`);
      if (!user.electiveCourse) issues.push('No elective course listed for substitution');
      if (!user.enrolled) issues.push('Not marked as currently enrolled');
    }
    // Normalize verification/account status fields for frontend consistency
    safe.verificationStatus = safe.verificationStatus || safe.accountStatus || safe.status || null;
    safe.accountStatus = safe.accountStatus || safe.verificationStatus || safe.status || null;
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
  try {
    // Normalize and extract raw base64 if data: URI provided
    let raw = base64;
    if (typeof raw === 'string' && raw.startsWith('data:')) {
      const parts = raw.split(',');
      if (parts.length > 1) raw = parts[1];
      // if fileType missing, extract from prefix
      if (!fileType) {
        const m = base64.match(/^data:([^;]+);base64,/);
        if (m) fileType = m[1];
      }
    }
    // Reject unsupported mime types
    const allowed = ['application/pdf','image/png','image/jpeg','image/jpg'];
    if (!fileType || !allowed.includes(fileType.toLowerCase())) {
      return res.status(400).json({ error: 'Unsupported file type. Allowed: PDF, PNG, JPG.' });
    }
    // Validate decoded size (max 6MB)
    const buf = Buffer.from(raw, 'base64');
    if (buf.length > 6 * 1024 * 1024) return res.status(413).json({ error: 'File too large. Max 6MB.' });
    // sanitize fileName
    const safeName = (fileName || 'file').split('/').pop().split('\\').pop().replace(/[^a-zA-Z0-9._-]/g, '_');
    const uploadedAt = new Date().toISOString();
    const insertSQL = 'INSERT INTO uploadedFiles (ownerId,fileName,fileType,base64,uploadedAt) VALUES (?,?,?,?,?)';
    const [result] = await db.execute(insertSQL, [req.user.id, safeName, fileType, base64, uploadedAt]);
    const [rows] = await db.execute('SELECT * FROM uploadedFiles WHERE id = ? LIMIT 1', [result.insertId]);
    // include download URL in response
    const fileRow = rows[0];
    const downloadUrl = `/api/profile/file/${fileRow.id}/download`;
    res.status(201).json({ fileId: fileRow.id, fileName: fileRow.fileName, downloadUrl });
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

// GET /api/profile/file/:id/download — return raw file as attachment (for direct browser downloads)
router.get('/file/:id/download', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM uploadedFiles WHERE id = ? LIMIT 1', [parseInt(req.params.id)]);
    const file = rows[0];
    if (!file) return res.status(404).json({ error: 'File not found.' });
    if (!file.base64) return res.status(404).json({ error: 'File data missing.' });
    // Only allow owner or university/sysadmin roles to download the file
    if (file.ownerId !== req.user.id && !['university', 'sysadmin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to access this file.' });
    }
    // Normalize base64 (strip data:...;base64, prefix if present)
    let raw = file.base64;
    if (typeof raw === 'string' && raw.startsWith('data:')) {
      const parts = raw.split(',');
      raw = parts.length > 1 ? parts[1] : '';
    }
    const buffer = Buffer.from(raw, 'base64');
    const fileName = (file.fileName || 'file').replace(/"/g, '');
    res.setHeader('Content-Type', file.fileType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Download file error:', err);
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
