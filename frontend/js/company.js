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
      <div class="page-subtitle">Submission requires Riphah university approval before students can apply.</div>
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
        <tbody>${apps.map(a=>{
            const s = a.studentDetails || a;
            const studentName = s && (s.name || s.studentName) ? (s.name || s.studentName) : '';
            const studentEmail = s && (s.email || s.studentEmail) ? (s.email || s.studentEmail) : '';
            const studentUniversity = s && (s.university || s.studentUniversity) ? (s.university || s.studentUniversity) : '—';
            const studentCgpa = s && (s.cgpa || s.studentCgpa) ? (s.cgpa || s.studentCgpa) : '—';
            const studentSkills = s && (s.skills || s.studentSkills) ? (s.skills || s.studentSkills) : '—';
            const docsBtn = (s && s.transcriptFileId) ? `<div style="margin-top:6px"><button class="btn btn-outline btn-sm" onclick="viewFile(${s.transcriptFileId})">Transcript</button></div>` : '';
            return `<tr>
              <td>
                <strong>${studentName}</strong><br>
                <span style="font-size:11px;color:var(--muted)">${studentEmail||''}</span>
                ${docsBtn}
              </td>
              <td style="font-size:12px">${studentUniversity||'—'}</td>
              <td style="font-size:12px"><strong>${studentCgpa||'—'}</strong></td>
              <td style="font-size:11px;color:var(--muted)">${studentSkills||'—'}</td>
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
            </tr>`;
          }).join('')}</tbody>
      </table></div></div>`}`;
  } catch(e) { showPageError(document.getElementById('page-applicants'), e.message); }
}

function openReviewModal(id, status) {
  const container = document.createElement('div');
  const h3 = document.createElement('h3'); h3.textContent = 'Accept Application'; container.appendChild(h3);
  const group = document.createElement('div'); group.className = 'form-group';
  const label = document.createElement('label'); label.textContent = 'Message to Student (Optional)';
  const textarea = document.createElement('textarea'); textarea.id = 'review-msg'; textarea.placeholder = 'e.g. We are pleased to offer you this internship. Please confirm at your earliest convenience.';
  group.appendChild(label); group.appendChild(textarea); container.appendChild(group);
  const actions = document.createElement('div'); actions.className = 'modal-actions';
  const btnCancel = document.createElement('button'); btnCancel.className = 'btn btn-outline'; btnCancel.textContent = 'Cancel'; btnCancel.onclick = closeModal;
  const btnSend = document.createElement('button'); btnSend.className = 'btn btn-success'; btnSend.textContent = 'Send Offer';
  btnSend.onclick = function() { reviewApplication(id, 'company_accepted', document.getElementById('review-msg').value); };
  actions.appendChild(btnCancel); actions.appendChild(btnSend); container.appendChild(actions);
  openModal(container.innerHTML);
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
    const active = apps.filter(a => a.status==='student_confirmed' || a.status==='university_approved');
    let html = '';
    html += '<div class="page-header"><div><div class="page-title">File Complaint</div>';
    html += '<div class="page-subtitle">Report issues with an intern to the Riphah university</div>';
    html += '</div></div>';
    html += '<div class="card">';
    if (!active.length) {
      html += '<div class="empty-state"><div class="icon">✅</div><p>No active interns to file complaints about.</p></div>';
    } else {
      html += '<div class="form-group"><label>Select Intern *</label>';
      html += '<select id="fc-app">';
      html += '<option value="">— Select intern —</option>';
      for (const a of active) {
        html += '<option value="' + a.id + '">' + (a.studentName || '') + ' — ' + (a.internshipTitle || '') + '</option>';
      }
      html += '</select></div>';
      html += '<div class="form-group"><label>Subject *</label>';
      html += '<input id="fc-subject" type="text" placeholder="e.g. Attendance Issues, Misconduct, Performance" />';
      html += '</div>';
      html += '<div class="form-group"><label>Description *</label>';
      html += '<textarea id="fc-desc" placeholder="Provide a detailed description of the issue..."></textarea>';
      html += '</div>';
      html += '<div style="display:flex;gap:10px">';
      html += '<button class="btn btn-primary" onclick="submitComplaint()">Submit Complaint</button>';
      html += '<button class="btn btn-outline" onclick="navigateTo(\'company-dashboard\')">Cancel</button>';
      html += '</div>';
    }
    html += '</div>';
    document.getElementById('page-file-complaint').innerHTML = html;
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
    showToast('Complaint submitted to university.', 'success');
    navigateTo('company-dashboard');
  } catch(e) { showToast(e.message, 'error'); }
}

