# Application Flow

This flow describes the internship application decision states. The student first submits an application; subsequent decisions are made by the company, student, and university/sysadmin roles.

```text
pending
  -> company_accepted
  -> student_confirmed
  -> sysadmin_approved
```

The company reviews a pending application and may accept or reject it. Following acceptance, the student records a decision: confirming the offer moves the application to `student_confirmed`, while declining it records `student_declined`. A confirmed application is then eligible for final university/sysadmin approval, which moves it to `sysadmin_approved`.

```text
pending -> company_rejected
company_accepted -> student_declined
student_confirmed -> sysadmin_approved
```

Each decision is performed by its authorized role through the application routes. The API checks the current state before advancing a record so a later-stage decision cannot bypass the preceding review. Related internship publication and direct student-found opportunity reviews are separate approval workflows.
