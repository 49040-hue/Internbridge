// university.js — University Admin portal

async function initUniDashboard() {
  try {
    const [stats, companies, complaints] = await Promise.all([api.getAdminStats(), api.getCompanies(), api.getComplaints()]);
    const pending = companies.filter(c=>c.status==='pending');
    const openC   = complaints.filter(c=>c.status==='open');
    document.getElementById('page-uni-dashboard').innerHTML = `
      <div class="page-header">
        <div><div class="page-title">University Admin Panel</div>
          <div class="page-subtitle">Riphah International University · Faculty of Computing</div>
        </div>
      </div>
      ${openC.length?`<div class="alert alert-danger"><span class="alert-icon">🚨</span>
        <div><strong>${openC.length} open complaint(s)</strong> need your attention.
          <a style="color:var(--red);cursor:pointer;text-decoration:underline;margin-left:6px" onclick="navigateTo('complaints')">Review →</a>
        </div></div>`:''}
      ${stats.pendingStudents?`<div class="alert alert-info"><span class="alert-icon">👤</span>
        <div><strong>${stats.pendingStudents} student(s)</strong> pending verification.
          <a style="color:var(--teal);cursor:pointer;text-decoration:underline;margin-left:6px" onclick="navigateTo('verify-students')">Verify →</a>
        </div></div>`:''}
      ${pending.length?`<div class="alert alert-warning"><span class="alert-icon">⏳</span>
        <div><strong>${pending.length} company(ies)</strong> awaiting verification.
          <a style="color:var(--gold);cursor:pointer;text-decoration:underline;margin-left:6px" onclick="navigateTo('verify-companies')">Verify →</a>
        </div></div>`:''}
      ${stats.pendingApproval?`<div class="alert alert-info"><span class="alert-icon">📌</span>
        <div><strong>${stats.pendingApproval} internship post(s)</strong> awaiting Riphah approval.
          <a style="color:var(--teal);cursor:pointer;text-decoration:underline;margin-left:6px" onclick="navigateTo('approve-internships')">Approve →</a>
        </div></div>`:''}
      ${stats.pendingSelfFound?`<div class="alert alert-info"><span class="alert-icon">📋</span>
        <div><strong>${stats.pendingSelfFound} self-found internship(s)</strong> pending review.
          <a style="color:var(--teal);cursor:pointer;text-decoration:underline;margin-left:6px" onclick="navigateTo('self-found-review')">Review →</a>
        </div></div>`:''}
      <div class="stat-grid">
        <div class="stat-card green"><div class="stat-num">${stats.verifiedCompanies}</div><div class="stat-label">Verified Companies</div></div>
        <div class="stat-card gold"><div class="stat-num">${stats.pendingCompanies}</div><div class="stat-label">Pending Verification</div></div>
        <div class="stat-card"><div class="stat-num">${stats.sysadminApproved}</div><div class="stat-label">Approved Posts</div></div>
        <div class="stat-card muted"><div class="stat-num">${stats.openInternships}</div><div class="stat-label">Open Internships</div></div>
      </div>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-num">${stats.verifiedStudents}</div><div class="stat-label">Verified Students</div></div>
        <div class="stat-card gold"><div class="stat-num">${stats.pendingStudents}</div><div class="stat-label">Students Pending</div></div>
        <div class="stat-card green"><div class="stat-num">${stats.confirmedApplications}</div><div class="stat-label">Confirmed Interns</div></div>
        <div class="stat-card red"><div class="stat-num">${openC.length}</div><div class="stat-label">Open Complaints</div></div>
      </div>`;
  } catch(e) { showPageError(document.getElementById('page-uni-dashboard'), e.message); }
}

// ── PROFILE PAGE ───────────────────────────────────────────────
async function initUniProfile() {
  try {
    const profile = await api.getProfile(authToken);
    const websitePrefill = profile.website || 'www.riphah.edu.pk';
    document.getElementById('page-uni-profile').innerHTML = `
      <div class="page-header"><div><div class="page-title">University Profile</div></div></div>
      <div class="card" style="max-width:720px;margin:auto">
        <div class="card-title">University Information</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
          <div class="form-group"><label>University Name</label><input id="uni-name" type="text" value="Riphah International University" readonly /></div>
          <div class="form-group"><label>Admin Name</label><input id="uni-admin-name" type="text" value="${profile.name || ''}" /></div>
          <div class="form-group"><label>Email</label><input id="uni-email" type="email" value="${profile.email || ''}" readonly /></div>
          <div class="form-group"><label>Phone Number</label><input id="uni-phone" type="text" value="${profile.phone || ''}" /></div>
          <div class="form-group" style="grid-column:1 / -1"><label>Office Address</label><input id="uni-address" type="text" value="${profile.address || ''}" /></div>
          <div class="form-group"><label>Website</label><input id="uni-website" type="text" value="${websitePrefill}" /></div>
          <div class="form-group" style="grid-column:1 / -1"><label>Description</label><textarea id="uni-description" rows="4">${profile.description || ''}</textarea></div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:14px">
          <button class="btn btn-primary" id="uni-save-btn">Save Changes</button>
        </div>
      </div>`;

    document.getElementById('uni-save-btn').addEventListener('click', async () => {
      const payload = {
        name: document.getElementById('uni-admin-name').value.trim(),
        email: document.getElementById('uni-email').value.trim(),
        phone: document.getElementById('uni-phone').value.trim(),
        address: document.getElementById('uni-address').value.trim(),
        website: document.getElementById('uni-website').value.trim(),
        description: document.getElementById('uni-description').value.trim(),
      };
      try {
        const tok = await _getLatestToken();
        const headers = { 'Content-Type': 'application/json' };
        if (tok) headers['Authorization'] = 'Bearer ' + tok;
        const res = await fetch('/api/admin/uni-profile', { method: 'PUT', headers, body: JSON.stringify(payload) });
        if (!res.ok) {
          const b = await res.json().catch(() => ({}));
          throw new Error(b.error || b.message || 'Failed to save profile.');
        }
        const updated = await res.json();
        showToast('Profile updated successfully.','success');
        // refresh the page content with updated values
        initUniProfile();
      } catch (err) {
        showToast(err.message || 'Failed to save profile.','error');
      }
    });
  } catch(e) {
    showPageError(document.getElementById('page-uni-profile'), e.message);
  }
}