async function initCompanyProfile() {
  try {
    const profile = await api.getProfile(_companyAuth());
    // compute file IDs (backend now returns regCertFileId / cmmiFileId when available)
    const regId = profile.regCertFileId || (profile.regCertDoc ? parseInt((profile.regCertDoc || '').split('/').pop()) : null);
    const cmmiId = profile.cmmiFileId || (profile.cmmiDoc ? parseInt((profile.cmmiDoc || '').split('/').pop()) : null);
    const regHtml = regId ? `<div>📄 Registration Certificate: <span class="text-green">✓ Uploaded</span> <button class="btn btn-outline btn-sm" onclick="viewFile(${regId})">View</button></div>` : `<div>📄 Registration Certificate: <span class="text-red">Not uploaded</span></div>`;
    const cmmiHtml = cmmiId ? `<div>📄 CMMI/ISO Certificate: <span class="text-green">✓ Uploaded</span> <button class="btn btn-outline btn-sm" onclick="viewFile(${cmmiId})">View</button></div>` : `<div>📄 CMMI/ISO Certificate: <span class="text-red">Not uploaded</span></div>`;

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
            ${regHtml}
            <div style="margin-top:4px">${cmmiHtml}</div>
            <div style="margin-top:10px;display:flex;gap:8px;align-items:center">
              <input id="cp-reg-input" type="file" style="display:none" onchange="companyUploadCert('reg', this)" />
              <button id="cp-reg-btn" class="btn btn-outline btn-sm" onclick="document.getElementById('cp-reg-input').click()">Upload Registration Cert</button>
              <input id="cp-cmmi-input" type="file" style="display:none" onchange="companyUploadCert('cmmi', this)" />
              <button id="cp-cmmi-btn" class="btn btn-outline btn-sm" onclick="document.getElementById('cp-cmmi-input').click()">Upload CMMI/ISO Cert</button>
              <span id="cp-upload-status" style="font-size:12px;color:var(--muted);margin-left:8px"></span>
            </div>
            <div id="cp-dropzone" style="margin-top:8px;padding:8px;border:1px dashed var(--border);border-radius:6px;text-align:center;font-size:12px;color:var(--muted)">Drag & drop documents here to upload (reg / cmmi)</div>
          </div>
        </div>
        <button class="btn btn-primary" onclick="saveCompanyProfile()">Save Changes</button>
      </div>`;

    // attach enhanced drag/drop handlers (supports multiple files)
    const dz = document.getElementById('cp-dropzone');
    if (dz) {
      dz.ondragover = (e) => { e.preventDefault(); dz.style.background = 'rgba(0,0,0,0.02)'; };
      dz.ondragleave = (e) => { dz.style.background = ''; };
      dz.ondrop = (e) => {
        e.preventDefault(); dz.style.background = '';
        const files = (e.dataTransfer && e.dataTransfer.files) ? Array.from(e.dataTransfer.files) : [];
        if (!files.length) return showToast('No files detected in drop.', 'error');
        for (const f of files) {
          const name = (f.name || '').toLowerCase();
          const type = name.includes('cmmi') || name.includes('iso') ? 'cmmi' : (name.includes('reg') || name.includes('certificate') || name.endsWith('.pdf') ? 'reg' : 'reg');
          companyUploadCert(type, f);
        }
      };
    }
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

// Upload company registration / cmmi documents
async function companyUploadCert(type, inputOrFile) {
  let file = null;
  if (!inputOrFile) return showToast('No file selected.', 'error');
  if (inputOrFile.files && inputOrFile.files[0]) file = inputOrFile.files[0];
  else if (inputOrFile instanceof File) file = inputOrFile;
  else return showToast('Invalid file input.', 'error');
  if (file.size > 6 * 1024 * 1024) return showToast('File too large. Max 6MB allowed.', 'error');
    try {
      // disable buttons and show status
      const statusEl = document.getElementById('cp-upload-status');
      const regBtn = document.getElementById('cp-reg-btn');
      const cmmiBtn = document.getElementById('cp-cmmi-btn');
      if (regBtn) regBtn.disabled = true;
      if (cmmiBtn) cmmiBtn.disabled = true;
      if (statusEl) statusEl.textContent = 'Uploading...';

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = e.target.result;
          let tok = await (window.getAuthToken ? window.getAuthToken() : (authToken || localStorage.getItem('ib_token')));
          if (typeof tok === 'string' && tok.startsWith('Bearer ')) tok = tok.split(' ')[1];
          const headers = { 'Content-Type': 'application/json' };
          if (tok) headers['Authorization'] = 'Bearer ' + tok;
          const prefix = type === 'cmmi' ? 'cmmi_cert_' : 'reg-cert_';
          const fileName = prefix + Date.now() + '.' + (file.name.split('.').pop() || 'pdf');
          const uploadRes = await fetch('/api/profile/upload', {
            method: 'POST', headers, body: JSON.stringify({ fileName, fileType: file.type, base64 })
          });
          if (!uploadRes.ok) {
            const body = await uploadRes.json().catch(() => ({}));
            showToast(body.error || 'Upload failed.', 'error');
            if (statusEl) statusEl.textContent = '';
            return;
          }
          const uploadData = await uploadRes.json().catch(() => ({}));
          showToast('Document uploaded!', 'success');
          if (statusEl) statusEl.textContent = `Uploaded: ${uploadData.fileName || file.name}`;
          // refresh the profile to show the updated document preview button
          setTimeout(() => { initCompanyProfile(); if (statusEl) statusEl.textContent = ''; }, 800);
        } catch (err) { showToast('Upload failed: ' + err.message, 'error'); }
        finally {
          if (regBtn) regBtn.disabled = false;
          if (cmmiBtn) cmmiBtn.disabled = false;
        }
      };
      reader.readAsDataURL(file);
    } catch (e) { showToast('Upload failed: ' + e.message, 'error'); }
}