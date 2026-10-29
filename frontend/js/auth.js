// auth.js — InternBridge v4 (shared auth flow)
let currentUser = null;
let authToken   = null;

const ROLE_PAGES = {
  student: 'student.html',
  company: 'company.html',
  university: 'university.html',
  sysadmin: 'sysadmin.html'
};

// ── STARTUP ───────────────────────────────────────────────────
function showRoleSelectScreen() {
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('register-page').style.display = 'none';
  document.getElementById('app').classList.remove('visible');
}

function showLoginScreen() {
  showRoleSelectScreen();
}

function roleFromToken(token) {
  try {
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(encoded));
    return payload.role;
  } catch (_) {
    return null;
  }
}

function redirectByRole(role) {
  const page = ROLE_PAGES[role];
  if (!page) throw new Error('This account has an unsupported role.');
  window.location.href = page;
}

// ── LOGIN ─────────────────────────────────────────────────────
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn');
  if (!email || !password) return showToast('Please enter email and password.', 'error');
  btn.disabled = true;
  btn.textContent = 'Signing in…';
  try {
    const data = await api.login(email, password);
    const role = roleFromToken(data.token) || data.user.role;
    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('ib_token', authToken);
    localStorage.setItem('ib_user', JSON.stringify(currentUser));
    redirectByRole(role);
  } catch(e) {
    showToast(e.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Login';
  }
}

// ── REGISTER SCREEN ───────────────────────────────────────────
function showRegisterScreen(role = 'student') {
  const selectedRole = role === 'company' ? 'company' : 'student';
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('register-page').style.display = 'flex';
  document.getElementById('register-page').classList.add('visible');

  const roleSelect = document.getElementById('register-role');
  if (roleSelect) roleSelect.value = selectedRole;

  const title = document.getElementById('register-title');
  const tabs = document.getElementById('register-type-tabs');
  const container = document.getElementById('register-form-container');

  if (tabs) tabs.innerHTML = '';
  if (title) title.textContent = 'Create account';
  container.innerHTML = selectedRole === 'student' ? _studentForm() : _companyForm();
  try { attachRegisterFormValidation(); } catch (e) { console.warn('register validation attach failed', e); }
}

// ── STUDENT FORM ──────────────────────────────────────────────
function _studentForm() { return `
  <div class="alert alert-info"><span class="alert-icon">ℹ️</span>
    <div>Eligibility: minimum 60 credit hours, CGPA ≥ 2.0, and an available elective course.
    University will verify your account before you can log in.</div>
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
  </div>
  <div class="form-group"><label>Skills</label><input id="r-skills" type="text" placeholder="e.g. React, Python" /></div>
  <div class="form-group"><label>Email Address *</label><input id="r-email" type="email" placeholder="your@riphah.edu.pk" /></div>
  <div class="form-row">
    <div class="form-group" style="position:relative"><label>Password *</label>
      <input id="r-pass" type="password" placeholder="Min 6 characters" />
      <span onclick="togglePwd('r-pass',this)" style="position:absolute;right:10px;top:34px;cursor:pointer;font-size:14px;color:var(--muted)">👁</span>
      <div id="r-pass-help" style="font-size:12px;color:var(--muted);margin-top:6px">Password must be at least 6 characters.</div>
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
  <button class="btn btn-primary btn-full" id="reg-submit-btn" onclick="registerStudent()">Create Student Account →</button>`; }

// Attach simple real-time validation to registration fields after render
function attachRegisterFormValidation() {
  const emailEl = document.getElementById('r-email');
  const passEl = document.getElementById('r-pass');
  const passHelp = document.getElementById('r-pass-help');
  if (emailEl) {
    emailEl.addEventListener('input', () => {
      const val = emailEl.value.trim();
      const ok = validateEmail(val);
      if (val && !ok) emailEl.style.borderColor = '#dc2626'; else emailEl.style.borderColor = '';
    });
  }
  if (passEl && passHelp) {
    passEl.addEventListener('input', () => {
      if (passEl.value.length < 6) {
        passHelp.textContent = 'Password must be at least 6 characters.';
        passHelp.style.color = '#dc2626';
      } else {
        passHelp.textContent = 'Looks good.';
        passHelp.style.color = 'var(--green)';
      }
    });
  }
}

