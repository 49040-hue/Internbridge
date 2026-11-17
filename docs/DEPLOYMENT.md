# Deployment

## Services

- Deploy the Node.js application on Render and configure its start command as `npm start`.
- Provision the MySQL-compatible database with TiDB Cloud and allow the deployed application to connect to it.
- Configure Brevo for transactional email delivery. The backend uses its HTTPS API when the Brevo API key is configured; SMTP configuration is also supported.
- Set the frontend's allowed origin to the deployed application origin and enable production mode.

## Environment variable names

Configure values securely in the hosting provider's environment settings. This document intentionally lists names only; do not put credentials, endpoints, or sample values in documentation.

- Application: `NODE_ENV`, `PORT`, `APP_URL`, `FRONTEND_URL`, `BASE_URL`, `RENDER_EXTERNAL_URL`, `CRONTZ`
- Database: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- Authentication: `JWT_SECRET`
- Brevo: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `EMAIL_USER`, `EMAIL_PASS`
- Optional diagnostics: `DEBUG_OTP_LOG`

## Release checklist

1. Provide the required environment variables through the platform's secret/environment settings.
2. Ensure the database schema is initialized and the application can reach the database.
3. Confirm the application starts and its health endpoints respond.
4. Verify the configured sender and transactional email capability in Brevo, without exposing credentials in logs or source control.
5. Confirm the production deployment does not seed development accounts.
