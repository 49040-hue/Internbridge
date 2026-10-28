const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendMail } = require('../utils/email');
const db = require('../config/db');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Login rate limiter: 10 requests per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function makeToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET, { expiresIn: '24h' }
  );
}

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const email = (req.body && req.body.email) ? String(req.body.email).trim().toLowerCase() : '';
  const password = (req.body && req.body.password) ? String(req.body.password) : '';
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [email.toLowerCase()]);
    const user = rows[0];
    try {
      if (!user) {
        // Do not reveal whether the account exists
        return res.status(401).json({ error: 'Incorrect email or password.' });
      }

      // Check account lockout
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        return res.status(403).json({ error: 'Account is locked due to too many failed attempts. Please try again after 15 minutes.' });
      }

      const match = bcrypt.compareSync(password, user.password);
      if (!match) {
        const current = parseInt(user.failed_attempts, 10) || 0;
        const next = current + 1;
        if (next >= 15) {
          const lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
          const lockedSql = lockedUntil.toISOString().slice(0,19).replace('T',' ');
          await db.execute('UPDATE users SET failed_attempts = 0, locked_until = ? WHERE id = ?', [lockedSql, user.id]);
          console.log(`User id=${user.id} locked until ${lockedSql} due to too many failed login attempts`);
        } else {
          await db.execute('UPDATE users SET failed_attempts = ? WHERE id = ?', [next, user.id]);
        }
        return res.status(401).json({ error: 'Incorrect email or password.' });
      }

      // Successful login: reset counters
      try {
        await db.execute('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?', [user.id]);
      } catch (uErr) {
        console.warn('Failed to reset failed_attempts/locked_until for user', user.id, uErr && uErr.message);
      }
    } catch (dbgErr) {
      console.warn('Login debug/error:', dbgErr && dbgErr.message);
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    if (user.role === 'student') {
      if (user.accountStatus === 'email_unverified')
        return res.status(403).json({ error: 'Please verify your email first. Check your inbox for the OTP code.' });
      if (user.accountStatus === 'pending_verification')
        return res.status(403).json({ error: 'Your account is pending university admin approval. You will be notified via email once reviewed.' });
      if (user.accountStatus === 'suspended')
        return res.status(403).json({ error: 'Your account has been suspended. Please contact the university admin.' });
    }
    if (user.role === 'company') {
      if (user.status === 'email_unverified')
        return res.status(403).json({ error: 'Please verify your email first. Check your inbox for the OTP code.' });
      if (user.status === 'pending')
        return res.status(403).json({ error: 'Your company registration is under review. You will be notified via email once approved.' });
      if (user.status === 'rejected')
        return res.status(403).json({ error: `Your company registration was rejected. Reason: ${user.rejectionReason || 'Not specified'}. Please register again.` });
      // if verified, allow login
    }

    console.log(`${user.name} logged in`);
    res.json({ token: makeToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/register/student
router.post('/register/student', async (req, res) => {
  const name = req.body && req.body.name ? String(req.body.name).trim() : '';
  const email = req.body && req.body.email ? String(req.body.email).trim().toLowerCase() : '';
  const password = req.body && req.body.password ? String(req.body.password) : '';
  const program = req.body && req.body.program ? String(req.body.program).trim() : '';
  const semester = req.body && req.body.semester ? parseInt(req.body.semester, 10) : 0;
  const cgpa = req.body && req.body.cgpa ? parseFloat(req.body.cgpa) : 0;
  const creditHours = req.body && req.body.creditHours ? parseInt(req.body.creditHours, 10) : 0;
  const electiveCourse = req.body && req.body.electiveCourse ? String(req.body.electiveCourse).trim() : '';
  
  const skills = req.body && req.body.skills ? String(req.body.skills).trim() : '';
  const transcriptFileId = req.body && req.body.transcriptFileId ? req.body.transcriptFileId : null;

  if (!name || !email || !password || !program || !cgpa || !creditHours)
    return res.status(400).json({ error: 'All required fields must be filled in.' });
  // Relaxed password policy: require minimum length only (frontend gives better UX feedback)
  if (typeof password !== 'string' || password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  try {
    const [exists] = await db.execute('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [email]);
    if (exists.length) {
      const existing = exists[0];
      // If the existing user was previously rejected, remove their old record so they can re-register
      if (existing.accountStatus === 'rejected') {
        try {
          await db.execute('DELETE FROM password_resets WHERE user_id = ?', [existing.id]);
          await db.execute('DELETE FROM users WHERE id = ?', [existing.id]);
          console.log(`Deleted rejected user record for ${email} to allow re-registration`);
        } catch (delErr) {
          console.error('Failed to remove rejected user record:', delErr);
          return res.status(500).json({ error: 'Unable to process registration. Please try again later.' });
        }
        // proceed with fresh registration (fall through)
      } else if (existing.accountStatus === 'email_unverified') {
        try {
          // remove old OTPs
          await db.execute('DELETE FROM password_resets WHERE user_id = ?', [existing.id]);
          const otp = Math.floor(100000 + Math.random() * 900000).toString();
          const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
          const createdAt = new Date();
          await db.execute('INSERT INTO password_resets (user_id, token, expires_at, created_at) VALUES (?,?,?,?)', [existing.id, otp, expiresAt.toISOString().slice(0,19).replace('T',' '), createdAt.toISOString().slice(0,19).replace('T',' ')]);

          const mailOptions = {
            from: `InternBridge <${process.env.EMAIL_USER}>`,
            to: existing.email,
            subject: 'InternBridge — Email verification code (resent)',
            html: `
              <p>Hi ${existing.name || ''},</p>
              <p>A verification code was requested for your account. Here is your new 6-digit code:</p>
              <h2 style="letter-spacing:6px">${otp}</h2>
              <p>This code expires in 10 minutes.</p>
              <p>If you did not request this, please ignore this email.</p>
              <p>— InternBridge</p>`
          };

          const mailRes = await sendMail(mailOptions);
          if (mailRes && mailRes.ok) {
            return res.status(200).json({ message: 'A verification email has already been sent. We resent a new OTP to your email.' });
          } else {
            console.error('Failed to resend OTP during re-register:', mailRes && mailRes.error);
            return res.status(500).json({ error: 'Account exists and verification email resend failed. Please contact support.' });
          }
        } catch (e) {
          console.error('Error resending OTP for existing unverified user:', e);
          return res.status(500).json({ error: 'Unable to resend verification code. Please try again later.' });
        }
      }
      // If we didn't delete a rejected user or resend OTP above, block duplicate registration
      if (exists.length && !(existing && existing.accountStatus === 'rejected'))
        return res.status(409).json({ error: 'This email address is already registered.' });
    }

    const hashed = bcrypt.hashSync(password, 10);
    const registeredAt = new Date().toISOString();
    // mark account as email_unverified until student confirms OTP
    const accountStatus = 'email_unverified';

    const insertSQL = `INSERT INTO users
      (name,email,password,role,university,program,semester,cgpa,creditHours,electiveCourse,skills,enrolled,transcriptFileId,cvFileId,accountStatus,verifiedAt,rejectionReason,registeredAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const params = [
      name, email, hashed, 'student', 'Riphah International University', program,
      parseInt(semester) || 0, parseFloat(cgpa) || 0, parseInt(creditHours) || 0,
      electiveCourse, skills || '', true, transcriptFileId || null, null, accountStatus, null, null, registeredAt
    ];
    const [result] = await db.execute(insertSQL, params);
    const userId = result && result.insertId ? result.insertId : null;

    // Save transcript document if provided as base64
    const transcriptDocData = req.body && req.body.transcriptDoc ? String(req.body.transcriptDoc) : null;
    if (userId && transcriptDocData && transcriptDocData.startsWith('data:')) {
      try {
        const matches = transcriptDocData.match(/^data:(.+);base64,(.*)$/);
        if (matches) {
          const mime = matches[1];
          const b64 = matches[2];
          const ext = mime.split('/')[1] || 'pdf';
          const fileName = `transcript_${userId}.${ext}`;
          const uploadedAt = new Date().toISOString();
          const [fres] = await db.execute(
            'INSERT INTO uploadedFiles (ownerId,fileName,fileType,base64,uploadedAt) VALUES (?,?,?,?,?)',
            [userId, fileName, mime, b64, uploadedAt]
          );
          const fileId = fres && fres.insertId ? fres.insertId : null;
          if (fileId) {
            await db.execute('UPDATE users SET transcriptFileId = ?, transcriptDoc = ? WHERE id = ?', [fileId, transcriptDocData, userId]);
          }
        }
      } catch (fileErr) {
        console.error('Failed to save transcript during registration:', fileErr && fileErr.message);
      }
    }

    // generate 6-digit OTP and store in password_resets table (token field used for OTP)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const createdAt = new Date();
    // remove any existing tokens for this user
    if (userId) await db.execute('DELETE FROM password_resets WHERE user_id = ?', [userId]);
    await db.execute('INSERT INTO password_resets (user_id, token, expires_at, created_at) VALUES (?,?,?,?)', [userId, otp, expiresAt.toISOString().slice(0,19).replace('T',' '), createdAt.toISOString().slice(0,19).replace('T',' ')]);

    // send OTP email
    const mailOptions = {
      from: `InternBridge <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'InternBridge — Email verification code',
      html: `
        <p>Hi ${name || ''},</p>
        <p>Thank you for registering on InternBridge. Please enter the following 6-digit verification code to confirm your email address:</p>
        <h2 style="letter-spacing:6px">${otp}</h2>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not register, please ignore this email.</p>
        <p>— InternBridge</p>`
    };

    
    const mailRes = await sendMail(mailOptions);
    if (!mailRes || !mailRes.ok) {
      console.error('Failed to send OTP email:', mailRes && mailRes.error);
      console.warn(`New student registered (email unverified, email send failed): ${name}`);
      return res.status(201).json({ message: 'Account created but verification email failed. Please use Resend OTP.' });
    }

    console.warn(`New student registered (email unverified): ${name}`);
    return res.status(201).json({ message: 'Account created. Please check your email for OTP verification code.' });
  } catch (err) {
    console.error('Register student error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/register/company
router.post('/register/company', async (req, res) => {
  const name = req.body && req.body.name ? String(req.body.name).trim() : '';
  const email = req.body && req.body.email ? String(req.body.email).trim().toLowerCase() : '';
  const password = req.body && req.body.password ? String(req.body.password) : '';
  const city = req.body && req.body.city ? String(req.body.city).trim() : '';
  const pasha = req.body && req.body.pasha ? String(req.body.pasha).trim() : '';
  const pseb = req.body && req.body.pseb ? String(req.body.pseb).trim() : '';
  const secp = req.body && req.body.secp ? String(req.body.secp).trim() : '';
  const cmmi = req.body && req.body.cmmi ? String(req.body.cmmi).trim() : '';
  const operational = req.body && (req.body.operational === true || req.body.operational === 'true' || req.body.operational === 1) ? 1 : (req.body.operational ? req.body.operational : '');
  const certFileId = req.body && req.body.certFileId ? req.body.certFileId : null;
  // Optional base64 data URLs sent by frontend during registration
  const regCertDoc = req.body && req.body.regCertDoc ? String(req.body.regCertDoc) : null;
  const cmmiDoc = req.body && req.body.cmmiDoc ? String(req.body.cmmiDoc) : null;

  // Make `operational` optional (frontend may send empty string). Require core fields only.
  if (!name || !email || !password || !city || !cmmi)
    return res.status(400).json({ error: 'All required fields must be filled in.' });
  if (!pasha && !pseb && !secp)
    return res.status(400).json({ error: 'At least one registration ID is required (P@SHA, PSEB, or SECP).' });

  // Basic email format validation
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(email)) return res.status(400).json({ error: 'Invalid email address format.' });

  // Password minimum length
  if (typeof password !== 'string' || password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    try {
    const [exists] = await db.execute('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [email]);
    if (exists.length) {
      const existing = exists[0];
      // If this is an old rejected company record, remove it and allow fresh registration
      if (existing.role === 'company') {
        if (existing.status === 'rejected') {
          try {
            await db.execute('DELETE FROM password_resets WHERE user_id = ?', [existing.id]);
            await db.execute('DELETE FROM users WHERE id = ?', [existing.id]);
            console.log(`Deleted rejected company record for ${email} to allow re-registration`);
          } catch (delErr) {
            console.error('Failed to remove rejected company record:', delErr);
            return res.status(500).json({ error: 'Unable to process registration. Please try again later.' });
          }
          // proceed with registration
        } else if (existing.status === 'email_unverified') {
          // Resend OTP for existing unverified company
          try {
            await db.execute('DELETE FROM password_resets WHERE user_id = ?', [existing.id]);
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
            const createdAt = new Date();
            await db.execute('INSERT INTO password_resets (user_id, token, expires_at, created_at) VALUES (?,?,?,?)', [existing.id, otp, expiresAt.toISOString().slice(0,19).replace('T',' '), createdAt.toISOString().slice(0,19).replace('T',' ')]);

            const mailOptions = {
              from: `InternBridge <${process.env.EMAIL_USER}>`,
              to: existing.email,
              subject: 'InternBridge — Email verification code (resent)',
              html: `
                <p>Hi ${existing.name || ''},</p>
                <p>A verification code was requested for your company registration. Here is your new 6-digit code:</p>
                <h2 style="letter-spacing:6px">${otp}</h2>
                <p>This code expires in 10 minutes.</p>
                <p>If you did not request this, please ignore this email.</p>
                <p>— InternBridge</p>`
            };

            const mailRes = await sendMail(mailOptions);
            if (mailRes && mailRes.ok) {
              return res.status(200).json({ message: 'A verification email has already been sent. We resent a new OTP to your email.' });
            } else {
              console.error('Failed to resend OTP during re-register (company):', mailRes && mailRes.error);
              return res.status(500).json({ error: 'Account exists and verification email resend failed. Please contact support.' });
            }
          } catch (e) {
            console.error('Error resending OTP for existing unverified company:', e);
            return res.status(500).json({ error: 'Unable to resend verification code. Please try again later.' });
          }
        } else if (existing.status === 'pending') {
          return res.status(409).json({ error: 'Your registration is already under review. Please wait for university admin approval.' });
        } else if (existing.status === 'verified') {
          return res.status(409).json({ error: 'This email address is already registered.' });
        } else {
          return res.status(409).json({ error: 'This email address is already registered.' });
        }
      } else {
        return res.status(409).json({ error: 'This email address is already registered.' });
      }
    }

    const hashed = bcrypt.hashSync(password, 10);
    const registeredAt = new Date().toISOString();
    // mark company as email_unverified until company confirms OTP
    const status = 'email_unverified';

    const insertSQL = `INSERT INTO users
      (name,email,password,role,city,pasha,pseb,secp,cmmi,operational,certFileId,status,rejectionReason,registeredAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const params = [name, email, hashed, 'company', city, pasha || '', pseb || '', secp || '', cmmi, operational, certFileId || null, status, null, registeredAt];
    const [result] = await db.execute(insertSQL, params);
    const userId = result && result.insertId ? result.insertId : null;

    // If frontend provided registration certificate or cmmi doc as base64 data URLs,
    // store them in uploadedFiles and update the user's certFileId to point to regCertDoc
    try {
      if (userId && regCertDoc && regCertDoc.startsWith('data:')) {
        const matches = regCertDoc.match(/^data:(.+);base64,(.*)$/);
        if (matches) {
          const mime = matches[1];
          const b64 = matches[2];
          const ext = mime.split('/')[1] || 'pdf';
          const fileName = `reg-cert_${userId}.${ext}`;
          const uploadedAt = new Date().toISOString();
          const insertFileSQL = 'INSERT INTO uploadedFiles (ownerId,fileName,fileType,base64,uploadedAt) VALUES (?,?,?,?,?)';
          const [fres] = await db.execute(insertFileSQL, [userId, fileName, mime, b64, uploadedAt]);
          const regFileId = fres && fres.insertId ? fres.insertId : null;
          if (regFileId) {
            await db.execute('UPDATE users SET certFileId = ? WHERE id = ?', [regFileId, userId]);
          }
        }
      }
      // store CMMI/ISO document as well (not linked to users table currently)
      if (userId && cmmiDoc && cmmiDoc.startsWith('data:')) {
        const matches2 = cmmiDoc.match(/^data:(.+);base64,(.*)$/);
        if (matches2) {
          const mime2 = matches2[1];
          const b642 = matches2[2];
          const ext2 = mime2.split('/')[1] || 'pdf';
          const fileName2 = `cmmi_cert_${userId}.${ext2}`;
          const uploadedAt2 = new Date().toISOString();
          const insertFileSQL2 = 'INSERT INTO uploadedFiles (ownerId,fileName,fileType,base64,uploadedAt) VALUES (?,?,?,?,?)';
          const [fres2] = await db.execute(insertFileSQL2, [userId, fileName2, mime2, b642, uploadedAt2]);
          if (fres2 && fres2.insertId) {}
        }
      }
    } catch (fileErr) {
      console.error('Failed to save uploaded files during registration:', fileErr && fileErr.message);
      // do not block registration for file save errors
    }

    // generate 6-digit OTP and store in password_resets table (token field used for OTP)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const createdAt = new Date();
    if (userId) await db.execute('DELETE FROM password_resets WHERE user_id = ?', [userId]);
    await db.execute('INSERT INTO password_resets (user_id, token, expires_at, created_at) VALUES (?,?,?,?)', [userId, otp, expiresAt.toISOString().slice(0,19).replace('T',' '), createdAt.toISOString().slice(0,19).replace('T',' ')]);

    // send OTP email to company
    const mailOptions = {
      from: `InternBridge <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'InternBridge — Email verification code',
      html: `
        <p>Hi ${name || ''},</p>
        <p>Thank you for registering your company on InternBridge. Please enter the following 6-digit verification code to confirm your email address:</p>
        <h2 style="letter-spacing:6px">${otp}</h2>
        <p>This code expires in 10 minutes.</p>
        <p>After verification, your company registration will be submitted for university admin review.</p>
        <p>If you did not register, please ignore this email.</p>
        <p>— InternBridge</p>`
    };

    const mailRes = await sendMail(mailOptions);
    if (!mailRes || !mailRes.ok) {
      console.error('Failed to send OTP email for company registration:', mailRes && mailRes.error);
      console.warn(`New company registered (email unverified, email send failed): ${name}`);
      return res.status(201).json({ message: 'Company account created but verification email failed. Please use Resend OTP.' });
    }

    console.warn(`New company registered (email unverified): ${name}`);
    return res.status(201).json({ message: 'Company registered. Please check your email for OTP verification code.' });
  } catch (err) {
    console.error('Register company error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: 'Current password and new password are required.' });
  if (newPassword.length < 6)
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (!bcrypt.compareSync(currentPassword, user.password))
      return res.status(401).json({ error: 'Current password is incorrect.' });
    if (bcrypt.compareSync(newPassword, user.password))
      return res.status(400).json({ error: 'New password must be different from your current password.' });

    const hashed = bcrypt.hashSync(newPassword, 10);
    await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id]);

    console.log(`Password changed for: ${user.name}`);
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const email = req.body && req.body.email ? String(req.body.email).trim().toLowerCase() : '';
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  try {
    const [rows] = await db.execute('SELECT id, name, email FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [email]);
    if (!rows.length) {
      // Do not reveal whether account exists
      return res.json({ message: 'If an account exists, a password reset link has been sent to the email address.' });
    }
    const user = rows[0];
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    const createdAt = new Date();
    // Ensure password_resets table exists in your DB (see backend/sql/create-password-resets.sql)
    // Delete any existing reset tokens for this user to avoid multiple active tokens
    await db.execute('DELETE FROM password_resets WHERE user_id = ?', [user.id]);
    await db.execute('INSERT INTO password_resets (user_id, token, expires_at, created_at) VALUES (?,?,?,?)', [user.id, token, expiresAt.toISOString().slice(0,19).replace('T',' '), createdAt.toISOString().slice(0,19).replace('T',' ')]);

    const configuredAppUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
    const requestOrigin = `${req.protocol}://${req.get('host')}`;
    const resetLink = `${configuredAppUrl || requestOrigin}/reset-password.html?token=${token}`;
    // Send email via centralized email util (with retries). Requires EMAIL_USER and EMAIL_PASS in .env
    const mailOptions = {
      from: `InternBridge <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'InternBridge — Password reset',
      html: `
        <p>Hi ${user.name || ''},</p>
        <p>We received a request to reset your InternBridge password. Click the link below to set a new password. The link expires in 1 hour.</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>If you didn't request this, you can safely ignore this email.</p>
        <p>— InternBridge</p>`
    };

    const result = await sendMail(mailOptions);
    if (result.ok) {
      console.log('Password reset email send result:', result.info);
      console.log(`Password reset email sent to ${user.email}`);
      return res.json({ message: 'If an account exists, a password reset link has been sent to the email address.' });
    } else {
      console.error('Failed to send reset email:', result.error);
      console.log(`Password reset link for ${user.email}: ${resetLink}`);
      return res.status(500).json({ error: 'Failed to send password reset email. Please try again later.' });
    }
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const token = req.body && req.body.token ? String(req.body.token).trim() : '';
  const newPassword = req.body && req.body.newPassword ? String(req.body.newPassword) : '';
  if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password are required.' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  try {
    const [rows] = await db.execute('SELECT pr.user_id, pr.expires_at, u.* FROM password_resets pr JOIN users u ON pr.user_id = u.id WHERE pr.token = ? LIMIT 1', [token]);
    if (!rows.length) return res.status(400).json({ error: 'Invalid or expired token.' });
    const rec = rows[0];
    if (new Date(rec.expires_at) < new Date()) return res.status(400).json({ error: 'Token has expired.' });

    const hashed = bcrypt.hashSync(newPassword, 10);
    await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, rec.user_id]);
    await db.execute('DELETE FROM password_resets WHERE token = ?', [token]);

    console.log(`Password reset for user id=${rec.user_id} (${rec.email})`);
    res.json({ message: 'Password has been reset successfully. You can now log in with the new password.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  const email = req.body && req.body.email ? String(req.body.email).trim().toLowerCase() : '';
  const otp = req.body && req.body.otp ? String(req.body.otp).trim() : '';
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required.' });
  try {
    const [uRows] = await db.execute('SELECT id, name, email, role FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [email]);
    if (!uRows.length) return res.status(400).json({ error: 'Invalid verification code. Please try again.' });
    const user = uRows[0];

    const [rows] = await db.execute('SELECT * FROM password_resets WHERE user_id = ? AND token = ? LIMIT 1', [user.id, otp]);
    if (!rows.length) return res.status(400).json({ error: 'Invalid verification code. Please try again.' });
    const rec = rows[0];
    if (new Date(rec.expires_at) < new Date()) return res.status(400).json({ error: 'Your OTP has expired. Please click Resend OTP.' });

    // mark user as awaiting admin approval and set verifiedAt
    const now = new Date().toISOString();
    if (user.role === 'student') {
      await db.execute("UPDATE users SET accountStatus = 'pending_verification', verifiedAt = ? WHERE id = ?", [now, user.id]);
    } else if (user.role === 'company') {
      await db.execute("UPDATE users SET status = 'pending', verifiedAt = ? WHERE id = ?", [now, user.id]);
    } else {
      await db.execute("UPDATE users SET accountStatus = 'pending_verification', verifiedAt = ? WHERE id = ?", [now, user.id]);
    }
    // remove the OTP record
    await db.execute('DELETE FROM password_resets WHERE user_id = ? AND token = ?', [user.id, otp]);

    // send confirmation email
    try {
      let mailOptions;
      if (user.role === 'company') {
        mailOptions = {
          from: 'InternBridge <' + (process.env.EMAIL_USER || '') + '>',
          to: user.email,
          subject: 'InternBridge — Email verified',
          html: '<p>Hi ' + (user.name || '') + ',</p>' +
                '<p>Your email has been verified. Your company registration is now pending university admin approval. You will be notified once reviewed.</p>' +
                '<p>— InternBridge</p>'
        };
      } else {
        mailOptions = {
          from: 'InternBridge <' + (process.env.EMAIL_USER || '') + '>',
          to: user.email,
          subject: 'InternBridge — Email verified',
          html: '<p>Hi ' + (user.name || '') + ',</p>' +
                '<p>Your email has been verified. Your account is now pending university admin approval. You will be notified once reviewed.</p>' +
                '<p>— InternBridge</p>'
        };
      }
      await sendMail(mailOptions);
    } catch (mailErr) {
      console.error('Failed to send verification-confirmation email:', mailErr && mailErr.message);
    }

    console.log(`Email verified for user id=${user.id} (${user.email})`);
    return res.json({ message: 'Your email has been verified. Your account is now pending university admin approval. You will be notified once reviewed.' });
  } catch (err) {
    console.error('Verify OTP error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Rate limiter for resending OTP: max 3 requests per 10 minutes per IP
const resendLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  message: { error: 'Too many resend attempts. Please try again after 10 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/resend-otp
router.post('/resend-otp', resendLimiter, async (req, res) => {
  const email = req.body && req.body.email ? String(req.body.email).trim().toLowerCase() : '';
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  try {
    const [uRows] = await db.execute('SELECT id, name, email, accountStatus FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [email]);
    if (!uRows.length) return res.status(400).json({ error: 'Invalid request.' });
    const user = uRows[0];
    const isUnverified = user.accountStatus === 'email_unverified' || user.status === 'email_unverified';
    if (!isUnverified) return res.status(400).json({ error: 'Account is not awaiting email verification.' });

    // remove old OTPs for this user
    await db.execute('DELETE FROM password_resets WHERE user_id = ?', [user.id]);

    // generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    const createdAt = new Date();
    await db.execute('INSERT INTO password_resets (user_id, token, expires_at, created_at) VALUES (?,?,?,?)', [user.id, otp, expiresAt.toISOString().slice(0,19).replace('T',' '), createdAt.toISOString().slice(0,19).replace('T',' ')]);

    // send OTP email
    const mailOptions = {
      from: `InternBridge <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'InternBridge — Email verification code',
      html: `
        <p>Hi ${user.name || ''},</p>
        <p>Your new 6-digit verification code is:</p>
        <h2 style="letter-spacing:6px">${otp}</h2>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
        <p>— InternBridge</p>`
    };

    const result = await sendMail(mailOptions);
    if (result && result.ok) {
      console.log(`Resent OTP to ${user.email}`);
      return res.json({ message: 'A verification email has already been sent. We resent a new OTP to your email.' });
    } else {
      console.error('Failed to resend OTP email:', result && result.error);
      return res.status(500).json({ error: 'Failed to send OTP email. Please try again later.' });
    }
  } catch (err) {
    console.error('Resend OTP error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
