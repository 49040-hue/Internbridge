# InternBridge — Riphah International University
## Internship Management System

---

## Project Structure

```
InternBridge_Complete/
├── backend/
│   ├── data/store.js          ← In-memory database
│   ├── middleware/auth.js      ← JWT authentication
│   ├── routes/
│   │   ├── auth.js            ← Login, Register, Change Password
│   │   ├── internships.js     ← Internship CRUD + Time Slots
│   │   ├── applications.js    ← Apply, Accept, Reject, Approve
│   │   ├── admin.js           ← University & Sysadmin routes
│   │   └── profile.js         ← Profile + File Upload
│   └── server.js              ← Express server
├── frontend/
│   ├── index.html             ← Single page app shell
│   ├── css/main.css           ← All styles
│   └── js/
│       ├── api.js             ← In-browser data layer (localStorage)
│       ├── app.js             ← Navigation, sidebar, utilities
│       ├── auth.js            ← Role selection + login/register
│       ├── student.js         ← Student pages
│       ├── company.js         ← Company pages
│       ├── university.js      ← University admin pages
│       └── sysadmin.js        ← System admin pages
└── package.json
```

---

## How to Run (Backend)

Copy `.env.example` to `.env` in the project root and set the database and email
credentials before starting the server. For Gmail, use a Google App Password
(with 2-Step Verification enabled), not your normal account password. Keep `.env`
private and never commit real credentials.
Database TLS is disabled by default for local MySQL servers. Set `DB_SSL=true`
when your database provider requires SSL/TLS.

```bash
npm install
npm start
```
Server runs at: http://localhost:3000

---

## How to Run (Frontend Only)
Just open `frontend/index.html` in browser — no server needed.
Uses localStorage as database automatically.
Email verification and OTP delivery require the backend and configured SMTP credentials.

If a verification code does not arrive, check the inbox spam folder and use **Resend OTP**.
If sending still fails, confirm `EMAIL_USER` and `EMAIL_PASS` in the project-root `.env`
and check the backend console for the SMTP error.

---

## Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| University Admin | S@riphah.edu.pk | Salam123 |
| System Admin | A@riphah.edu.pk | Salam321 |

Student and Company accounts must be registered first, then approved by University Admin.

---

## Auth Flow

1. **First Screen** → 4 role cards (Student / Company / University Admin / System Admin)
2. **Click any card** → Login screen for that role
3. **Student/Company** → Have "Create Account" option below login
4. **After Company Register** → InDrive-style "Application Submitted" pending screen
5. **After Student Register** → Verification checklist pending screen
6. **Both cannot login** until University Admin approves them

---

## Approval Flow

### Company:
Register → University Admin verifies documents → Approved → Can login & post internships

### Student:
Register → University Admin checks CGPA/credits/transcript → Approved → Can apply for internships

### Internship Posts:
Company posts → **System Admin** approves → Visible to students

### Applications:
Student applies → Company accepts → Student confirms → **System Admin** gives final approval
