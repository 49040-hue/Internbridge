// InternBridge v4 — In-Memory Data Store
const bcrypt = require('bcryptjs');
const h = pw => bcrypt.hashSync(pw, 10);

const store = {
  users: [
    { id:1, name:'University Admin',  email:'admin@riphah.edu.pk',    password:h('Salam123'),  role:'university', university:'Riphah International University', department:'Faculty of Computing' },
    { id:2, name:'System Admin',      email:'sysadmin@riphah.edu.pk', password:h('Salam321'),  role:'sysadmin' },
    { id:3, name:'Ahmed Raza',        email:'student@riphah.edu.pk',  password:h('password'),  role:'student',
      university:'Riphah International University', program:'BSCS', semester:6, cgpa:3.2,
      creditHours:96, electiveCourse:'Web Engineering', skills:'React, Node.js, Python',
      enrolled:true, transcriptFileId:null, cvFileId:null,
      accountStatus:'verified', verifiedAt:new Date().toISOString(), rejectionReason:null,
      registeredAt:new Date().toISOString() },
    { id:4, name:'TechCorp Pvt Ltd',  email:'company@techcorp.com',   password:h('password'),  role:'company',
      city:'Lahore', pasha:'P@SHA-2024-001', pseb:'', secp:'', cmmi:'CMMI Level 3',
      operational:'5', certFileId:null, status:'verified', rejectionReason:null,
      registeredAt:new Date().toISOString() },
    { id:5, name:'DataViz Solutions', email:'hr@dataviz.com',         password:h('password'),  role:'company',
      city:'Karachi', pasha:'', pseb:'PSEB-2024-088', secp:'', cmmi:'ISO 9001',
      operational:'4', certFileId:null, status:'pending', rejectionReason:null,
      registeredAt:new Date().toISOString() },
  ],

  internships: [
    { id:1, companyId:4, company:'TechCorp Pvt Ltd', title:'Frontend Developer Intern',
      city:'Lahore', deadline:'2026-08-15', description:'Work on React/Vue.js projects. Requires HTML, CSS, JavaScript knowledge.',
      stipend:'15,000 PKR/month', type:'full-time', durationWeeks:12, isRemote:false,
      status:'open', sysadminApproved:true, approvedAt:new Date().toISOString(), rejectionNote:null,
      timeSlots:[], createdAt:new Date().toISOString().split('T')[0] },
    { id:2, companyId:4, company:'TechCorp Pvt Ltd', title:'Backend Engineer Intern',
      city:'Lahore', deadline:'2026-09-01', description:'Node.js and Express backend development. Database design experience preferred.',
      stipend:'18,000 PKR/month', type:'full-time', durationWeeks:12, isRemote:false,
      status:'open', sysadminApproved:false, approvedAt:null, rejectionNote:null,
      timeSlots:[], createdAt:new Date().toISOString().split('T')[0] },
  ],

  applications: [
    { id:1, studentId:3, internshipId:1, studentName:'Ahmed Raza',
      internshipTitle:'Frontend Developer Intern', company:'TechCorp Pvt Ltd', companyId:4,
      appliedAt:new Date().toISOString().split('T')[0], status:'pending', companyFeedback:null,
      sysadminApproved:false, slotId:null },
  ],

  complaints: [],
  universityFeedback: [],
  activityLog: [
    { id:1, time:new Date().toISOString(), event:'InternBridge v4 started', type:'info' },
    { id:2, time:new Date().toISOString(), event:'DataViz Solutions registered — pending verification', type:'warning' },
  ],

  criteria: {
    studentEligibility: [
      { id:1, text:'Has completed at least 60 credited hours' },
      { id:2, text:'Has a CGPA of 2.0 or above' },
      { id:3, text:'Has an elective course available for substitution' },
      { id:4, text:'Must be currently enrolled at Riphah' },
    ],
    companyEligibility: [
      { id:1, text:'Must be a software or IT organization only (no banks, NGOs, etc.)' },
      { id:2, text:'Must be registered with P@SHA, PSEB, or SECP' },
      { id:3, text:'Must hold at least CMMI Level 2 or ISO Certification' },
      { id:4, text:'Company must have been operational for more than 3 years' },
      { id:5, text:'Internship must be at least 8 weeks full-time or 16 weeks part-time' },
      { id:6, text:'Internship must be ongoing at time of registration' },
      { id:7, text:'Remote internships are not accepted — on-site only' },
      { id:8, text:'Registration valid only after system admin approval' },
    ],
    importantNotes: [
      { id:1, text:'Approved internship will replace an elective course in transcript' },
      { id:2, text:'Can be registered in any session: Fall, Spring, or Summer' },
      { id:3, text:'Student must complete at least 180 hours for 3 credit hours' },
      { id:4, text:'Only one internship per semester is allowed' },
      { id:5, text:'Internships without formal system admin approval will not be credited' },
      { id:6, text:'Offer letter and company profile must be submitted at registration' },
      { id:7, text:'Attendance sheet and completion certificate required after finishing' },
    ],
    requiredDocs: [
      { id:1, text:'Internship Offer Letter (on official company letterhead)' },
      { id:2, text:'Company Registration Certificate (P@SHA / PSEB / SECP)' },
      { id:3, text:'Company Profile or official website link' },
      { id:4, text:'Official University Transcript (for student eligibility verification)' },
      { id:5, text:'Supervisor approval email or letter' },
      { id:6, text:'Completion Certificate (after internship ends)' },
      { id:7, text:'Daily Attendance Sheet (after internship ends)' },
    ],
    partnerCompanies: ['TechCorp Pvt Ltd', 'Systems Limited', 'NETSOL Technologies'],
    creditedCompanies: ['TechCorp Pvt Ltd', 'Arbisoft', 'Tkxel', 'Contour Software', 'i2c Inc'],
  },

  uploadedFiles: [],
  _next: { users:6, internships:3, applications:2, complaints:1, feedback:1, files:1, log:3 },
};

store.log = (event, type='info') => {
  store.activityLog.unshift({ id:store._next.log++, time:new Date().toISOString(), event, type });
  if (store.activityLog.length > 100) store.activityLog.pop();
};

module.exports = store;
