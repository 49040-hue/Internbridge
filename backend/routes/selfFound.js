const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { sendMail } = require('../utils/email');

// POST /api/self-found/submit
router.post('/submit', authMiddleware, async (req, res) => {
  const { companyName, companyWebsite, supervisorName, supervisorEmail, startDate, endDate, stipend, workDescription, offerLetterDoc } = req.body;
  if (!companyName || !supervisorEmail || !startDate || !endDate || !workDescription)
    return res.status(400).json({ error: 'Missing required fields.' });
  try {
    // Validate dates: startDate must be in the future, endDate after startDate, minimum duration 8 weeks
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return res.status(400).json({ error: 'Invalid startDate or endDate.' });
    const now = new Date();
    // allow startDate today or future? require future (>= today)
    if (s < new Date(now.toDateString())) return res.status(400).json({ error: 'startDate must be today or in the future.' });
    if (e <= s) return res.status(400).json({ error: 'endDate must be after startDate.' });
    const minDurationDays = 8 * 7; // 8 weeks
    const diffDays = Math.ceil((e - s) / (1000 * 60 * 60 * 24));
    if (diffDays < minDurationDays) return res.status(400).json({ error: 'Duration must be at least 8 weeks.' });
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
    // Notify student via email and in-app notification
    try {
      const sf = rows[0];
      const [studentRows] = await db.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [sf.student_id]);
      const student = studentRows[0];
      const studentName = student ? student.name : '';
      const companyName = sf.company_name || '';
      if (student && student.email) {
        if (status === 'approved') {
          const mailOptions = {
            from: `InternBridge <${process.env.EMAIL_USER}>`,
            to: student.email,
            subject: 'Self-Found Internship Approved — InternBridge',
            html: `
              <p>Congratulations ${studentName || ''}!</p>
              <p>Your self-found internship at <strong>${companyName}</strong> has been approved by the university. Please check your dashboard for details.</p>
              <p>— InternBridge</p>`
          };
          try {
            const sent = await sendMail(mailOptions);
            if (!sent.ok) console.error('Failed to send self-found approved email to student:', sent.error);
          } catch (e) { console.error('Error sending self-found approved email:', e); }
        } else if (status === 'rejected') {
          const reason = adminNote || 'No reason given';
          const mailOptions = {
            from: `InternBridge <${process.env.EMAIL_USER}>`,
            to: student.email,
            subject: 'Self-Found Internship Update — InternBridge',
            html: `
              <p>Dear ${studentName || ''},</p>
              <p>Your self-found internship application at <strong>${companyName}</strong> was not approved.</p>
              <p>Reason: ${reason}</p>
              <p>Please contact your university coordinator for guidance.</p>
              <p>— InternBridge</p>`
          };
          try {
            const sent = await sendMail(mailOptions);
            if (!sent.ok) console.error('Failed to send self-found rejected email to student:', sent.error);
          } catch (e) { console.error('Error sending self-found rejected email:', e); }
        }
      }
      // Insert in-app notification
      try {
        let message = '';
        if (status === 'approved') message = `Your self-found internship at ${companyName} has been approved!`;
        else if (status === 'rejected') message = `Your self-found internship at ${companyName} was not approved. Check your email for details.`;
        if (message && sf.student_id) {
          const createdAt = new Date().toISOString().slice(0,19).replace('T',' ');
          await db.execute('INSERT INTO notifications (userId, message, type, createdAt, isRead) VALUES (?,?,?,?,?)', [sf.student_id, message, 'info', createdAt, 0]);
        }
      } catch (e) {
        console.error('Error inserting notification for self-found review:', e);
      }
    } catch (e) {
      console.error('Error sending notifications for self-found review:', e);
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Review self-found error:', err && err.stack || err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
