// @ts-nocheck
// student.js — Student portal pages

function _isCompanyApproved(item) {
  if (!item) return false;
  return !!(
    item.riphahApproved || item.universityApproved || item.sysadminApproved ||
    item.status === 'approved' ||
    item.riphah_approved || item.university_approved || item.sysadmin_approved
  );
}

async function initStudentDashboard() {
  try {
    let [internships, applications, feedback, selfFound] = await Promise.all([
      api.getInternships({}, authToken), api.getMyApplications(authToken),
      api.getMyFeedback(authToken), api.getMySelfFoundInternships(authToken),
    ]);
    // show students only internships from companies approved by the university
    internships = (internships || []).filter(i => _isCompanyApproved(i));
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
    let [internships, profile] = await Promise.all([api.getInternships({}, authToken), api.getProfile(authToken)]);
    // only include internships from admin-approved companies for students
    internships = (internships || []).filter(i => _isCompanyApproved(i));
    // STEP 1 — Fetch student free time
    let freeTime = [];
    try { freeTime = await api.getStudentFreeTime(authToken) || []; } catch (e) { freeTime = []; }

    // STEP 2 — Score each internship using student's free time and _timeOverlap
    function matchScore(internship, freeTime) {
      if (!internship.timeSlots || internship.timeSlots.length === 0) return null;
      if (!freeTime || freeTime.length === 0) return null;
      let matched = 0;
      for (const slot of internship.timeSlots) {
        const hasMatch = freeTime.some(ft =>
          (ft.day === slot.day || ft.dayOfWeek === slot.day) &&
          (typeof _timeOverlap === 'function' ? _timeOverlap(slot.startTime, slot.endTime, ft.startTime, ft.endTime) : (window._timeOverlap ? window._timeOverlap(slot.startTime, slot.endTime, ft.startTime, ft.endTime) : false))
        );
        if (hasMatch) matched++;
      }
      return Math.round((matched / internship.timeSlots.length) * 100);
    }

    const enriched = (internships || []).map(i => ({ ...i, matchScore: matchScore(i, freeTime) }));
    // STEP 3 — Sort: score >= 50 first, then the rest; within groups sort by score desc
    enriched.sort((a, b) => {
      const aMatch = (a.matchScore !== null && a.matchScore >= 50) ? 1 : 0;
      const bMatch = (b.matchScore !== null && b.matchScore >= 50) ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      const as = a.matchScore == null ? -1 : a.matchScore;
      const bs = b.matchScore == null ? -1 : b.matchScore;
      return bs - as;
    });
    window._allInternships = enriched;
    renderSearchPage(enriched, profile);
  } catch(e) { showPageError(document.getElementById('page-search'), e.message); }
}

