-- Create table for self-found internships
CREATE TABLE IF NOT EXISTS self_found_internships (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  student_name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255) NOT NULL,
  company_website VARCHAR(512),
  supervisor_name VARCHAR(255),
  supervisor_email VARCHAR(255),
  start_date DATE,
  end_date DATE,
  stipend VARCHAR(128),
  work_description TEXT,
  offer_letter_doc VARCHAR(512),
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  INDEX (student_id),
  INDEX (status)
);
