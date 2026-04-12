// student.js — Student portal pages

async function initStudentDashboard() {
  try {
    const [internships, applications, feedback, selfFound] = await Promise.all([
      api.getInternships({}, authToken), api.getMyApplications(authToken),
      api.getMyFeedback(authToken), api.getMySelfFoundInternships(authToken),
    ]);
    const offers   = applications.filter(a => a.status === 'company_accepted');
    const unread   = feedback.filter(f => !f.read).length;
    const confirmed = applications.filter(a => a.status === 'student_confirmed' || a.status === 'university_approved');

    document.getElementById('page-dashboard').innerHTML = `
      <div class="page-header">
        <div>
          <div class="page-title">Welcome, ${currentUser.name} 👋</div>
          <div class="page-subtitle">Riphah International University · Faculty of Computing</div>
        </div>
      </div>

      ${offers.length ? `<div class="alert alert-warning"><span class="alert-icon">🎉</span>
        <div><strong>${offers.length} company offer(s) awaiting your decision!</strong>
          <a style="color:var(--gold);cursor:pointer;text-decoration:underline;margin-left:6px" onclick="navigateTo('decisions')">Review Offers →</a>
        </div></div>` : ''}

      ${unread ? `<div class="alert alert-info"><span class="alert-icon">📩</span>
        <div>You have <strong>${unread} unread feedback message(s)</strong> from the university.
          <a style="color:var(--teal);cursor:pointer;text-decoration:underline;margin-left:6px" onclick="navigateTo('my-feedback')">View →</a>
        </div></div>` : ''}

      <div class="stat-grid">
        <div class="stat-card"><div class="stat-num">${internships.length}</div><div class="stat-label">Open Internships</div></div>
        <div class="stat-card gold"><div class="stat-num">${applications.length}</div><div class="stat-label">My Applications</div></div>
        <div class="stat-card green"><div class="stat-num">${offers.length}</div><div class="stat-label">Offers Received</div></div>
        <div class="stat-card purple"><div class="stat-num">${confirmed.length}</div><div class="stat-label">Confirmed</div></div>
      </div>

      <div class="card">
        <div class="card-title">Recent Applications</div>
        ${!applications.length ? '<p class="text-muted" style="font-size:13px">No applications yet. <a style="color:var(--teal);cursor:pointer" onclick="navigateTo(\'search\')">Search internships →</a></p>' :
        `<div class="table-wrap"><table>
          <thead><tr><th>Position</th><th>Company</th><th>Applied</th><th>Status</th></tr></thead>
          <tbody>${applications.slice(0,5).map(a=>`<tr>
            <td><strong>${a.internshipTitle}</strong></td>
            <td class="text-teal">${a.company}</td>
            <td>${a.appliedAt}</td>
            <td>${badge(a.status)}</td>
          </tr>`).join('')}</tbody>
        </table></div>`}
      </div>

      ${selfFound.length ? `<div class="card">
        <div class="card-title">Self-Found Internships</div>
        <div class="table-wrap"><table>
          <thead><tr><th>Company</th><th>Submitted</th><th>Status</th></tr></thead>
          <tbody>${selfFound.map(s=>`<tr>
            <td><strong>${s.companyName}</strong></td>
            <td>${new Date(s.submittedAt).toLocaleDateString()}</td>
            <td>${badge(s.status)}</td>
          </tr>`).join('')}</tbody>
        </table></div>
      </div>` : ''}`;
  } catch(e) { showPageError(document.getElementById('page-dashboard'), e.message); }
}

async function initSearchPage() {
  try {
    const [internships, profile] = await Promise.all([api.getInternships({}, authToken), api.getProfile(authToken)]);
    window._allInternships = internships;
    renderSearchPage(internships, profile);
  } catch(e) { showPageError(document.getElementById('page-search'), e.message); }
}

