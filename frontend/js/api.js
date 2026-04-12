// ================================================================
// InternBridge — api.js  (In-memory DB with localStorage persistence)
// ================================================================

const _dbDefaults = {
  users: [
    { id:1, name:'University Admin',  email:'S@riphah.edu.pk',    password:'Salam123',    role:'university', university:'Riphah International University', department:'Faculty of Computing' },
    { id:2, name:'System Admin',      email:'A@riphah.edu.pk', password:'Salam321', role:'sysadmin' },
  ],
  internships:[], applications:[], complaints:[], universityFeedback:[], selfFoundInternships:[],
  company_time_slots:[], student_free_time:[],
  activityLog:[],
  criteria:{
    studentEligibility:[
      {id:1,text:'Must have completed at least 60 credited hours',editable:true},
      {id:2,text:'Must have a CGPA of 2.0 or above',editable:true},
      {id:3,text:'Must have an elective course available for substitution',editable:true},
      {id:4,text:'Must be currently enrolled at Riphah International University',editable:true},
    ],
    companyEligibility:[
      {id:1,text:'Must be a software/IT organization only (no banks, NGOs, etc.)',editable:true},
      {id:2,text:'Must be registered with P@SHA / PSEB / SECP',editable:true},
      {id:3,text:'Must hold at least CMMI Level 2 or ISO Certification',editable:true},
      {id:4,text:'Must have been operational for more than 3 years',editable:true},
      {id:5,text:'Startups must have been operational for at least 1 year',editable:true},
      {id:6,text:'Internship must be 8 weeks full-time or 16 weeks part-time (minimum)',editable:true},
      {id:7,text:'Internship must be ongoing at the time of registration',editable:true},
      {id:8,text:'Remote internships are NOT accepted — must be on-site',editable:true},
    ],
    importantNotes:[
      {id:1,text:'The internship replaces the elective course if approved',editable:true},
      {id:2,text:'Credited internships can be registered in any session (Fall, Spring, Summer)',editable:true},
      {id:3,text:'Minimum 180 hours required for 3 credit hours',editable:true},
      {id:4,text:'Internships without formal department approval will not be credited',editable:true},
      {id:5,text:'Students must submit Offer Letter and Company Profile to the department',editable:true},
      {id:6,text:'Daily Attendance Sheet and Completion Certificate must be uploaded after finishing',editable:true},
      {id:7,text:'Only one internship per semester is permitted',editable:true},
    ],
    requiredDocs:[
      {id:1,text:'Internship Offer Letter (on company letterhead)',editable:true},
      {id:2,text:'Company Profile or Website',editable:true},
      {id:3,text:'Supervisor approval email or letter',editable:true},
      {id:4,text:'Internship Completion Certificate',editable:true},
      {id:5,text:'Daily Attendance Sheet',editable:true},
    ],
    partnerCompanies:[], creditedCompanies:[],
  },
  _next:{users:3,internships:1,applications:1,log:1,complaints:1,feedback:1,selfFound:1,company_time_slots:1,student_free_time:1},
};

// Load from localStorage or use defaults
let _db;
try {
  const saved = localStorage.getItem('ib_db');
  _db = saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(_dbDefaults));
  // Ensure all keys exist (in case of schema updates)
  if (!_db._next) _db._next = { ...JSON.parse(JSON.stringify(_dbDefaults))._next };
  if (!_db.criteria) _db.criteria = JSON.parse(JSON.stringify(_dbDefaults.criteria));
  if (!_db.selfFoundInternships) _db.selfFoundInternships = [];
  if (!_db.complaints) _db.complaints = [];
  if (!_db.universityFeedback) _db.universityFeedback = [];
  if (!_db.internships) _db.internships = [];
  if (!_db.applications) _db.applications = [];
  if (!_db.company_time_slots) _db.company_time_slots = [];
  if (!_db.student_free_time) _db.student_free_time = [];
} catch(e) {
  _db = JSON.parse(JSON.stringify(_dbDefaults));
}

function _save() {
  try { localStorage.setItem('ib_db', JSON.stringify(_db)); } catch(e) {}
}

function _delay() { return new Promise(r => setTimeout(r, 60)); }

function _timeOverlap(start1, end1, start2, end2) {
  // Convert to minutes since midnight
  const toMin = t => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const s1 = toMin(start1), e1 = toMin(end1), s2 = toMin(start2), e2 = toMin(end2);
  return s1 < e2 && s2 < e1;
}

function _log(e, t='info') {
  _db.activityLog.unshift({ id: _db._next.log++, time: new Date().toISOString(), event: e, type: t });
  if (_db.activityLog.length > 80) _db.activityLog.pop();
  _save();
}
function _dec(t) {
  try { return JSON.parse(decodeURIComponent(escape(atob((t||'').split('.')[1])))); }
  catch (e) { return null; }
}

