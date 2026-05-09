// company.js — Company portal pages

let _timeSlots = [];

function _getToken() {
  try {
    if (typeof getAuthHeaders === 'function') {
      const h = getAuthHeaders();
      if (h && h.Authorization) return h.Authorization.startsWith('Bearer ') ? h.Authorization.split(' ')[1] : h.Authorization;
    }
  } catch (e) {}
  return (typeof authToken !== 'undefined' && authToken) ? authToken : localStorage.getItem('ib_token');
}

function _companyAuth() {
  const t = localStorage.getItem('token') || localStorage.getItem('ib_token') || '';
  return 'Bearer ' + t;
}

async function initCompanyDashboard() {
  try {
    const token = _companyAuth();
    const [internships, applications] = await Promise.all([
      api.getMyInternships(token), api.getCompanyApplications(token),
    ]);
    document.getElementById('page-company-dashboard').innerHTML = `
      <div class="page-header">
        <div><div class="page-title">${currentUser.name}</div>
          <div class="page-subtitle">Company Dashboard</div>
        </div>
        <button class="btn btn-primary" onclick="navigateTo('post-internship')">+ Post Internship</button>
      </div>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-num">${internships.length}</div><div class="stat-label">Posted Internships</div></div>
        <div class="stat-card gold"><div class="stat-num">${applications.filter(a=>a.status==='pending').length}</div><div class="stat-label">Pending Reviews</div></div>
        <div class="stat-card green"><div class="stat-num">${applications.filter(a=>a.status==='company_accepted').length}</div><div class="stat-label">Offers Extended</div></div>
        <div class="stat-card muted"><div class="stat-num">${applications.filter(a=>a.status==='student_confirmed'||a.status==='university_approved').length}</div><div class="stat-label">Confirmed Interns</div></div>
      </div>
      <div class="card">
        <div class="card-title">Recent Applications</div>
        ${!applications.length ? '<p class="text-muted">No applications yet.</p>' :
        `<div class="table-wrap"><table>
          <thead><tr><th>Student</th><th>Position</th><th>Date</th><th>Status</th></tr></thead>
          <tbody>${applications.slice(0,5).map(a=>`<tr>
            <td><strong>${a.studentName}</strong></td>
            <td>${a.internshipTitle}</td>
            <td>${a.appliedAt}</td>
            <td>${badge(a.status)}</td>
          </tr>`).join('')}</tbody>
        </table></div>`}
      </div>`;
  } catch(e) { showPageError(document.getElementById('page-company-dashboard'), e.message); }
}

async function initMyInternships() {
  try {
    const internships = await api.getMyInternships(_companyAuth());
    window._companyInternships = internships;
    document.getElementById('page-my-internships').innerHTML = `
      <div class="page-header">
        <div><div class="page-title">My Internships</div></div>
        <button class="btn btn-primary" onclick="navigateTo('post-internship')">+ Post New</button>
      </div>
      ${!internships.length ? `<div class="empty-state card"><div class="icon">📌</div><p>No internships posted yet.</p></div>` :
        internships.map(i=>`
        <div class="internship-card" id="internship-card-${i.id}">
          <div>
            <div class="title">${i.title}
              ${i.riphahApproved ? ' <span class="chip-ok">✓ Riphah Approved</span>' : '<span class="chip-warn">⏳ Awaiting Riphah Approval</span>'}
              ${i.rejectionNote ? ' <span class="chip-warn">✗ Rejected</span>' : ''}
            </div>
            <div class="meta">📍 ${i.city} &nbsp;⏰ ${i.deadline} &nbsp;💰 ${i.stipend} &nbsp;⏳ ${i.duration} &nbsp;👥 ${i.applicantsCount} applicants</div>
            ${i.rejectionNote ? `<div style="font-size:12px;color:var(--red);margin-top:4px">Rejection reason: ${i.rejectionNote}</div>` : ''}
          </div>
          <div class="actions">
            ${badge(i.status)}
            ${i.status==='open' ? `<button class="btn btn-danger btn-sm" onclick="closeInternship(${i.id})">Close</button>` : ''}
            ${(i.status==='pending' || i.status==='open') && (!i.sysadminApproved || i.sysadminApproved==0) ? `<button class="btn btn-secondary btn-sm" onclick="editInternship(${i.id})">Edit</button>` : ''}
          </div>
        </div>`).join('')}`;
  } catch(e) { showPageError(document.getElementById('page-my-internships'), e.message); }
}