function renderSearchPage(internships, profile) {
  const issues = profile ? (profile.creditHours < 60 || profile.cgpa < 2.0 || !profile.electiveCourse) : false;
  document.getElementById('page-search').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Search Internships</div>
        <div class="page-subtitle">Verified companies — Riphah approved listings only</div>
      </div>
    </div>
    ${issues ? `<div class="alert alert-danger"><span class="alert-icon">⚠️</span>
      <div><strong>Eligibility check failed.</strong> You may not meet one or more Riphah criteria.
        <a style="color:var(--red);cursor:pointer;text-decoration:underline;margin-left:6px" onclick="navigateTo('criteria-view')">View Criteria →</a>
      </div></div>` :
    `<div class="alert alert-success"><span class="alert-icon">✅</span>
      <div>Your profile meets Riphah eligibility criteria. You may apply for internships.</div></div>`}
    <div class="search-bar">
      <input type="text" id="search-q" placeholder="Search by title or company..." oninput="filterInternships()" />
      <select id="search-city" onchange="filterInternships()">
        <option value="">All Cities</option>
        <option>Lahore</option><option>Karachi</option><option>Islamabad</option><option>Rawalpindi</option>
      </select>
    </div>
    <div id="internship-list">${renderInternshipCards(internships)}</div>`;
}

function renderInternshipCards(list) {
  if (!list.length) return `<div class="empty-state"><div class="icon">🔍</div><p>No internships found.</p></div>`;
  return list.map(i => `
    <div class="internship-card">
      <div>
        <div class="title">${i.title} <span class="chip-ok">✓ Riphah Approved</span></div>
        <div class="company-name">${i.company}</div>
        <div class="meta">
          <span>📍 ${i.city}</span>
          <span>⏰ Deadline: ${i.deadline}</span>
          <span>💰 ${i.stipend||'TBD'}</span>
          <span>⏳ ${i.duration||'TBD'}</span>
          <span>👥 ${i.applicantsCount||0} applicants</span>
        </div>
        ${i.timeSlots && i.timeSlots.length ? `<div class="meta" style="margin-top:4px;font-size:11px;color:var(--muted)">
          <span>🕒 Time Slots: ${i.timeSlots.map(s => `${s.day} ${s.startTime}-${s.endTime} (${s.type})`).join(', ')}</span>
        </div>` : ''}
        ${i.description ? `<p style="font-size:12px;color:var(--muted);margin-top:8px">${i.description.substring(0,120)}${i.description.length>120?'...':''}</p>` : ''}
      </div>
      <div class="actions">
        ${badge(i.status)}
        <button class="btn btn-primary btn-sm" onclick="applyForInternship(${i.id})">Apply Now</button>
      </div>
    </div>`).join('');
}

function filterInternships() {
  const q    = document.getElementById('search-q').value.toLowerCase();
  const city = document.getElementById('search-city').value;
  let list   = window._allInternships || [];
  if (q)    list = list.filter(i => i.title.toLowerCase().includes(q) || i.company.toLowerCase().includes(q));
  if (city) list = list.filter(i => i.city === city);
  document.getElementById('internship-list').innerHTML = renderInternshipCards(list);
}

async function applyForInternship(id) {
  try {
    await api.apply(id, authToken);
    showToast('Application submitted successfully!', 'success');
    window._allInternships = await api.getInternships({}, authToken);
    filterInternships();
  } catch(e) { showToast(e.message, 'error'); }
}

async function initMyApplications() {
  try {
    const apps = await api.getMyApplications(authToken);
    document.getElementById('page-my-applications').innerHTML = `
      <div class="page-header">
        <div><div class="page-title">My Applications</div>
          <div class="page-subtitle">Track all your internship applications this semester</div>
        </div>
      </div>
      ${!apps.length ? `<div class="empty-state card"><div class="icon">📋</div>
        <p>No applications yet. <a style="color:var(--teal);cursor:pointer" onclick="navigateTo('search')">Search internships →</a></p></div>` :
      `<div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Position</th><th>Company</th><th>Applied</th><th>Company Feedback</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>${apps.map(a=>`<tr>
          <td><strong>${a.internshipTitle}</strong></td>
          <td class="text-teal">${a.company}</td>
          <td>${a.appliedAt}</td>
          <td style="font-size:12px;color:var(--muted)">${a.companyFeedback||'—'}</td>
          <td>${badge(a.status)}</td>
          <td>${a.status==='company_accepted'?`<button class="btn btn-warning btn-sm" onclick="navigateTo('decisions')">Decide →</button>`:'—'}</td>
        </tr>`).join('')}</tbody>
      </table></div></div>`}`;
  } catch(e) { showPageError(document.getElementById('page-my-applications'), e.message); }
}

async function initDecisionsPage() {
  try {
    const apps   = await api.getMyApplications(authToken);
    const offers = apps.filter(a => a.status === 'company_accepted');
    document.getElementById('page-decisions').innerHTML = `
      <div class="page-header">
        <div><div class="page-title">Pending Decisions</div>
          <div class="page-subtitle">Review company offers and confirm exactly one. Only one internship per semester is permitted by Riphah.</div>
        </div>
      </div>
      ${!offers.length ? `<div class="empty-state card"><div class="icon">🎯</div>
        <p>No pending offers right now. Offers will appear here once a company accepts your application.</p></div>` :
      `<div class="alert alert-warning"><span class="alert-icon">⚠️</span>
        <div><strong>Important:</strong> Confirming one offer will automatically decline all other accepted offers. This action cannot be undone.</div>
      </div>
      ${offers.map(a=>`
        <div class="decision-card has-offer">
          <div class="decision-title">${a.internshipTitle}</div>
          <div class="decision-meta">🏢 ${a.company} &nbsp;|&nbsp; Applied: ${a.appliedAt}
            ${a.companyFeedback?`&nbsp;|&nbsp; 💬 "${a.companyFeedback}"`:''}
          </div>
          <div class="decision-actions">
            <button class="btn btn-success" onclick="decideOffer(${a.id},'confirm')">✓ Confirm This Offer</button>
            <button class="btn btn-danger"  onclick="decideOffer(${a.id},'decline')">✗ Decline This Offer</button>
          </div>
        </div>`).join('')}
      <div class="alert alert-info" style="margin-top:8px"><span class="alert-icon">ℹ️</span>
        <div>After confirming, the university admin will review and give final approval.</div>
      </div>`}`;
  } catch(e) { showPageError(document.getElementById('page-decisions'), e.message); }
}

async function decideOffer(appId, decision) {
  const msg = decision==='confirm'
    ? 'Confirm this internship? All other offers will be automatically declined.'
    : 'Decline this offer?';
  if (!confirm(msg)) return;
  try {
    await api.studentDecideApplication(appId, decision, authToken);
    showToast(decision==='confirm' ? 'Internship confirmed! Awaiting university approval.' : 'Offer declined.', decision==='confirm'?'success':'info');
    initDecisionsPage();
    updateSidebarBadges();
  } catch(e) { showToast(e.message, 'error'); }
}

async function initMyFeedback() {
  try {
    const feedback = await api.getMyFeedback(authToken);
    document.getElementById('page-my-feedback').innerHTML = `
      <div class="page-header">
        <div><div class="page-title">University Feedback</div>
          <div class="page-subtitle">Messages and feedback from the Riphah Faculty of Computing</div>
        </div>
      </div>
      ${!feedback.length ? `<div class="empty-state card"><div class="icon">📩</div><p>No feedback received yet.</p></div>` :
        feedback.map(f=>`
        <div class="card" style="border-left:4px solid var(--teal)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
            <div style="font-weight:700;font-size:14px;color:var(--navy)">${f.subject}</div>
            <span style="font-size:11px;color:var(--muted)">${new Date(f.sentAt).toLocaleDateString()}</span>
          </div>
          <div style="font-size:13px;color:var(--text2);margin-bottom:10px">${f.message}</div>
          <div style="font-size:11px;color:var(--muted)">From: ${f.sentByName} · ${f.category||'General'}</div>
        </div>`).join('')}`;
  } catch(e) { showPageError(document.getElementById('page-my-feedback'), e.message); }
}

// My Complaints — student view of complaints filed against them
async function initMyComplaints() {
  try {
    const complaints = await api.getComplaints();
    // determine current user id
    let uid = null;
    try { if (typeof currentUser !== 'undefined' && currentUser && currentUser.id) uid = currentUser.id; } catch(e) {}
    if (!uid) {
      const tok = await _getLatestToken();
      const dec = _dec(tok);
      uid = dec && dec.id;
    }
    const mine = (complaints || []).filter(c => Number(c.studentId) === Number(uid));
    const pageEl = document.getElementById('page-my-complaints');
    if (!mine.length) {
      pageEl.innerHTML = `
        <div class="page-header"><div><div class="page-title">My Complaints</div></div></div>
        <div class="card"><p>No complaints have been filed against you.</p></div>`;
      return;
    }
    const cards = mine.map(c => {
      const date = c.submittedAt ? new Date(c.submittedAt).toLocaleDateString() : '';
      const company = c.company || c.companyName || c.internshipTitle || '—';
      const response = c.adminResponse || c.adminNote || c.respondedAt ? (c.adminResponse || c.adminNote || '') : '';
      return `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div style="font-weight:700;font-size:15px">${c.subject}</div>
            <div style="font-size:12px;color:var(--muted)">${date}</div>
          </div>
          <div style="margin-top:8px;font-size:13px;color:var(--muted)">Company: ${company}</div>
          <div style="margin-top:10px">${badge(c.status)}</div>
          ${response ? `<div class="alert alert-info" style="margin-top:10px"><strong>Admin Response:</strong><div style="margin-top:6px">${response}</div></div>` : ''}
        </div>`;
    }).join('');
    pageEl.innerHTML = `<div class="page-header"><div><div class="page-title">My Complaints</div></div></div><div class="card">${cards}</div>`;
  } catch (e) {
    showPageError(document.getElementById('page-my-complaints'), e.message);
  }
}

async function initCriteriaView() {
  try {
    const c = await api.getCriteria() || {};
    const studentEligibility = Array.isArray(c.studentEligibility) ? c.studentEligibility : [];
    const companyEligibility = Array.isArray(c.companyEligibility) ? c.companyEligibility : [];
    const importantNotes = Array.isArray(c.importantNotes) ? c.importantNotes : [];
    const requiredDocs = Array.isArray(c.requiredDocs) ? c.requiredDocs : [];
    const partnerCompanies = Array.isArray(c.partnerCompanies) ? c.partnerCompanies : [];
    document.getElementById('page-criteria-view').innerHTML = `
      <div class="page-header">
        <div><div class="page-title">Riphah Internship Criteria</div>
          <div class="page-subtitle">Faculty of Computing — Internship Registration Guidelines</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">🎓 Student Eligibility</div>
        ${studentEligibility.map(x=>`<div class="criteria-item"><span class="criteria-check">✓</span> ${x.text}</div>`).join('')}
      </div>
      <div class="card">
        <div class="card-title">🏢 Company Eligibility</div>
        ${companyEligibility.map(x=>`<div class="criteria-item"><span class="criteria-check">✓</span> ${x.text}</div>`).join('')}
      </div>
      <div class="card">
        <div class="card-title">📋 Important Notes</div>
        ${importantNotes.map(x=>`<div class="criteria-item" style="color:var(--text2)">• ${x.text}</div>`).join('')}
      </div>
      <div class="card">
        <div class="card-title">📎 Required Documents</div>
        ${requiredDocs.map(x=>`<div class="criteria-item"><span class="criteria-check">□</span> ${x.text}</div>`).join('')}
      </div>
      ${partnerCompanies.length?`<div class="card">
        <div class="card-title">🤝 Partner Companies</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">${partnerCompanies.map(x=>`<span class="badge badge-info">${x}</span>`).join('')}</div>
      </div>`:''}`;
  } catch(e) { showPageError(document.getElementById('page-criteria-view'), e.message); }
}

// Self-Found Internship
function initSelfFoundPage() {
  document.getElementById('page-self-found').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Declare Self-Found Internship</div>
        <div class="page-subtitle">Found an internship on your own? Submit it here for university approval.</div>
      </div>
    </div>
    <div class="alert alert-info"><span class="alert-icon">ℹ️</span>
      <div>If you secured an internship independently, submit the details and offer letter below. The university admin will verify the company meets Riphah criteria and approve/reject your declaration.</div>
    </div>
    <div class="card">
      <div class="form-row">
        <div class="form-group"><label>Company Name *</label><input id="sf-company" type="text" placeholder="e.g. XYZ Technologies" /></div>
        <div class="form-group"><label>Company Website</label><input id="sf-website" type="text" placeholder="https://company.com" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Supervisor Name *</label><input id="sf-supname" type="text" placeholder="e.g. Mr. Ali Hassan" /></div>
        <div class="form-group"><label>Supervisor Email *</label><input id="sf-supemail" type="email" placeholder="supervisor@company.com" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Start Date *</label><input id="sf-start" type="date" /></div>
        <div class="form-group"><label>End Date *</label><input id="sf-end" type="date" /></div>
      </div>
      <div class="form-group"><label>Monthly Stipend</label><input id="sf-stipend" type="text" placeholder="e.g. 15,000 PKR/month" /></div>
      <div class="form-group"><label>Description of Work *</label>
        <textarea id="sf-desc" placeholder="Describe your role and responsibilities..."></textarea>
      </div>
      <div class="form-group">
        <label>Offer Letter (PDF) *</label>
        <div class="upload-box" onclick="document.getElementById('sf-letter').click()">
          📄 Click to upload offer letter
          <input id="sf-letter" type="file" accept=".pdf,.jpg,.png" style="display:none" onchange="previewUpload(this,'sf-letter-preview')" />
        </div>
        <div id="sf-letter-preview" style="font-size:12px;color:var(--green);margin-top:4px"></div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-primary" onclick="submitSelfFound()">Submit for Approval</button>
        <button class="btn btn-outline"  onclick="navigateTo('dashboard')">Cancel</button>
      </div>
    </div>`;
}

