-- Rollback: Remove category_schedules table
-- Date: 2025-01-07
-- Stage: 5 - Category schedules

DROP INDEX IF EXISTS idx_category_schedules_day;
DROP INDEX IF EXISTS idx_category_schedules_category;
DROP TABLE IF EXISTS category_schedules;