function editInternship(id) {
  try {
    const list = window._companyInternships || [];
    const i = list.find(x => x.id === id);
    if (!i) return showToast('Internship not found.', 'error');
    if (i.sysadminApproved && i.sysadminApproved==1) return showToast('Approved internships cannot be edited.', 'error');
    const container = document.getElementById('internship-card-' + id);
    if (!container) return;
    container.innerHTML = `
      <div style="flex:1">
        <div class="form-group"><label>Job Title</label><input id="edit-title-${id}" type="text" value="${escapeHtml(i.title||'')}" /></div>
        <div class="form-group"><label>Deadline</label><input id="edit-deadline-${id}" type="date" value="${i.deadline||''}" /></div>
        <div class="form-group"><label>Stipend</label><input id="edit-stipend-${id}" type="text" value="${i.stipend||''}" /></div>
        <div class="form-group"><label>Type</label>
          <select id="edit-type-${id}">
            <option value="full-time" ${i.type==='full-time'?'selected':''}>Full-time</option>
            <option value="part-time" ${i.type==='part-time'?'selected':''}>Part-time</option>
          </select>
        </div>
        <div class="form-group"><label>Duration (weeks)</label><input id="edit-weeks-${id}" type="number" value="${i.durationWeeks||8}" /></div>
        <div class="form-group"><label>Description</label><textarea id="edit-desc-${id}">${escapeHtml(i.description||'')}</textarea></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
        <button class="btn btn-primary" onclick="saveEditedInternship(${id})">Save</button>
        <button class="btn btn-outline" onclick="initMyInternships()">Cancel</button>
      </div>`;
  } catch (e) { showToast(e.message, 'error'); }
}

async function saveEditedInternship(id) {
  try {
    const data = {};
    const title = document.getElementById('edit-title-' + id).value.trim(); if (title) data.title = title;
    const deadline = document.getElementById('edit-deadline-' + id).value; if (deadline) data.deadline = deadline;
    const stipend = document.getElementById('edit-stipend-' + id).value.trim(); if (stipend !== undefined) data.stipend = stipend;
    const type = document.getElementById('edit-type-' + id).value; if (type) data.type = type;
    const weeks = parseInt(document.getElementById('edit-weeks-' + id).value) || 0; data.durationWeeks = weeks;
    const desc = document.getElementById('edit-desc-' + id).value.trim(); if (desc !== undefined) data.description = desc;
    await api.updateInternship(id, data, _companyAuth());
    showToast('Internship updated.', 'success');
    initMyInternships();
  } catch (e) { showToast(e.message || 'Update failed', 'error'); }
}

