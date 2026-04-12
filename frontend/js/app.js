// app.js — Core app logic, navigation, sidebar

function badge(status) {
  if (!status) return '';
  const label = {
    open:'Open', verified:'Verified', accepted:'Accepted',
    student_confirmed:'Confirmed', university_approved:'Uni Approved',
    completed:'Completed', pending:'Pending', company_accepted:'Offer Received',
    rejected:'Rejected', closed:'Closed', student_declined:'Declined',
    company_rejected:'Not Selected', info:'Info', resolved:'Resolved', approved:'Approved',
  };
  return `<span class="badge badge-${status.toLowerCase().replace(/\s/g,'_')}">${label[status]||status}</span>`;
}

let _toastTimer;
function showToast(msg, type='info') {
  const t = document.getElementById('toast');
  const icons = { success:'✓', error:'✗', info:'ℹ', warning:'⚠' };
  t.textContent = (icons[type]||'') + ' ' + msg;
  t.className = 'show ' + type;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { t.className = ''; }, 3500);
}

function openModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('show');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
}
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

function switchTab(btn, tabId) {
  btn.closest('.page, .card, #page-criteria, #page-manage-users')
     .querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.closest('.page, .card, #page-criteria, #page-manage-users')
     .querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(tabId).classList.add('active');
}

// ── SIDEBAR CONFIG ────────────────────────────────────────────
const sidebarConfig = {
  student: [
    { id:'dashboard',       label:'Dashboard',             icon:'📊' },
    { id:'search',          label:'Search Internships',    icon:'🔍' },
    { id:'my-applications', label:'My Applications',       icon:'📋', badge:true },
    { id:'my-complaints',   label:'Complaints',            icon:'🚨' },
    { id:'decisions',       label:'Pending Decisions',     icon:'🎯', badge:true },
    { id:'my-feedback',     label:'University Feedback',   icon:'📩', badge:true },
    { id:'self-found',      label:'Self-Found Internship', icon:'🏢' },
    { id:'criteria-view',   label:'Riphah Criteria',       icon:'📜' },
    { id:'profile',         label:'My Profile',            icon:'👤' },
  ],
  company: [
    { id:'company-dashboard', label:'Dashboard',       icon:'📊' },
    { id:'my-internships',    label:'My Internships',  icon:'📌' },
    { id:'post-internship',   label:'Post Internship', icon:'➕' },
    { id:'applicants',        label:'Applications',    icon:'📋' },
    { id:'file-complaint',    label:'File Complaint',  icon:'🚨' },
    { id:'company-profile',   label:'Company Profile', icon:'🏢' },
  ],
  university: [
    { id:'uni-dashboard',       label:'Dashboard',            icon:'📊' },
    { id:'verify-students',     label:'Verify Students',      icon:'👤', badge:true },
    { id:'verify-companies',    label:'Verify Companies',     icon:'✅', badge:true },
    { id:'approve-internships', label:'Approve Internships',  icon:'📋', badge:true },
    { id:'self-found-review',   label:'Self-Found Review',    icon:'🏢', badge:true },
    { id:'all-applications',    label:'All Applications',     icon:'📂' },
    { id:'student-details',     label:'Student Details',      icon:'👤' },
    { id:'complaints',          label:'Complaints',           icon:'🚨', badge:true },
    { id:'send-feedback',       label:'Send Feedback',        icon:'📩' },
    { id:'monitor-posts',       label:'Monitor Posts',        icon:'📌' },
    { id:'criteria',            label:'Manage Criteria',      icon:'📜' },
    { id:'reports',             label:'Reports',              icon:'📈' },
    { id:'uni-profile',         label:'My Profile',           icon:'👤' },
  ],
  sysadmin: [
    { id:'sys-dashboard', label:'Dashboard',    icon:'📊' },
    { id:'manage-users',  label:'Manage Users', icon:'👥' },
    { id:'security',      label:'Security',     icon:'🔒' },
    { id:'backup',        label:'Backup & DB',  icon:'💾' },
    { id:'activity',      label:'Activity Log', icon:'📡' },
    { id:'sys-profile',   label:'My Profile',   icon:'👤' },
  ],
};

