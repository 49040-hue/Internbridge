const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

function fullStudentDetails(student) {
  const { password, ...safe } = student;
  return safe;
}

// POST /api/applications — student applies
router.post('/', authMiddleware, requireRole('student'), async (req, res) => {
  const { internshipId } = req.body;
  if (!internshipId) return res.status(400).json({ error: 'Internship ID is required.' });
  try {
    const [studentRows] = await db.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    const student = studentRows[0];
    if (!student || student.accountStatus !== 'verified')
      return res.status(403).json({ error: 'Your account is not yet verified by the university. You cannot apply until verified.' });

    const [internRows] = await db.execute('SELECT * FROM internships WHERE id = ? LIMIT 1', [parseInt(internshipId)]);
    const internship = internRows[0];
    if (!internship) return res.status(404).json({ error: 'Internship not found.' });
    if (internship.status !== 'open') return res.status(400).json({ error: 'This internship is no longer open.' });
    if (!internship.sysadminApproved) return res.status(403).json({ error: 'This internship has not been approved by the system admin yet.' });
    if (new Date(internship.deadline) < new Date()) return res.status(400).json({ error: 'The application deadline has passed.' });

    // Eligibility checks
    const issues = [];
    if ((student.creditHours || 0) < 60) issues.push(`Credit hours below 60 (currently ${student.creditHours || 0})`);
    if ((student.cgpa || 0) < 2.0) issues.push(`CGPA below 2.0 (currently ${student.cgpa || 0})`);
    if (!student.electiveCourse) issues.push('No elective course listed for substitution');
    if (!student.enrolled) issues.push('Not marked as currently enrolled');
    if (issues.length > 0) return res.status(403).json({ error: 'Eligibility check failed.', issues });

    const [dup] = await db.execute('SELECT id FROM applications WHERE studentId = ? AND internshipId = ? LIMIT 1', [req.user.id, parseInt(internshipId)]);
    if (dup.length) return res.status(409).json({ error: 'You have already applied to this internship.' });

    const [confirmedRows] = await db.execute("SELECT id FROM applications WHERE studentId = ? AND status IN ('student_confirmed','sysadmin_approved') LIMIT 1", [req.user.id]);
    if (confirmedRows.length) return res.status(400).json({ error: 'You already have a confirmed internship this semester. Only one per semester is allowed.' });

    const appliedAt = new Date().toISOString().split('T')[0];
    const insertSQL = `INSERT INTO applications (studentId,internshipId,studentName,internshipTitle,company,companyId,appliedAt,status,companyFeedback,sysadminApproved,slotId)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`;
    const params = [req.user.id, parseInt(internshipId), req.user.name, internship.title, internship.company, internship.companyId, appliedAt, 'pending', null, 0, null];
    const [result] = await db.execute(insertSQL, params);
    const appId = result.insertId;
    console.log(`${req.user.name} applied for "${internship.title}"`);

    const [newAppRows] = await db.execute('SELECT * FROM applications WHERE id = ? LIMIT 1', [appId]);
    const [companyRows] = await db.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [internship.companyId]);
    const company = companyRows[0];
    res.status(201).json({
      ...newAppRows[0],
      internshipDetails: {
        ...internship,
        companyEmail: company ? company.email : null,
        companyCmmi: company ? company.cmmi : null,
      },
    });
  } catch (err) {
    console.error('Apply error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/applications/mine — student sees their applications with full details
router.get('/mine', authMiddleware, requireRole('student'), async (req, res) => {
  try {
    const [apps] = await db.execute('SELECT * FROM applications WHERE studentId = ?', [req.user.id]);
    const enriched = [];
    for (const a of apps) {
      const [internRows] = await db.execute('SELECT * FROM internships WHERE id = ? LIMIT 1', [a.internshipId]);
      const internship = internRows[0];
      const [companyRows] = internship ? await db.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [internship.companyId]) : [ [] ];
      const company = companyRows[0];
      const timeSlots = internship && internship.timeSlots ? JSON.parse(internship.timeSlots) : [];
      const availableSlots = timeSlots.filter(s => (s.bookedBy ? s.bookedBy.length : 0) < s.capacity).length;
      const slot = internship && a.slotId ? timeSlots.find(s => s.id === a.slotId) : null;
      enriched.push({
        ...a,
        internshipDetails: internship ? {
          id: internship.id, title: internship.title, description: internship.description,
          city: internship.city, deadline: internship.deadline, stipend: internship.stipend,
          type: internship.type, durationWeeks: internship.durationWeeks, isRemote: internship.isRemote,
          availableSlots, timeSlots,
          companyName: company ? company.name : internship.company,
          companyCity: company ? company.city : null,
          companyEmail: company ? company.email : null,
          companyCmmi: company ? company.cmmi : null,
        } : null,
        bookedSlot: slot,
      });
    }
    res.json(enriched);
  } catch (err) {
    console.error('Get mine error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/applications/company — company sees all applicants with full student details
router.get('/company', authMiddleware, requireRole('company'), async (req, res) => {
  try {
    const [internRows] = await db.execute('SELECT id FROM internships WHERE companyId = ?', [req.user.id]);
    const myIds = (internRows || []).map(r => r.id);
    if (!myIds.length) return res.json([]);
    const [apps] = await db.execute(`SELECT * FROM applications WHERE internshipId IN (${myIds.map(() => '?').join(',')})`, myIds);
    const result = [];
    for (const a of apps) {
      const [studentRows] = await db.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [a.studentId]);
      const student = studentRows[0];
      const [internRows2] = await db.execute('SELECT * FROM internships WHERE id = ? LIMIT 1', [a.internshipId]);
      const internship = internRows2[0];
      const timeSlots = internship && internship.timeSlots ? JSON.parse(internship.timeSlots) : [];
      const slot = internship && a.slotId ? timeSlots.find(s => s.id === a.slotId) : null;
      result.push({
        ...a,
        studentDetails: student ? fullStudentDetails(student) : null,
        internshipDetails: internship || null,
        bookedSlot: slot,
      });
    }
    res.json(result);
  } catch (err) {
    console.error('Company apps error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/applications/all — university/sysadmin sees all with full details
router.get('/all', authMiddleware, requireRole('university', 'sysadmin'), async (req, res) => {
  try {
    const [apps] = await db.execute('SELECT * FROM applications');
    const result = [];
    for (const a of apps) {
      const [studentRows] = await db.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [a.studentId]);
      const student = studentRows[0];
      const [internRows] = await db.execute('SELECT * FROM internships WHERE id = ? LIMIT 1', [a.internshipId]);
      const internship = internRows[0];
      const [companyRows] = internship ? await db.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [internship.companyId]) : [ [] ];
      const company = companyRows[0];
      result.push({
        ...a,
        studentDetails: student ? fullStudentDetails(student) : null,
        internshipDetails: internship || null,
        companyDetails: company ? { id: company.id, name: company.name, email: company.email, city: company.city, status: company.status } : null,
      });
    }
    res.json(result);
  } catch (err) {
    console.error('All apps error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/applications/:id — company accepts/rejects
router.patch('/:id', authMiddleware, requireRole('company'), async (req, res) => {
  const { status, feedback } = req.body;
  if (!['company_accepted', 'company_rejected'].includes(status))
    return res.status(400).json({ error: 'Status must be company_accepted or company_rejected.' });
  try {
    const [appRows] = await db.execute('SELECT * FROM applications WHERE id = ? LIMIT 1', [parseInt(req.params.id)]);
    const app = appRows[0];
    if (!app) return res.status(404).json({ error: 'Application not found.' });
    const [internRows] = await db.execute('SELECT id FROM internships WHERE companyId = ? AND id = ? LIMIT 1', [req.user.id, app.internshipId]);
    if (!internRows.length) return res.status(403).json({ error: 'This application is not for your internship.' });
    await db.execute('UPDATE applications SET status = ?, companyFeedback = ? WHERE id = ?', [status, feedback || null, app.id]);
    console.log(`Application for "${app.internshipTitle}" ${status} by ${req.user.name}`);
    const [updated] = await db.execute('SELECT * FROM applications WHERE id = ? LIMIT 1', [app.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('Company patch error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/applications/:id/student-decision — student confirms or declines offer
router.patch('/:id/student-decision', authMiddleware, requireRole('student'), async (req, res) => {
  const { decision } = req.body; // 'confirm' | 'decline'
  if (!['confirm', 'decline'].includes(decision)) return res.status(400).json({ error: 'Decision must be confirm or decline.' });
  try {
    const [appRows] = await db.execute('SELECT * FROM applications WHERE id = ? AND studentId = ? LIMIT 1', [parseInt(req.params.id), req.user.id]);
    const app = appRows[0];
    if (!app) return res.status(404).json({ error: 'Application not found.' });
    if (app.status !== 'company_accepted') return res.status(400).json({ error: 'You can only decide on offers that a company has accepted.' });
    if (decision === 'confirm') {
      await db.execute("UPDATE applications SET status = 'student_confirmed' WHERE id = ?", [app.id]);
      await db.execute("UPDATE applications SET status = 'student_declined' WHERE studentId = ? AND id != ? AND status = 'company_accepted'", [req.user.id, app.id]);
      console.log(`${req.user.name} confirmed internship at ${app.company}`);
    } else {
      await db.execute("UPDATE applications SET status = 'student_declined' WHERE id = ?", [app.id]);
      console.log(`${req.user.name} declined offer from ${app.company}`);
    }
    const [updated] = await db.execute('SELECT * FROM applications WHERE id = ? LIMIT 1', [app.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('Student decision error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/applications/:id/sysadmin-approve — sysadmin or university gives final approval
router.patch('/:id/sysadmin-approve', authMiddleware, requireRole('sysadmin', 'university'), async (req, res) => {
  try {
    const [appRows] = await db.execute('SELECT * FROM applications WHERE id = ? LIMIT 1', [parseInt(req.params.id)]);
    const app = appRows[0];
    if (!app) return res.status(404).json({ error: 'Application not found.' });
    if (app.status !== 'student_confirmed') return res.status(400).json({ error: 'Application must be student-confirmed before system admin approval.' });
    await db.execute("UPDATE applications SET status = 'sysadmin_approved', sysadminApproved = 1 WHERE id = ?", [app.id]);
    console.log(`System Admin gave final approval: ${app.studentName} at ${app.company}`);
    const [updated] = await db.execute('SELECT * FROM applications WHERE id = ? LIMIT 1', [app.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('Sysadmin approve error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
