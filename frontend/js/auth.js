// auth.js — InternBridge v4  (Role-first auth flow)
let currentUser = null;
let authToken   = null;

// ── STARTUP ───────────────────────────────────────────────────
function showRoleSelectScreen() {
  document.getElementById('login-page').style.display    = 'flex';
  document.getElementById('register-page').style.display = 'none';
  document.getElementById('app').classList.remove('visible');

  document.getElementById('login-page').innerHTML = `
    <div class="auth-brand">
      <div class="auth-logo">Intern<span>Bridge</span></div>
      <div class="auth-tagline">Riphah International University · Faculty of Computing</div>
    </div>
    <div class="auth-card" style="max-width:480px;width:100%">
      <div class="auth-card-header">
        <h2>Who are you?</h2>
        <p>Select your role to continue</p>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:8px">
        ${[['🎓','Student','student','Apply for internships'],
           ['🏢','Company','company','Post internship listings'],
           ['🏛️','University Admin','university','Manage students & companies'],
           ['⚙️','System Admin','sysadmin','System & approvals']
          ].map(([icon,label,role,desc])=>`
          <div onclick="showLoginScreen('${role}')"
            style="border:2px solid var(--border);border-radius:14px;padding:24px 14px 20px;
                   text-align:center;cursor:pointer;transition:all .18s;background:var(--surface)"
            onmouseover="this.style.borderColor='#2563eb';this.style.transform='translateY(-2px)'"
            onmouseout="this.style.borderColor='var(--border)';this.style.transform='none'">
            <div style="font-size:34px;margin-bottom:10px">${icon}</div>
            <div style="font-size:14px;font-weight:700">${label}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:5px">${desc}</div>
          </div>`).join('')}
      </div>
    </div>
    <div class="auth-footer"><span>© 2025 Riphah International University · InternBridge</span></div>`;
}

// ── PER-ROLE LOGIN SCREEN ─────────────────────────────────────
function showLoginScreen(role) {
  const info = {
    student:    {label:'Student',          icon:'🎓', reg:true },
    company:    {label:'Company',          icon:'🏢', reg:true },
    university: {label:'University Admin', icon:'🏛️', reg:false},
    sysadmin:   {label:'System Admin',     icon:'⚙️', reg:false},
  }[role];

  document.getElementById('login-page').style.display    = 'flex';
  document.getElementById('register-page').style.display = 'none';

  document.getElementById('login-page').innerHTML = `
    <div class="auth-brand">
      <div class="auth-logo">Intern<span>Bridge</span></div>
      <div class="auth-tagline">Riphah International University · Faculty of Computing</div>
    </div>
    <div class="auth-card" style="max-width:440px;width:100%">
      <button onclick="showRoleSelectScreen()"
        style="display:flex;align-items:center;gap:6px;background:none;border:none;
               color:var(--muted);font-size:12px;cursor:pointer;padding:0;margin-bottom:18px">
        ← Back to role selection
      </button>
      <div class="auth-card-header" style="margin-bottom:20px">
        <div style="font-size:28px;margin-bottom:6px">${info.icon}</div>
        <h2>${info.label}</h2>
        <p>Sign in to your account</p>
      </div>
      <div class="form-group">
        <label>Email Address</label>
        <input type="email" id="login-email" placeholder="your@email.com" autocomplete="email"
          onkeydown="if(event.key==='Enter')document.getElementById('login-password').focus()" />
      </div>
      <div class="form-group" style="position:relative">
        <label>Password</label>
        <input type="password" id="login-password" placeholder="••••••••"
          onkeydown="if(event.key==='Enter')doLogin('${role}')" />
        <span onclick="togglePwd('login-password',this)"
          style="position:absolute;right:11px;top:34px;cursor:pointer;font-size:15px;color:var(--muted)">👁</span>
      </div>
      <div style="text-align:right;margin-top:8px;font-size:13px;color:var(--muted)"><a onclick="openForgotModal()" style="color:#2563eb;cursor:pointer">Forgot password?</a></div>
      </div>
      <button class="btn btn-primary" id="login-btn" onclick="doLogin('${role}')">Sign In →</button>
      ${info.reg ? `
        <div style="text-align:center;margin-top:20px;font-size:13px;color:var(--muted)">
          Don't have an account?
          <a onclick="showRegisterScreen('${role}')"
            style="color:#2563eb;cursor:pointer;font-weight:600;margin-left:4px">Create Account</a>
        </div>` : ''}
    </div>
    <div class="auth-footer"><span>© 2025 Riphah International University · InternBridge</span></div>`;
}

