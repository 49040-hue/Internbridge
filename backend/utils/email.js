const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: process.env.SMTP_SECURE === 'true' || false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  tls: { ciphers: 'TLSv1.2' }
});

transporter.on('error', err => console.error('Email transporter error:', err));

async function init() {
  try {
    await transporter.verify();
    console.log('✅ SMTP transporter verified');
  } catch (err) {
    console.error('❌ SMTP verify failed:');
    console.error(err && err.stack || err);
    if (err && err.response) console.error('SMTP response:', err.response);
    if (err && err.code) console.error('SMTP error code:', err.code);
  }
}

async function sendMail(mailOptions, { retries = 2 } = {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const info = await transporter.sendMail(mailOptions);
      // Log structured send information
      try {
        console.log('✔ email sent:', {
          messageId: info && info.messageId,
          accepted: info && info.accepted,
          rejected: info && info.rejected,
          response: info && info.response
        });
      } catch (e) { /* ignore logging errors */ }
      return { ok: true, info };
    } catch (err) {
      console.error(`sendMail attempt ${attempt} failed:`);
      console.error(err && err.stack || err);
      if (err && err.response) console.error('SMTP response:', err.response);
      if (err && err.code) console.error('SMTP error code:', err.code);
      if (attempt === retries) return { ok: false, error: err };
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }
}

module.exports = { transporter, init, sendMail };
