# Deploy InternBridge

## Render deployment

Render's free plan blocks outbound SMTP on ports 25, 465, and 587. Configure
Brevo's HTTPS transactional email API for OTP, verification, and password-reset
messages instead of SMTP:

- `BREVO_API_KEY` — Brevo API key with transactional email access.
- `BREVO_SENDER_EMAIL` — optional verified sender address in Brevo.

Add these in the Render web service's **Environment** settings. The sender
address configured in Brevo must be verified. When `BREVO_API_KEY` is set, the
application sends through Brevo over HTTPS; otherwise it falls back to the
configured SMTP variables.

Also configure `NODE_ENV`, `APP_URL`, `JWT_SECRET`, `DB_HOST`, `DB_PORT`,
`DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `CRONTZ`. Set `DB_SSL=true` if the
database provider requires TLS. Import `schema.sql` into the production database
before deploying the service.

After setting variables, deploy and confirm `/api/health` responds successfully.

## Railway deployment

### 1. Create the project

1. Open Railway and create a new project.
2. Add a MySQL database service.
3. Add a service from this repository.
4. Set the root directory to the repository root.
5. Confirm Railway uses `npm install` for dependencies and `npm start` for the application command.

### 2. Import the database schema

1. Open the Railway MySQL service.
2. Use the database query or import interface.
3. Import `schema.sql` while the InternBridge database is selected.
4. Confirm all application tables were created successfully.

Do not import demo seed SQL into production. Demo accounts are created only when `NODE_ENV` is not `production`.

### 3. Configure application variables

Set these variables in the application service:

- `NODE_ENV`
- `PORT`
- `APP_URL`
- `JWT_SECRET`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `EMAIL_USER`
- `EMAIL_PASS`
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `CRONTZ`

For Railway variables, use the MySQL service private host and connection values provided by Railway.

Set `NODE_ENV` to `production`. Set `APP_URL` to the public HTTPS origin generated for the application service. Set `PORT` when explicitly required by your Railway configuration. Railway can also provide it automatically.

Generate a strong, unique value for `JWT_SECRET`. Use an SMTP account and credentials that are dedicated for this application.

### 4. Deploy

1. Trigger a deployment after adding the variables.
2. Wait for the build and startup logs to complete.
3. Open the generated Railway domain.
4. Confirm `/api/health` responds successfully.

### 5. Verify production behavior

- Verify login and registration with production accounts.
- Confirm password-reset emails use `APP_URL`.
- Confirm database writes and file uploads work through Railway MySQL.
- Confirm demo accounts are absent because `NODE_ENV` is `production`.
- Rotate `JWT_SECRET`, database credentials, and SMTP credentials if they have ever been shared or committed elsewhere.

### 6. Local development

Copy `.env.example` to `.env` and fill in local values. Do not commit `.env`. Start locally with `npm start`.