// ── DO LOGIN ──────────────────────────────────────────────────
async function doLogin(role) {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn      = document.getElementById('login-btn');
  if (!email || !password) return showToast('Please enter email and password.', 'error');
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    const data = await api.login(email, password);
    if (data.user.role !== role)
      throw new Error(`This account belongs to role "${data.user.role}". Go back and select the correct role.`);
    authToken = data.token;
    currentUser = data.user;
    if (authToken) localStorage.setItem('ib_token', authToken);
    else localStorage.removeItem('ib_token');
    localStorage.setItem('ib_user', JSON.stringify(currentUser));
    initApp();
  } catch(e) {
    showToast(e.message, 'error');
    btn.disabled = false; btn.textContent = 'Sign In →';
  }
}

// ── REGISTER SCREEN ───────────────────────────────────────────
function showRegisterScreen(role) {
  document.getElementById('login-page').style.display    = 'none';
  document.getElementById('register-page').style.display = 'flex';
  document.getElementById('register-page').classList.add('visible');

  const backBtn = `<button onclick="showLoginScreen('${role}');document.getElementById('register-page').style.display='none';document.getElementById('login-page').style.display='flex';"
    style="display:flex;align-items:center;gap:6px;background:none;border:none;
           color:var(--muted);font-size:12px;cursor:pointer;padding:0;margin-bottom:18px">
    ← Back to sign in</button>`;

  const title = document.getElementById('register-title');
  const tabs  = document.getElementById('register-type-tabs');
  const cont  = document.getElementById('register-form-container');

  if (tabs)  tabs.innerHTML = '';
  if (title) title.textContent = role === 'student' ? 'Student Registration' : 'Company Registration';
  cont.innerHTML = backBtn + (role === 'student' ? _studentForm() : _companyForm());
}

// ── STUDENT FORM ──────────────────────────────────────────────
function _studentForm() { return `
  <div class="alert alert-info"><span class="alert-icon">ℹ️</span>
    <div>Eligibility: minimum 60 credit hours, CGPA ≥ 2.0, and an available elective course.
    University admin will verify your account before you can log in.</div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>Full Name *</label><input id="r-name" type="text" placeholder="e.g. Ahmed Raza" /></div>
    <div class="form-group"><label>Program *</label>
      <select id="r-program"><option value="BSCS">BSCS</option><option value="BSSE">BSSE</option><option value="BSIT">BSIT</option><option value="BSAI">BSAI</option></select>
    </div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>Semester *</label><input id="r-semester" type="number" placeholder="e.g. 6" min="1" max="8" /></div>
    <div class="form-group"><label>CGPA *</label><input id="r-cgpa" type="number" step="0.01" placeholder="e.g. 3.2" min="0" max="4" /></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>Completed Credit Hours *</label><input id="r-credits" type="number" placeholder="e.g. 96" /></div>
    <div class="form-group"><label>Elective Course *</label><input id="r-elective" type="text" placeholder="e.g. Web Engineering" /></div>
  </div>
  <div class="form-group"><label>Skills</label><input id="r-skills" type="text" placeholder="e.g. React, Python" /></div>
  <div class="form-group"><label>Email Address *</label><input id="r-email" type="email" placeholder="your@riphah.edu.pk" /></div>
  <div class="form-row">
    <div class="form-group" style="position:relative"><label>Password *</label>
      <input id="r-pass" type="password" placeholder="Min 6 characters" />
      <span onclick="togglePwd('r-pass',this)" style="position:absolute;right:10px;top:34px;cursor:pointer;font-size:14px;color:var(--muted)">👁</span>
    </div>
    <div class="form-group"><label>Confirm Password *</label><input id="r-pass2" type="password" placeholder="Repeat password" /></div>
  </div>
  <div class="form-group">
    <label>Official Transcript (PDF/Image) *</label>
    <div class="upload-box" onclick="document.getElementById('r-transcript').click()">
      📎 Click to upload your official transcript
      <input id="r-transcript" type="file" accept=".pdf,.jpg,.png" style="display:none" onchange="previewUpload(this,'r-transcript-preview')" />
    </div>
    <div id="r-transcript-preview" style="font-size:12px;color:var(--green);margin-top:4px"></div>
  </div>
  <div class="form-group">
    <label>Enrollment Letter (PDF/Image) *</label>
    <div class="upload-box" onclick="document.getElementById('r-enrollment').click()">
      📎 Click to upload your enrollment letter
      <input id="r-enrollment" type="file" accept=".pdf,.jpg,.png" style="display:none" onchange="previewUpload(this,'r-enrollment-preview')" />
    </div>
    <div id="r-enrollment-preview" style="font-size:12px;color:var(--green);margin-top:4px"></div>
  </div>
  <button class="btn btn-primary btn-full" id="reg-submit-btn" onclick="registerStudent()">Create Student Account →</button>`; }

