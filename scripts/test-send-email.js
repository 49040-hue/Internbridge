const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const { transporter } = require('../backend/utils/email');

(async () => {
  try {
    if (!process.env.EMAIL_USER) {
      console.error('EMAIL_USER not found in .env (looked at ' + path.resolve(__dirname, '..', '.env') + ')');
      process.exit(2);
    }
    console.log('Verifying transporter...');
    await transporter.verify();
    console.log('Transporter OK. Sending test email...');
    const info = await transporter.sendMail({
      from: `Test <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: 'InternBridge - Test Email',
      text: 'This is a test email from InternBridge. If you receive it, SMTP is working.'
    });
    console.log('Send result:', {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response
    });
  } catch (err) {
    console.error('Test send failed:');
    console.error(err && err.stack || err);
    if (err && err.response) console.error('SMTP response:', err.response);
    if (err && err.code) console.error('SMTP error code:', err.code);
    process.exit(2);
  }
})();