async function submitSelfFound() {
  const d = {
    companyName:     document.getElementById('sf-company').value.trim(),
    companyWebsite:  document.getElementById('sf-website').value.trim(),
    supervisorName:  document.getElementById('sf-supname').value.trim(),
    supervisorEmail: document.getElementById('sf-supemail').value.trim(),
    startDate:       document.getElementById('sf-start').value,
    endDate:         document.getElementById('sf-end').value,
    stipend:         document.getElementById('sf-stipend').value.trim(),
    workDescription: document.getElementById('sf-desc').value.trim(),
  };
  if (!d.companyName||!d.supervisorName||!d.supervisorEmail||!d.startDate||!d.endDate||!d.workDescription)
    return showToast('Please fill all required fields.', 'error');
  const letterInput = document.getElementById('sf-letter');
  if (letterInput && letterInput.files[0]) {
    try { d.offerLetterDoc = await readFileAsBase64(letterInput); } catch(e) { return showToast('File error: '+e.message,'error'); }
  }
  try {
    await api.submitSelfFoundInternship(d, authToken);
    showToast('Declaration submitted! Awaiting university admin review.', 'success');
    navigateTo('dashboard');
  } catch(e) { showToast(e.message, 'error'); }
}

async function initStudentProfile() {
  try {
    const [profile, freeTime] = await Promise.all([api.getProfile(authToken), api.getStudentFreeTime(authToken)]);
    _freeTimeSlots = freeTime.slice();
    const issues  = [];
    if ((profile.creditHours||0) < 60) issues.push('Credit hours below 60 (' + (profile.creditHours||0) + '/60)');
    if ((profile.cgpa||0) < 2.0)       issues.push('CGPA below 2.0 (current: ' + (profile.cgpa||0) + ')');
    if (!profile.electiveCourse)        issues.push('No elective course listed');

    document.getElementById('page-profile').innerHTML = `
      <div class="page-header"><div><div class="page-title">My Profile</div></div></div>
      ${issues.length ? `<div class="alert alert-danger"><span class="alert-icon">⚠️</span>
        <div><strong>Eligibility Issues:</strong> ${issues.join('; ')}</div></div>` :
        `<div class="alert alert-success"><span class="alert-icon">✅</span>
        <div>Your profile meets all Riphah internship eligibility criteria.</div></div>`}
      <div class="card">
        <div style="display:flex;gap:16px;align-items:center;margin-bottom:22px">
          <div class="avatar">${(profile.name||'?')[0].toUpperCase()}</div>
          <div>
            <div style="font-size:18px;font-weight:700">${profile.name}</div>
            <div class="text-muted">${profile.university} · ${profile.program||'—'} · Semester ${profile.semester||'—'}</div>
            <div style="margin-top:6px">${badge(profile.verificationStatus==='approved'?'verified':profile.verificationStatus||'pending')}</div>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Full Name</label><input id="p-name" type="text" value="${profile.name||''}" /></div>
          <div class="form-group"><label>Program</label><input id="p-program" type="text" value="${profile.program||''}" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>CGPA</label><input id="p-cgpa" type="number" step="0.01" value="${profile.cgpa||''}" /></div>
          <div class="form-group"><label>Credit Hours Completed</label><input id="p-credits" type="number" value="${profile.creditHours||''}" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Elective Course</label><input id="p-elective" type="text" value="${profile.electiveCourse||''}" /></div>
          <div class="form-group"><label>Skills</label><input id="p-skills" type="text" value="${profile.skills||''}" /></div>
        </div>
        <div class="form-group">
          <label>Documents</label>
          <div style="font-size:13px;padding:10px;background:var(--bg);border-radius:8px;border:1px solid var(--border)">
            <div>📄 Transcript: ${profile.transcriptDoc ? '<span class="text-green">✓ Uploaded</span>' : '<span class="text-red">Not uploaded</span>'}</div>
            <div style="margin-top:4px">📄 Enrollment Letter: ${profile.enrollmentDoc ? '<span class="text-green">✓ Uploaded</span>' : '<span class="text-red">Not uploaded</span>'}</div>
          </div>
        </div>
        <div class="form-group">
          <label>Available Free Time (for internship matching)</label>
          <div id="free-time-list" style="font-size:13px;padding:10px;background:var(--bg);border-radius:8px;border:1px solid var(--border);margin-bottom:10px">No free time set.</div>
          <div class="form-row">
            <div class="form-group"><label>Day</label>
              <select id="ft-day">
                <option>Monday</option><option>Tuesday</option><option>Wednesday</option><option>Thursday</option><option>Friday</option><option>Saturday</option><option>Sunday</option>
              </select>
            </div>
            <div class="form-group"><label>Start Time</label><input id="ft-start" type="time" /></div>
            <div class="form-group"><label>End Time</label><input id="ft-end" type="time" /></div>
          </div>
          <button class="btn btn-outline btn-sm" onclick="addFreeTimeSlot()">+ Add Slot</button>
          <button class="btn btn-primary btn-sm" onclick="saveFreeTime()">Save Free Time</button>
        </div>
        <button class="btn btn-primary" onclick="saveStudentProfile()">Save Changes</button>
      </div>`;
    renderFreeTimeList();
  } catch(e) { showPageError(document.getElementById('page-profile'), e.message); }
}