function escapeHtml(s) { return (s+'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }

async function closeInternship(id) {
  if (!confirm('Close this internship posting?')) return;
  try {
    await api.closeInternship(id, _companyAuth());
    showToast('Internship closed.', 'info');
    initMyInternships();
  } catch(e) { showToast(e.message, 'error'); }
}

function initPostInternship() {
  _timeSlots = [];
  document.getElementById('page-post-internship').innerHTML = `
    <div class="page-header"><div><div class="page-title">Post Internship</div>
      <div class="page-subtitle">Submission requires Riphah university admin approval before students can apply.</div>
    </div></div>
    <div class="alert alert-info"><span class="alert-icon">ℹ️</span>
      <div>Per Riphah criteria: internship must be <strong>8 weeks full-time or 16 weeks part-time</strong>, on-site only (no remote).</div>
    </div>
    <div class="card">
      <div class="form-row">
        <div class="form-group"><label>Job Title *</label><input id="pi-title" type="text" placeholder="e.g. Frontend Developer Intern" /></div>
        <div class="form-group"><label>City *</label>
          <select id="pi-city"><option value="">Select City</option><option>Lahore</option><option>Karachi</option><option>Islamabad</option><option>Rawalpindi</option><option>Faisalabad</option></select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Application Deadline *</label><input id="pi-deadline" type="date" /></div>
        <div class="form-group"><label>Monthly Stipend</label><input id="pi-stipend" type="text" placeholder="e.g. 15,000 PKR/month" /></div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Type *</label>
          <select id="pi-type">
            <option value="full-time">Full-time (8 weeks minimum)</option>
            <option value="part-time">Part-time (16 weeks minimum)</option>
          </select>
        </div>
        <div class="form-group"><label>Duration (Weeks) *</label><input id="pi-weeks" type="number" value="8" min="8" /></div>
      </div>
      <div class="form-group"><label>Job Description</label>
        <textarea id="pi-desc" placeholder="Describe the role, responsibilities, and required skills..."></textarea>
      </div>
      <div class="form-group">
        <label>Available Time Slots</label>
        <div id="time-slots-list"></div>
        <div class="form-row" style="margin-top:10px;">
          <div class="form-group"><label>Day</label>
            <select id="slot-day">
              <option value="Monday">Monday</option>
              <option value="Tuesday">Tuesday</option>
              <option value="Wednesday">Wednesday</option>
              <option value="Thursday">Thursday</option>
              <option value="Friday">Friday</option>
              <option value="Saturday">Saturday</option>
              <option value="Sunday">Sunday</option>
            </select>
          </div>
          <div class="form-group"><label>Start Time</label><input id="slot-start" type="time" /></div>
          <div class="form-group"><label>End Time</label><input id="slot-end" type="time" /></div>
          <div class="form-group"><label>Type</label>
            <select id="slot-type">
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
            </select>
          </div>
          <div class="form-group" style="align-self:flex-end;"><button class="btn btn-outline" onclick="addTimeSlot()">Add Slot</button></div>
        </div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn btn-primary" onclick="submitPostInternship()">Submit for Riphah Approval</button>
        <button class="btn btn-outline" onclick="navigateTo('my-internships')">Cancel</button>
      </div>
    </div>`;
  renderTimeSlots();
}

async function submitPostInternship() {
  const d = {
    title:        document.getElementById('pi-title').value.trim(),
    city:         document.getElementById('pi-city').value,
    deadline:     document.getElementById('pi-deadline').value,
    stipend:      document.getElementById('pi-stipend').value.trim(),
    type:         document.getElementById('pi-type').value,
    durationWeeks: parseInt(document.getElementById('pi-weeks').value)||8,
    description:  document.getElementById('pi-desc').value.trim(),
    time_slots:    _timeSlots,
  };
  d.duration = d.durationWeeks + ' weeks ' + d.type;
  // ensure companyId is provided (supports new accounts where token decoding may be unreliable)
  try { if (typeof getCurrentCompanyId === 'function') d.companyId = getCurrentCompanyId(); } catch(e) {}
  if (!d.title||!d.city||!d.deadline) return showToast('Title, city and deadline are required.', 'error');
  if (d.durationWeeks < 8)            return showToast('Duration must be at least 8 weeks.', 'error');
  try {
    await api.postInternship(d, _companyAuth());
    showToast('Internship submitted! Awaiting Riphah university approval.', 'success');
    _timeSlots = [];
    navigateTo('my-internships');
  } catch(e) { showToast(e.message, 'error'); }
}

function addTimeSlot() {
  const day = document.getElementById('slot-day').value;
  const start = document.getElementById('slot-start').value;
  const end = document.getElementById('slot-end').value;
  const type = document.getElementById('slot-type').value;
  if (!day || !start || !end) return showToast('All slot fields are required.', 'error');
  if (start >= end) return showToast('Start time must be before end time.', 'error');
  _timeSlots.push({ day, startTime: start, endTime: end, type });
  renderTimeSlots();
  document.getElementById('slot-start').value = '';
  document.getElementById('slot-end').value = '';
}

function removeTimeSlot(index) {
  _timeSlots.splice(index, 1);
  renderTimeSlots();
}

function renderTimeSlots() {
  const list = document.getElementById('time-slots-list');
  list.innerHTML = _timeSlots.map((slot, i) => `
    <div class="slot-item" style="display:flex;justify-content:space-between;align-items:center;padding:8px;border:1px solid #ddd;margin-bottom:5px;border-radius:4px;">
      <span>${slot.day} ${slot.startTime} - ${slot.endTime} (${slot.type})</span>
      <button class="btn btn-sm btn-outline" onclick="removeTimeSlot(${i})">Remove</button>
    </div>
  `).join('');
}

async function initApplicants() {
  try {
    const apps = await api.getCompanyApplications(_companyAuth());
    document.getElementById('page-applicants').innerHTML = `
      <div class="page-header"><div><div class="page-title">Student Applications</div>
        <div class="page-subtitle">Review applications and extend or decline offers</div>
      </div></div>
      ${!apps.length ? `<div class="empty-state card"><div class="icon">📋</div><p>No applications yet.</p></div>` :
      `<div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Student</th><th>University</th><th>CGPA</th><th>Skills</th><th>Position</th><th>Applied</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>${apps.map(a=>`<tr>
          <td>
            <strong>${a.studentName}</strong><br>
            <span style="font-size:11px;color:var(--muted)">${a.studentEmail||''}</span>
          </td>
          <td style="font-size:12px">${a.studentUniversity||'—'}</td>
          <td style="font-size:12px"><strong>${a.studentCgpa||'—'}</strong></td>
          <td style="font-size:11px;color:var(--muted)">${a.studentSkills||'—'}</td>
          <td>${a.internshipTitle}</td>
          <td>${a.appliedAt}</td>
          <td>${badge(a.status)}</td>
          <td><div class="td-actions">
            ${a.status==='pending'?`
              <button class="btn btn-success" onclick="openReviewModal(${a.id},'company_accepted')">Accept</button>
              <button class="btn btn-danger"  onclick="reviewApplication(${a.id},'company_rejected','')">Reject</button>`:''}
            ${(a.status==='student_confirmed'||a.status==='university_approved')?
              `<button class="btn btn-warning btn-sm" onclick="navigateTo('file-complaint');window._complaintApp=${a.id}">File Complaint</button>`:''}
            ${a.status==='company_accepted'||a.status==='company_rejected'?'<span style="font-size:12px;color:var(--muted)">Decision sent</span>':''}
          </div></td>
        </tr>`).join('')}</tbody>
      </table></div></div>`}`;
  } catch(e) { showPageError(document.getElementById('page-applicants'), e.message); }
}

function openReviewModal(id, status) {
  openModal(`
    <h3>Accept Application</h3>
    <div class="form-group"><label>Message to Student (Optional)</label>
      <textarea id="review-msg" placeholder="e.g. We are pleased to offer you this internship. Please confirm at your earliest convenience."></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-success" onclick="reviewApplication(${id},'company_accepted',document.getElementById('review-msg').value)">Send Offer</button>
    </div>`);
}

async function reviewApplication(id, status, feedback) {
  try {
    await api.updateApplication(id, status, feedback, _companyAuth());
    closeModal();
    showToast(status==='company_accepted'?'Offer extended to student!':'Application rejected.', 'info');
    initApplicants();
  } catch(e) { showToast(e.message, 'error'); }
}

async function initFileComplaint() {
  try {
    const apps   = await api.getCompanyApplications(_companyAuth());
    const active = apps.filter(a => a.status==='student_confirmed'||a.status==='university_approved');
    document.getElementById('page-file-complaint').innerHTML = `
      <div class="page-header"><div><div class="page-title">File Complaint</div>
        <div class="page-subtitle">Report issues with an intern to the Riphah university admin</div>
      </div></div>
      <div class="card">
        ${!active.length ? `<div class="empty-state"><div class="icon">✅</div><p>No active interns to file complaints about.</p></div>` :
        `<div class="form-group"><label>Select Intern *</label>
          <select id="fc-app">
            <option value="">— Select intern —</option>
            ${active.map(a=>`<option value="${a.id}">${a.studentName} — ${a.internshipTitle}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Subject *</label>
          <input id="fc-subject" type="text" placeholder="e.g. Attendance Issues, Misconduct, Performance" />
        </div>
        <div class="form-group"><label>Description *</label>
          <textarea id="fc-desc" placeholder="Provide a detailed description of the issue..."></textarea>
        </div>
        <div style="display:flex;gap:10px">
          <button class="btn btn-primary" onclick="submitComplaint()">Submit Complaint</button>
          <button class="btn btn-outline" onclick="navigateTo('company-dashboard')">Cancel</button>
        </div>`}
      </div>`;
    if (window._complaintApp) {
      const sel = document.getElementById('fc-app');
      if (sel) sel.value = window._complaintApp;
      window._complaintApp = null;
    }
  } catch(e) { showPageError(document.getElementById('page-file-complaint'), e.message); }
}

async function submitComplaint() {
  const appId   = parseInt(document.getElementById('fc-app').value);
  const subject = document.getElementById('fc-subject').value.trim();
  const desc    = document.getElementById('fc-desc').value.trim();
  if (!appId||!subject||!desc) return showToast('All fields are required.', 'error');
  try {
    await api.submitComplaint({ applicationId:appId, subject, description:desc }, _companyAuth());
    showToast('Complaint submitted to university admin.', 'success');
    navigateTo('company-dashboard');
  } catch(e) { showToast(e.message, 'error'); }
}

async function initCompanyProfile() {
  try {
    const profile = await api.getProfile(_companyAuth());
    document.getElementById('page-company-profile').innerHTML = `
      <div class="page-header"><div><div class="page-title">Company Profile</div></div></div>
      <div class="card">
        <div style="display:flex;gap:16px;align-items:center;margin-bottom:24px">
          <div class="avatar avatar-sq">${(profile.name||'?')[0].toUpperCase()}</div>
          <div>
            <div style="font-size:18px;font-weight:700">${profile.name}</div>
            <div class="text-muted">${profile.city||'Pakistan'}</div>
            <div style="margin-top:6px">${badge(profile.status||'pending')}</div>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Company Name</label><input id="cp-name" type="text" value="${profile.name||''}" /></div>
          <div class="form-group"><label>City</label>
            <select id="cp-city"><option>Lahore</option><option>Karachi</option><option>Islamabad</option><option>Rawalpindi</option></select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>P@SHA / PSEB / SECP ID</label>
            <input type="text" value="${[profile.pasha,profile.pseb,profile.secp].filter(Boolean).join(' / ')||'—'}" disabled /></div>
          <div class="form-group"><label>CMMI / ISO Certification</label>
            <input type="text" value="${profile.cmmi||'—'}" disabled /></div>
        </div>
        <div class="form-group"><label>Years Operational</label>
          <input type="text" value="${profile.operational||'—'}" disabled /></div>
        <div class="form-group">
          <label>Uploaded Documents</label>
          <div style="font-size:13px;padding:10px;background:var(--bg);border-radius:8px;border:1px solid var(--border)">
            <div>📄 Registration Certificate: ${profile.regCertDoc?'<span class="text-green">✓ Uploaded</span>':'<span class="text-red">Not uploaded</span>'}</div>
            <div style="margin-top:4px">📄 CMMI/ISO Certificate: ${profile.cmmiDoc?'<span class="text-green">✓ Uploaded</span>':'<span class="text-red">Not uploaded</span>'}</div>
          </div>
        </div>
        <button class="btn btn-primary" onclick="saveCompanyProfile()">Save Changes</button>
      </div>`;
  } catch(e) {
    showToast(e.message, 'error');
    document.getElementById('page-company-profile').innerHTML =
      `<p class="text-muted" style="text-align:center;padding:60px">Failed to load profile.</p>`;
  }
}

async function saveCompanyProfile() {
  try {
    await api.updateProfile({ name:document.getElementById('cp-name').value, city:document.getElementById('cp-city').value }, _companyAuth());
    showToast('Profile updated!', 'success');
  } catch(e) { showToast(e.message, 'error'); }
}
