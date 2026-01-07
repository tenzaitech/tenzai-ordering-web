-- Rollback: Remove category_option_groups table
-- Date: 2025-01-07
-- Stage: 4 - Category-level option groups

DROP INDEX IF EXISTS idx_category_option_groups_group;
DROP TABLE IF EXISTS category_option_groups;