function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  // Basic RFC 5322-ish regex (reasonable for client-side). Backend still enforces uniqueness.
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// ── COMPANY FORM ──────────────────────────────────────────────
function _companyForm() { return `
  <div class="alert alert-warning"><span class="alert-icon">⚠️</span>
    <div>Only software/IT companies registered with P@SHA/PSEB/SECP with CMMI Level 2+ or ISO
    certification are eligible. Account requires university approval.</div>
  </div>
  <div class="form-group"><label>Company Name *</label><input id="r-name" type="text" placeholder="e.g. TechCorp Pvt Ltd" /></div>
  <div class="form-row">
    <div class="form-group"><label>City *</label>
      <select id="r-city"><option value="">Select City</option><option>Lahore</option><option>Karachi</option><option>Islamabad</option><option>Rawalpindi</option><option>Faisalabad</option><option>Peshawar</option></select>
    </div>
    <div class="form-group"><label>Year of Registration *</label><input id="r-year" type="number" placeholder="e.g. 2020" min="1900" max="2100" /></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>Registration Type *</label>
      <select id="r-registration-type">
        <option value="PSEB">PSEB</option>
        <option value="P@SHA">P@SHA</option>
        <option value="SECP">SECP</option>
      </select>
    </div>
    <div class="form-group"><label>Registration ID *</label><input id="r-registration-id" type="text" placeholder="Enter registration ID" /></div>
  </div>
  <div class="form-row">
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
    if (f.size > 10 * 1024 * 1024) {
      rej(new Error('File is too large. Please upload a file 10 MB or smaller.'));
      return;
    }
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
  if (!validateEmail(email)) return showToast('Please enter a valid email address.','error');
  if (password!==pass2)         return showToast('Passwords do not match.','error');
  if (password.length<6)        return showToast('Password must be at least 6 characters.','error');
  const btn=document.getElementById('reg-submit-btn');
  btn.disabled=true; btn.textContent='Creating account…';
  let transcriptDoc=null;
  try {
    transcriptDoc=await readFileAsBase64(document.getElementById('r-transcript'));
  } catch(e) { btn.disabled=false; btn.textContent='Create Student Account →'; return showToast('File error: '+e.message,'error'); }
  try {
    const result = await api.registerStudent({
      name,email: email.toLowerCase(),password,
      program:document.getElementById('r-program').value,
      semester:document.getElementById('r-semester').value,
      cgpa:document.getElementById('r-cgpa').value,
      creditHours:document.getElementById('r-credits').value,
      skills:document.getElementById('r-skills').value,
      transcriptDoc,
    });
    showOTPVerificationScreen(email, result.emailSent !== false);
  } catch(e) { showToast(e.message,'error'); btn.disabled=false; btn.textContent='Create Student Account →'; }
}

// ── OTP VERIFICATION UI ──────────────────────────────────────
function showOTPVerificationScreen(email, emailSent = true) {
  document.getElementById('register-page').style.display='none';
  document.getElementById('login-page').style.display='flex';
  document.getElementById('login-page').innerHTML = `
    <div class="auth-brand">
      <div class="auth-logo">Intern<span>Bridge</span></div>
      <div class="auth-tagline">Riphah International University · Faculty of Computing</div>
    </div>
    <div class="auth-card" style="max-width:480px;width:100%;text-align:center">
      <div style="font-size:46px;margin-bottom:12px">✉️</div>
      <h2 style="margin-bottom:8px">Verify your email</h2>
      ${emailSent
        ? `<p style="color:var(--muted);font-size:13px;margin-bottom:18px">Enter the 6-digit code sent to <strong>${email}</strong>. Check your spam folder if it is not in your inbox.</p>`
        : `<div class="alert alert-warning" style="text-align:left">Your account was created, but the verification email could not be sent. Check the email server configuration, then use Resend OTP.</div><p style="color:var(--muted);font-size:13px;margin-bottom:18px">Verification code for <strong>${email}</strong></p>`}
      <div class="form-group"><label>Verification Code</label><input id="otp-code" type="text" maxlength="6" placeholder="123456" /></div>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
            <button class="btn btn-outline" onclick="showLoginScreen('student')">Cancel</button>
            <button class="btn btn-primary" id="otp-submit-btn" onclick="submitOtp('${email}')">Verify Email</button>
          </div>
          <div style="margin-top:12px;text-align:center">
            <button class="btn btn-link" id="resend-otp-btn" onclick="resendOtpClicked('${email}')">Resend OTP</button>
            <div id="resend-otp-timer" style="color:var(--muted);font-size:13px;margin-top:8px"></div>
          </div>
    </div>
    <div class="auth-footer"><span>© 2025 Riphah International University · InternBridge</span></div>`;
}

async function submitOtp(email) {
  const code = document.getElementById('otp-code').value.trim();
  const btn = document.getElementById('otp-submit-btn');
  if (!code || code.length !== 6) return showToast('Please enter the 6-digit code.','error');
  btn.disabled = true; btn.textContent = 'Verifying…';
  try {
    const res = await api.verifyOtp(email, code);
    showToast(res.message || 'Email verified! Please wait for university approval.', 'success');
    // After verification, show login screen so user can return and wait for approval
    showLoginScreen('student');
  } catch (e) {
    showToast(e.message || 'Failed to verify code.', 'error');
    btn.disabled = false; btn.textContent = 'Verify Email';
  }
}

// Resend OTP handling
let _resendInterval = null;
function startResendCountdown(seconds = 60) {
  const btn = document.getElementById('resend-otp-btn');
  const timer = document.getElementById('resend-otp-timer');
  if (!btn || !timer) return;
  btn.disabled = true;
  let remaining = seconds;
  timer.textContent = `Resend in ${remaining}s`;
  _resendInterval && clearInterval(_resendInterval);
  _resendInterval = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(_resendInterval); _resendInterval = null; btn.disabled = false; timer.textContent = '';
      btn.textContent = 'Resend OTP';
    } else {
      timer.textContent = `Resend in ${remaining}s`;
      btn.textContent = 'Resend OTP';
    }
  }, 1000);
}

async function resendOtpClicked(email) {
  const btn = document.getElementById('resend-otp-btn');
  if (!btn) return;
  btn.disabled = true; btn.textContent = 'Sending…';
  try {
    const res = await api.resendOtp(email);
    showToast(res.message || 'New OTP sent to your email.', 'success');
    startResendCountdown(60);
  } catch (e) {
    console.error('Resend OTP failed:', e);
    showToast(e.message || 'Failed to resend OTP.', 'error');
    // allow retry after short delay
    btn.disabled = false; btn.textContent = 'Resend OTP';
  }
}

// ── REGISTER COMPANY ──────────────────────────────────────────
async function registerCompany() {
  const name=document.getElementById('r-name').value.trim();
  const email=document.getElementById('r-email').value.trim();
  const password=document.getElementById('r-pass').value;
  console.log('DEBUG company form submit called', {name, email, password});
  const pass2=document.getElementById('r-pass2').value;
  const city=document.getElementById('r-city').value;
  const cmmi=document.getElementById('r-cmmi').value.trim();
  const registrationType = document.getElementById('r-registration-type') && document.getElementById('r-registration-type').value;
  const registrationId = document.getElementById('r-registration-id') && document.getElementById('r-registration-id').value.trim();
  const yearOfRegistration = document.getElementById('r-year') && document.getElementById('r-year').value;
  // Use yearOfRegistration as the `operational` value for backend compatibility
  const operationalValue = yearOfRegistration || '';
  if (!name||!email||!password||!city||!cmmi||!registrationType||!registrationId||!yearOfRegistration)
    return showToast('Company name, city, registration, year, CMMI/ISO, email and password are required.','error');
  if (password!==pass2)  return showToast('Passwords do not match.','error');
  if (password.length<6) return showToast('Password must be at least 6 characters.','error');
  const btn=document.getElementById('reg-submit-btn');
  btn.disabled=true; btn.textContent='Submitting…';
  let regCertDoc=null, cmmiDoc=null;
  try {
    regCertDoc=await readFileAsBase64(document.getElementById('r-regcert'));
    cmmiDoc=await readFileAsBase64(document.getElementById('r-cmmidoc'));
    console.log('DEBUG company files:', { regCertDocSize: regCertDoc ? regCertDoc.length : 0, cmmiDocSize: cmmiDoc ? cmmiDoc.length : 0 });
  } catch(e) { btn.disabled=false; btn.textContent='Submit Application →'; return showToast('File error: '+e.message,'error'); }
  try {
    // Map registrationId into the legacy per-provider fields expected by the backend
    let pasha = '';
    let pseb = '';
    let secp = '';
    const rt = (registrationType || '').toString().toUpperCase();
    const rid = registrationId || '';
    if (rt === 'P@SHA' || rt === 'PASHA') pasha = rid;
    else if (rt === 'PSEB') pseb = rid;
    else if (rt === 'SECP') secp = rid;

    const result = await api.registerCompany({
      name, email, password, city, cmmi,
      registrationType, registrationId, yearOfRegistration,
      // legacy fields populated based on selected registration type
      pasha, pseb, secp, operational: operationalValue,
      // include base64 file payloads (backend may accept or ignore depending on server-side handling)
      regCertDoc, cmmiDoc,
    });
    // Show OTP verification modal so company can verify email before admin review
    showOTPVerificationScreen(email, result.emailSent !== false);
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
        The university will review your documents and certificates.
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
        Your student registration has been submitted. The university will verify
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
        <div>You <strong>cannot log in</strong> until the university approves your account.</div>
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