// ── VERIFY STUDENTS ─────────────────────────────────────────────
async function initVerifyStudents() {
  try {
    const students = await api.getPendingStudents();
    document.getElementById('page-verify-students').innerHTML = `
      <div class="page-header"><div>
        <div class="page-title">Student Verification</div>
        <div class="page-subtitle">Verify student eligibility against Riphah criteria based on their uploaded transcript</div>
      </div></div>
      ${!students.length?`<div class="empty-state card"><div class="icon">✅</div><p>No students pending verification.</p></div>`:''}
      ${students.map(s=>{
        const issues=[];
        if((s.creditHours||0)<60) issues.push('Credit hours: '+(s.creditHours||0)+'/60 required');
        if((s.cgpa||0)<2.0)       issues.push('CGPA: '+(s.cgpa||0)+' (minimum 2.0)');
        const ok=issues.length===0;
        return `<div class="card" style="border-top:3px solid ${ok?'var(--green)':'var(--gold)'}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
            <div>
              <div style="font-weight:700;font-size:15px">${s.name}</div>
              <div style="font-size:12px;color:var(--muted)">${s.email} · ${s.program||'—'} · Semester ${s.semester||'—'}</div>
              <div style="margin-top:8px;display:flex;gap:16px;font-size:13px">
                <span style="color:${(s.cgpa||0)>=2.0?'var(--green)':'var(--red)'}"><strong>CGPA:</strong> ${s.cgpa||'—'}</span>
                <span style="color:${(s.creditHours||0)>=60?'var(--green)':'var(--red)'}"><strong>Credits:</strong> ${s.creditHours||'—'}/60</span>
              </div>
              <div style="margin-top:6px;font-size:12px">
                <strong>Documents:</strong>
                ${s.transcriptDoc?'<span class="text-green">✓ Transcript</span>':'<span class="text-red">✗ No Transcript</span>'}
              </div>
              ${s.transcriptDoc?`<div style="margin-top:6px"><a class="btn btn-outline btn-sm" href="${s.transcriptDoc}" target="_blank" download="transcript_${s.name}.pdf">📄 View Transcript</a></div>`:''}
            </div>
            <div>
              ${ok?'<span class="chip-ok">✓ Meets all criteria</span>':issues.map(i=>`<div class="chip-warn" style="margin-bottom:4px">⚠ ${i}</div>`).join('')}
            </div>
          </div>
          <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-success" onclick="verifyStudentAction(${s.id},'approved','')">✓ Approve Account</button>
            <button class="btn btn-danger"  onclick="openRejectStudentModal(${s.id},'${s.name}')">✗ Reject</button>
          </div>
        </div>`;
      }).join('')}`;
  } catch(e) { showPageError(document.getElementById('page-verify-students'), e.message); }
}

function openRejectStudentModal(id, name) {
  openModal(`
    <h3>Reject Student: ${name}</h3>
    <div class="form-group"><label>Reason for Rejection *</label>
      <textarea id="rej-note" placeholder="e.g. Transcript does not show minimum 60 credit hours. Please provide updated official transcript."></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger"  onclick="verifyStudentAction(${id},'rejected',document.getElementById('rej-note').value)">Reject Account</button>
    </div>`);
}

async function verifyStudentAction(id, status, note) {
  if (!note && status==='rejected') return showToast('Please provide a rejection reason.','error');
  try {
    await api.verifyStudent(id, status, note);
    closeModal();
    showToast('Student ' + status, status==='approved'?'success':'info');
    initVerifyStudents();
    updateSidebarBadges();
  } catch(e) { showToast(e.message,'error'); }
}