// Try to obtain the latest token from localStorage, with a short polling window
async function _getLatestToken() {
  // quick poll for up to 500ms in case code calls API immediately after login
  for (let i = 0; i < 10; i++) {
    try {
      const raw = localStorage.getItem('ib_token');
      if (raw && raw !== 'null') return typeof raw === 'string' && raw.startsWith('Bearer ') ? raw.split(' ')[1] : raw;
    } catch (e) {}
    await new Promise(r => setTimeout(r, 50));
  }
  // fallback to in-memory authToken
  try {
    const raw = (typeof authToken !== 'undefined' ? authToken : null);
    return raw && typeof raw === 'string' && raw.startsWith('Bearer ') ? raw.split(' ')[1] : raw;
  } catch (e) { return null; }
}

// Resolve token from arg, global `authToken`, or localStorage
function _resolveToken(t) {
  if (t) return typeof t === 'string' && t.startsWith('Bearer ') ? t.split(' ')[1] : t;
  if (typeof authToken !== 'undefined' && authToken) return typeof authToken === 'string' && authToken.startsWith('Bearer ') ? authToken.split(' ')[1] : authToken;
  const ls = localStorage.getItem('ib_token');
  if (ls && ls !== 'null') return typeof ls === 'string' && ls.startsWith('Bearer ') ? ls.split(' ')[1] : ls;
  return null;
}

function _eligStudent(s) {
  const i = [];
  if ((s.creditHours||0) < 60) i.push('Less than 60 credit hours (' + (s.creditHours||0) + '/60)');
  if ((s.cgpa||0) < 2.0) i.push('CGPA below 2.0 (current: ' + (s.cgpa||0) + ')');
  if (!s.electiveCourse) i.push('No elective course listed');
  return i;
}

function _eligInternship(i) {
  const issues = [];
  const co = _db.users.find(u => u.id === i.companyId);
  if (!co) return ['Company not found'];
  if (!co.pasha && !co.pseb && !co.secp) issues.push('Not registered with P@SHA/PSEB/SECP');
  if (!co.cmmi) issues.push('No CMMI Level 2+ or ISO Certification');
  if ((i.durationWeeks||0) < 8) issues.push('Duration less than 8 weeks');
  return issues;
}

