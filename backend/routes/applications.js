const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { sendMail } = require('../utils/email');

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
    const params = [req.user.id, parseInt(internshipId), student.name, internship.title, internship.company, internship.companyId, appliedAt, 'pending', null, 0, null];
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
    // Only allow company to change applications that are pending or previously rejected by company
    const allowedCurrent = ['pending', 'company_rejected'];
    if (!allowedCurrent.includes(app.status)) {
      return res.status(400).json({ error: 'Application cannot be modified in its current state.' });
    }
    const [internRows] = await db.execute('SELECT id FROM internships WHERE companyId = ? AND id = ? LIMIT 1', [req.user.id, app.internshipId]);
    if (!internRows.length) return res.status(403).json({ error: 'This application is not for your internship.' });
    await db.execute('UPDATE applications SET status = ?, companyFeedback = ? WHERE id = ?', [status, feedback || null, app.id]);
    console.log(`Application for "${app.internshipTitle}" ${status} by ${req.user.name}`);

    // Notify student by email and in-app if company accepted
    if (status === 'company_accepted') {
      try {
        const [studentRows] = await db.execute('SELECT id, name, email FROM users WHERE id = ? LIMIT 1', [app.studentId]);
        const student = studentRows[0];
        if (student && student.email) {
          const mailOptions = {
            from: `InternBridge <${process.env.EMAIL_USER}>`,
            to: student.email,
            subject: 'InternBridge — Your application was accepted by the company',
            html: `
              <p>Hi ${student.name || ''},</p>
              <p>Good news — the company <strong>${req.user.name}</strong> has accepted your application for the internship <strong>${app.internshipTitle}</strong>.</p>
              <p>Please review the offer and confirm or decline it in your InternBridge dashboard.</p>
              <p>— InternBridge</p>`
          };
          try {
            const sent = await sendMail(mailOptions);
            if (!sent.ok) console.error('Failed to send company_accepted email to student:', sent.error);
          } catch (e) {
            console.error('Error sending company_accepted email to student:', e);
          }
        }
      } catch (e) {
        console.error('Error sending student notification for company_accepted:', e);
      }

      // Create in-app notification for student
      try {
        const { createNotification } = require('./notifications');
        await createNotification(app.studentId, 'Application Accepted', `${req.user.name} accepted your application for ${app.internshipTitle}!`, 'success');
      } catch (e) {
        console.error('createNotification error (company_accepted):', e);
      }
    }

    // Notify student in-app when company rejects (info)
    if (status === 'company_rejected') {
      try {
        const { createNotification } = require('./notifications');
        await createNotification(app.studentId, 'Application Update', feedback || `${req.user.name} updated your application.`, 'info');
      } catch (e) {
        console.error('createNotification error (company_rejected):', e);
      }
      // Also email student about rejection
      try {
        const [studentRows2] = await db.execute('SELECT id, name, email FROM users WHERE id = ? LIMIT 1', [app.studentId]);
        const student2 = studentRows2[0];
        if (student2 && student2.email) {
          const mailOptions2 = {
            from: `InternBridge <${process.env.EMAIL_USER}>`,
            to: student2.email,
            subject: 'Application Update — InternBridge',
            html: `
              <p>Dear ${student2.name || ''},</p>
              <p>We regret to inform you that your application for <strong>${app.internshipTitle}</strong> at <strong>${app.company}</strong> was not selected at this time. Keep applying — new opportunities are added regularly on InternBridge.</p>
              <p>— InternBridge</p>`
          };
          try {
            const sent2 = await sendMail(mailOptions2);
            if (!sent2.ok) console.error('Failed to send company_rejected email to student:', sent2.error);
          } catch (e) {
            console.error('Error sending company_rejected email to student:', e);
          }
        }
      } catch (e) {
        console.error('Error looking up student for company_rejected email:', e);
      }
    }

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
      // Notify sysadmin about student's confirmation
      try {
        const [sysRows] = await db.execute("SELECT name,email FROM users WHERE role = 'sysadmin'");
        const sysadmins = sysRows || [];
        if (sysadmins.length) {
          const [companyRows] = await db.execute('SELECT name FROM users WHERE id = ? LIMIT 1', [app.companyId]);
          const company = companyRows[0];
          const subject = 'InternBridge — Student confirmed an internship offer';
          const html = `
            <p>Dear Admin,</p>
            <p>Student <strong>${req.user.name}</strong> has confirmed an internship offer at <strong>${company ? company.name : app.company}</strong> for <strong>${app.internshipTitle}</strong>.</p>
            <p>Please review and perform any necessary system administration steps.</p>
            <p>— InternBridge</p>`;
          for (const sa of sysadmins) {
            if (!sa.email) continue;
            const mailOptions = { from: `InternBridge <${process.env.EMAIL_USER}>`, to: sa.email, subject, html };
            const sent = await sendMail(mailOptions);
            if (!sent.ok) console.error('Failed to send student_confirmed email to sysadmin:', sent.error);
          }
        } else {
          console.warn('No sysadmin accounts found to notify about student confirmation.');
        }
      } catch (e) { console.error('Error notifying sysadmin of student confirmation:', e); }
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
    // If university role is performing approval, ensure the student belongs to the same university
    if (req.user.role === 'university') {
      try {
        const [sRows] = await db.execute('SELECT university FROM users WHERE id = ? LIMIT 1', [app.studentId]);
        const student = sRows[0];
        if (!student) return res.status(404).json({ error: 'Student not found for this application.' });
        if ((req.user.university || '').trim() && (student.university || '').trim() && req.user.university !== student.university) {
          return res.status(403).json({ error: 'You are not authorized to approve applications for students of other universities.' });
        }
      } catch (e) {
        console.error('University ownership check error:', e);
        return res.status(500).json({ error: 'Internal server error.' });
      }
    }
    await db.execute("UPDATE applications SET status = 'sysadmin_approved', sysadminApproved = 1 WHERE id = ?", [app.id]);
    console.log(`System Admin gave final approval: ${app.studentName} at ${app.company}`);
    // Send email to student notifying final approval
    try {
      const [studentRows3] = await db.execute('SELECT id, name, email FROM users WHERE id = ? LIMIT 1', [app.studentId]);
      const student3 = studentRows3[0];
      if (student3 && student3.email) {
        const mailOptions3 = {
          from: `InternBridge <${process.env.EMAIL_USER}>`,
          to: student3.email,
          subject: 'Internship Officially Confirmed — InternBridge',
          html: `
            <p>Congratulations ${student3.name || app.studentName},</p>
            <p>Your internship at <strong>${app.company}</strong> for the position of <strong>${app.internshipTitle}</strong> has been officially confirmed by the university. Please check your dashboard for next steps.</p>
            <p>— InternBridge</p>`
        };
        try {
          const sent3 = await sendMail(mailOptions3);
          if (!sent3.ok) console.error('Failed to send sysadmin_approved email to student:', sent3.error);
        } catch (e) { console.error('Error sending sysadmin_approved email to student:', e); }
      }
    } catch (e) { console.error('Error looking up student for sysadmin_approved email:', e); }

    const [updated] = await db.execute('SELECT * FROM applications WHERE id = ? LIMIT 1', [app.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('Sysadmin approve error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