// ── VERIFY COMPANIES ─────────────────────────────────────────────
async function initVerifyCompanies() {
  try {
    const companies = await api.getCompanies();
    console.log('DEBUG pending companies (raw):', companies);
    document.getElementById('page-verify-companies').innerHTML = `
      <div class="page-header"><div>
        <div class="page-title">Company Verification</div>
        <div class="page-subtitle">Check each company against Riphah criteria: P@SHA/PSEB/SECP registration, CMMI Level 2+, IT company, 3+ years operational</div>
      </div></div>
      ${!companies.length?`<div class="empty-state card"><div class="icon">🏢</div><p>No companies registered yet.</p></div>`:''}
      ${companies.map(c=>{
        // Prefer explicit provider fields; fall back to unified registrationType/registrationId
        const regProviders = [c.pasha, c.pseb, c.secp].filter(v => v !== undefined && v !== null && String(v).trim() !== '');
        let regId = regProviders.join(', ');
        if (!regId) {
          // older/newer records might use registrationType + registrationId
          if (c.registrationType && c.registrationId) regId = c.registrationType + ' — ' + c.registrationId;
          else regId = null;
        }
        const criteriaChecks=[
          {label:'Registration ID (P@SHA/PSEB/SECP)', ok:!!regId, val:regId||'Not provided'},
          {label:'CMMI / ISO Certification',          ok:!!c.cmmi, val:c.cmmi||'Not provided'},
          {label:'Year of Registration',              ok:!!c.operational, val: c.operational || 'Not stated'},
          {label:'Registration Certificate',          ok:!!c.regCertDoc, val:c.regCertDoc?'Uploaded':'Missing'},
          {label:'CMMI/ISO Certificate Doc',          ok:!!c.cmmiDoc, val:c.cmmiDoc?'Uploaded':'Missing'},
        ];
        const allOk = criteriaChecks.every(x=>x.ok);
        return `<div class="card" style="border-top:3px solid ${c.status==='verified'?'var(--green)':c.status==='rejected'?'var(--red)':'var(--gold)'}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:14px">
            <div>
              <div style="font-weight:700;font-size:15px">${c.name}</div>
              <div style="font-size:12px;color:var(--muted)">${c.email} · ${c.city||'—'} · Registered: ${c.registeredAt?new Date(c.registeredAt).toLocaleDateString():'—'}</div>
            </div>
            <div>${badge(c.status)}</div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;margin-bottom:14px">
            ${criteriaChecks.map(ch=>`
              <div style="font-size:12px;padding:8px 10px;background:${ch.ok?'var(--green-lite)':'var(--red-lite)'};border-radius:6px;border:1px solid ${ch.ok?'#86EFAC':'#FCA5A5'}">
                <span style="color:${ch.ok?'var(--green)':'var(--red)'};font-weight:700">${ch.ok?'✓':'✗'}</span>
                <strong style="margin-left:4px">${ch.label}</strong><br>
                <span style="color:var(--muted)">${ch.val}</span>
              </div>`).join('')}
          </div>
          ${c.regCertDoc?`<div style="margin-bottom:10px"><a class="btn btn-outline btn-sm" href="${c.regCertDoc}" target="_blank" download="reg_cert_${c.name}.pdf">📄 View Registration Certificate</a> `:''}
          ${c.cmmiDoc?`<a class="btn btn-outline btn-sm" href="${c.cmmiDoc}" target="_blank" download="cmmi_${c.name}.pdf">📄 View CMMI/ISO Certificate</a></div>`:''}
          ${c.status==='pending'?`
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <button class="btn btn-success" onclick="verifyCompany(${c.id},'verified','')">✓ Approve Company</button>
              <button class="btn btn-danger"  onclick="openRejectCompanyModal(${c.id},'${c.name}')">✗ Reject</button>
            </div>`:`<span style="font-size:12px;color:var(--muted)">Already reviewed — ${c.rejectionNote?'Reason: '+c.rejectionNote:''}</span>`}
        </div>`;
      }).join('')}`;
  } catch(e) { showPageError(document.getElementById('page-verify-companies'), e.message); }
}

function openRejectCompanyModal(id, name) {
  openModal(`
    <h3>Reject Company: ${name}</h3>
    <div class="form-group"><label>Reason for Rejection *</label>
      <textarea id="rco-note" placeholder="e.g. CMMI certification document not uploaded. Please resubmit with valid CMMI Level 2 certificate."></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger"  onclick="verifyCompany(${id},'rejected',document.getElementById('rco-note').value)">Reject Company</button>
    </div>`);
}

async function verifyCompany(id, status, note) {
  if (!note && status==='rejected') return showToast('Please provide a rejection reason.','error');
  try {
    await api.updateCompany(id, status, note);
    closeModal();
    showToast('Company ' + status, status==='verified'?'success':'info');
    initVerifyCompanies();
    updateSidebarBadges();
  } catch(e) { showToast(e.message,'error'); }
}

// ── APPROVE INTERNSHIPS ──────────────────────────────────────────
async function initApproveInternships() {
  try {
    const internships = await api.getAllInternshipsForAdmin();
    const pending = internships.filter(i=>!i.riphahApproved&&i.status==='open');
    document.getElementById('page-approve-internships').innerHTML = `
      <div class="page-header"><div>
        <div class="page-title">Approve Internship Posts</div>
        <div class="page-subtitle">Validate each posting against Riphah criteria before students can apply</div>
      </div></div>
      <div class="alert alert-info"><span class="alert-icon">ℹ️</span>
        <div>Each internship must meet: software/IT company, P@SHA/PSEB/SECP registered, CMMI Level 2+, 8+ weeks duration, on-site only.</div>
      </div>
      ${!internships.length?`<div class="empty-state card"><div class="icon">📌</div><p>No internship posts yet.</p></div>`:''}
      ${internships.map(i=>{
        const ok=i.eligibilityIssues&&i.eligibilityIssues.length===0;
        return `<div class="internship-card" style="flex-direction:column;align-items:stretch">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
            <div>
              <div class="title">${i.title}
                ${i.riphahApproved?'<span class="chip-ok">✓ Approved</span>':i.status==='closed'&&i.rejectionNote?'<span style="color:var(--red);font-size:11px">✗ Rejected</span>':'<span class="chip-warn">⏳ Pending Approval</span>'}
              </div>
              <div class="company-name">${i.company} — ${i.city}</div>
              <div class="meta">
                <span>⏰ Deadline: ${i.deadline ? new Date(i.deadline).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : ''}</span>
                <span>⏳ ${i.durationWeeks ? i.durationWeeks + ' weeks' : 'Not specified'}</span>
                <span>💰 ${i.stipend}</span>
                <span>👥 ${i.applicantsCount} applied</span>
              </div>
            </div>
          </div>
          ${i.description?`<p style="font-size:12px;color:var(--muted);margin-bottom:8px">${i.description}</p>`:''}
          ${ok?'<div style="margin-bottom:8px"><span class="chip-ok">✓ Meets all Riphah criteria</span></div>':
            `<div style="margin-bottom:8px">${(i.eligibilityIssues||[]).map(x=>`<span class="chip-warn" style="margin-right:4px">⚠ ${x}</span>`).join('')}</div>`}
          ${i.rejectionNote?`<div style="font-size:12px;color:var(--red);margin-bottom:8px">Rejection reason: ${i.rejectionNote}</div>`:''}
          ${!i.riphahApproved&&i.status==='open'?`
            <div style="display:flex;gap:10px">
              ${ok?`<button class="btn btn-success btn-sm" onclick="approveInternship(${i.id})">✓ Approve Post</button>`:''}
              <button class="btn btn-danger btn-sm" onclick="openRejectInternshipModal(${i.id})">✗ Reject Post</button>
            </div>`:''}
        </div>`;
      }).join('')}`;
  } catch(e) { showPageError(document.getElementById('page-approve-internships'), e.message); }
}

