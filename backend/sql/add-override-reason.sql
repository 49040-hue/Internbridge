-- Migration: add override_reason to internships
-- Adds a nullable text column to store admin override reasons when approving posts

ALTER TABLE internships
  ADD COLUMN IF NOT EXISTS override_reason TEXT DEFAULT NULL;