// ── COMPANY FORM ──────────────────────────────────────────────
function _companyForm() { return `
  <div class="alert alert-warning"><span class="alert-icon">⚠️</span>
    <div>Only software/IT companies registered with P@SHA/PSEB/SECP with CMMI Level 2+ or ISO
    certification are eligible. Account requires university admin approval.</div>
  </div>
  <div class="form-group"><label>Company Name *</label><input id="r-name" type="text" placeholder="e.g. TechCorp Pvt Ltd" /></div>
  <div class="form-row">
    <div class="form-group"><label>City *</label>
      <select id="r-city"><option value="">Select City</option><option>Lahore</option><option>Karachi</option><option>Islamabad</option><option>Rawalpindi</option><option>Faisalabad</option><option>Peshawar</option></select>
    </div>
    <div class="form-group"><label>Years Operational *</label><input id="r-ops" type="text" placeholder="e.g. 5 years" /></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>P@SHA ID</label><input id="r-pasha" type="text" placeholder="P@SHA-2024-XXX" /></div>
    <div class="form-group"><label>PSEB ID</label><input id="r-pseb" type="text" placeholder="PSEB-XXXX" /></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>SECP ID</label><input id="r-secp" type="text" placeholder="SECP-XXXX" /></div>
    <div class="form-group"><label>CMMI / ISO Certification *</label><input id="r-cmmi" type="text" placeholder="e.g. CMMI Level 2" /></div>
  </div>
  <div class="form-group"><label>Email Address *</label><input id="r-email" type="email" placeholder="hr@company.com" /></div>
  <div class="form-row">
    <div class="form-group" style="position:relative"><label>Password *</label>
      <input id="r-pass" type="password" placeholder="Min 6 characters" />
      <span onclick="togglePwd('r-pass',this)" style="position:absolute;right:10px;top:34px;cursor:pointer;font-size:14px;color:var(--muted)">👁</span>
    </div>
    <div class="form-group"><label>Confirm Password *</label><input id="r-pass2" type="password" placeholder="Repeat password" /></div>
  </div>
  <div class="form-group">
    <label>Company Registration Certificate (PDF) *</label>
    <div class="upload-box" onclick="document.getElementById('r-regcert').click()">
      📄 Click to upload registration certificate
      <input id="r-regcert" type="file" accept=".pdf,.jpg,.png" style="display:none" onchange="previewUpload(this,'r-regcert-preview')" />
    </div>
    <div id="r-regcert-preview" style="font-size:12px;color:var(--green);margin-top:4px"></div>
  </div>
  <div class="form-group">
    <label>CMMI / ISO Certificate (PDF) *</label>
    <div class="upload-box" onclick="document.getElementById('r-cmmidoc').click()">
      📄 Click to upload CMMI/ISO certificate
      <input id="r-cmmidoc" type="file" accept=".pdf,.jpg,.png" style="display:none" onchange="previewUpload(this,'r-cmmidoc-preview')" />
    </div>
    <div id="r-cmmidoc-preview" style="font-size:12px;color:var(--green);margin-top:4px"></div>
  </div>
  <button class="btn btn-primary btn-full" id="reg-submit-btn" onclick="registerCompany()">Submit Application →</button>`; }