function openRejectInternshipModal(id) {
  openModal(`
    <h3>Reject Internship Post</h3>
    <div class="form-group"><label>Reason for Rejection *</label>
      <textarea id="ri-note" placeholder="e.g. Duration is less than 8 weeks. Please resubmit with correct duration."></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger"  onclick="rejectInternshipAction(${id})">Reject Post</button>
    </div>`);
}

async function rejectInternshipAction(id) {
  const note = document.getElementById('ri-note').value.trim();
  if (!note) return showToast('Please provide a rejection reason.','error');
  try {
    await api.rejectInternship(id, note);
    closeModal();
    showToast('Internship post rejected.','info');
    initApproveInternships();
  } catch(e) { showToast(e.message,'error'); }
}

async function approveInternship(id) {
  try {
    await api.approveInternship(id);
    showToast('Internship approved! Students can now apply.','success');
    initApproveInternships();
  } catch(e) { showToast(e.message,'error'); }
}

// ── SELF-FOUND REVIEW ────────────────────────────────────────────
async function initSelfFoundReview() {
  try {
    const sfs = await api.getAllSelfFoundInternships();
    document.getElementById('page-self-found-review').innerHTML = `
      <div class="page-header"><div>
        <div class="page-title">Self-Found Internship Review</div>
        <div class="page-subtitle">Review and approve/reject self-declared internships from students</div>
      </div></div>
      ${!sfs.length?`<div class="empty-state card"><div class="icon">📋</div><p>No self-found internship declarations.</p></div>`:''}
      ${sfs.map(sf=>`
        <div class="card" style="border-top:3px solid ${sf.status==='approved'?'var(--green)':sf.status==='rejected'?'var(--red)':'var(--gold)'}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div>
              <div style="font-weight:700;font-size:15px">${sf.studentName}</div>
              <div style="font-size:12px;color:var(--muted)">Submitted: ${new Date(sf.submittedAt).toLocaleDateString()}</div>
            </div>
            ${badge(sf.status)}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;margin-bottom:12px">
            <div><strong>Company:</strong> ${sf.companyName}</div>
            <div><strong>Website:</strong> ${sf.companyWebsite||'—'}</div>
            <div><strong>Supervisor:</strong> ${sf.supervisorName}</div>
            <div><strong>Supervisor Email:</strong> ${sf.supervisorEmail}</div>
            <div><strong>Start Date:</strong> ${sf.startDate}</div>
            <div><strong>End Date:</strong> ${sf.endDate}</div>
            <div><strong>Stipend:</strong> ${sf.stipend}</div>
          </div>
          <div style="font-size:13px;margin-bottom:12px"><strong>Work Description:</strong><br>${sf.workDescription}</div>
          ${sf.offerLetterDoc?`<div style="margin-bottom:12px"><a class="btn btn-outline btn-sm" href="${sf.offerLetterDoc}" target="_blank" download="offer_${sf.studentName}.pdf">📄 View Offer Letter</a></div>`:'<div style="margin-bottom:12px;font-size:12px;color:var(--red)">⚠ No offer letter uploaded</div>'}
          ${sf.adminNote?`<div class="alert alert-info" style="margin-bottom:10px"><span class="alert-icon">💬</span> <strong>Admin Note:</strong> ${sf.adminNote}</div>`:''}
          ${sf.status==='pending'?`
            <div style="display:flex;gap:10px;flex-wrap:wrap">
              <button class="btn btn-success" onclick="reviewSelfFound(${sf.id},'approved')">✓ Approve</button>
              <button class="btn btn-danger"  onclick="openRejectSelfFoundModal(${sf.id},'${sf.studentName}')">✗ Reject</button>
            </div>`:'<span style="font-size:12px;color:var(--muted)">Already reviewed.</span>'}
        </div>`).join('')}`;
  } catch(e) { showPageError(document.getElementById('page-self-found-review'), e.message); }
}

function openRejectSelfFoundModal(id, name) {
  openModal(`
    <h3>Reject Self-Found Internship — ${name}</h3>
    <div class="form-group"><label>Reason *</label>
      <textarea id="rsf-note" placeholder="e.g. Company does not appear to meet P@SHA/PSEB/SECP registration requirement."></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger"  onclick="reviewSelfFound(${id},'rejected',document.getElementById('rsf-note').value)">Reject</button>
    </div>`);
}

async function reviewSelfFound(id, status, note) {
  if (!note && status==='rejected') return showToast('Please provide a rejection reason.','error');
  try {
    await api.reviewSelfFoundInternship(id, status, note||'');
    closeModal();
    showToast('Self-found internship ' + status,'success');
    initSelfFoundReview();
    updateSidebarBadges();
  } catch(e) { showToast(e.message,'error'); }
}

