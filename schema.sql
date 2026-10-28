SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('student','company','university','sysadmin') NOT NULL,
  university VARCHAR(255),
  department VARCHAR(255),
  program VARCHAR(64),
  semester INT,
  cgpa DECIMAL(3,2),
  creditHours INT,
  electiveCourse VARCHAR(255),
  skills TEXT,
  enrolled TINYINT(1),
  transcriptFileId INT UNSIGNED,
  cvFileId INT UNSIGNED,
  accountStatus VARCHAR(32),
  verifiedAt VARCHAR(64),
  rejectionReason TEXT,
  registeredAt VARCHAR(64),
  phone VARCHAR(32),
  address TEXT,
  website VARCHAR(512),
  description TEXT,
  city VARCHAR(100),
  pasha VARCHAR(128),
  pseb VARCHAR(128),
  secp VARCHAR(128),
  cmmi VARCHAR(128),
  operational VARCHAR(64),
  certFileId INT UNSIGNED,
  status VARCHAR(32),
  transcriptDoc LONGTEXT,
  enrollmentDoc LONGTEXT,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  createdAt VARCHAR(64),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
);

CREATE TABLE IF NOT EXISTS uploadedFiles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ownerId INT UNSIGNED NOT NULL,
  fileName VARCHAR(255) NOT NULL,
  fileType VARCHAR(128) NOT NULL,
  base64 LONGTEXT NOT NULL,
  uploadedAt VARCHAR(64) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_uploaded_owner (ownerId),
  CONSTRAINT fk_uploaded_owner FOREIGN KEY (ownerId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_resets (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  token VARCHAR(128) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_password_reset_token (token),
  KEY idx_password_reset_user (user_id),
  CONSTRAINT fk_password_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS internships (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  companyId INT UNSIGNED NOT NULL,
  company VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  deadline VARCHAR(32) NOT NULL,
  description TEXT NOT NULL,
  stipend VARCHAR(128),
  type VARCHAR(32),
  durationWeeks INT,
  isRemote TINYINT(1) DEFAULT 0,
  status VARCHAR(32) DEFAULT 'open',
  sysadminApproved TINYINT(1) DEFAULT 0,
  approvedAt VARCHAR(64),
  rejectionNote TEXT,
  override_reason TEXT,
  timeSlots JSON,
  createdAt VARCHAR(64),
  PRIMARY KEY (id),
  KEY idx_internships_company (companyId),
  KEY idx_internships_status (status),
  CONSTRAINT fk_internship_company FOREIGN KEY (companyId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS applications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  studentId INT UNSIGNED NOT NULL,
  internshipId INT UNSIGNED NOT NULL,
  studentName VARCHAR(255),
  internshipTitle VARCHAR(255),
  company VARCHAR(255),
  companyId INT UNSIGNED,
  appliedAt VARCHAR(64),
  status VARCHAR(32) DEFAULT 'pending',
  companyFeedback TEXT,
  sysadminApproved TINYINT(1) DEFAULT 0,
  slotId VARCHAR(64),
  PRIMARY KEY (id),
  UNIQUE KEY uq_application_student_internship (studentId, internshipId),
  KEY idx_applications_internship (internshipId),
  KEY idx_applications_company (companyId),
  CONSTRAINT fk_application_student FOREIGN KEY (studentId) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_application_internship FOREIGN KEY (internshipId) REFERENCES internships(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS complaints (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  fromId INT UNSIGNED,
  fromName VARCHAR(255),
  studentId INT UNSIGNED,
  studentName VARCHAR(255),
  internshipTitle VARCHAR(255),
  applicationId INT UNSIGNED,
  subject VARCHAR(255),
  description TEXT,
  submittedAt VARCHAR(64),
  status VARCHAR(32) DEFAULT 'open',
  adminResponse TEXT,
  respondedAt VARCHAR(64),
  PRIMARY KEY (id),
  KEY idx_complaints_student (studentId),
  CONSTRAINT fk_complaint_student FOREIGN KEY (studentId) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS universityFeedback (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  studentId INT UNSIGNED NOT NULL,
  studentName VARCHAR(255),
  subject VARCHAR(255),
  message TEXT,
  category VARCHAR(64),
  sentByName VARCHAR(255),
  sentAt VARCHAR(64),
  `read` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_feedback_student (studentId),
  CONSTRAINT fk_feedback_student FOREIGN KEY (studentId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activityLog (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  event TEXT,
  type VARCHAR(32),
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS criteria (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  section VARCHAR(64) NOT NULL,
  items JSON NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_criteria_section (section)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  userId INT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  type ENUM('info','success','warning','error') DEFAULT 'info',
  isRead TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notifications_user (userId),
  CONSTRAINT fk_notification_user FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS self_found_internships (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id INT UNSIGNED NOT NULL,
  student_name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  company_website VARCHAR(512),
  supervisor_name VARCHAR(255),
  supervisor_email VARCHAR(255),
  start_date DATE,
  end_date DATE,
  stipend VARCHAR(128),
  work_description TEXT,
  offer_letter_doc LONGTEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME,
  PRIMARY KEY (id),
  KEY idx_self_found_student (student_id),
  KEY idx_self_found_status (status),
  CONSTRAINT fk_self_found_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS student_free_time (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id INT UNSIGNED NOT NULL,
  day VARCHAR(20) NOT NULL,
  start_time VARCHAR(10) NOT NULL,
  end_time VARCHAR(10) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_free_time_student (student_id),
  CONSTRAINT fk_free_time_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO criteria (section, items) VALUES
  ('studentEligibility', JSON_ARRAY(
    JSON_OBJECT('id', 1, 'text', 'Minimum 60 credit hours completed'),
    JSON_OBJECT('id', 2, 'text', 'Minimum CGPA of 2.0'),
    JSON_OBJECT('id', 3, 'text', 'Must be currently enrolled'),
    JSON_OBJECT('id', 4, 'text', 'Must have elective course for substitution')
  )),
  ('companyRequirements', JSON_ARRAY(
    JSON_OBJECT('id', 1, 'text', 'Registered with P@SHA, PSEB, or SECP'),
    JSON_OBJECT('id', 2, 'text', 'CMMI Level 2+ or ISO Certification'),
    JSON_OBJECT('id', 3, 'text', 'Minimum 3 years operational'),
    JSON_OBJECT('id', 4, 'text', 'Must be IT/Software company')
  )),
  ('internshipRequirements', JSON_ARRAY(
    JSON_OBJECT('id', 1, 'text', 'Minimum 8 weeks duration (full-time)'),
    JSON_OBJECT('id', 2, 'text', 'Minimum 16 weeks duration (part-time)'),
    JSON_OBJECT('id', 3, 'text', 'On-site only - no remote internships'),
    JSON_OBJECT('id', 4, 'text', 'Must provide offer letter')
  ))
ON DUPLICATE KEY UPDATE items = VALUES(items);
