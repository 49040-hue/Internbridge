// sysadmin.js — System Admin portal

async function initSysProfile() {
  try {
    const profile = await api.getProfile(authToken);
    document.getElementById('page-sys-profile').innerHTML = `
      <div class="page-header"><div><div class="page-title">My Profile</div></div></div>
      <div class="card" style="max-width:500px;margin:auto">
        <div style="margin-bottom:20px">
          <div style="font-size:18px;font-weight:700">${profile.name}</div>
          <div style="font-size:13px;color:var(--muted)">${profile.email}</div>
          <div style="margin-top:6px" class="badge badge-${profile.role}">${profile.role === 'sysadmin' ? 'System Admin' : profile.role}</div>
        </div>
      </div>`;
  } catch(e) {
    showPageError(document.getElementById('page-sys-profile'), e.message);
  }
}

async function initSysDashboard() {
  try {
    const [sysStats, stats] = await Promise.all([api.getSystemStats(), api.getAdminStats()]);
    document.getElementById('page-sys-dashboard').innerHTML = `
      <div class="page-header"><div><div class="page-title">System Admin Panel</div>
        <div class="page-subtitle">System health, user management, and monitoring</div>
      </div></div>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-num">${sysStats.totalUsers}</div><div class="stat-label">Total Users</div></div>
        <div class="stat-card green"><div class="stat-num">${sysStats.dbRecords}</div><div class="stat-label">Total Records</div></div>
        <div class="stat-card gold"><div class="stat-num">${sysStats.securityAlerts}</div><div class="stat-label">Activity Warnings</div></div>
        <div class="stat-card muted"><div class="stat-num">${formatUptime(sysStats.uptime)}</div><div class="stat-label">Uptime</div></div>
      </div>
      <div class="card">
        <div class="card-title">System Overview</div>
        ${[['Mode',sysStats.nodeVersion],['Total Users',sysStats.totalUsers],['Total DB Records',sysStats.dbRecords],['Last Backup',sysStats.lastBackup]]
          .map(([k,v])=>`<div class="detail-row"><div class="detail-label">${k}</div><div class="detail-value" style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--teal)">${v}</div></div>`).join('')}
      </div>`;
  } catch(e) { showPageError(document.getElementById('page-sys-dashboard'), e.message); }
}

function formatUptime(s) {
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60);
  return h+'h '+m+'m';
}

async function initManageUsers() {
  try {
    const users = await api.getUsers();
    const byRole = r => users.filter(u=>u.role===r);
    document.getElementById('page-manage-users').innerHTML = `
      <div class="page-header"><div><div class="page-title">Manage Users</div></div></div>
      <div class="tab-bar">
        <button class="tab-btn active" onclick="switchTab(this,'tab-students')">Students (${byRole('student').length})</button>
        <button class="tab-btn" onclick="switchTab(this,'tab-companies')">Companies (${byRole('company').length})</button>
        <button class="tab-btn" onclick="switchTab(this,'tab-admins')">Admins</button>
      </div>
      <div id="tab-students" class="tab-panel active">
        <div class="card"><div class="table-wrap"><table>
          <thead><tr><th>Name</th><th>Email</th><th>Program</th><th>CGPA</th><th>Credits</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>${byRole('student').length?byRole('student').map(u=>`<tr>
            <td><strong>${u.name}</strong></td>
            <td style="font-size:12px;color:var(--muted)">${u.email}</td>
            <td style="font-size:12px">${u.program||'—'}</td>
            <td style="font-size:12px"><strong style="color:${(u.cgpa||0)>=2.0?'var(--green)':'var(--red)'}">${u.cgpa||'—'}</strong></td>
            <td style="font-size:12px">${u.creditHours||'—'}</td>
            <td>${badge(u.verificationStatus||'pending')}</td>
            <td><button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">Remove</button></td>
          </tr>`).join(''):`<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:30px">No students registered yet.</td></tr>`}
          </tbody>
        </table></div></div>
      </div>
      <div id="tab-companies" class="tab-panel">
        <div class="card"><div class="table-wrap"><table>
          <thead><tr><th>Company</th><th>Email</th><th>Registration</th><th>CMMI</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>${byRole('company').length?byRole('company').map(u=>`<tr>
            <td><strong>${u.name}</strong></td>
            <td style="font-size:12px;color:var(--muted)">${u.email}</td>
            <td style="font-size:11px;font-family:monospace;color:var(--teal)">${[u.pasha,u.pseb,u.secp].filter(Boolean).join('/')||'—'}</td>
            <td style="font-size:12px">${u.cmmi||'—'}</td>
            <td>${badge(u.status||'pending')}</td>
            <td><button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})">Remove</button></td>
          </tr>`).join(''):`<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:30px">No companies registered yet.</td></tr>`}
          </tbody>
        </table></div></div>
      </div>
      <div id="tab-admins" class="tab-panel">
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <div class="card-title" style="margin:0">Admin Accounts</div>
            <button class="btn btn-primary btn-sm" onclick="openCreateAdminModal()">+ Create Admin Account</button>
          </div>
          <div class="table-wrap"><table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
            <tbody>${[...byRole('university'),...byRole('sysadmin')].map(u=>`<tr>
              <td><strong>${u.name}</strong></td>
              <td style="font-size:12px;color:var(--muted)">${u.email}</td>
              <td>${badge('info')}&nbsp;<span style="font-size:11px">${u.role}</span></td>
            </tr>`).join('')}
            </tbody>
          </table></div>
        </div>
      </div>`;
  } catch(e) { showPageError(document.getElementById('page-manage-users'), e.message); }
}

function openCreateAdminModal() {
  openModal(`
    <h3>Create Admin Account</h3>
    <div class="form-group"><label>Full Name *</label><input id="ca-name" type="text" placeholder="e.g. Dr. Ali Hassan" /></div>
    <div class="form-group"><label>Email *</label><input id="ca-email" type="email" placeholder="admin@riphah.edu.pk" /></div>
    <div class="form-group"><label>Password *</label><input id="ca-pass" type="password" placeholder="Minimum 6 characters" /></div>
    <div class="form-group"><label>Role *</label>
      <select id="ca-role">
        <option value="university">University Admin</option>
        <option value="sysadmin">System Admin</option>
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="createAdminAccount()">Create Account</button>
    </div>`);
}

async function createAdminAccount() {
  const d = { name:document.getElementById('ca-name').value.trim(), email:document.getElementById('ca-email').value.trim(), password:document.getElementById('ca-pass').value, role:document.getElementById('ca-role').value };
  if (!d.name||!d.email||!d.password) return showToast('All fields are required.','error');
  try { await api.createAdminUser(d); closeModal(); showToast('Admin account created.','success'); initManageUsers(); }
  catch(e) { showToast(e.message,'error'); }
}

async function deleteUser(id) {
  if (!confirm('Delete this user? This cannot be undone.')) return;
  try { await api.deleteUser(id); showToast('User deleted.','info'); initManageUsers(); }
  catch(e) { showToast(e.message,'error'); }
}

function initSecurity() {
  document.getElementById('page-security').innerHTML = `
    <div class="page-header"><div><div class="page-title">Security</div></div></div>
    <div class="card">
      <div class="card-title">Security Status</div>
        ${[['Password Storage','bcrypt hashing (10 rounds)',true],['JWT Authentication','Real JWT with 24h expiry',true],['Rate Limiting','Login protected — 10 attempts per 15 min',true],['Input Validation','Server-side validation enabled',true]].map(([l,s,ok])=>`
        <div class="detail-row">
          <div class="detail-label">${l}</div>
          <div class="detail-value" style="font-weight:600;color:${ok?'var(--green)':'var(--gold)'}">${ok?'✓':'⚠'} ${s}</div>
        </div>`).join('')}
    </div>
    <div class="alert alert-warning"><span class="alert-icon">⚠️</span>
      <div><strong>Demo Mode:</strong> This system runs entirely in the browser. For production, connect a real backend (Node.js + Express), use bcrypt for password hashing, real JWT tokens, and a database (PostgreSQL / MongoDB).</div>
    </div>`;
}

function initBackup() {
  document.getElementById('page-backup').innerHTML = `
    <div class="page-header"><div><div class="page-title">Backup & Database</div></div></div>
    <div class="card">
      <div class="card-title">Database Status</div>
      ${[['Engine','MySQL (via XAMPP)'],['Persistence','Permanent — data saved in MySQL database'],['Status','Connected and running']].map(([k,v])=>`
        <div class="detail-row">
          <div class="detail-label">${k}</div>
          <div class="detail-value" style="color:var(--teal);font-weight:500">${v}</div>
        </div>`).join('')}
    </div>
    <div class="alert alert-info"><span class="alert-icon">ℹ️</span>
      <div>This is a browser-based demo. To persist data, integrate a real backend database. All features and workflows are fully functional in this demo.</div>
    </div>`;
}

async function initActivityLog() {
  try {
    const logs  = await api.getActivity();
    const icons = { info:'ℹ️', success:'✅', warning:'⚠️', error:'❌' };
    document.getElementById('page-activity').innerHTML = `
      <div class="page-header"><div><div class="page-title">Activity Log</div></div></div>
      <div class="card">
        <div class="card-title">Recent System Events</div>
        ${logs.map(l=>`
          <div class="log-item">
            <span style="font-size:17px">${icons[l.type]||'ℹ️'}</span>
            <div style="flex:1">
              <div style="font-size:13px">${l.event}</div>
              <div class="log-time">${new Date(l.time).toLocaleString()}</div>
            </div>
          </div>`).join('')}
      </div>`;
  } catch(e) { showPageError(document.getElementById('page-activity'), e.message); }
}