// ── PASSWORD TOGGLE ───────────────────────────────────────────
function togglePwd(inputId, el) {
  const inp = document.getElementById(inputId); if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  el.textContent = inp.type === 'password' ? '👁' : '🙈';
}

// ── FORGOT PASSWORD ──────────────────────────────────────────
function openForgotModal() {
  openModal(`<div style="padding:12px 18px;text-align:left">
    <h3 style="margin-bottom:6px">Reset your password</h3>
    <p style="color:var(--muted);font-size:13px;margin-bottom:12px">Enter the email address for your account. We'll send a reset link if the account exists.</p>
    <div class="form-group"><label>Email</label><input id="fp-email" type="email" placeholder="your@email.com" /></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="sendForgotRequest()">Send Reset Link</button>
    </div>
  </div>`);
}

async function sendForgotRequest() {
  const email = document.getElementById('fp-email') && document.getElementById('fp-email').value.trim();
  if (!email) return showToast('Please enter your email address.', 'error');
  try {
    const res = await api.forgotPassword(email);
    closeModal(); showToast(res.message || 'If an account exists, a reset link was sent.', 'info');
  } catch (e) {
    showToast(e.message || 'Failed to request password reset.', 'error');
  }
}

// ── FILE HELPERS ──────────────────────────────────────────────
function previewUpload(input, previewId) {
  const f = input.files[0]; if (!f) return;
  const p = document.getElementById(previewId); if (p) p.textContent = '✓ ' + f.name + ' selected';
}
function readFileAsBase64(input) {
  return new Promise((res, rej) => {
    const f = input && input.files[0]; if (!f) { res(null); return; }
    const r = new FileReader();
    r.onload  = e => res(e.target.result);
    r.onerror = () => rej(new Error('Failed to read file'));
    r.readAsDataURL(f);
  });
}

// ── REGISTER STUDENT ──────────────────────────────────────────
async function registerStudent() {
  const name=document.getElementById('r-name').value.trim();
  const email=document.getElementById('r-email').value.trim();
  const password=document.getElementById('r-pass').value;
  const pass2=document.getElementById('r-pass2').value;
  if (!name||!email||!password) return showToast('Name, email and password are required.','error');
  if (password!==pass2)         return showToast('Passwords do not match.','error');
  if (password.length<6)        return showToast('Password must be at least 6 characters.','error');
  const btn=document.getElementById('reg-submit-btn');
  btn.disabled=true; btn.textContent='Creating account…';
  let transcriptDoc=null, enrollmentDoc=null;
  try {
    transcriptDoc=await readFileAsBase64(document.getElementById('r-transcript'));
    enrollmentDoc=await readFileAsBase64(document.getElementById('r-enrollment'));
  } catch(e) { btn.disabled=false; btn.textContent='Create Student Account →'; return showToast('File error: '+e.message,'error'); }
  try {
    await api.registerStudent({
      name,email,password,
      program:document.getElementById('r-program').value,
      semester:document.getElementById('r-semester').value,
      cgpa:document.getElementById('r-cgpa').value,
      creditHours:document.getElementById('r-credits').value,
      electiveCourse:document.getElementById('r-elective').value,
      skills:document.getElementById('r-skills').value,
      transcriptDoc,enrollmentDoc,
    });
    showStudentPendingScreen();
  } catch(e) { showToast(e.message,'error'); btn.disabled=false; btn.textContent='Create Student Account →'; }
}