async function saveStudentProfile() {
  try {
    await api.updateProfile({
      name:          document.getElementById('p-name').value,
      program:       document.getElementById('p-program').value,
      cgpa:          parseFloat(document.getElementById('p-cgpa').value),
      creditHours:   parseInt(document.getElementById('p-credits').value),
      electiveCourse: document.getElementById('p-elective').value,
      skills:        document.getElementById('p-skills').value,
    }, authToken);
    await saveFreeTime();
    showToast('Profile saved!', 'success');
    initStudentProfile();
  } catch(e) { showToast(e.message, 'error'); }
}

let _freeTimeSlots = [];

async function addFreeTimeSlot() {
  const day = document.getElementById('ft-day').value;
  const start = document.getElementById('ft-start').value;
  const end = document.getElementById('ft-end').value;
  if (!start || !end) return showToast('Please enter start and end time.', 'error');
  _freeTimeSlots.push({ day, startTime: start, endTime: end });
  renderFreeTimeList();
}

function removeFreeTimeSlot(id) {
  _freeTimeSlots = _freeTimeSlots.filter(ft => ft.id !== id);
  renderFreeTimeList();
}

function renderFreeTimeList() {
  document.getElementById('free-time-list').innerHTML = _freeTimeSlots.length ? _freeTimeSlots.map((ft, i) => `<div>${ft.day} ${ft.startTime} - ${ft.endTime} <button onclick="removeFreeTimeSlot(${i})">x</button></div>`).join('') : 'No free time set.';
}

async function saveFreeTime() {
  try {
    await api.saveStudentFreeTime(_freeTimeSlots, authToken);
    showToast('Free time saved!', 'success');
    initStudentProfile();
  } catch(e) { showToast(e.message, 'error'); }
}
