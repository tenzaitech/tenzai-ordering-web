-- Rollback: Remove menu_item_categories table
-- Date: 2025-01-07
-- Stage: 3 - Multi-category + per-category ordering

DROP INDEX IF EXISTS idx_menu_item_categories_category;
DROP TABLE IF EXISTS menu_item_categories;
