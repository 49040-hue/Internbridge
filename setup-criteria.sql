-- setup-criteria.sql
-- Inserts default criteria sections used by the application

DELETE FROM criteria WHERE section IN ('studentEligibility','companyRequirements','internshipRequirements');

INSERT INTO criteria (section, items) VALUES
('studentEligibility', '[{"id":1,"text":"Minimum 60 credit hours completed"},{"id":2,"text":"Minimum CGPA of 2.0"},{"id":3,"text":"Must be currently enrolled"},{"id":4,"text":"Must have elective course for substitution"}]'),
('companyRequirements', '[{"id":1,"text":"Registered with P@SHA, PSEB, or SECP"},{"id":2,"text":"CMMI Level 2+ or ISO Certification"},{"id":3,"text":"Minimum 3 years operational"},{"id":4,"text":"Must be IT/Software company"}]'),
('internshipRequirements', '[{"id":1,"text":"Minimum 8 weeks duration (full-time)"},{"id":2,"text":"Minimum 16 weeks duration (part-time)"},{"id":3,"text":"On-site only — no remote internships"},{"id":4,"text":"Must provide offer letter"}]');
