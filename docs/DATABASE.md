# Database

The backend uses a MySQL-compatible database through the `mysql2` promise driver. The connection pool is configured in `backend/config/db.js`; the checked-in `schema.sql` defines the core relational schema.

## Main records

- `users` stores account identity, role, registration status, and profile fields.
- `internships` stores company-posted opportunities and their approval/publication state.
- `applications` connects students to internships and records the company, student, and final administrative decisions.
- `self_found_internships` stores opportunities submitted directly by students for review.
- `uploadedFiles` associates uploaded document data with its owning user.
- `student_free_time` stores student availability used by the application.
- `complaints`, `universityFeedback`, and `notifications` support communication and review workflows.
- `criteria` and `activityLog` support university configuration and administrative history.
- `password_resets` stores expiring password-reset request records.

The server checks database connectivity during startup and runs idempotent schema checks for selected columns and supporting tables. Keep schema changes compatible with existing records and apply any required schema setup before serving traffic.

## Data access

Route handlers use parameterized database statements through the shared pool. Preserve ownership and role checks when reading or changing user-specific records. Uploaded documents and application decisions should be changed through the API rather than direct ad hoc edits.

## Configuration

Database connection settings are supplied through environment variable names: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`. The deployment-specific TLS behavior is configured in the database connection module.
