const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

// ── UNIVERSITY ADMIN ──────────────────────────────────────────────────

// GET /api/admin/stats
router.get('/stats', authMiddleware, requireRole('university', 'sysadmin'), async (req, res) => {
  try {
    const [studentsTotal] = await db.execute("SELECT COUNT(*) as c FROM users WHERE role = 'student'");
    const [studentsVerified] = await db.execute("SELECT COUNT(*) as c FROM users WHERE role = 'student' AND accountStatus = 'verified'");
    const [studentsPending] = await db.execute("SELECT COUNT(*) as c FROM users WHERE role = 'student' AND accountStatus = 'pending_verification'");
    const [companiesTotal] = await db.execute("SELECT COUNT(*) as c FROM users WHERE role = 'company'");
    const [companiesVerified] = await db.execute("SELECT COUNT(*) as c FROM users WHERE role = 'company' AND status = 'verified'");
    const [companiesPending] = await db.execute("SELECT COUNT(*) as c FROM users WHERE role = 'company' AND status = 'pending'");
    const [internshipsTotal] = await db.execute('SELECT COUNT(*) as c FROM internships');
    const [openInternships] = await db.execute("SELECT COUNT(*) as c FROM internships WHERE status = 'open'");
    const [sysadminApproved] = await db.execute('SELECT COUNT(*) as c FROM internships WHERE sysadminApproved = 1');
    const [pendingApproval] = await db.execute("SELECT COUNT(*) as c FROM internships WHERE sysadminApproved = 0 AND status = 'open'");
    const [applicationsTotal] = await db.execute('SELECT COUNT(*) as c FROM applications');
    const [applicationsPending] = await db.execute("SELECT COUNT(*) as c FROM applications WHERE status = 'pending'");
    const [applicationsAccepted] = await db.execute("SELECT COUNT(*) as c FROM applications WHERE status = 'company_accepted'");
    const [applicationsConfirmed] = await db.execute("SELECT COUNT(*) as c FROM applications WHERE status IN ('student_confirmed','sysadmin_approved')");
    const [openComplaints] = await db.execute("SELECT COUNT(*) as c FROM complaints WHERE status = 'open'");

    res.json({
      totalStudents: studentsTotal[0].c,
      verifiedStudents: studentsVerified[0].c,
      pendingStudents: studentsPending[0].c,
      totalCompanies: companiesTotal[0].c,
      verifiedCompanies: companiesVerified[0].c,
      pendingCompanies: companiesPending[0].c,
      totalInternships: internshipsTotal[0].c,
      openInternships: openInternships[0].c,
      sysadminApproved: sysadminApproved[0].c,
      pendingApproval: pendingApproval[0].c,
      totalApplications: applicationsTotal[0].c,
      pendingApplications: applicationsPending[0].c,
      acceptedApplications: applicationsAccepted[0].c,
      confirmedApplications: applicationsConfirmed[0].c,
      openComplaints: openComplaints[0].c,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/admin/students/pending
router.get('/students/pending', authMiddleware, requireRole('university', 'sysadmin'), async (req, res) => {
  try {
    const [rows] = await db.execute("SELECT * FROM users WHERE role = 'student' AND accountStatus = 'pending_verification'");
    const pending = rows.map(s => {
      const { password, ...safe } = s;
      const issues = [];
      if ((s.creditHours||0) < 60) issues.push(`Credit hours below 60 (${s.creditHours||0}/60)`);
      if ((s.cgpa||0) < 2.0) issues.push(`CGPA below 2.0 (current: ${s.cgpa||0})`);
      if (!s.electiveCourse) issues.push('No elective course listed');
      if (!s.enrolled) issues.push('Not marked as enrolled');
      return { ...safe, eligibilityIssues: issues };
    });
    res.json(pending);
  } catch (err) {
    console.error('Pending students error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/admin/students/:id — verify or reject student
router.patch('/students/:id', authMiddleware, requireRole('university', 'sysadmin'), async (req, res) => {
  const { decision, reason } = req.body;
  if (!['approve', 'reject'].includes(decision))
    return res.status(400).json({ error: 'Decision must be approve or reject.' });
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE id = ? AND role = ? LIMIT 1', [parseInt(req.params.id), 'student']);
    const student = rows[0];
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    if (decision === 'approve') {
      await db.execute('UPDATE users SET accountStatus = ?, verifiedAt = ?, rejectionReason = NULL WHERE id = ?', ['verified', new Date().toISOString(), student.id]);
      console.log(`Student account verified: ${student.name}`);
    } else {
      await db.execute('UPDATE users SET accountStatus = ?, rejectionReason = ? WHERE id = ?', ['rejected', reason || 'Does not meet eligibility criteria.', student.id]);
      console.warn(`Student verification rejected: ${student.name}`);
    }
    res.json({ message: `Student ${decision}d.` });
  } catch (err) {
    console.error('Patch student error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/admin/students — all students with details
router.get('/students', authMiddleware, requireRole('university', 'sysadmin'), async (req, res) => {
  try {
    const [studentsRows] = await db.execute("SELECT * FROM users WHERE role = 'student'");
    const students = [];
    for (const s of studentsRows) {
      const { password, ...safe } = s;
      const [apps] = await db.execute('SELECT * FROM applications WHERE studentId = ?', [s.id]);
      students.push({ ...safe, applications: apps });
    }
    res.json(students);
  } catch (err) {
    console.error('Get students error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/admin/students/:id — full student details
router.get('/students/:id', authMiddleware, requireRole('university', 'sysadmin'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE id = ? AND role = ? LIMIT 1', [parseInt(req.params.id), 'student']);
    const student = rows[0];
    if (!student) return res.status(404).json({ error: 'Student not found.' });
    const { password, ...safe } = student;
    const issues = [];
    if ((student.creditHours||0) < 60) issues.push(`Credit hours below 60`);
    if ((student.cgpa||0) < 2.0) issues.push(`CGPA below 2.0`);
    if (!student.electiveCourse) issues.push('No elective course listed');
    const [applications] = await db.execute('SELECT * FROM applications WHERE studentId = ?', [student.id]);
    const [feedback] = await db.execute('SELECT * FROM universityFeedback WHERE studentId = ?', [student.id]);
    const [complaints] = await db.execute('SELECT * FROM complaints WHERE studentId = ?', [student.id]);
    res.json({ ...safe, eligibilityIssues: issues, applications, feedback, complaints });
  } catch (err) {
    console.error('Get student error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/admin/companies
router.get('/companies', authMiddleware, requireRole('university', 'sysadmin'), async (req, res) => {
  try {
    const [companiesRows] = await db.execute("SELECT * FROM users WHERE role = 'company'");
    const companies = [];
    for (const c of companiesRows) {
      const { password, ...safe } = c;
      const [countRows] = await db.execute('SELECT COUNT(*) as c FROM internships WHERE companyId = ?', [c.id]);
      companies.push({ ...safe, internshipsCount: countRows[0].c });
    }
    res.json(companies);
  } catch (err) {
    console.error('Get companies error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/admin/companies/:id — verify or reject company
router.patch('/companies/:id', authMiddleware, requireRole('university', 'sysadmin'), async (req, res) => {
  const { status, reason } = req.body;
  if (!['verified', 'rejected'].includes(status))
    return res.status(400).json({ error: 'Status must be verified or rejected.' });
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE id = ? AND role = ? LIMIT 1', [parseInt(req.params.id), 'company']);
    const company = rows[0];
    if (!company) return res.status(404).json({ error: 'Company not found.' });
    await db.execute('UPDATE users SET status = ?, rejectionReason = ? WHERE id = ?', [status, reason || null, company.id]);
    console.log(`Company ${company.name} ${status} by ${req.user.role}`);
    res.json({ message: `Company ${status}.` });
  } catch (err) {
    console.error('Patch company error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/admin/complaints
router.get('/complaints', authMiddleware, requireRole('university', 'sysadmin'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM complaints');
    res.json(rows);
  } catch (err) {
    console.error('Get complaints error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/admin/complaints/:id — respond to complaint
router.patch('/complaints/:id', authMiddleware, requireRole('university', 'sysadmin'), async (req, res) => {
  const { response } = req.body;
  if (!response) return res.status(400).json({ error: 'Response is required.' });
  try {
    const [rows] = await db.execute('SELECT * FROM complaints WHERE id = ? LIMIT 1', [parseInt(req.params.id)]);
    const complaint = rows[0];
    if (!complaint) return res.status(404).json({ error: 'Complaint not found.' });
    const respondedAt = new Date().toISOString();
    await db.execute('UPDATE complaints SET adminResponse = ?, status = ?, respondedAt = ? WHERE id = ?', [response, 'resolved', respondedAt, complaint.id]);
    console.log(`Complaint #${complaint.id} resolved by ${req.user.name}`);
    const [updated] = await db.execute('SELECT * FROM complaints WHERE id = ? LIMIT 1', [complaint.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('Patch complaint error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/admin/complaints — company files complaint
router.post('/complaints', authMiddleware, requireRole('company'), async (req, res) => {
  const { applicationId, subject, description } = req.body;
  if (!subject || !description) return res.status(400).json({ error: 'Subject and description are required.' });
  try {
    let studentId = null, studentName = 'Unknown', internshipTitle = '';
    if (applicationId) {
      const [appRows] = await db.execute('SELECT * FROM applications WHERE id = ? LIMIT 1', [applicationId]);
      const app = appRows[0];
      if (app) {
        studentId = app.studentId; studentName = app.studentName; internshipTitle = app.internshipTitle;
      }
    }
    const submittedAt = new Date().toISOString();
    const insertSQL = `INSERT INTO complaints (fromId,fromName,studentId,studentName,internshipTitle,applicationId,subject,description,submittedAt,status,adminResponse,respondedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;
    const params = [req.user.id, req.user.name, studentId, studentName, internshipTitle, applicationId || null, subject, description, submittedAt, 'open', null, null];
    const [result] = await db.execute(insertSQL, params);
    const [newRows] = await db.execute('SELECT * FROM complaints WHERE id = ? LIMIT 1', [result.insertId]);
    console.log(`Complaint filed by ${req.user.name}: ${subject}`);
    res.status(201).json(newRows[0]);
  } catch (err) {
    console.error('Create complaint error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/admin/feedback
router.get('/feedback', authMiddleware, requireRole('university', 'sysadmin'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM universityFeedback');
    res.json(rows);
  } catch (err) {
    console.error('Get feedback error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/admin/feedback — send feedback to student
router.post('/feedback', authMiddleware, requireRole('university', 'sysadmin'), async (req, res) => {
  const { studentId, studentName, subject, message, category } = req.body;
  if (!studentId || !subject || !message) return res.status(400).json({ error: 'Student, subject and message are required.' });
  try {
    const sentAt = new Date().toISOString();
    const insertSQL = `INSERT INTO universityFeedback (studentId,studentName,subject,message,category,sentByName,sentAt,\`read\`)
      VALUES (?,?,?,?,?,?,?,?)`;
    const params = [studentId, studentName||'Student', subject, message, category||'General', req.user.name, sentAt, 0];
    const [result] = await db.execute(insertSQL, params);
    const [newRows] = await db.execute('SELECT * FROM universityFeedback WHERE id = ? LIMIT 1', [result.insertId]);
    console.log(`Feedback sent to ${studentName} by ${req.user.name}`);
    res.status(201).json(newRows[0]);
  } catch (err) {
    console.error('Create feedback error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/admin/activity
router.get('/activity', authMiddleware, requireRole('university', 'sysadmin'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM activityLog ORDER BY timestamp DESC LIMIT 50');
    res.json(rows);
  } catch (err) {
    console.error('Get activity error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/admin/uni-profile — get current university admin profile
router.get('/uni-profile', authMiddleware, requireRole('university'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE id = ? AND role = ? LIMIT 1', [req.user.id, 'university']);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'University admin profile not found.' });
    const { password, ...safe } = user;
    res.json(safe);
  } catch (err) {
    console.error('Get uni profile error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/admin/uni-profile — update university admin profile fields
router.put('/uni-profile', authMiddleware, requireRole('university'), async (req, res) => {
  const { name, email, phone, address, website, description } = req.body;
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE id = ? AND role = ? LIMIT 1', [req.user.id, 'university']);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'University admin profile not found.' });

    if (email && email.toLowerCase() !== (user.email || '').toLowerCase()) {
      const [exists] = await db.execute('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ? LIMIT 1', [email, req.user.id]);
      if (exists.length) return res.status(409).json({ error: 'This email address is already registered.' });
    }

    const updatedName = name || user.name;
    const updatedEmail = email || user.email;
    const updatedPhone = typeof phone !== 'undefined' ? phone : user.phone || null;
    const updatedAddress = typeof address !== 'undefined' ? address : user.address || null;
    const updatedWebsite = typeof website !== 'undefined' ? website : user.website || null;
    const updatedDescription = typeof description !== 'undefined' ? description : user.description || null;

    await db.execute('UPDATE users SET name = ?, email = ?, phone = ?, address = ?, website = ?, description = ? WHERE id = ?', [updatedName, updatedEmail, updatedPhone, updatedAddress, updatedWebsite, updatedDescription, req.user.id]);

    const [updatedRows] = await db.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    const { password, ...safe } = updatedRows[0];
    console.log(`University profile updated by ${req.user.name}`);
    res.json(safe);
  } catch (err) {
    console.error('Update uni profile error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── CRITERIA ──────────────────────────────────────────────────────────
// GET /api/admin/criteria
router.get('/criteria', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT section, items FROM criteria');
    const obj = {};
    for (const r of rows) obj[r.section] = JSON.parse(r.items || '[]');
    res.json(obj);
  } catch (err) {
    console.error('Get criteria error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PUT /api/admin/criteria/:section
router.put('/criteria/:section', authMiddleware, requireRole('university', 'sysadmin'), async (req, res) => {
  const { section } = req.params;
  try {
    const [rows] = await db.execute('SELECT * FROM criteria WHERE section = ? LIMIT 1', [section]);
    if (!rows.length) return res.status(404).json({ error: 'Section not found.' });
    await db.execute('UPDATE criteria SET items = ? WHERE section = ?', [JSON.stringify(req.body.items || []), section]);
    console.log(`Criteria updated: ${section} by ${req.user.name}`);
    const [updated] = await db.execute('SELECT section, items FROM criteria');
    const obj = {};
    for (const r of updated) obj[r.section] = JSON.parse(r.items || '[]');
    res.json(obj);
  } catch (err) {
    console.error('Put criteria error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/admin/criteria/:section/item
router.post('/criteria/:section/item', authMiddleware, requireRole('university', 'sysadmin'), async (req, res) => {
  const { section } = req.params;
  try {
    const [rows] = await db.execute('SELECT * FROM criteria WHERE section = ? LIMIT 1', [section]);
    if (!rows.length) return res.status(404).json({ error: 'Section not found.' });
    const items = JSON.parse(rows[0].items || '[]');
    const id = Date.now();
    items.push({ id, text: req.body.text });
    await db.execute('UPDATE criteria SET items = ? WHERE section = ?', [JSON.stringify(items), section]);
    console.log(`Criteria item added to ${section}`);
    res.status(201).json({ id, text: req.body.text });
  } catch (err) {
    console.error('Post criteria item error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/admin/criteria/:section/item/:id
router.delete('/criteria/:section/item/:id', authMiddleware, requireRole('university', 'sysadmin'), async (req, res) => {
  const { section, id } = req.params;
  try {
    const [rows] = await db.execute('SELECT * FROM criteria WHERE section = ? LIMIT 1', [section]);
    if (!rows.length) return res.status(404).json({ error: 'Section not found.' });
    const items = JSON.parse(rows[0].items || '[]');
    const filtered = items.filter(x => x.id.toString() !== id.toString());
    await db.execute('UPDATE criteria SET items = ? WHERE section = ?', [JSON.stringify(filtered), section]);
    res.json({ message: 'Item deleted.' });
  } catch (err) {
    console.error('Delete criteria item error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── SYSTEM ADMIN ONLY ─────────────────────────────────────────────────

// GET /api/admin/users
router.get('/users', authMiddleware, requireRole('sysadmin'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM users');
    const result = rows.map(u => {
      const { password, ...safe } = u;
      return safe;
    });
    res.json(result);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', authMiddleware, requireRole('sysadmin'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [parseInt(req.params.id)]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user.role === 'sysadmin' && user.id === req.user.id) return res.status(403).json({ error: 'Cannot delete your own system admin account.' });
    await db.execute('DELETE FROM users WHERE id = ?', [user.id]);
    console.log(`User deleted: ${user.name} by ${req.user.name}`);
    res.json({ message: 'User deleted.' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/admin/users/reset-password
router.post('/users/reset-password', authMiddleware, requireRole('sysadmin'), async (req, res) => {
  const { userId, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [parseInt(userId)]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const hashed = bcrypt.hashSync(newPassword, 10);
    await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, user.id]);
    console.log(`Password reset for ${user.name} by System Admin`);
    res.json({ message: 'Password reset successfully.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/admin/users/create-admin
router.post('/users/create-admin', authMiddleware, requireRole('sysadmin'), async (req, res) => {
  const { name, email, password, role, department } = req.body;
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'All fields are required.' });
  if (!['university', 'sysadmin'].includes(role)) return res.status(400).json({ error: 'Role must be university or sysadmin.' });
  try {
    const [exists] = await db.execute('SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [email]);
    if (exists.length) return res.status(409).json({ error: 'This email is already registered.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const hashed = bcrypt.hashSync(password, 10);
    const createdAt = new Date().toISOString();
    await db.execute('INSERT INTO users (name,email,password,role,university,department,createdAt) VALUES (?,?,?,?,?,?,?)', [name, email, hashed, role, 'Riphah International University', department||'Faculty of Computing', createdAt]);
    console.log(`Admin account created: ${name} (${role}) by ${req.user.name}`);
    res.status(201).json({ message: 'Admin account created.' });
  } catch (err) {
    console.error('Create admin error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/admin/users/:id/suspend — suspend or unsuspend student
router.patch('/users/:id/suspend', authMiddleware, requireRole('sysadmin'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [parseInt(req.params.id)]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    const status = req.body.suspend ? 'suspended' : 'verified';
    await db.execute('UPDATE users SET accountStatus = ? WHERE id = ?', [status, user.id]);
    console.log(`User ${user.name} ${req.body.suspend ? 'suspended' : 'unsuspended'} by System Admin`);
    res.json({ message: `User ${req.body.suspend ? 'suspended' : 'unsuspended'}.` });
  } catch (err) {
    console.error('Suspend user error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/admin/system-stats
router.get('/system-stats', authMiddleware, requireRole('sysadmin'), async (req, res) => {
  try {
    const [usersCount] = await db.execute('SELECT COUNT(*) as c FROM users');
    const [internshipsCount] = await db.execute('SELECT COUNT(*) as c FROM internships');
    const [applicationsCount] = await db.execute('SELECT COUNT(*) as c FROM applications');
    const [filesCount] = await db.execute('SELECT COUNT(*) as c FROM uploadedFiles');
    const [alerts] = await db.execute("SELECT COUNT(*) as c FROM activityLog WHERE type = 'warning'");
    res.json({
      totalUsers: usersCount[0].c,
      uptime: process.uptime(),
      memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      nodeVersion: process.version,
      dbRecords: usersCount[0].c + internshipsCount[0].c + applicationsCount[0].c,
      storedFiles: filesCount[0].c,
      lastBackup: 'Not configured',
      securityAlerts: alerts[0].c,
    });
  } catch (err) {
    console.error('System stats error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
