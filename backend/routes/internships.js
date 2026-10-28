const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { authMiddleware, requireRole } = require('../middleware/auth');

async function checkInternship(internship) {
  const issues = [];
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [internship.companyId]);
    const c = rows[0];
    if (!c) return ['Company not found'];
    if (!c.pasha && !c.pseb && !c.secp) issues.push('Company not registered with P@SHA/PSEB/SECP');
    if (!c.cmmi) issues.push('Company must hold CMMI Level 2+ or ISO Certification');
    if (!c.operational || parseInt(c.operational) < 3) issues.push('Company must be operational for at least 3 years');
    const minWeeks = internship.type === 'part-time' ? 16 : 8;
    if ((internship.durationWeeks || 0) < minWeeks) issues.push(`Duration must be at least ${minWeeks} weeks for ${internship.type || 'full-time'}`);
    if (internship.isRemote) issues.push('Remote internships are not accepted — on-site only');
    return issues;
  } catch (err) {
    console.error('checkInternship error:', err);
    return ['Unable to verify company details.'];
  }
}

// GET /api/internships — public listing (only sysadmin-approved, from verified companies)
// Supports optional filters: city, search (title/company), type, stipendMin, stipendMax, durationMin, durationMax
router.get('/', async (req, res) => {
  const { city, search, type, stipendMin, stipendMax, durationMin, durationMax } = req.query;
  try {
    const verified = await db.execute("SELECT id FROM users WHERE role = 'company' AND status = 'verified'");
    const verifiedIds = (verified[0] || []).map(r => r.id);

    let sql = 'SELECT * FROM internships WHERE status = ? AND sysadminApproved = 1';
    const params = ['open'];
    if (verifiedIds.length) {
      sql += ` AND companyId IN (${verifiedIds.map(() => '?').join(',')})`;
      params.push(...verifiedIds);
    }
    if (city) {
      sql += ' AND LOWER(city) LIKE ?';
      params.push(`%${city.toLowerCase()}%`);
    }
    if (search) {
      sql += ' AND (LOWER(title) LIKE ? OR LOWER(company) LIKE ?)';
      params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`);
    }
    // Filter by type (exact match, e.g. 'full-time' or 'part-time')
    if (type) {
      sql += ' AND LOWER(type) = ?';
      params.push(type.toLowerCase());
    }
    // Stipend numeric range filtering. Many records use 'Not specified' — ensure stipend looks numeric before casting.
    if (stipendMin) {
      sql += " AND stipend REGEXP '^[0-9]' AND CAST(stipend AS SIGNED) >= ?";
      params.push(parseInt(stipendMin, 10) || 0);
    }
    if (stipendMax) {
      sql += " AND stipend REGEXP '^[0-9]' AND CAST(stipend AS SIGNED) <= ?";
      params.push(parseInt(stipendMax, 10) || 0);
    }
    // Duration (weeks) filtering
    if (durationMin) {
      sql += ' AND durationWeeks >= ?';
      params.push(parseInt(durationMin, 10) || 0);
    }
    if (durationMax) {
      sql += ' AND durationWeeks <= ?';
      params.push(parseInt(durationMax, 10) || 0);
    }
    const [rows] = await db.execute(sql, params);
    const list = [];
    for (const i of rows) {
      const [countRows] = await db.execute('SELECT COUNT(*) as c FROM applications WHERE internshipId = ?', [i.id]);
      const applicantsCount = countRows[0] ? countRows[0].c : 0;
      list.push({ ...i, applicantsCount });
    }
    res.json(list);
  } catch (err) {
    console.error('List internships error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/internships/company/mine
router.get('/company/mine', authMiddleware, requireRole('company'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM internships WHERE companyId = ?', [req.user.id]);
    const list = [];
    for (const i of rows) {
      const [countRows] = await db.execute('SELECT COUNT(*) as c FROM applications WHERE internshipId = ?', [i.id]);
      const applicantsCount = countRows[0] ? countRows[0].c : 0;
      list.push({ ...i, applicantsCount });
    }
    res.json(list);
  } catch (err) {
    console.error('Company internships error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/internships/pending-approval — sysadmin only
router.get('/pending-approval', authMiddleware, requireRole('sysadmin'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM internships WHERE sysadminApproved = 0 AND status = ?', ['open']);
    const pending = [];
    for (const i of rows) {
      const criteriaIssues = await checkInternship(i);
      pending.push({ ...i, criteriaIssues });
    }
    res.json(pending);
  } catch (err) {
    console.error('Pending approval error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/internships/all — university/sysadmin
router.get('/all', authMiddleware, requireRole('university', 'sysadmin'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM internships');
    const result = [];
    for (const i of rows) {
      const [countRows] = await db.execute('SELECT COUNT(*) as c FROM applications WHERE internshipId = ?', [i.id]);
      const applicantsCount = countRows[0] ? countRows[0].c : 0;
      const criteriaIssues = await checkInternship(i);
      result.push({ ...i, applicantsCount, criteriaIssues });
    }
    res.json(result);
  } catch (err) {
    console.error('All internships error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// GET /api/internships/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM internships WHERE id = ? LIMIT 1', [parseInt(req.params.id)]);
    const internship = rows[0];
    if (!internship) return res.status(404).json({ error: 'Internship not found.' });
    const [countRows] = await db.execute('SELECT COUNT(*) as c FROM applications WHERE internshipId = ?', [internship.id]);
    const applicantsCount = countRows[0] ? countRows[0].c : 0;
    const [companyRows] = await db.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [internship.companyId]);
    const company = companyRows[0];
    res.json({
      ...internship,
      applicantsCount,
      companyEmail: company ? company.email : null,
      companyCity: company ? company.city : null,
      companyCmmi: company ? company.cmmi : null,
    });
  } catch (err) {
    console.error('Get internship error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/internships — company posts
router.post('/', authMiddleware, requireRole('company'), async (req, res) => {
  try {
    const [companyRows] = await db.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    const company = companyRows[0];
    if (!company || company.status !== 'verified')
      return res.status(403).json({ error: 'Your company must be verified before posting internships.' });

    const { title, city, deadline, description, stipend, type, durationWeeks, isRemote } = req.body;
    if (!title || !city || !deadline || !description)
      return res.status(400).json({ error: 'Title, city, deadline, and description are required.' });

    const createdAt = new Date().toISOString().split('T')[0];
    let timeSlots = JSON.stringify([]);
    if (req.body.time_slots && Array.isArray(req.body.time_slots) && req.body.time_slots.length > 0) {
      const mappedSlots = req.body.time_slots.map(s => ({
        id: Date.now() + Math.floor(Math.random() * 10000),
        day: s.day || '',
        startTime: s.startTime || '',
        endTime: s.endTime || '',
        type: s.type || 'full-time',
        capacity: parseInt(s.capacity) || 1,
        bookedBy: []
      }));
      timeSlots = JSON.stringify(mappedSlots);
    }
    const sysadminApproved = 0;
    const status = 'open';

    const insertSQL = `INSERT INTO internships
      (companyId,company,title,city,deadline,description,stipend,type,durationWeeks,isRemote,status,sysadminApproved,approvedAt,rejectionNote,timeSlots,createdAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const params = [req.user.id, req.user.name, title, city, deadline, description, stipend || 'Not specified', type || 'full-time', parseInt(durationWeeks) || 8, !!isRemote ? 1 : 0, status, sysadminApproved, null, null, timeSlots, createdAt];
    const [result] = await db.execute(insertSQL, params);
    const newId = result.insertId;
    console.log(`Internship submitted for approval: "${title}" by ${req.user.name}`);
    const [newRows] = await db.execute('SELECT * FROM internships WHERE id = ? LIMIT 1', [newId]);
    res.status(201).json(newRows[0]);
  } catch (err) {
    console.error('Create internship error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/internships/:id/approve — sysadmin/university approves
router.patch('/:id/approve', authMiddleware, requireRole('sysadmin', 'university'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM internships WHERE id = ? LIMIT 1', [parseInt(req.params.id)]);
    const item = rows[0];
    if (!item) return res.status(404).json({ error: 'Internship not found.' });
    const approvedAt = new Date().toISOString();
    // Accept optional override reason when admin approves despite eligibility issues
    const overrideReason = (req.body && (req.body.override_reason || req.body.overrideReason)) ? String(req.body.override_reason || req.body.overrideReason).trim() : null;
    if (overrideReason) {
      await db.execute('UPDATE internships SET sysadminApproved = 1, approvedAt = ?, rejectionNote = NULL, override_reason = ? WHERE id = ?', [approvedAt, overrideReason, item.id]);
      console.log(`Internship approved with override by ${req.user ? req.user.name : 'admin'}: "${item.title}" — reason: ${overrideReason}`);
    } else {
      await db.execute('UPDATE internships SET sysadminApproved = 1, approvedAt = ?, rejectionNote = NULL, override_reason = NULL WHERE id = ?', [approvedAt, item.id]);
      console.log(`Internship approved by System Admin: "${item.title}"`);
    }
    const [updated] = await db.execute('SELECT * FROM internships WHERE id = ? LIMIT 1', [item.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('Approve internship error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/internships/:id — company edits their internship (limited fields)
router.patch('/:id', authMiddleware, requireRole('company'), async (req, res) => {
  try {
    const iid = parseInt(req.params.id);
    const [rows] = await db.execute('SELECT * FROM internships WHERE id = ? AND companyId = ? LIMIT 1', [iid, req.user.id]);
    const item = rows[0];
    if (!item) return res.status(404).json({ error: 'Internship not found or access denied' });
    // Only allow editing when not yet sysadmin approved
    if (item.sysadminApproved && item.sysadminApproved == 1) return res.status(403).json({ error: 'Approved internships cannot be edited.' });

    const allowed = ['title','city','deadline','description','stipend','type','durationWeeks','isRemote'];
    const updates = [];
    const params = [];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        let val = req.body[key];
        if (key === 'durationWeeks') val = parseInt(val) || 0;
        if (key === 'isRemote') val = !!val ? 1 : 0;
        updates.push(`${key} = ?`);
        params.push(val);
      }
    }
    if (updates.length) {
      params.push(iid);
      const sql = `UPDATE internships SET ${updates.join(', ')} WHERE id = ?`;
      await db.execute(sql, params);
    }
    const [updatedRows] = await db.execute('SELECT * FROM internships WHERE id = ? LIMIT 1', [iid]);
    res.json(updatedRows[0]);
  } catch (err) {
    console.error('Edit internship error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// PATCH /api/internships/:id/reject — sysadmin/university rejects
router.patch('/:id/reject', authMiddleware, requireRole('sysadmin', 'university'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM internships WHERE id = ? LIMIT 1', [parseInt(req.params.id)]);
    const item = rows[0];
    if (!item) return res.status(404).json({ error: 'Internship not found.' });
    const note = req.body.note || 'Does not meet Riphah criteria.';
    await db.execute('UPDATE internships SET sysadminApproved = 0, status = ?, rejectionNote = ? WHERE id = ?', ['closed', note, item.id]);
    console.warn(`Internship rejected by System Admin: "${item.title}"`);
    const [updated] = await db.execute('SELECT * FROM internships WHERE id = ? LIMIT 1', [item.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('Reject internship error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/internships/:id/slots — company adds time slots
router.post('/:id/slots', authMiddleware, requireRole('company'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM internships WHERE id = ? AND companyId = ? LIMIT 1', [parseInt(req.params.id), req.user.id]);
    const item = rows[0];
    if (!item) return res.status(404).json({ error: 'Internship not found.' });
    const { date, time, capacity, notes } = req.body;
    if (!date || !time) return res.status(400).json({ error: 'Date and time are required.' });
    const slot = { id: Date.now(), date, time, capacity: parseInt(capacity) || 1, notes: notes || '', bookedBy: [] };
    const currentSlots = item.timeSlots ? JSON.parse(item.timeSlots) : [];
    currentSlots.push(slot);
    await db.execute('UPDATE internships SET timeSlots = ? WHERE id = ?', [JSON.stringify(currentSlots), item.id]);
    console.log(`Time slot added to "${item.title}" by ${req.user.name}`);
    res.status(201).json(slot);
  } catch (err) {
    console.error('Add slot error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/internships/:id/slots/:slotId — company removes slot
router.delete('/:id/slots/:slotId', authMiddleware, requireRole('company'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM internships WHERE id = ? AND companyId = ? LIMIT 1', [parseInt(req.params.id), req.user.id]);
    const item = rows[0];
    if (!item) return res.status(404).json({ error: 'Internship not found.' });
    const currentSlots = item.timeSlots ? JSON.parse(item.timeSlots) : [];
    const filtered = currentSlots.filter(s => s.id !== parseInt(req.params.slotId));
    await db.execute('UPDATE internships SET timeSlots = ? WHERE id = ?', [JSON.stringify(filtered), item.id]);
    res.json({ message: 'Time slot removed.' });
  } catch (err) {
    console.error('Remove slot error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/internships/:id/slots/:slotId/book — student books a slot
router.post('/:id/slots/:slotId/book', authMiddleware, requireRole('student'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM internships WHERE id = ? LIMIT 1', [parseInt(req.params.id)]);
    const item = rows[0];
    if (!item) return res.status(404).json({ error: 'Internship not found.' });
    const slots = item.timeSlots ? JSON.parse(item.timeSlots) : [];
    const slot = slots.find(s => s.id === parseInt(req.params.slotId));
    if (!slot) return res.status(404).json({ error: 'Time slot not found.' });
    if (slot.bookedBy && slot.bookedBy.includes(req.user.id)) return res.status(409).json({ error: 'You already booked this slot.' });
    if ((slot.bookedBy ? slot.bookedBy.length : 0) >= slot.capacity) return res.status(400).json({ error: 'This slot is fully booked.' });
    slot.bookedBy = slot.bookedBy || [];
    slot.bookedBy.push(req.user.id);
    await db.execute('UPDATE internships SET timeSlots = ? WHERE id = ?', [JSON.stringify(slots), item.id]);
    // Link slot to application
    await db.execute('UPDATE applications SET slotId = ? WHERE studentId = ? AND internshipId = ?', [slot.id, req.user.id, item.id]);
    console.log(`${req.user.name} booked interview slot for "${item.title}"`);
    res.json({ message: 'Slot booked successfully.', slot });
  } catch (err) {
    console.error('Book slot error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// DELETE /api/internships/:id — company closes
router.delete('/:id', authMiddleware, requireRole('company'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM internships WHERE id = ? AND companyId = ? LIMIT 1', [parseInt(req.params.id), req.user.id]);
    const item = rows[0];
    if (!item) return res.status(404).json({ error: 'Internship not found.' });
    await db.execute('UPDATE internships SET status = ? WHERE id = ?', ['closed', item.id]);
    console.log(`Internship closed: "${item.title}" by ${req.user.name}`);
    res.json({ message: 'Internship closed.' });
  } catch (err) {
    console.error('Close internship error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
