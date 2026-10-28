Gmail App Password setup for InternBridge

Follow these steps to create a Gmail App Password and configure the project:

1. Sign into the Gmail account used by `EMAIL_USER`.
2. Enable 2-Step Verification for the Google account if not already enabled: https://myaccount.google.com/security
3. After 2-Step Verification is enabled, go to "App passwords": https://myaccount.google.com/apppasswords
4. Create a new app password:
   - Select "Mail" as the app.
   - Choose "Other (Custom name)" and enter e.g. "InternBridge Local".
   - Click "Generate" and copy the 16-character password.
5. Open the project's `.env` file at the repository root and set:

   EMAIL_USER=your.email@gmail.com
   EMAIL_PASS=<paste_the_16_char_app_password_here>
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false

6. Restart the server:

```bash
node backend/server.js
```

7. Run the provided test script to verify sending:

```bash
node scripts/test-send-email.js
```

If you see `Transporter OK` and the send result shows `accepted`, SMTP is working.

Troubleshooting:
- If you get `535 5.7.8 Username and Password not accepted`, ensure the App Password was generated for the same Google account in `EMAIL_USER` and that 2-Step Verification is enabled.
- For Google Workspace accounts, admins may block App Passwords. In that case use Mailtrap or a transactional email provider (SendGrid, Mailgun).
- For development only, consider using Mailtrap (https://mailtrap.io) and replace SMTP settings with the Mailtrap credentials.