// ── ALL APPLICATIONS ─────────────────────────────────────────────
async function initAllApplications() {
  try {
    const apps = await api.getAllApplications();
    document.getElementById('page-all-applications').innerHTML = `
      <div class="page-header"><div>
        <div class="page-title">All Applications</div>
        <div class="page-subtitle">Monitor all applications and give final university approval for confirmed internships</div>
      </div></div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Student</th><th>Internship</th><th>Company</th><th>Applied</th><th>Status</th><th>University Approval</th><th>Action</th></tr></thead>
        <tbody>${!apps.length?`<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:40px">No applications yet.</td></tr>`:
          apps.map(a=>`<tr>
            <td><a style="color:var(--teal);cursor:pointer;font-weight:600" onclick="viewStudentDetails(${a.studentId})">${a.studentName}</a></td>
            <td>${a.internshipTitle}</td>
            <td>${a.company}</td>
            <td>${a.appliedAt}</td>
            <td>${badge(a.status)}</td>
            <td>${a.universityApproved?'<span class="text-green font-bold">✓ Approved</span>':'<span class="text-muted">—</span>'}</td>
            <td>${a.status==='student_confirmed'&&!a.universityApproved?
              `<button class="btn btn-success btn-sm" onclick="universityApprove(${a.id})">Final Approve</button>`:'—'}
            </td>
          </tr>`).join('')}
        </tbody>
      </table></div></div>`;
  } catch(e) { showPageError(document.getElementById('page-all-applications'), e.message); }
}

async function universityApprove(id) {
  try {
    await api.universityApproveApplication(id);
    showToast('University approval granted!','success');
    initAllApplications();
  } catch(e) { showToast(e.message,'error'); }
}

// ── STUDENT DETAILS ──────────────────────────────────────────────
async function viewStudentDetails(studentId) {
  navigateTo('student-details');
  try {
    const d = await api.getStudentDetails(studentId);
    const elig = d.eligibilityIssues||[];
    document.getElementById('page-student-details').innerHTML = `
      <div class="page-header">       
        <div><div class="page-title">Student Details</div></div>
        <button class="btn btn-outline btn-sm" onclick="navigateTo('all-applications')">← Back</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px">
        <div class="card">
          <div class="card-title">👤 Personal Information</div>
          ${[['Full Name',d.name],['Email',d.email],['University',d.university||'—'],['Program',d.program||'—'],['Semester',d.semester||'—']].map(([l,v])=>`<div class="detail-row"><div class="detail-label">${l}</div><div class="detail-value">${v}</div></div>`).join('')}
        </div>
        <div class="card">
          <div class="card-title">🎓 Academic Information</div>
          <div class="detail-row"><div class="detail-label">CGPA</div><div class="detail-value"><strong style="color:${(d.cgpa||0)>=2.0?'var(--green)':'var(--red)'}">${d.cgpa||'—'}</strong></div></div>
          <div class="detail-row"><div class="detail-label">Credit Hours</div><div class="detail-value"><strong style="color:${(d.creditHours||0)>=60?'var(--green)':'var(--red)'}">${d.creditHours||'—'} / 60 required</strong></div></div>
          <div class="detail-row"><div class="detail-label">Elective Course</div><div class="detail-value">${d.electiveCourse||'—'}</div></div>
          <div class="detail-row"><div class="detail-label">Skills</div><div class="detail-value">${d.skills||'—'}</div></div>
          <div class="detail-row"><div class="detail-label">Transcript</div><div class="detail-value">${d.transcriptDoc?`<a href="${d.transcriptDoc}" target="_blank" download="transcript_${d.name}.pdf" class="btn btn-outline btn-sm">📄 Download</a>`:'<span class="text-red">Not uploaded</span>'}</div></div>
          <div class="detail-row"><div class="detail-label">Enrollment Letter</div><div class="detail-value">${d.enrollmentDoc?`<a href="${d.enrollmentDoc}" target="_blank" download="enrollment_${d.name}.pdf" class="btn btn-outline btn-sm">📄 Download</a>`:'<span class="text-red">Not uploaded</span>'}</div></div>
        </div>
      </div>
      <div class="card" style="border-top:3px solid ${elig.length?'var(--red)':'var(--green)'}">
        <div class="card-title">${elig.length?'⚠️ Eligibility Issues':'✅ Eligibility Status'}</div>
        ${elig.length?elig.map(x=>`<div class="alert alert-danger" style="margin-bottom:6px"><span class="alert-icon">✗</span> ${x}</div>`).join(''):
          '<div class="alert alert-success"><span class="alert-icon">✓</span> Student meets all Riphah internship eligibility criteria.</div>'}
      </div>
      <div class="card">
        <div class="card-title">📋 Applications (${d.applications.length})</div>
        ${!d.applications.length?'<p class="text-muted">No applications.</p>':
        `<div class="table-wrap"><table>
          <thead><tr><th>Internship</th><th>Company</th><th>Applied</th><th>Status</th></tr></thead>
          <tbody>${d.applications.map(a=>`<tr><td>${a.internshipTitle}</td><td>${a.company}</td><td>${a.appliedAt}</td><td>${badge(a.status)}</td></tr>`).join('')}</tbody>
        </table></div>`}
      </div>
      <div class="card">
        <div class="card-title">📩 Feedback Sent (${d.feedback.length})</div>
        ${!d.feedback.length?'<p class="text-muted">No feedback sent yet.</p>':
          d.feedback.map(f=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)">
            <strong style="font-size:13px">${f.subject}</strong>
            <span style="font-size:11px;color:var(--muted);margin-left:8px">${new Date(f.sentAt).toLocaleDateString()}</span>
            <p style="font-size:12px;color:var(--text2);margin-top:4px">${f.message}</p>
            <div style="margin-top:6px">
              <button class="btn btn-outline btn-sm" onclick="(async()=>{ if (!confirm('Delete this feedback?')) return; try{ await api.deleteFeedback(${f.id}); showToast('Feedback deleted.','info'); viewStudentDetails(${studentId}); } catch(e){ showToast(e.message,'error'); } })()">Delete</button>
            </div>
          </div>`).join('')}
        <div style="margin-top:16px">
          <button class="btn btn-primary btn-sm" onclick="openSendFeedbackModal(${studentId},'${d.name}')">Send Feedback</button>
        </div>
      </div>`;
  } catch(e) { showToast(e.message,'error'); }
}