// lazy initializer map so that handlers defined in other modules are available
function getPageInit(pageId) {
  const map = {
    'dashboard':            initStudentDashboard,
    'search':               initSearchPage,
    'my-applications':      initMyApplications,
    'decisions':            initDecisionsPage,
    'my-feedback':          initMyFeedback,
    'self-found':           initSelfFoundPage,
    'criteria-view':        initCriteriaView,
    'profile':              initStudentProfile,
    'my-complaints':        initMyComplaints,
    'company-dashboard':    initCompanyDashboard,
    'my-internships':       initMyInternships,
    'post-internship':      initPostInternship,
    'applicants':           initApplicants,
    'file-complaint':       initFileComplaint,
    'company-profile':      initCompanyProfile,
    'uni-dashboard':        initUniDashboard,
    'verify-students':      initVerifyStudents,
    'verify-companies':     initVerifyCompanies,
    'approve-internships':  initApproveInternships,
    'self-found-review':    initSelfFoundReview,
    'all-applications':     initAllApplications,
    'student-details':      initStudentDetails,
    'complaints':           initComplaints,
    'send-feedback':        initSendFeedback,
    'criteria':             initCriteria,
    'monitor-posts':        initMonitorPosts,
    'reports':              initReports,
    'sys-dashboard':        initSysDashboard,
    'manage-users':         initManageUsers,
    'security':             initSecurity,
    'backup':               initBackup,
    'activity':             initActivityLog,
    'uni-profile':          initUniProfile,
    'sys-profile':          initSysProfile,
  };
  return map[pageId];
}  

let currentPage = null;

function showPageSpinner(pageEl) {
  pageEl.innerHTML = `<div style="display:flex;justify-content:center;padding:80px"><div class="spinner"></div></div>`;
}

function showPageError(pageEl, msg) {
  pageEl.innerHTML = `
    <div style="text-align:center;padding:80px 20px">
      <div style="font-size:36px;margin-bottom:12px">⚠️</div>
      <div style="font-size:15px;font-weight:700;color:var(--red);margin-bottom:8px">Failed to load page</div>
      <div style="font-size:13px;color:var(--muted);margin-bottom:20px">${msg}</div>
      <button class="btn btn-primary" onclick="navigateTo('${currentPage}')">Try Again</button>
    </div>`;
}

async function navigateTo(pageId) {
  // assign early so errors inside init or showPageError have a valid value
  currentPage = pageId;

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById('page-' + pageId);
  if (pageEl) {
    pageEl.classList.add('active');
    showPageSpinner(pageEl);
  }
  const navEl = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (navEl) navEl.classList.add('active');

  const initFn = getPageInit(pageId);
  if (initFn) {
    try {
      await Promise.race([
        initFn(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Request timed out. Please try again.')), 10000)),
      ]);
      // If init ran but never replaced spinner, show fallback
      if (pageEl && pageEl.querySelector('.spinner')) {
        showPageError(pageEl, 'Page initialiser did not return content.');
      }
    } catch(e) {
      if (pageEl) showPageError(pageEl, e.message);
    }
  }
}

async function updateSidebarBadges() {
  if (!authToken || !currentUser) return;
  try {
    if (currentUser.role === 'student') {
      const [apps, fb] = await Promise.all([api.getMyApplications(authToken), api.getMyFeedback(authToken)]);
      setBadge('decisions',       apps.filter(a => a.status === 'company_accepted').length);
      setBadge('my-feedback',     fb.filter(f => !f.read).length);
      setBadge('my-applications', apps.filter(a => a.status === 'pending').length);
    }
    if (currentUser.role === 'university') {
      const stats = await api.getAdminStats();
      setBadge('verify-students',     stats.pendingStudents);
      setBadge('verify-companies',    stats.pendingCompanies);
      setBadge('approve-internships', stats.pendingApproval);
      setBadge('self-found-review',   stats.pendingSelfFound);
      setBadge('complaints',          stats.openComplaints);
    }
  } catch {}
}

function setBadge(pageId, count) {
  const el = document.querySelector(`.nav-item[data-page="${pageId}"] .badge-dot`);
  if (!el) return;
  if (count > 0) { el.textContent = count; el.style.display = ''; }
  else el.style.display = 'none';
}

function initApp() {
  const role = currentUser.role;
  document.getElementById('nav-username').textContent = currentUser.name;
  document.getElementById('nav-role').textContent = {
    student:'Student', company:'Company', university:'University Admin', sysadmin:'System Admin',
  }[role] || role;

  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = (sidebarConfig[role]||[]).map(item => `
    <div class="nav-item" data-page="${item.id}" onclick="navigateTo('${item.id}')">
      <span class="icon">${item.icon}</span>
      ${item.label}
      ${item.badge !== undefined ? `<span class="badge-dot" style="display:none">0</span>` : ''}
    </div>`).join('');

  document.getElementById('login-page').style.display    = 'none';
  document.getElementById('register-page').style.display = 'none';
  document.getElementById('register-page').classList.remove('visible');
  document.getElementById('app').classList.add('visible');

  const defaults = { student:'dashboard', company:'company-dashboard', university:'uni-dashboard', sysadmin:'sys-dashboard' };
  navigateTo(defaults[role] || 'dashboard');
  setTimeout(updateSidebarBadges, 600);
  setInterval(updateSidebarBadges, 30000);
}

document.addEventListener('DOMContentLoaded', () => {
  if (!tryAutoLogin()) showRoleSelectScreen();
});