// ── REGISTER COMPANY ──────────────────────────────────────────
async function registerCompany() {
  const name=document.getElementById('r-name').value.trim();
  const email=document.getElementById('r-email').value.trim();
  const password=document.getElementById('r-pass').value;
  const pass2=document.getElementById('r-pass2').value;
  const city=document.getElementById('r-city').value;
  const cmmi=document.getElementById('r-cmmi').value.trim();
  if (!name||!email||!password||!city||!cmmi)
    return showToast('Company name, city, CMMI/ISO, email and password are required.','error');
  if (password!==pass2)  return showToast('Passwords do not match.','error');
  if (password.length<6) return showToast('Password must be at least 6 characters.','error');
  const btn=document.getElementById('reg-submit-btn');
  btn.disabled=true; btn.textContent='Submitting…';
  let regCertDoc=null, cmmiDoc=null;
  try {
    regCertDoc=await readFileAsBase64(document.getElementById('r-regcert'));
    cmmiDoc=await readFileAsBase64(document.getElementById('r-cmmidoc'));
  } catch(e) { btn.disabled=false; btn.textContent='Submit Application →'; return showToast('File error: '+e.message,'error'); }
  try {
    await api.registerCompany({
      name,email,password,city,cmmi,
      pasha:document.getElementById('r-pasha').value.trim(),
      pseb:document.getElementById('r-pseb').value.trim(),
      secp:document.getElementById('r-secp').value.trim(),
      operational:document.getElementById('r-ops').value.trim(),
      regCertDoc,cmmiDoc,
    });
    showCompanyPendingScreen(name);
  } catch(e) { showToast(e.message,'error'); btn.disabled=false; btn.textContent='Submit Application →'; }
}

// ── INDRIVE-STYLE COMPANY PENDING ─────────────────────────────
function showCompanyPendingScreen(companyName) {
  document.getElementById('register-page').style.display='none';
  document.getElementById('login-page').style.display='flex';
  document.getElementById('login-page').innerHTML=`
    <div class="auth-brand">
      <div class="auth-logo">Intern<span>Bridge</span></div>
      <div class="auth-tagline">Riphah International University · Faculty of Computing</div>
    </div>
    <div class="auth-card" style="max-width:500px;width:100%;text-align:center">
      <div style="font-size:60px;margin-bottom:16px">📋</div>
      <h2 style="margin-bottom:8px">Application Submitted!</h2>
      <p style="color:var(--muted);font-size:13px;margin-bottom:28px">
        Your company registration for <strong>${companyName}</strong> has been received.
        The university admin will review your documents and certificates.
      </p>
      <div style="display:flex;align-items:center;justify-content:center;margin-bottom:28px">
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:110px">
          <div style="width:40px;height:40px;border-radius:50%;background:#10B981;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:700">✓</div>
          <div style="font-size:11px;font-weight:700;color:#10B981">Submitted</div>
        </div>
        <div style="flex:1;height:3px;background:linear-gradient(to right,#10B981,#F59E0B);max-width:50px;margin-bottom:20px"></div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:110px">
          <div style="width:40px;height:40px;border-radius:50%;background:#F59E0B;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px">⏳</div>
          <div style="font-size:11px;font-weight:700;color:#F59E0B">Under Review</div>
        </div>
        <div style="flex:1;height:3px;background:#E2E8F0;max-width:50px;margin-bottom:20px"></div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:6px;width:110px">
          <div style="width:40px;height:40px;border-radius:50%;background:#E2E8F0;display:flex;align-items:center;justify-content:center;color:#94A3B8;font-size:18px">🏢</div>
          <div style="font-size:11px;font-weight:700;color:#94A3B8">Account Active</div>
        </div>
      </div>
      <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px;margin-bottom:24px;text-align:left">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">What happens next?</div>
        ${['📄 Admin will review your uploaded registration & CMMI documents',
           '✅ If approved, you can log in and post internships',
           '❌ If rejected, you will see the reason on the login screen',
           '⏱ Review usually takes 1–3 business days'
          ].map(t=>`<div style="font-size:12px;color:var(--muted);margin-bottom:7px">${t}</div>`).join('')}
      </div>
      <button class="btn btn-primary btn-full" onclick="showLoginScreen('company')">Go to Company Login →</button>
    </div>
    <div class="auth-footer"><span>© 2025 Riphah International University · InternBridge</span></div>`;
}

