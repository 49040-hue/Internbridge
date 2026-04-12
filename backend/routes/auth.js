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
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required.' });
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [email]);
    const user = rows[0];
    // Debug: log whether user was found and bcrypt comparison result
    try {
      const match = user ? bcrypt.compareSync(password, user.password) : false;
      if (!user || !match) return res.status(401).json({ error: 'Incorrect email or password.' });
    } catch (dbgErr) {
      console.warn('Login debug: bcrypt compare failed', dbgErr && dbgErr.message);
      return res.status(401).json({ error: 'Incorrect email or password.' });
    }

    if (user.role === 'student' && user.accountStatus === 'suspended')
      return res.status(403).json({ error: 'Your account has been suspended. Please contact the university admin.' });
    if (user.role === 'company' && user.status === 'rejected')
      return res.status(403).json({ error: 'Your company registration was rejected. Please contact the university admin.' });

    console.log(`${user.name} logged in`);
    res.json({ token: makeToken(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/register/student
router.post('/register/student', async (req, res) => {
  const { name, email, password, program, semester, cgpa, creditHours, electiveCourse, skills, transcriptFileId } = req.body;
  if (!name || !email || !password || !program || !cgpa || !creditHours || !electiveCourse)
    return res.status(400).json({ error: 'All required fields must be filled in.' });
  const passwordPolicy = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?]).{8,}$/;
  if (!passwordPolicy.test(password))
    return res.status(400).json({ error: 'Password must be at least 8 characters and contain uppercase, number, and special character.' });
  try {
    const [exists] = await db.execute('SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [email]);
    if (exists.length) return res.status(409).json({ error: 'This email address is already registered.' });

    const hashed = bcrypt.hashSync(password, 10);
    const registeredAt = new Date().toISOString();
    const accountStatus = 'pending_verification';

    const insertSQL = `INSERT INTO users
      (name,email,password,role,university,program,semester,cgpa,creditHours,electiveCourse,skills,enrolled,transcriptFileId,cvFileId,accountStatus,verifiedAt,rejectionReason,registeredAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const params = [
      name, email, hashed, 'student', 'Riphah International University', program,
      parseInt(semester) || 0, parseFloat(cgpa) || 0, parseInt(creditHours) || 0,
      electiveCourse, skills || '', true, transcriptFileId || null, null, accountStatus, null, null, registeredAt
    ];
    await db.execute(insertSQL, params);

    console.warn(`New student registered (pending verification): ${name}`);
    res.status(201).json({ message: 'Account created successfully. Please wait for university admin verification before you can apply for internships.' });
  } catch (err) {
    console.error('Register student error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/register/company
router.post('/register/company', async (req, res) => {
  const { name, email, password, city, pasha, pseb, secp, cmmi, operational, certFileId } = req.body;
  if (!name || !email || !password || !city || !cmmi || !operational)
    return res.status(400).json({ error: 'All required fields must be filled in.' });
  if (!pasha && !pseb && !secp)
    return res.status(400).json({ error: 'At least one registration ID is required (P@SHA, PSEB, or SECP).' });
  const passwordPolicy = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?]).{8,}$/;
  if (!passwordPolicy.test(password))
    return res.status(400).json({ error: 'Password must be at least 8 characters and contain uppercase, number, and special character.' });
  try {
    const [exists] = await db.execute('SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1', [email]);
    if (exists.length) return res.status(409).json({ error: 'This email address is already registered.' });

    const hashed = bcrypt.hashSync(password, 10);
    const registeredAt = new Date().toISOString();
    const status = 'pending';

    const insertSQL = `INSERT INTO users
      (name,email,password,role,city,pasha,pseb,secp,cmmi,operational,certFileId,status,rejectionReason,registeredAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const params = [name, email, hashed, 'company', city, pasha || '', pseb || '', secp || '', cmmi, operational, certFileId || null, status, null, registeredAt];
    await db.execute(insertSQL, params);

    console.warn(`New company registered (pending verification): ${name}`);
    res.status(201).json({ message: 'Company registered successfully. Your account is pending university admin verification.' });
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
  const { email } = req.body;
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

    const resetLink = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password.html?token=${token}`;
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
  const { token, newPassword } = req.body;
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

module.exports = router;