function openSendFeedbackModal(studentId, studentName) {
  openModal(`
    <h3>Send Feedback — ${studentName}</h3>
    <div class="form-group"><label>Category</label>
      <select id="fb-cat"><option>Performance Review</option><option>Warning</option><option>Encouragement</option><option>Document Reminder</option><option>General</option></select>
    </div>
    <div class="form-group"><label>Subject *</label>
      <input id="fb-subj" type="text" placeholder="e.g. Mid-Internship Performance Review" />
    </div>
    <div class="form-group"><label>Message *</label>
      <textarea id="fb-msg" placeholder="Write your feedback message..."></textarea>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="sendFeedbackToStudent(${studentId},'${studentName}')">Send Feedback</button>
    </div>`);
}

async function sendFeedbackToStudent(studentId, studentName) {
  const d = { studentId, studentName, subject:document.getElementById('fb-subj').value, message:document.getElementById('fb-msg').value, category:document.getElementById('fb-cat').value, sentByName:currentUser.name };
  if (!d.subject||!d.message) return showToast('Subject and message are required.','error');
  try { await api.sendFeedback(d); closeModal(); showToast('Feedback sent to '+studentName,'success'); viewStudentDetails(studentId); }
  catch(e) { showToast(e.message,'error'); }
}

// ── STUDENT DETAILS ───────────────────────────────────────────────
async function initStudentDetails() {
  try {
    const students = await api.getAllStudents();
    document.getElementById('page-student-details').innerHTML = `
      <div class="page-header"><div>
        <div class="page-title">Student Details</div>
        <div class="page-subtitle">View all registered students and their information</div>
      </div></div>
      ${!students.length?`<div class="empty-state card"><div class="icon">👤</div><p>No students registered.</p></div>`:''}
      ${students.map(s=>{
        const issues = [];
        if ((s.creditHours||0) < 60) issues.push('Credit hours below 60');
        if ((s.cgpa||0) < 2.0) issues.push('CGPA below 2.0');
        if (!s.electiveCourse) issues.push('No elective course');
        return `<div class="card">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
            <div>
              <div style="font-weight:700;font-size:15px">${s.name}</div>
              <div style="font-size:12px;color:var(--muted)">${s.email} · ${s.program||'—'} · Semester ${s.semester||'—'}</div>
              <div style="margin-top:8px;display:flex;gap:16px;font-size:13px">
                <span><strong>CGPA:</strong> ${s.cgpa||'—'}</span>
                <span><strong>Credits:</strong> ${s.creditHours||'—'}</span>
                <span><strong>Elective:</strong> ${s.electiveCourse||'—'}</span>
                <span><strong>Skills:</strong> ${s.skills||'—'}</span>
              </div>
              <div style="margin-top:6px;font-size:12px">
                <strong>Status:</strong> ${badge(s.verificationStatus||'pending')}
              </div>
              ${s.verificationNote?`<div style="margin-top:6px;font-size:12px;color:var(--muted)">Note: ${s.verificationNote}</div>`:''}
            </div>
            <div>
              ${issues.length ? issues.map(i => `<div class="chip-warn" style="margin-bottom:4px">⚠ ${i}</div>`).join('') : '<span class="chip-ok">✓ Eligible</span>'}
            </div>
          </div>
        </div>`;
      }).join('')}`;
  } catch(e) { showPageError(document.getElementById('page-student-details'), e.message); }
}

// ── COMPLAINTS ────────────────────────────────────────────────────
async function initComplaints() {
  try {
    const complaints = await api.getComplaints();
    document.getElementById('page-complaints').innerHTML = `
      <div class="page-header"><div>
        <div class="page-title">Complaints</div>
        <div class="page-subtitle">Complaints filed by companies about interns</div>
      </div></div>
      ${!complaints.length?`<div class="empty-state card"><div class="icon">✅</div><p>No complaints filed.</p></div>`:''}
      ${complaints.map(c=>`
        <div class="card" style="border-left:4px solid ${c.status==='open'?'var(--red)':'var(--green)'}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
            <div>
              <div style="font-weight:700;font-size:14px">${c.subject}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:3px">
                From: <strong>${c.fromName}</strong> about intern <strong>${c.studentName}</strong> — ${c.internshipTitle||''}
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              ${badge(c.status)}
              <span style="font-size:11px;color:var(--muted)">${new Date(c.submittedAt).toLocaleDateString()}</span>
            </div>
          </div>
          <div style="font-size:13px;color:var(--text2);margin-bottom:12px">${c.description}</div>
          ${c.adminResponse?`<div class="alert alert-success" style="margin-bottom:8px"><span class="alert-icon">✓</span><div><strong>Admin Response:</strong> ${c.adminResponse}</div></div>`:''}
          ${c.status==='open'?`
            <div style="display:flex;gap:10px;align-items:center">
              <input type="text" id="resp-${c.id}" placeholder="Type your response to the company..." style="flex:1" />
              <button class="btn btn-primary btn-sm" onclick="resolveComplaint(${c.id})">Respond & Resolve</button>
              ${c.studentId?`<button class="btn btn-outline btn-sm" onclick="viewStudentDetails(${c.studentId})">View Student</button>`:''}
            </div>`:''}
        </div>`).join('')}`;
  } catch(e) { showPageError(document.getElementById('page-complaints'), e.message); }
}

async function resolveComplaint(id) {
  const resp = document.getElementById('resp-'+id).value.trim();
  if (!resp) return showToast('Please enter a response.','error');
  try { await api.respondComplaint(id,resp); showToast('Complaint resolved.','success'); initComplaints(); }
  catch(e) { showToast(e.message,'error'); }
}