const api = {
  login: async (email, password) => {
    // Try backend API first. Only fall back to in-memory when fetch itself fails (network/offline).
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // For authentication errors (401/400), propagate error to caller instead of falling back
        throw new Error(body.error || body.message || 'Invalid email or password.');
      }
      const data = await res.json();
      // Persist backend token to global `authToken` (if present) and localStorage so other modules can use it
      try {
        if (data && data.token) {
          try { authToken = data.token; } catch (e) {}
          if (typeof window !== 'undefined') window.authToken = data.token;
          try { localStorage.setItem('ib_token', data.token); } catch (e) {}
        }
      } catch (e) {}
      return data; // expects { token, user }
    } catch (err) {
      // Only use in-memory fallback when fetch threw (TypeError) indicating network/offline.
      if (!(err instanceof TypeError)) throw err;
      await _delay();
      const u = _db.users.find(u => u.email === email && u.password === password);
      if (!u) throw new Error('Invalid email or password.');
      if (u.role === 'student' && u.verificationStatus !== 'approved')
        throw new Error(u.verificationStatus === 'rejected'
          ? 'Your account was rejected. Contact Faculty of Computing.'
          : 'Account pending university admin verification. Please wait.');
      if (u.role === 'company' && u.status !== 'verified')
        throw new Error(u.status === 'rejected'
          ? 'Your company was rejected. Contact university admin.'
          : 'Company account pending university admin verification. Please wait.');
      _log(u.name + ' logged in', 'info');
      return { token: null, user: { id:u.id, name:u.name, email:u.email, role:u.role } };
    }
  },

  registerStudent: async (d) => {
    await _delay();
    if (!d.name||!d.email||!d.password) throw new Error('Name, email and password are required.');
    if (_db.users.find(u => u.email === d.email)) throw new Error('This email is already registered.');
    _db.users.push({
      id:_db._next.users++, name:d.name, email:d.email, password:d.password, role:'student',
      university:'Riphah International University', program:d.program||'', semester:parseInt(d.semester)||0,
      cgpa:parseFloat(d.cgpa)||0, creditHours:parseInt(d.creditHours)||0, electiveCourse:d.electiveCourse||'',
      skills:d.skills||'', transcriptDoc:d.transcriptDoc||null, enrollmentDoc:d.enrollmentDoc||null, cv:null,
      verificationStatus:'pending', verificationNote:'', registeredAt:new Date().toISOString(),
    });
    _log('Student registered (pending): ' + d.name, 'info');
    _save();
    return { message: 'Registration submitted! Awaiting university admin verification.' };
  },

  registerCompany: async (d) => {
    // Try backend API first
    try {
      const res = await fetch('/api/auth/register/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d)
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || body.message || 'Failed to register company.');
      }
      return await res.json();
    } catch (err) {
      // Fallback to in-memory simulation for offline/dev
      await _delay();
      if (!d.name||!d.email||!d.password) throw new Error('Name, email and password are required.');
      if (_db.users.find(u => u.email === d.email)) throw new Error('This email is already registered.');
      _db.users.push({
        id:_db._next.users++, name:d.name, email:d.email, password:d.password, role:'company',
        city:d.city||'', pasha:d.pasha||'', pseb:d.pseb||'', secp:d.secp||'',
        cmmi:d.cmmi||'', operational:d.operational||'',
        regCertDoc:d.regCertDoc||null, cmmiDoc:d.cmmiDoc||null,
        status:'pending', rejectionNote:'', registeredAt:new Date().toISOString(),
      });
      _log('Company registered (pending): ' + d.name, 'warning');
      _save();
      return { message: 'Company registered. Awaiting university admin verification.' };
    }
  },

  // Forgot / Reset password (tries backend first; falls back to in-memory simulation)
  forgotPassword: async (email) => {
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
      });
      if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to request password reset.'); }
      return await res.json();
    } catch (err) {
      // Fallback: simulate token and store in localStorage for dev
      await _delay();
      const u = _db.users.find(u => u.email && u.email.toLowerCase() === (email||'').toLowerCase());
      if (!u) return { message: 'If an account exists, a password reset link has been sent to the email address.' };
      const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
      const expires = Date.now() + 3600 * 1000;
      const resets = JSON.parse(localStorage.getItem('ib_password_resets') || '{}');
      resets[token] = { userId: u.id, expires }; localStorage.setItem('ib_password_resets', JSON.stringify(resets));
      console.log('DEV password reset link:', `${location.origin}/reset-password.html?token=${token}`);
      return { message: 'If an account exists, a password reset link has been sent to the email address.' };
    }
  },

  resetPassword: async (token, newPassword) => {
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, newPassword })
      });
      if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to reset password.'); }
      return await res.json();
    } catch (err) {
      // Fallback: check localStorage simulated resets
      await _delay();
      const resets = JSON.parse(localStorage.getItem('ib_password_resets') || '{}');
      const r = resets[token];
      if (!r || r.expires < Date.now()) throw new Error('Invalid or expired token.');
      const u = _db.users.find(x => x.id === r.userId);
      if (!u) throw new Error('User not found.');
      u.password = newPassword; // in-memory
      delete resets[token]; localStorage.setItem('ib_password_resets', JSON.stringify(resets)); _save();
      return { message: 'Password has been reset successfully.' };
    }
  },

  getInternships: async (p, t) => {
    // Call backend API with optional query params. Fallback to in-memory if backend unavailable.
    try {
      const qs = [];
      if (p && p.city) qs.push('city=' + encodeURIComponent(p.city));
      if (p && p.search) qs.push('search=' + encodeURIComponent(p.search));
      const url = '/api/internships' + (qs.length ? ('?' + qs.join('&')) : '');
      // build Authorization header safely from token param which may be 'Bearer <token>' or just '<token>'
      const headers = {};
      if (t) {
        const tok = typeof t === 'string' && t.startsWith('Bearer ') ? t.split(' ')[1] : t;
        headers['Authorization'] = 'Bearer ' + tok;
      }
      const res = await fetch(url, { headers });
      if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to fetch internships'); }
      const list = await res.json();
      // parse timeSlots if stored as JSON string
      return list.map(i => ({ ...i, timeSlots: i.timeSlots && typeof i.timeSlots === 'string' ? JSON.parse(i.timeSlots) : (i.timeSlots||[]) }));
    } catch (err) {
      // fallback to in-memory
      await _delay();
      const vIds = _db.users.filter(u => u.role === 'company' && u.status === 'verified').map(u => u.id);
      let list = _db.internships.filter(i => i.status === 'open' && i.riphahApproved && vIds.includes(i.companyId));
      if (p && p.city) list = list.filter(i => i.city.toLowerCase().includes(p.city.toLowerCase()));
      if (p && p.search) list = list.filter(i => i.title.toLowerCase().includes(p.search.toLowerCase()) || i.company.toLowerCase().includes(p.search.toLowerCase()));
      return list.map(i => ({ ...i, applicantsCount: _db.applications.filter(a => a.internshipId === i.id).length, eligibilityIssues: _eligInternship(i), timeSlots: _db.company_time_slots.filter(s => s.internshipId === i.id) }));
    }
  },

  getAllInternshipsForAdmin: async () => {
    try {
      const tok = await _getLatestToken();
      const res = await fetch('/api/internships/all', { headers: tok ? { 'Authorization': 'Bearer ' + tok } : {} });
      if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to fetch'); }
      const rows = await res.json();
      return rows.map(i => ({
        ...i,
        timeSlots: i.timeSlots && typeof i.timeSlots === 'string' ? JSON.parse(i.timeSlots) : (i.timeSlots||[]),
        eligibilityIssues: i.criteriaIssues || i.eligibilityIssues || [],
      }));
    } catch (err) {
      await _delay(); return _db.internships.map(i => ({ ...i, applicantsCount: _db.applications.filter(a => a.internshipId === i.id).length, eligibilityIssues: _eligInternship(i) }));
    }
  },

  getMyInternships: async (t) => {
    try {
      const headers = {};
      const tok = await _getLatestToken();
      if (tok) headers['Authorization'] = 'Bearer ' + tok;
      const res = await fetch('/api/internships/company/mine', { headers });
      if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to fetch'); }
      const rows = await res.json();
      return rows.map(i => ({ ...i, timeSlots: i.timeSlots && typeof i.timeSlots === 'string' ? JSON.parse(i.timeSlots) : (i.timeSlots||[]) }));
    } catch (err) {
      await _delay();
      const clean = await _getLatestToken();
      const u = _dec(clean);
      return _db.internships.filter(i => i.companyId === (u && u.id)).map(i => ({ ...i, applicantsCount: _db.applications.filter(a => a.internshipId === i.id).length }));
    }
  },

  postInternship: async (d, t) => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (t) { const tok = typeof t === 'string' && t.startsWith('Bearer ') ? t.split(' ')[1] : t; headers['Authorization'] = 'Bearer ' + tok; }
      const res = await fetch('/api/internships', { method: 'POST', headers, body: JSON.stringify(d) });
      if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to create internship'); }
      const row = await res.json();
      row.timeSlots = row.timeSlots && typeof row.timeSlots === 'string' ? JSON.parse(row.timeSlots) : (row.timeSlots||[]);
      return row;
    } catch (err) {
      await _delay(); const u = _dec(t); // fallback
      const item = { id:_db._next.internships++, companyId:u.id, company:u.name, title:d.title, city:d.city, deadline:d.deadline, stipend:d.stipend||'Not specified', duration:d.duration||(d.durationWeeks + ' weeks ' + d.type), durationWeeks:parseInt(d.durationWeeks)||8, type:d.type||'full-time', description:d.description||'', status:'open', riphahApproved:false, rejectionNote:'', createdAt:new Date().toISOString().split('T')[0] };
      _db.internships.push(item);
      if (d.time_slots && Array.isArray(d.time_slots)) d.time_slots.forEach(slot => { _db.company_time_slots.push({ id: _db._next.company_time_slots ? ++_db._next.company_time_slots : (_db._next.company_time_slots = 1), internshipId: item.id, day: slot.day, startTime: slot.startTime, endTime: slot.endTime, type: slot.type }); });
      _log('Internship posted (pending approval): ' + d.title, 'info'); _save(); return item;
    }
  },

  approveInternship: async (id) => {
    try {
      const tok = await _getLatestToken();
      const res = await fetch('/api/internships/' + id + '/approve', { method: 'PATCH', headers: tok ? { 'Authorization': 'Bearer ' + tok } : {} });
      if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to approve'); }
      const row = await res.json(); row.timeSlots = row.timeSlots && typeof row.timeSlots === 'string' ? JSON.parse(row.timeSlots) : (row.timeSlots||[]); return row;
    } catch (err) { await _delay(); const i = _db.internships.find(x => x.id === id); if (!i) throw new Error('Not found.'); i.riphahApproved = true; i.approvedAt = new Date().toISOString(); _log('Internship approved: ' + i.title, 'success'); _save(); return i; }
  },

  rejectInternship: async (id, note) => {
    try {
      const res = await fetch('/api/internships/' + id + '/reject', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }) });
      if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to reject'); }
      const row = await res.json(); row.timeSlots = row.timeSlots && typeof row.timeSlots === 'string' ? JSON.parse(row.timeSlots) : (row.timeSlots||[]); return row;
    } catch (err) { await _delay(); const i = _db.internships.find(x => x.id === id); if (!i) throw new Error('Not found.'); i.riphahApproved = false; i.status = 'closed'; i.rejectionNote = note||''; _log('Internship rejected: ' + i.title, 'warning'); _save(); return i; }
  },

  closeInternship: async (id, t) => {
    try {
      const headers = {};
      if (t) { const tok = typeof t === 'string' && t.startsWith('Bearer ') ? t.split(' ')[1] : t; headers['Authorization'] = 'Bearer ' + tok; }
      const res = await fetch('/api/internships/' + id, { method: 'DELETE', headers });
      if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to close'); }
      return await res.json();
    } catch (err) { await _delay(); const u = _dec(t); const i = _db.internships.find(x => x.id === id && x.companyId === u.id); if (!i) throw new Error('Not found.'); i.status = 'closed'; _save(); return { message: 'Closed.' }; }
  },

  apply: async (internshipId, t) => {
    const headers = { 'Content-Type': 'application/json' };
    if (t) { const tok = typeof t === 'string' && t.startsWith('Bearer ') ? t.split(' ')[1] : t; headers['Authorization'] = 'Bearer ' + tok; }
    const res = await fetch('/api/applications', { method: 'POST', headers, body: JSON.stringify({ internshipId: parseInt(internshipId) }) });
    if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to apply'); }
    return await res.json();
  },

  getMyApplications: async (t) => {
    const headers = {};
    if (t) { const tok = typeof t === 'string' && t.startsWith('Bearer ') ? t.split(' ')[1] : t; headers['Authorization'] = 'Bearer ' + tok; }
    const res = await fetch('/api/applications/mine', { headers });
    if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to fetch'); }
    try { return await res.json(); } catch (e) { throw new Error('Invalid server response while fetching applications.'); }
  },

  studentDecideApplication: async (id, decision, t) => {
    const headers = { 'Content-Type': 'application/json' };
    if (t) { const tok = typeof t === 'string' && t.startsWith('Bearer ') ? t.split(' ')[1] : t; headers['Authorization'] = 'Bearer ' + tok; }
    const res = await fetch('/api/applications/' + id + '/student-decision', { method: 'PATCH', headers, body: JSON.stringify({ decision }) });
    if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to update'); }
    return await res.json();
  },

  getCompanyApplications: async (t) => {
    const headers = {};
    const tok = await _getLatestToken();
    if (tok) headers['Authorization'] = 'Bearer ' + tok;
    const res = await fetch('/api/applications/company', { headers });
    if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to fetch'); }
    return await res.json();
  },

  getAllApplications: async () => {
    const tok = await _getLatestToken();
    const res = await fetch('/api/applications/all', { headers: tok ? { 'Authorization': 'Bearer ' + tok } : {} });
    if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to fetch'); }
    return await res.json();
  },

  updateApplication: async (id, status, feedback, t) => {
    const headers = { 'Content-Type': 'application/json' };
    if (t) { const tok = typeof t === 'string' && t.startsWith('Bearer ') ? t.split(' ')[1] : t; headers['Authorization'] = 'Bearer ' + tok; }
    const res = await fetch('/api/applications/' + id, { method: 'PATCH', headers, body: JSON.stringify({ status, feedback }) });
    if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to update'); }
    return await res.json();
  },

  universityApproveApplication: async (id) => {
    const tok = await _getLatestToken();
    const res = await fetch('/api/applications/' + id + '/sysadmin-approve', { method: 'PATCH', headers: tok ? { 'Authorization': 'Bearer ' + tok } : {} });
    if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to approve'); }
    return await res.json();
  },

  submitSelfFoundInternship: async (d, t) => {
    // Try backend API first
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (t) { const tok = typeof t === 'string' && t.startsWith('Bearer ') ? t.split(' ')[1] : t; headers['Authorization'] = 'Bearer ' + tok; }
      const res = await fetch('/api/self-found/submit', { method: 'POST', headers, body: JSON.stringify(d) });
      if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to submit'); }
      return await res.json();
    } catch (err) {
      // Fallback to in-memory for offline/dev
      await _delay();
      const u = _dec(t);
      const sf = {
        id:_db._next.selfFound++, studentId:u.id, studentName:u.name,
        companyName:d.companyName, companyWebsite:d.companyWebsite||'',
        supervisorName:d.supervisorName, supervisorEmail:d.supervisorEmail,
        startDate:d.startDate, endDate:d.endDate, stipend:d.stipend||'Not disclosed',
        workDescription:d.workDescription, offerLetterDoc:d.offerLetterDoc||null,
        status:'pending', adminNote:'', submittedAt:new Date().toISOString(),
      };
      _db.selfFoundInternships.push(sf);
      _log('Self-found internship submitted by ' + u.name, 'info'); _save(); return sf;
    }
  },

  getMySelfFoundInternships: async (t) => {
    try {
      const headers = {};
      if (t) { const tok = typeof t === 'string' && t.startsWith('Bearer ') ? t.split(' ')[1] : t; headers['Authorization'] = 'Bearer ' + tok; }
      const res = await fetch('/api/self-found/mine', { headers });
      if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to fetch'); }
      return await res.json();
    } catch (err) {
      await _delay(); const u = _dec(t); return _db.selfFoundInternships.filter(s => s.studentId === u.id);
    }
  },

  getAllSelfFoundInternships: async () => {
    try {
      const res = await fetch('/api/self-found');
      if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to fetch'); }
      return await res.json();
    } catch (err) {
      await _delay(); return _db.selfFoundInternships.slice();
    }
  },

  reviewSelfFoundInternship: async (id, status, note) => {
    // Backend review endpoint
    try {
      const res = await fetch('/api/self-found/' + id + '/review', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, adminNote: note||'' })
      });
      if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to review'); }
      return await res.json();
    } catch (err) {
      await _delay();
      const sf = _db.selfFoundInternships.find(s => s.id === id);
      if (!sf) throw new Error('Not found.');
      sf.status = status; sf.adminNote = note||''; sf.reviewedAt = new Date().toISOString();
      _log('Self-found ' + status + ' for ' + sf.studentName, status === 'approved' ? 'success' : 'warning');
      _save(); return sf;
    }
  },

  getCompanies: async () => {
    await _delay();
    return _db.users.filter(u => u.role === 'company').map(c => ({
      id:c.id, name:c.name, email:c.email, city:c.city, pasha:c.pasha, pseb:c.pseb, secp:c.secp,
      cmmi:c.cmmi, operational:c.operational, regCertDoc:c.regCertDoc, cmmiDoc:c.cmmiDoc,
      status:c.status||'pending', rejectionNote:c.rejectionNote||'', registeredAt:c.registeredAt,
      internshipsCount:_db.internships.filter(i => i.companyId === c.id).length,
    }));
  },

  updateCompany: async (id, status, note) => {
    await _delay();
    const c = _db.users.find(u => u.id === id && u.role === 'company');
    if (!c) throw new Error('Not found.');
    c.status = status; c.rejectionNote = note||'';
    _log('Company ' + c.name + ' ' + status, status === 'verified' ? 'success' : 'warning');
    _save(); return { message: 'Company ' + status };
  },

  getPendingStudents: async () => {
    await _delay();
    return _db.users.filter(u => u.role === 'student' && u.verificationStatus === 'pending').map(({ password, ...s }) => s);
  },

  getAllStudents: async () => {
    await _delay();
    return _db.users.filter(u => u.role === 'student').map(({ password, ...s }) => s);
  },

  verifyStudent: async (id, status, note) => {
    await _delay();
    const s = _db.users.find(u => u.id === id && u.role === 'student');
    if (!s) throw new Error('Not found.');
    s.verificationStatus = status; s.verificationNote = note||'';
    _log('Student ' + s.name + ' ' + status, status === 'approved' ? 'success' : 'warning');
    _save(); return { message: 'Student ' + status };
  },

  getComplaints: async (t) => {
    const headers = {};
    const token = t || (typeof authToken !== 'undefined' ? authToken : null) || localStorage.getItem('ib_token');
    if (token) { const tok = typeof token === 'string' && token.startsWith('Bearer ') ? token.split(' ')[1] : token; headers['Authorization'] = 'Bearer ' + tok; }
    const res = await fetch('/api/admin/complaints', { headers });
    if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to fetch complaints'); }
    return await res.json();
  },

  submitComplaint: async (d, t) => {
    const headers = { 'Content-Type': 'application/json' };
    if (t) { const tok = typeof t === 'string' && t.startsWith('Bearer ') ? t.split(' ')[1] : t; headers['Authorization'] = 'Bearer ' + tok; }
    const res = await fetch('/api/admin/complaints', { method: 'POST', headers, body: JSON.stringify(d) });
    if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to submit complaint'); }
    return await res.json();
  },

  respondComplaint: async (id, response, t) => {
    const headers = { 'Content-Type': 'application/json' };
    if (t) { const tok = typeof t === 'string' && t.startsWith('Bearer ') ? t.split(' ')[1] : t; headers['Authorization'] = 'Bearer ' + tok; }
    const res = await fetch('/api/admin/complaints/' + id, { method: 'PATCH', headers, body: JSON.stringify({ response }) });
    if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to respond to complaint'); }
    return await res.json();
  },

  getMyFeedback: async (t) => {
    const headers = {};
    if (t) { const tok = typeof t === 'string' && t.startsWith('Bearer ') ? t.split(' ')[1] : t; headers['Authorization'] = 'Bearer ' + tok; }
    const res = await fetch('/api/profile/feedback', { headers });
    if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to fetch feedback'); }
    try { return await res.json(); } catch (e) { throw new Error('Invalid server response while fetching feedback.'); }
  },

  sendFeedback: async (d, t) => {
    const headers = { 'Content-Type': 'application/json' };
    // token may be passed or available globally as authToken or in localStorage
    const token = t || (typeof authToken !== 'undefined' ? authToken : null) || localStorage.getItem('ib_token');
    if (token) { const tok = typeof token === 'string' && token.startsWith('Bearer ') ? token.split(' ')[1] : token; headers['Authorization'] = 'Bearer ' + tok; }
    const res = await fetch('/api/admin/feedback', { method: 'POST', headers, body: JSON.stringify(d) });
    if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to send feedback'); }
    return await res.json();
  },

  saveStudentFreeTime: async (freeTime, t) => {
    const headers = { 'Content-Type': 'application/json' };
    const token = t || (typeof authToken !== 'undefined' ? authToken : null) || localStorage.getItem('ib_token');
    if (token) { const tok = typeof token === 'string' && token.startsWith('Bearer ') ? token.split(' ')[1] : token; headers['Authorization'] = 'Bearer ' + tok; }
    const res = await fetch('/api/profile/free-time', { method: 'POST', headers, body: JSON.stringify({ freeTime }) });
    if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to save free time'); }
    return await res.json();
  },

  getStudentFreeTime: async (t) => {
    const headers = {};
    const token = t || (typeof authToken !== 'undefined' ? authToken : null) || localStorage.getItem('ib_token');
    if (token) { const tok = typeof token === 'string' && token.startsWith('Bearer ') ? token.split(' ')[1] : token; headers['Authorization'] = 'Bearer ' + tok; }
    const res = await fetch('/api/profile/free-time', { headers });
    if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to fetch free time'); }
    try { return await res.json(); } catch (e) { throw new Error('Invalid server response while fetching free time.'); }
  },

  getAdminStats: async () => {
    await _delay();
    const cos = _db.users.filter(u => u.role === 'company');
    const sts = _db.users.filter(u => u.role === 'student');
    return {
      totalStudents:sts.length, pendingStudents:sts.filter(s => s.verificationStatus === 'pending').length,
      approvedStudents:sts.filter(s => s.verificationStatus === 'approved').length,
      totalCompanies:cos.length, verifiedCompanies:cos.filter(c => c.status === 'verified').length,
      pendingCompanies:cos.filter(c => c.status === 'pending').length,
      totalInternships:_db.internships.length, openInternships:_db.internships.filter(i => i.status === 'open').length,
      riphahApproved:_db.internships.filter(i => i.riphahApproved).length,
      pendingApproval:_db.internships.filter(i => !i.riphahApproved && i.status === 'open').length,
      totalApplications:_db.applications.length,
      pendingApplications:_db.applications.filter(a => a.status === 'pending').length,
      confirmedApplications:_db.applications.filter(a => a.status === 'student_confirmed' || a.status === 'university_approved').length,
      openComplaints:_db.complaints.filter(c => c.status === 'open').length,
      pendingSelfFound:_db.selfFoundInternships.filter(s => s.status === 'pending').length,
    };
  },

  getUniProfile: async () => {
    const tok = await _getLatestToken();
    const res = await fetch('/api/admin/uni-profile', { headers: tok ? { 'Authorization': 'Bearer ' + tok } : {} });
    if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || body.message || 'Failed to fetch university profile'); }
    return await res.json();
  },

  updateUniProfile: async (data) => {
    const tok = await _getLatestToken();
    const headers = { 'Content-Type': 'application/json' };
    if (tok) headers['Authorization'] = 'Bearer ' + tok;
    const res = await fetch('/api/admin/uni-profile', { method: 'PUT', headers, body: JSON.stringify(data) });
    if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || body.message || 'Failed to update university profile'); }
    return await res.json();
  },

  getUsers: async () => {
    await _delay();
    return _db.users.map(({ password, ...u }) => u);
  },

  deleteUser: async (id) => {
    await _delay();
    const idx = _db.users.findIndex(u => u.id === id);
    if (idx === -1) throw new Error('Not found.');
    if (_db.users[idx].role === 'sysadmin') throw new Error('Cannot delete system admin.');
    const n = _db.users[idx].name;
    _db.users.splice(idx, 1);
    _log('User ' + n + ' deleted', 'warning'); _save(); return { message: 'Deleted.' };
  },

  createAdminUser: async (d) => {
    await _delay();
    if (_db.users.find(u => u.email === d.email)) throw new Error('Email already registered.');
    _db.users.push({ id:_db._next.users++, name:d.name, email:d.email, password:d.password, role:d.role });
    _log('Admin account created: ' + d.name + ' (' + d.role + ')', 'warning');
    _save(); return { message: 'Admin created.' };
  },

  getActivity: async (tokenParam) => {
    const headers = {};
    // accept optional token param via function arg or fallback to global/localStorage
    const tokVal = tokenParam || (typeof authToken !== 'undefined' ? authToken : null) || localStorage.getItem('ib_token');
    if (tokVal) { const t = typeof tokVal === 'string' && tokVal.startsWith('Bearer ') ? tokVal.split(' ')[1] : tokVal; headers['Authorization'] = 'Bearer ' + t; }
    const res = await fetch('/api/admin/activity', { headers });
    if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to fetch activity'); }
    return await res.json();
  },

  getSystemStats: async () => {
    await _delay();
    return {
      totalUsers:_db.users.length, uptime:Math.floor(performance.now()/1000),
      memoryMB:'N/A', nodeVersion:'Browser Mode',
      dbRecords:_db.users.length + _db.internships.length + _db.applications.length,
      lastBackup:'N/A', securityAlerts:_db.activityLog.filter(l => l.type === 'warning').length,
    };
  },

  getCriteria: async () => {
    const tok = await _getLatestToken();
    const res = await fetch('/api/admin/criteria', { headers: tok ? { 'Authorization': 'Bearer ' + tok } : {} });
    if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to fetch criteria'); }
    return await res.json();
  },

  updateCriteria: async (s, a, t) => {
    const tok = await _getLatestToken();
    const headers = { 'Content-Type': 'application/json' };
    if (tok) headers['Authorization'] = 'Bearer ' + tok;
    const res = await fetch('/api/admin/criteria/' + encodeURIComponent(s), { method: 'PUT', headers, body: JSON.stringify({ items: a }) });
    if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to update criteria'); }
    return await res.json();
  },

  addCriteriaItem: async (s, t, tokenParam) => {
    const tok = await _getLatestToken();
    const headers = { 'Content-Type': 'application/json' };
    if (tok) headers['Authorization'] = 'Bearer ' + tok;
    const res = await fetch('/api/admin/criteria/' + encodeURIComponent(s) + '/item', { method: 'POST', headers, body: JSON.stringify({ text: t }) });
    if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to add criteria item'); }
    return await res.json();
  },

  deleteCriteriaItem: async (s, id, t) => {
    const tok = await _getLatestToken();
    const headers = {};
    if (tok) headers['Authorization'] = 'Bearer ' + tok;
    const res = await fetch('/api/admin/criteria/' + encodeURIComponent(s) + '/item/' + encodeURIComponent(id), { method: 'DELETE', headers });
    if (!res.ok) { const body = await res.json().catch(()=>({})); throw new Error(body.error || 'Failed to delete criteria item'); }
    return await res.json();
  },

  getProfile: async (t) => {
    // Try backend first when a token is available; fall back to in-memory for offline/dev
    try {
      const tok = await _getLatestToken();
      const headers = {};
      if (tok) headers['Authorization'] = 'Bearer ' + tok;
      const res = await fetch('/api/profile', { headers });
      if (res.ok) return await res.json();
      // If backend returned an error, throw to trigger fallback handling below
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || 'Failed to fetch profile');
    } catch (err) {
      // Fallback to in-memory token decoding
      await _delay();
      const u = _dec(t);
      if (!u) throw new Error('Invalid session. Please log in again.');
      const user = _db.users.find(x => x.id === u.id);
      if (!user) throw new Error('Account not found. Please log in again.');
      const safe = Object.assign({}, user);
      delete safe.password;
      return safe;
    }
  },

  updateProfile: async (d, t) => {
    await _delay();
    const u = _dec(t);
    const user = _db.users.find(x => x.id === u.id);
    if (!user) throw new Error('Not found.');
    Object.assign(user, d);
    _save();
    const safe = Object.assign({}, user);
    delete safe.password;
    return safe;
  },

  getStudentDetails: async (sid) => {
    await _delay();
    const s = _db.users.find(u => u.id === sid);
    if (!s) throw new Error('Not found.');
    const safe = Object.assign({}, s);
    delete safe.password;
    return Object.assign({}, safe, {
      applications: _db.applications.filter(a => a.studentId === sid),
      feedback: _db.universityFeedback.filter(f => f.studentId === sid),
      complaints: _db.complaints.filter(c => c.studentId === sid),
      eligibilityIssues: _eligStudent(s),
    });
  },

  resetDatabase: () => {
    localStorage.removeItem('ib_db');
    localStorage.removeItem('ib_token');
    localStorage.removeItem('ib_user');
    location.reload();
  },
};
