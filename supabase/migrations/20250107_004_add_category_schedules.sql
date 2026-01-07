-- Migration: Add category_schedules table for time-based category visibility
-- Date: 2025-01-07
-- Stage: 5 - Category schedules

-- Create table for category time windows
CREATE TABLE IF NOT EXISTS category_schedules (
  id SERIAL PRIMARY KEY,
  category_code TEXT NOT NULL REFERENCES categories(category_code) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),  -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  CONSTRAINT valid_time_range CHECK (start_time < end_time),
  UNIQUE (category_code, day_of_week, start_time)  -- Prevent duplicate overlapping slots
);

-- Index for efficient category-based queries
CREATE INDEX IF NOT EXISTS idx_category_schedules_category
  ON category_schedules(category_code);

-- Index for efficient time-based queries
CREATE INDEX IF NOT EXISTS idx_category_schedules_day
  ON category_schedules(day_of_week, start_time, end_time);

-- Comments for documentation
COMMENT ON TABLE category_schedules IS 'Time windows when a category is visible to customers. Empty = always visible.';
COMMENT ON COLUMN category_schedules.day_of_week IS '0=Sunday, 1=Monday, ..., 6=Saturday';
COMMENT ON COLUMN category_schedules.start_time IS 'Start time of visibility window (inclusive)';
COMMENT ON COLUMN category_schedules.end_time IS 'End time of visibility window (exclusive)';