// ── SEND FEEDBACK ────────────────────────────────────────────────
async function initSendFeedback() {
  try {
    const users    = await api.getStudentsList();
    const students = Array.isArray(users) ? users : (users.filter ? users.filter(u=> u.role === 'student' && u.accountStatus === 'verified') : []);
    document.getElementById('page-send-feedback').innerHTML = `
      <div class="page-header"><div>
        <div class="page-title">Send Feedback to Students</div>
        <div class="page-subtitle">Send academic guidance, warnings, or messages to students</div>
      </div></div>
      <div class="card">
        <div class="form-group"><label>Select Student *</label>
          <select id="sf-student">
            <option value="">— Select student —</option>
            ${students.map(s=>`<option value="${s.id}|${s.name}">${s.name} (${s.university||'Riphah'})</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Category</label>
            <select id="sf-cat"><option>Performance Review</option><option>Warning</option><option>Encouragement</option><option>Document Reminder</option><option>General</option></select>
          </div>
          <div class="form-group"><label>Subject *</label>
            <input id="sf-subj" type="text" placeholder="e.g. Mid-Internship Performance" />
          </div>
        </div>
        <div class="form-group"><label>Message *</label>
          <textarea id="sf-msg" placeholder="Write your message to the student..."></textarea>
        </div>
        <button class="btn btn-primary" onclick="sendFeedbackPage()">Send Feedback</button>
      </div>`;
  } catch(e) { showPageError(document.getElementById('page-send-feedback'), e.message); }
}

async function sendFeedbackPage() {
  const sel = document.getElementById('sf-student').value;
  if (!sel) return showToast('Please select a student.','error');
  const [studentId, studentName] = sel.split('|');
  const d = { studentId:parseInt(studentId), studentName, subject:document.getElementById('sf-subj').value, message:document.getElementById('sf-msg').value, category:document.getElementById('sf-cat').value, sentByName:currentUser.name };
  if (!d.subject||!d.message) return showToast('Subject and message are required.','error');
  try { await api.sendFeedback(d); showToast('Feedback sent!','success'); document.getElementById('sf-subj').value=''; document.getElementById('sf-msg').value=''; }
  catch(e) { showToast(e.message,'error'); }
}

// ── CRITERIA ──────────────────────────────────────────────────────
async function initCriteria() {
  try {
    const c = await api.getCriteria() || {};
    document.getElementById('page-criteria').innerHTML = `
      <div class="page-header"><div>
        <div class="page-title">Manage Internship Criteria</div>
        <div class="page-subtitle">Riphah Faculty of Computing · Internship Registration Guidelines</div>
      </div></div>
      <div class="tab-bar">
        <button class="tab-btn active" onclick="switchTab(this,'tab-se')">Student Eligibility</button>
        <button class="tab-btn" onclick="switchTab(this,'tab-ce')">Company Criteria</button>
        <button class="tab-btn" onclick="switchTab(this,'tab-notes')">Important Notes</button>
        <button class="tab-btn" onclick="switchTab(this,'tab-docs')">Required Docs</button>
        <button class="tab-btn" onclick="switchTab(this,'tab-partners')">Partner Companies</button>
      </div>
      <div id="tab-se" class="tab-panel active">${renderCriteriaSection('studentEligibility',Array.isArray(c.studentEligibility)?c.studentEligibility:[])}</div>
      <div id="tab-ce" class="tab-panel">${renderCriteriaSection('companyRequirements',Array.isArray(c.companyRequirements)?c.companyRequirements:[])}</div>
      <div id="tab-notes" class="tab-panel">${renderCriteriaSection('importantNotes',Array.isArray(c.importantNotes)?c.importantNotes:[])}</div>
      <div id="tab-docs" class="tab-panel">${renderCriteriaSection('requiredDocs',Array.isArray(c.requiredDocs)?c.requiredDocs:[])}</div>
      <div id="tab-partners" class="tab-panel">
        <div class="card">
          <div class="card-title">Partner Companies</div>
          <div id="partner-list">${(Array.isArray(c.partnerCompanies)?c.partnerCompanies:[]).map((x,i)=>`
            <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
              <span style="flex:1;font-size:13px">${x.text?x.text:x}</span>
              <button class="btn btn-danger btn-sm" onclick="removePartner(${i})">Remove</button>
            </div>`).join('')}</div>
          <div style="display:flex;gap:10px;margin-top:14px">
            <input id="new-partner" type="text" placeholder="Add new partner company name" />
            <button class="btn btn-primary btn-sm" onclick="addPartner()">+ Add</button>
          </div>
        </div>
      </div>`;
    window._criteria = {
      studentEligibility: Array.isArray(c.studentEligibility)?c.studentEligibility:[],
        companyRequirements: Array.isArray(c.companyRequirements)?c.companyRequirements:[],
        importantNotes: Array.isArray(c.importantNotes)?c.importantNotes:[],
        requiredDocs: Array.isArray(c.requiredDocs)?c.requiredDocs:[],
        partnerCompanies: Array.isArray(c.partnerCompanies)?c.partnerCompanies:[],
    };
  } catch(e) { showPageError(document.getElementById('page-criteria'), e.message); }
}

function renderCriteriaSection(section, items) {
  return `<div class="card">
    <div id="cl-${section}">${items.map(x=>`
      <div class="criteria-item" id="ci-${section}-${x.id}">
        <span class="criteria-check">✓</span>
        <input type="text" value="${x.text}" id="ci-text-${section}-${x.id}" style="flex:1" />
        <button class="btn btn-success btn-sm" onclick="saveCriteriaItem('${section}',${x.id})">Save</button>
        <button class="btn btn-danger btn-sm" onclick="deleteCriteriaItem('${section}',${x.id})">✕</button>
      </div>`).join('')}
    </div>
    <div style="display:flex;gap:10px;margin-top:14px">
      <input id="new-${section}" type="text" placeholder="Add new item..." />
      <button class="btn btn-primary btn-sm" onclick="addCriteriaItem('${section}')">+ Add</button>
    </div>
  </div>`;
}

async function saveCriteriaItem(section, id) {
  const text = document.getElementById('ci-text-'+section+'-'+id).value;
  window._criteria[section] = window._criteria[section].map(x=>x.id===id?{...x,text}:x);
  await api.updateCriteria(section, window._criteria[section]);
  showToast('Saved.','success');
}

async function deleteCriteriaItem(section, id) {
  await api.deleteCriteriaItem(section, id);
  window._criteria[section] = window._criteria[section].filter(x=>x.id!==id);
  document.getElementById('ci-'+section+'-'+id).remove();
  showToast('Deleted.','info');
}

async function addCriteriaItem(section) {
  const text = document.getElementById('new-'+section).value.trim();
  if (!text) return showToast('Enter criteria text.','error');
  const r = await api.addCriteriaItem(section, text);
  window._criteria[section].push({ id:r.id, text, editable:true });
  const list = document.getElementById('cl-'+section);
  const div  = document.createElement('div');
  div.className = 'criteria-item'; div.id = 'ci-'+section+'-'+r.id;
  div.innerHTML = `<span class="criteria-check">✓</span>
    <input type="text" value="${text}" id="ci-text-${section}-${r.id}" style="flex:1" />
    <button class="btn btn-success btn-sm" onclick="saveCriteriaItem('${section}',${r.id})">Save</button>
    <button class="btn btn-danger btn-sm"  onclick="deleteCriteriaItem('${section}',${r.id})">✕</button>`;
  list.appendChild(div);
  document.getElementById('new-'+section).value = '';
  showToast('Added.','success');
}

async function addPartner() {
  const name = document.getElementById('new-partner').value.trim();
  if (!name) return;
  window._criteria.partnerCompanies.push(name);
  await api.updateCriteria('partnerCompanies', window._criteria.partnerCompanies);
  document.getElementById('new-partner').value = '';
  showToast('Partner added.','success');
  initCriteria();
}

async function removePartner(idx) {
  window._criteria.partnerCompanies.splice(idx,1);
  await api.updateCriteria('partnerCompanies', window._criteria.partnerCompanies);
  showToast('Removed.','info');
  initCriteria();
}

    // ── MONITOR POSTS ─────────────────────────────────────────────────
         async function initMonitorPosts() {
         try {
               const internships = await api.getAllInternshipsForAdmin();
                document.getElementById('page-monitor-posts').innerHTML = `
             <div class="page-header"><div><div class="page-title">Monitor Internship Posts</div></div></div>
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Title</th><th>Company</th><th>City</th><th>Deadline</th><th>Duration</th><th>Applicants</th><th>Riphah</th><th>Status</th></tr></thead>
        <tbody>${!internships.length?`<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:40px">No internships posted yet.</td></tr>`:
          internships.map(i=>`<tr>
            <td>${i.title}</td>
            <td class="text-teal">${i.company}</td>
            <td>📍 ${i.city}</td>
            <td>${i.deadline}</td>
            <td style="font-size:12px">${i.duration}</td>
            <td>${i.applicantsCount}</td>
     <td>${i.riphahApproved?'<span class="text-green">✓</span>':'<span class="text-gold">⏳</span>'}</td>
      <td>${badge(i.status)}</td>
          </tr>`).join('')}
        </tbody>
      </table></div></div>`;
  } catch(e) { showPageError(document.getElementById('page-monitor-posts'), e.message); }
}

// ── REPORTS ───────────────────────────────────────────────────────
async function initReports() {
  try {
    const [stats, internships] = await Promise.all([api.getAdminStats(), api.getAllInternshipsForAdmin()]);
    const cityMap = {};
    internships.forEach(i=>{ cityMap[i.city]=(cityMap[i.city]||0)+1; });
    document.getElementById('page-reports').innerHTML = `
      <div class="page-header"><div><div class="page-title">Reports & Analytics</div></div></div>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-num">${stats.totalInternships}</div><div class="stat-label">Total Postings</div></div>
        <div class="stat-card gold"><div class="stat-num">${stats.approvedStudents}</div><div class="stat-label">Verified Students</div></div>
        <div class="stat-card green"><div class="stat-num">${stats.verifiedCompanies}</div><div class="stat-label">Verified Companies</div></div>
        <div class="stat-card purple"><div class="stat-num">${stats.riphahApproved}</div><div class="stat-label">Riphah Approved Posts</div></div>
      </div>
      <div class="card">
        <div class="card-title">City Distribution</div>
        ${Object.entries(cityMap).length?Object.entries(cityMap).map(([city,count])=>`
          <div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px">
              <span>${city}</span><span class="text-teal font-bold">${count} internship${count>1?'s':''}</span>
            </div>
            <div class="progress-wrap"><div class="progress-bar" style="width:${Math.round(count/internships.length*100)}%"></div></div>
          </div>`).join(''):'<p class="text-muted">No data yet.</p>'}
      </div>
      <div class="card">
        <div class="card-title">Application Pipeline</div>
        ${[['Pending',stats.pendingApplications,'var(--gold)'],['Confirmed',stats.confirmedApplications,'var(--green)']].map(([l,v,c])=>`
          <div style="margin-bottom:14px">
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px">
              <span>${l}</span><span style="font-weight:700;color:${c}">${v}</span>
            </div>
            <div class="progress-wrap"><div class="progress-bar" style="width:${stats.totalApplications?Math.round(v/stats.totalApplications*100):0}%;background:${c}"></div></div>
          </div>`).join('')}
      </div>`;
  } catch(e) { showPageError(document.getElementById('page-reports'), e.message); }
}
