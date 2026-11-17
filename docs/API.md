# API

The Express API is mounted under `/api`. JSON request bodies are accepted for write operations. Authenticated endpoints require a valid bearer token; role-restricted endpoints additionally require the role indicated below. Responses are JSON unless noted.

## Authentication — `/api/auth`

| Method | Path | Access |
|---|---|---|
| POST | `/login` | Public |
| POST | `/register/student` | Public |
| POST | `/register/company` | Public |
| POST | `/change-password` | Authenticated |
| POST | `/forgot-password` | Public |
| POST | `/reset-password` | Public |
| POST | `/verify-otp` | Public |
| POST | `/resend-otp` | Public, rate-limited |

## Internships — `/api/internships`

| Method | Path | Access |
|---|---|---|
| GET | `/` | Public |
| GET | `/company/mine` | Company |
| GET | `/pending-approval` | Sysadmin |
| GET | `/all` | University, sysadmin |
| GET | `/:id` | Public |
| POST | `/` | Company |
| PATCH | `/:id/approve` | University, sysadmin |
| PATCH | `/:id` | Company |
| PATCH | `/:id/reject` | University, sysadmin |
| POST | `/:id/slots` | Company |
| DELETE | `/:id/slots/:slotId` | Company |
| POST | `/:id/slots/:slotId/book` | Student |
| DELETE | `/:id` | Company |

## Applications — `/api/applications`

| Method | Path | Access |
|---|---|---|
| POST | `/` | Student |
| GET | `/mine` | Student |
| GET | `/company` | Company |
| GET | `/all` | University, sysadmin |
| PATCH | `/:id` | Company |
| PATCH | `/:id/student-decision` | Student |
| PATCH | `/:id/sysadmin-approve` | Sysadmin, university |

## Administration — `/api/admin`

University/sysadmin routes include `GET /stats`, `GET /students/pending`, `PATCH /students/:id`, `GET /students`, `GET /students-list`, `GET /students/:id`, `GET /companies`, `PATCH /companies/:id`, `GET /complaints`, `PATCH /complaints/:id`, `GET /feedback`, `POST /feedback`, `GET /activity`, `GET /criteria`, `PUT /criteria/:section`, `POST /criteria/:section/item`, and `DELETE /criteria/:section/item/:id`.

Additional routes are `GET /complaints/mine` and `PATCH /feedback/:id/read` (authenticated), `POST /complaints` (company), `DELETE /feedback/:id` (university/sysadmin), `GET /uni-profile` and `PUT /uni-profile` (university), and `GET /users`, `DELETE /users/:id`, `POST /users/reset-password`, `POST /users/create-admin`, `PATCH /users/:id/suspend`, and `GET /system-stats` (sysadmin).

## Profiles and supporting resources

- `/api/profile`: profile read/update, feedback retrieval, document upload/download, and free-time read/update; authenticated users.
- `/api/self-found`: submit and list personal submissions for authenticated users; university/sysadmin reviewers can list all and update review decisions.
- `/api/notifications`: authenticated notification listing and read-status updates.
- `GET /api/health` and `GET /healthz`: service health checks.

Route handlers validate request data and ownership and return an error status for rejected or unauthorized requests. Consult the corresponding router for exact request fields and response properties.
