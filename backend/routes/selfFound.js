const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { sendMail } = require('../utils/email');

// Helper: map DB row (snake_case) to camelCase object
function mapSelfFoundRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    studentId: r.student_id,
    studentName: r.student_name,
    companyName: r.company_name,
    companyWebsite: r.company_website,
    supervisorName: r.supervisor_name,
    supervisorEmail: r.supervisor_email,
    startDate: r.start_date,
    endDate: r.end_date,
    stipend: r.stipend,
    workDescription: r.work_description,
    offerLetterDoc: r.offer_letter_doc,
    status: r.status,
    adminNote: r.admin_note,
    submittedAt: r.submitted_at,
    reviewedAt: r.reviewed_at
  };
}

// POST /api/self-found/submit
// Accepts student submission for a self-found internship. Allows startDate in the past (for testing),
// but enforces a minimum duration of 8 weeks.
router.post('/submit', authMiddleware, async (req, res) => {
  // Debug: log incoming payload to help trace missing fields
  try { console.log('POST /api/self-found/submit payload:', JSON.stringify(req.body && Object.keys(req.body).length ? req.body : {})); } catch (e) {}
  const { companyName, companyWebsite, supervisorName, supervisorEmail, startDate, endDate, stipend, workDescription, offerLetterDoc } = req.body || {};
  if (!companyName || !supervisorEmail || !startDate || !endDate || !workDescription) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) {
      return res.status(400).json({ error: 'Invalid startDate or endDate.' });
    }
    if (e <= s) {
      return res.status(400).json({ error: 'endDate must be after startDate.' });
    }

    // Minimum duration: 8 weeks (56 days)
    const minDurationDays = 8 * 7;
    const diffDays = Math.ceil((e - s) / (1000 * 60 * 60 * 24));
    if (diffDays < minDurationDays) {
      return res.status(400).json({ error: 'Duration must be at least 8 weeks.' });
    }

    const studentId = req.user && req.user.id;
    const studentName = req.user && req.user.name || '';

    const sql = `INSERT INTO self_found_internships
      (student_id, student_name, company_name, company_website, supervisor_name, supervisor_email, start_date, end_date, stipend, work_description, offer_letter_doc)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`;
    const params = [studentId, studentName, companyName, companyWebsite || null, supervisorName || null, supervisorEmail, startDate, endDate, stipend || null, workDescription, offerLetterDoc || null];

    const [result] = await db.execute(sql, params);
    const insertedId = result && result.insertId;
    if (!insertedId) {
      console.error('Insert returned no insertId:', result);
      return res.status(500).json({ error: 'Failed to create record.' });
    }

    const [rows] = await db.execute('SELECT * FROM self_found_internships WHERE id = ? LIMIT 1', [insertedId]);
    const created = rows && rows[0] ? rows[0] : null;
    return res.status(201).json(mapSelfFoundRow(created));
  } catch (err) {
    console.error('Submit self-found error:', err && err.stack || err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/self-found/mine
// Returns the current student's submissions with camelCase fields
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const studentId = req.user && req.user.id;
    const [rows] = await db.execute('SELECT * FROM self_found_internships WHERE student_id = ? ORDER BY submitted_at DESC', [studentId]);
    return res.json((rows || []).map(mapSelfFoundRow));
  } catch (err) {
    console.error('Get my self-found error:', err && err.stack || err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/self-found — university/sysadmin only
// Returns all submissions with camelCase fields
router.get('/', authMiddleware, requireRole('university','sysadmin'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM self_found_internships ORDER BY submitted_at DESC');
    return res.json((rows || []).map(mapSelfFoundRow));
  } catch (err) {
    console.error('Get all self-found error:', err && err.stack || err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/self-found/:id/review — approve/reject
// Updates review status, notifies student, and returns the updated record in camelCase
router.patch('/:id/review', authMiddleware, requireRole('university','sysadmin'), async (req, res) => {
  const id = parseInt(req.params && req.params.id, 10);
  const { status, adminNote } = req.body || {};
  if (!id || Number.isNaN(id)) return res.status(400).json({ error: 'Invalid id.' });
  if (!['approved','rejected','pending'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });

  try {
    const reviewedAt = new Date();
    const reviewedAtSql = reviewedAt.toISOString().slice(0,19).replace('T',' ');
    await db.execute('UPDATE self_found_internships SET status = ?, admin_note = ?, reviewed_at = ? WHERE id = ?', [status, adminNote || null, reviewedAtSql, id]);

    const [rows] = await db.execute('SELECT * FROM self_found_internships WHERE id = ? LIMIT 1', [id]);
    const sf = rows && rows[0] ? rows[0] : null;
    if (!sf) return res.status(404).json({ error: 'Record not found.' });

    // Notify student via email and in-app notification (best-effort)
    try {
      if (sf.student_id) {
        const [studentRows] = await db.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [sf.student_id]);
        const student = studentRows && studentRows[0] ? studentRows[0] : null;
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
            try { await sendMail(mailOptions); } catch (e) { console.error('Error sending approval email:', e); }
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
            try { await sendMail(mailOptions); } catch (e) { console.error('Error sending rejection email:', e); }
          }
        }

        // Insert in-app notification
        try {
          let message = '';
          if (status === 'approved') message = `Your self-found internship at ${companyName} has been approved!`;
          else if (status === 'rejected') message = `Your self-found internship at ${companyName} was not approved. Check your email for details.`;
          if (message) {
            const createdAt = new Date().toISOString().slice(0,19).replace('T',' ');
            await db.execute('INSERT INTO notifications (userId, message, type, createdAt, isRead) VALUES (?,?,?,?,?)', [sf.student_id, message, 'info', createdAt, 0]);
          }
        } catch (e) {
          console.error('Error inserting notification for self-found review:', e);
        }
      }
    } catch (e) {
      console.error('Error sending notifications for self-found review:', e);
    }

    return res.json(mapSelfFoundRow(sf));
  } catch (err) {
    console.error('Review self-found error:', err && err.stack || err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