// ── STUDENT PENDING SCREEN ────────────────────────────────────
function showStudentPendingScreen() {
  document.getElementById('register-page').style.display='none';
  document.getElementById('login-page').style.display='flex';
  document.getElementById('login-page').innerHTML=`
    <div class="auth-brand">
      <div class="auth-logo">Intern<span>Bridge</span></div>
      <div class="auth-tagline">Riphah International University · Faculty of Computing</div>
    </div>
    <div class="auth-card" style="max-width:460px;width:100%;text-align:center">
      <div style="font-size:60px;margin-bottom:16px">🎓</div>
      <h2 style="margin-bottom:8px">Account Created!</h2>
      <p style="color:var(--muted);font-size:13px;margin-bottom:24px">
        Your student registration has been submitted. The university admin will verify
        your transcript and academic details before activating your account.
      </p>
      <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:16px;margin-bottom:20px;text-align:left">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px">Verification checklist</div>
        ${[['CGPA ≥ 2.0',true],['Credit hours ≥ 60',true],['Elective course listed',true],['Transcript reviewed by admin',false],['Account activated',false]]
          .map(([t,done])=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:7px;font-size:12px">
            <span style="color:${done?'#10B981':'#94A3B8'};font-size:14px">${done?'✓':'○'}</span>
            <span style="color:${done?'inherit':'var(--muted)'}">${t}</span>
          </div>`).join('')}
      </div>
      <div class="alert alert-warning" style="text-align:left;margin-bottom:20px">
        <span class="alert-icon">⏳</span>
        <div>You <strong>cannot log in</strong> until the university admin approves your account.</div>
      </div>
      <button class="btn btn-primary btn-full" onclick="showLoginScreen('student')">Go to Student Login →</button>
    </div>
    <div class="auth-footer"><span>© 2025 Riphah International University · InternBridge</span></div>`;
}

// ── LOGOUT ────────────────────────────────────────────────────
function logout() {
  openModal(`<div style="text-align:center;padding:10px 0">
    <div style="font-size:40px;margin-bottom:16px">👋</div>
    <h3 style="margin-bottom:8px">Sign Out?</h3>
    <p style="color:var(--muted);font-size:13px;margin-bottom:24px">Are you sure you want to sign out?</p>
    <div style="display:flex;gap:10px;justify-content:center">
      <button class="btn btn-outline" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="confirmLogout()">Yes, Sign Out</button>
    </div>
  </div>`);
}
function confirmLogout() {
  closeModal();
  authToken=null; currentUser=null;
  localStorage.removeItem('ib_token'); localStorage.removeItem('ib_user');
  document.getElementById('app').classList.remove('visible');
  showRoleSelectScreen();
}

// ── AUTO LOGIN ────────────────────────────────────────────────
function tryAutoLogin() {
  try {
    const token = localStorage.getItem('ib_token');
    const user = localStorage.getItem('ib_user');
    // Clear legacy fake tokens generated by frontend (format: ib.<payload>.sig)
    if (token && typeof token === 'string' && token.startsWith('ib.')) {
      localStorage.removeItem('ib_token'); localStorage.removeItem('ib_user');
      return false;
    }
    if (token && user) { authToken = token; currentUser = JSON.parse(user); initApp(); return true; }
  } catch(e) { localStorage.removeItem('ib_token'); localStorage.removeItem('ib_user'); }
  return false;
}

// ── BACKWARD COMPAT ───────────────────────────────────────────
function showLoginPage()        { showRoleSelectScreen(); }
function showRegisterPage(type) { showRegisterScreen(type); }

function getAuthHeaders() {
  const token = authToken || localStorage.getItem('ib_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
function getCurrentCompanyId() {
  try {
    const user = currentUser || JSON.parse(localStorage.getItem('ib_user') || '{}');
    return user.companyId || user.id || localStorage.getItem('ib_companyId') || '';
  } catch(e) { return ''; }
}
