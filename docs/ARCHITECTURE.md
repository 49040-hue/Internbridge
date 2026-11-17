# Architecture

InternBridge is an internship-management application with a browser-based single-page interface and a Node.js/Express API.

## Components

- `frontend/index.html` hosts the application shell; `frontend/js/` contains the API client, navigation, authentication screens, and role-specific pages.
- `backend/server.js` configures Express, serves the frontend, mounts API routers, checks database connectivity, and performs startup schema checks.
- `backend/routes/` implements authentication, internship, application, administrative, profile, self-found internship, and notification operations.
- `backend/middleware/auth.js` verifies bearer-token sessions and enforces role permissions.
- `backend/config/db.js` creates the MySQL-compatible connection pool used by the API.
- `backend/utils/` contains email delivery, JSON parsing, and URL helpers shared by routes.

## Request path

The browser calls `/api/...` endpoints. Express applies CORS, compression, JSON parsing, timing diagnostics, and route-specific authentication before returning JSON responses. Static frontend assets are served by the same application; unmatched browser paths fall back to the single-page app entry point.

## Persistent state and integrations

Application records are stored in the MySQL-compatible database described in [DATABASE.md](./DATABASE.md). Email is sent through the configured transactional provider, with the email utility supporting Brevo's HTTPS API and SMTP. The server also schedules a daily close operation for expired, open internships.

## Roles

The application distinguishes student, company, university, and sysadmin accounts. Authentication establishes identity; route middleware applies role-based access restrictions. Account and application approval steps are described in [APPLICATION_FLOW.md](./APPLICATION_FLOW.md).
