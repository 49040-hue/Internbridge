const nodemailer = require('nodemailer');

const missingEmailConfig = () => {
  const missing = ['EMAIL_USER', 'EMAIL_PASS'].filter(name => !process.env[name]);
  return missing.length
    ? new Error(`Email is not configured. Set ${missing.join(' and ')} in the project root .env file.`)
    : null;
};

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

function getEmailAddress(address) {
  const value = String(address || '').trim();
  const match = value.match(/<\s*([^<>]+)\s*>/);
  return (match ? match[1] : value).trim();
}

function getBrevoSender(from) {
  const value = String(from || '').trim();
  const match = value.match(/^\s*(.*?)\s*<\s*([^<>]+)\s*>\s*$/);
  const parsedEmail = (match ? match[2] : value).trim();
  const validFromEmail = /^(undefined|null)$/i.test(parsedEmail) ? '' : parsedEmail;
  const email = (process.env.BREVO_SENDER_EMAIL || validFromEmail || process.env.EMAIL_USER || '').trim();
  const name = (match ? match[1].replace(/^["']|["']$/g, '').trim() : '') || 'InternBridge';
  return { name, email };
}

async function init() {
  if (process.env.BREVO_API_KEY) {
    console.log('✅ Brevo transactional HTTPS API will be used for outgoing email');
    return;
  }

  const configError = missingEmailConfig();
  if (configError) {
    console.error(`❌ ${configError.message}`);
    return;
  }

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
  const useBrevo = Boolean(process.env.BREVO_API_KEY);
  if (!useBrevo) {
    const configError = missingEmailConfig();
    if (configError) {
      console.error(configError.message);
      return { ok: false, error: configError };
    }
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      let info;
      if (useBrevo) {
        const sender = getBrevoSender(mailOptions.from);
        const recipient = getEmailAddress(mailOptions.to);
        if (!sender.email || !recipient) {
          throw new Error('Brevo email requires a sender email and recipient email address.');
        }

        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': process.env.BREVO_API_KEY,
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({
            sender,
            to: [{ email: recipient }],
            subject: mailOptions.subject,
            htmlContent: mailOptions.html,
          }),
        });
        const responseBody = await response.text();
        try {
          info = responseBody ? JSON.parse(responseBody) : {};
        } catch {
          info = { response: responseBody };
        }

        if (!response.ok) {
          const error = new Error(`Brevo email API returned HTTP ${response.status}: ${responseBody || response.statusText}`);
          error.statusCode = response.status;
          error.response = responseBody;
          console.error('Brevo email API request failed:', error.message);
          throw error;
        }
      } else {
        info = await transporter.sendMail(mailOptions);
        if (!info.accepted || info.accepted.length === 0) {
          const error = new Error('The email provider did not accept the recipient address.');
          console.error(error.message, { rejected: info.rejected });
          return { ok: false, error };
        }
      }
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
      if (err && err.response) console.error('Email provider response:', err.response);
      if (err && err.code) console.error('Email provider error code:', err.code);
      if (attempt === retries) return { ok: false, error: err };
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }
}

module.exports = { transporter, init, sendMail };
