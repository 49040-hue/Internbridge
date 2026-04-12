const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

// POST /api/self-found/submit
router.post('/submit', authMiddleware, async (req, res) => {
  const { companyName, companyWebsite, supervisorName, supervisorEmail, startDate, endDate, stipend, workDescription, offerLetterDoc } = req.body;
  if (!companyName || !supervisorEmail || !startDate || !endDate || !workDescription)
    return res.status(400).json({ error: 'Missing required fields.' });
  try {
    const studentId = req.user.id;
    const studentName = req.user.name;
    const sql = `INSERT INTO self_found_internships
      (student_id, student_name, company_name, company_website, supervisor_name, supervisor_email, start_date, end_date, stipend, work_description, offer_letter_doc)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`;
    const params = [studentId, studentName, companyName, companyWebsite||null, supervisorName||null, supervisorEmail, startDate, endDate, stipend||null, workDescription, offerLetterDoc||null];
    const [result] = await db.execute(sql, params);
    const insertedId = result.insertId;
    const [rows] = await db.execute('SELECT * FROM self_found_internships WHERE id = ? LIMIT 1', [insertedId]);
    console.log(`Self-found internship submitted by ${studentName} (id=${insertedId})`);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Submit self-found error:', err && err.stack || err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/self-found/mine
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM self_found_internships WHERE student_id = ? ORDER BY submitted_at DESC', [req.user.id]);
    res.json(rows);
  } catch (err) {
    console.error('Get my self-found error:', err && err.stack || err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/self-found — university/sysadmin only
router.get('/', authMiddleware, requireRole('university','sysadmin'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM self_found_internships ORDER BY submitted_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('Get all self-found error:', err && err.stack || err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/self-found/:id/review — approve/reject
router.patch('/:id/review', authMiddleware, requireRole('university','sysadmin'), async (req, res) => {
  const id = parseInt(req.params.id);
  const { status, adminNote } = req.body;
  if (!['approved','rejected','pending'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  try {
    const reviewedAt = new Date();
    await db.execute('UPDATE self_found_internships SET status = ?, admin_note = ?, reviewed_at = ? WHERE id = ?', [status, adminNote||null, reviewedAt.toISOString().slice(0,19).replace('T',' '), id]);
    const [rows] = await db.execute('SELECT * FROM self_found_internships WHERE id = ? LIMIT 1', [id]);
    console.log(`Self-found id=${id} reviewed: ${status}`);
    res.json(rows[0]);
  } catch (err) {
    console.error('Review self-found error:', err && err.stack || err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
