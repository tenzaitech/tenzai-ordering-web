-- Migration: Add category_option_groups table for category-level option groups
-- Date: 2025-01-07
-- Stage: 4 - Category-level option groups

-- Create join table for categories to have default option groups
CREATE TABLE IF NOT EXISTS category_option_groups (
  category_code TEXT NOT NULL REFERENCES categories(category_code) ON DELETE CASCADE,
  group_code TEXT NOT NULL REFERENCES option_groups(group_code) ON DELETE CASCADE,
  PRIMARY KEY (category_code, group_code)
);

-- Index for efficient group-based queries
CREATE INDEX IF NOT EXISTS idx_category_option_groups_group
  ON category_option_groups(group_code);

-- Comment for documentation
COMMENT ON TABLE category_option_groups IS 'Join table for default option groups inherited by all items in a category.';