function renderSearchPage(internships, profile) {
  window._searchProfile = profile || null;
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
    <div id="internship-list">${renderInternshipCards(internships, profile)}</div>`;
}

function renderInternshipCards(list, profile) {
  if (!list.length) return `<div class="empty-state"><div class="icon">🔍</div><p>No internships found.</p></div>`;
  return list.map(i => `
    <div class="internship-card">
      <div>
        <div class="title">${i.title} <span class="chip-ok">✓ Riphah Approved</span></div>
        ${i.matchScore !== null && i.matchScore !== undefined ? (
          i.matchScore >= 80 ? `<div style="margin-top:6px"><span style="font-size:11px; padding:2px 8px; border-radius:20px; background:#EAF3DE; color:#3B6D11;">Great match</span></div>` :
          i.matchScore >= 50 ? `<div style="margin-top:6px"><span style="font-size:11px; padding:2px 8px; border-radius:20px; background:#EAF3FF; color:#0A3B8C;">Good match</span></div>` :
          i.matchScore === 0 ? `<div style="margin-top:6px;color:var(--muted);font-size:12px">Low match</div>` : ''
        ) : ''}
        <div class="company-name">${i.company}</div>
        <div class="meta">
          <span>📍 ${i.city}</span>
          <span>⏰ Deadline: ${i.deadline}</span>
          <span>💰 ${i.stipend||'TBD'}</span>
          <span>⏳ ${i.duration||'TBD'}</span>
          <span>👥 ${i.applicantsCount||0} applicants</span>
        </div>
        ${i.timeSlots && i.timeSlots.length ? `<div class="meta" style="margin-top:4px;font-size:11px;color:var(--muted)">
          <span>🕒 Time Slots: ${i.timeSlots.map(s => `<span style="font-size:11px;background:var(--bg);border-radius:4px;padding:2px 7px;margin:2px;display:inline-block;">${s.day} ${s.startTime}–${s.endTime} (${s.type})</span>`).join('')}</span>
        </div>` : ''}
        ${i.description ? `<p style="font-size:12px;color:var(--muted);margin-top:8px">${i.description.substring(0,120)}${i.description.length>120?'...':''}</p>` : ''}
      </div>
      <div class="actions">
        ${badge(i.status)}
        ${((profile && (profile.verificationStatus === 'approved' || profile.accountStatus === 'verified')) || (typeof profile === 'undefined'))
          ? `<button class="btn btn-primary btn-sm" onclick="applyForInternship(${i.id})">Apply Now</button>`
          : `<button class="btn btn-primary btn-sm" disabled title="Your account must be verified by the university to apply">Apply (verify account)</button>`}
      </div>
    </div>`).join('');
}

function filterInternships() {
  const q    = document.getElementById('search-q').value.toLowerCase();
  const city = document.getElementById('search-city').value;
  let list   = window._allInternships || [];
  if (q)    list = list.filter(i => i.title.toLowerCase().includes(q) || i.company.toLowerCase().includes(q));
  if (city) list = list.filter(i => i.city === city);
  document.getElementById('internship-list').innerHTML = renderInternshipCards(list, window._searchProfile || null);
}

async function applyForInternship(id) {
  try {
    await api.apply(id, authToken);
    showToast('Application submitted successfully!', 'success');
    // refresh only approved internships for students
    window._allInternships = (await api.getInternships({}, authToken) || []).filter(i => _isCompanyApproved(i));
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
        <div>After confirming, the university will review and give final approval.</div>
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
          <div style="margin-top:8px">
            ${f.read ? '<span style="font-size:11px;color:var(--muted)">Read</span>' : `<button class="btn btn-outline btn-sm" onclick="(async()=>{ try{ await api.markFeedbackRead(${f.id}, authToken); await initMyFeedback(); }catch(e){ showToast(e.message,'error'); } })()">Mark as Read</button>`}
          </div>
        </div>`).join('')}`;
  } catch(e) { showPageError(document.getElementById('page-my-feedback'), e.message); }
}

// My Complaints — student view of complaints filed against them
async function initMyComplaints() {
  try {
    const mine = await api.getMyComplaints(authToken);
    const pageEl = document.getElementById('page-my-complaints');
    if (!mine || !mine.length) {
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
      <div>If you secured an internship independently, submit the details and offer letter below. The university will verify the company meets Riphah criteria and approve/reject your declaration.</div>
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
  // Debug: log payload before sending
  try { console.log('Submitting self-found payload:', d); } catch (e) {}
  try {
    const res = await api.submitSelfFoundInternship(d, authToken);
    try { console.log('Self-found submit response:', res); } catch (e) {}
    showToast('Declaration submitted! Awaiting university review.', 'success');
    navigateTo('dashboard');
  } catch(e) { showToast(e.message, 'error'); }
}

async function initStudentProfile() {
  try {
    const [profile, freeTime, selfFound] = await Promise.all([api.getProfile(authToken), api.getStudentFreeTime(authToken), api.getMySelfFoundInternships(authToken)]);
    if (!profile || profile.role !== 'student') {
      showPageError(document.getElementById('page-profile'), 'Could not load your profile. Please sign in again.');
      return;
    }
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
          <div class="avatar">${(profile.name && profile.name.trim() ? profile.name.trim() : '?')[0].toUpperCase()}</div>
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
        <div class="form-group" style="display:flex;align-items:center;gap:10px;margin-top:8px">
          <input type="checkbox" id="p-enrolled" ${profile.enrolled ? 'checked' : ''} />
          <label for="p-enrolled" style="margin:0;cursor:pointer">I am currently enrolled at Riphah</label>
        </div>
        <div class="form-group">
          <label>Documents</label>
          <div style="font-size:13px;padding:10px;background:var(--bg);border-radius:8px;border:1px solid var(--border)">
            <div style="margin-bottom:10px">
              Transcript: 
              ${(profile.transcriptDoc || profile.transcriptFileId) 
                ? ('<span class="text-green">Uploaded ✓</span>' + (profile.transcriptFileId ? '<a href="#" onclick="viewFile(' + profile.transcriptFileId + ')" style="margin-left:8px;font-size:12px">View</a>' : ''))
                : '<span class="text-red">Not uploaded</span>'}
            </div>
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

    // Render Self-Found internships summary on student profile
    try {
      const sfArr = Array.isArray(selfFound) ? selfFound : (selfFound ? [selfFound] : []);
      const sfCard = document.createElement('div');
      sfCard.className = 'card';
      const title = document.createElement('div'); title.className = 'card-title'; title.textContent = '📁 Self-Found Internships (' + sfArr.length + ')'; sfCard.appendChild(title);
      if (!sfArr.length) {
        const p = document.createElement('p'); p.className = 'text-muted'; p.textContent = 'No self-found internships submitted.'; sfCard.appendChild(p);
      } else {
        const wrapper = document.createElement('div'); wrapper.className = 'table-wrap';
        const table = document.createElement('table');
        table.innerHTML = '<thead><tr><th>Company</th><th>Submitted</th><th>Status</th><th>Offer</th></tr></thead>';
        const tbody = document.createElement('tbody');
        sfArr.forEach(sf => {
          const tr = document.createElement('tr');
          const tdCompany = document.createElement('td'); tdCompany.innerHTML = '<strong>' + (sf.companyName || '') + '</strong>'; tr.appendChild(tdCompany);
          const tdSubmitted = document.createElement('td'); tdSubmitted.textContent = sf.submittedAt ? new Date(sf.submittedAt).toLocaleDateString() : ''; tr.appendChild(tdSubmitted);
          const tdStatus = document.createElement('td'); tdStatus.innerHTML = badge(sf.status); tr.appendChild(tdStatus);
          const tdOffer = document.createElement('td');
          if (sf.offerLetterDoc) {
            const btn = document.createElement('button'); btn.className = 'btn btn-outline btn-sm'; btn.textContent = 'View Offer';
            btn.addEventListener('click', () => openBase64(sf.offerLetterDoc, 'offer_' + (sf.studentName || 'offer')));
            tdOffer.appendChild(btn);
          } else {
            tdOffer.innerHTML = '<span class="text-muted">No offer uploaded</span>';
          }
          tr.appendChild(tdOffer);
          tbody.appendChild(tr);
        });
        table.appendChild(tbody); wrapper.appendChild(table); sfCard.appendChild(wrapper);
      }
      document.getElementById('page-profile').appendChild(sfCard);
    } catch (e) { /* non-fatal */ }
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
      enrolled:      document.getElementById('p-enrolled') ? (document.getElementById('p-enrolled').checked ? 1 : 0) : 0,
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

async function uploadDoc(type, input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    showToast('File too large. Max 5MB allowed.', 'error');
    return;
  }
  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const base64 = e.target.result;
        const tok = authToken || localStorage.getItem('ib_token');
        const headers = { 'Content-Type': 'application/json' };
        if (tok) headers['Authorization'] = 'Bearer ' + tok;
        const fileName = type + '_' + Date.now() + '.' + file.name.split('.').pop();
        const uploadRes = await fetch('/api/profile/upload', {
          method: 'POST',
          headers,
          body: JSON.stringify({ fileName, fileType: file.type, base64 })
        });
        if (!uploadRes.ok) {
          const body = await uploadRes.json().catch(() => ({}));
          showToast(body.error || 'Upload failed.', 'error');
          return;
        }
        const uploadData = await uploadRes.json();
        const fileId = uploadData.fileId;
        const profileField = type === 'transcript' ? 'transcriptFileId' : 'cvFileId';
        const docField = type === 'transcript' ? 'transcriptDoc' : 'enrollmentDoc';
        await api.updateProfile({ [profileField]: fileId, [docField]: base64 }, tok);
        showToast(type === 'transcript' ? 'Transcript uploaded!' : 'Enrollment letter uploaded!', 'success');
        await new Promise(r => setTimeout(r, 300));
        await initStudentProfile();
      } catch(err) {
        showToast('Upload failed: ' + err.message, 'error');
      }
    };
    reader.readAsDataURL(file);
  } catch(e) {
    showToast('Upload failed: ' + e.message, 'error');
  }
}

async function viewFile(fileId) {
  try {
    const tok = authToken || localStorage.getItem('ib_token');
    const headers = {};
    if (tok) headers['Authorization'] = 'Bearer ' + tok;
    const res = await fetch('/api/profile/file/' + fileId, { headers });
    if (!res.ok) { showToast('Could not load file.', 'error'); return; }
    const data = await res.json();
    if (!data.base64) { showToast('File not available.', 'error'); return; }

    // Build correct data URI — handle both cases:
    // 1) base64 already has "data:..." prefix (new uploads)
    // 2) base64 is raw without prefix (old uploads)
    let src = data.base64;
    if (!src.startsWith('data:')) {
      const mime = data.fileType || 'application/octet-stream';
      src = 'data:' + mime + ';base64,' + src;
    }

    openDocumentPreview(src, data.fileName || 'Document');
  } catch(e) {
    showToast('Error loading file: ' + e.message, 'error');
  }
}

function openBase64(encoded, fileName) {
  try {
    if (!encoded) return showToast('File not available.', 'error');
    let src = encoded;
    if (typeof src === 'string') {
      try { src = decodeURIComponent(src); } catch (e) {}
      const fileRoute = src.match(/\/api\/profile\/file\/(\d+)(?:\/[^/?#]+)?(?:[?#]|$)/);
      if (fileRoute) return viewFile(Number(fileRoute[1]));
      if (!/^(data:|https?:\/\/|\/|blob:)/i.test(src)) src = 'data:application/pdf;base64,' + src;
    }
    openDocumentPreview(src, fileName || 'Document');
  } catch (e) { showToast('Cannot open file: ' + (e.message || ''), 'error'); }
}

function openDocumentPreview(src, title) {
  const overlay = document.createElement('div');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', title || 'Document preview');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:1100;background:rgba(17,24,39,.72);display:flex;align-items:center;justify-content:center;padding:20px';

  const panel = document.createElement('div');
  panel.style.cssText = 'display:flex;flex-direction:column;width:min(1100px,100%);height:min(90vh,900px);background:var(--card,#fff);border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.3);overflow:hidden';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 16px;border-bottom:1px solid var(--border,#ddd)';
  const heading = document.createElement('strong');
  heading.textContent = title || 'Document preview';
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'btn btn-outline btn-sm';
  closeButton.textContent = 'Close';
  closeButton.setAttribute('aria-label', 'Close document preview');
  closeButton.onclick = () => overlay.remove();
  header.append(heading, closeButton);

  const content = document.createElement('div');
  content.style.cssText = 'display:flex;align-items:center;justify-content:center;flex:1;min-height:0;background:#f3f4f6';
  const isImage = /^data:image\//i.test(src) || /\.(png|jpe?g|gif|webp)(?:[?#]|$)/i.test(src);
  const viewer = document.createElement(isImage ? 'img' : 'iframe');
  viewer.src = src;
  viewer.style.cssText = isImage
    ? 'display:block;max-width:100%;max-height:100%;object-fit:contain'
    : 'width:100%;height:100%;border:0;background:#fff';
  if (isImage) viewer.alt = title || 'Document preview';
  else viewer.title = title || 'Document preview';
  content.appendChild(viewer);
  panel.append(header, content);
  overlay.appendChild(panel);
  overlay.addEventListener('click', event => {
    if (event.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  closeButton.focus();
}
