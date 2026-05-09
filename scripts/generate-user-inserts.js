const bcrypt = require('bcryptjs');

const users = [
  {
    id: 1,
    name: 'University Admin',
    email: 'admin@riphah.edu.pk',
    plaintext: 'Salam123',
    role: 'university',
    university: 'Riphah International University',
    department: 'Faculty of Computing'
  },
  {
    id: 2,
    name: 'System Admin',
    email: 'sysadmin@riphah.edu.pk',
    plaintext: 'Salam321',
    role: 'sysadmin'
  },
  {
    id: 3,
    name: 'Ahmed Raza',
    email: 'student@riphah.edu.pk',
    plaintext: 'password',
    role: 'student',
    university: 'Riphah International University',
    program: 'BSCS',
    semester: 6,
    cgpa: 3.2,
    creditHours: 96,
    electiveCourse: 'Web Engineering',
    skills: 'React, Node.js, Python',
    enrolled: 1,
    accountStatus: 'verified',
    verifiedAt: new Date().toISOString(),
    registeredAt: new Date().toISOString()
  },
  {
    id: 4,
    name: 'TechCorp Pvt Ltd',
    email: 'company@techcorp.com',
    plaintext: 'password',
    role: 'company',
    city: 'Lahore',
    pasha: 'P@SHA-2024-001',
    pseb: '',
    secp: '',
    cmmi: 'CMMI Level 3',
    operational: 5,
    status: 'verified',
    registeredAt: new Date().toISOString()
  }
];

const escape = v => v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`;

users.forEach(u => {
  const hash = bcrypt.hashSync(u.plaintext, 10);
  const cols = [
    'id','name','email','password','role','university','department','program','semester','cgpa',
    'creditHours','electiveCourse','skills','enrolled','transcriptFileId','cvFileId',
    'accountStatus','verifiedAt','rejectionReason','registeredAt','city','pasha','pseb','secp',
    'cmmi','operational','certFileId','status','createdAt'
  ];
  const vals = [
    u.id,
    u.name,
    u.email,
    hash,
    u.role,
    u.university || null,
    u.department || null,
    u.program || null,
    u.semester || null,
    u.cgpa || null,
    u.creditHours || null,
    u.electiveCourse || null,
    u.skills || null,
    (u.enrolled !== undefined ? (u.enrolled ? 1 : 0) : null),
    null, // transcriptFileId
    null, // cvFileId
    u.accountStatus || null,
    u.verifiedAt || null,
    null, // rejectionReason
    u.registeredAt || null,
    u.city || null,
    u.pasha || null,
    u.pseb || null,
    u.secp || null,
    u.cmmi || null,
    u.operational || null,
    null, // certFileId
    u.status || null,
    new Date().toISOString()
  ];
  const sql = `INSERT INTO users (${cols.join(',')}) VALUES (${vals.map(escape).join(',')});`;
  console.log(sql);
});
