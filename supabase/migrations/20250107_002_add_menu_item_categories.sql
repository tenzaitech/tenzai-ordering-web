-- Migration: Add menu_item_categories join table for multi-category support
-- Date: 2025-01-07
-- Stage: 3 - Multi-category + per-category ordering

-- Create join table for menu items to appear in multiple categories
CREATE TABLE IF NOT EXISTS menu_item_categories (
  menu_code TEXT NOT NULL REFERENCES menu_items(menu_code) ON DELETE CASCADE,
  category_code TEXT NOT NULL REFERENCES categories(category_code) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (menu_code, category_code)
);

-- Index for efficient category-based queries
CREATE INDEX IF NOT EXISTS idx_menu_item_categories_category
  ON menu_item_categories(category_code, sort_order);

-- Comment for documentation
COMMENT ON TABLE menu_item_categories IS 'Join table allowing menu items to appear in multiple categories with per-category sort order.';
COMMENT ON COLUMN menu_item_categories.sort_order IS 'Display order within this category. Lower values appear first.';

-- Migrate existing category assignments from menu_items.category_code
-- This preserves backward compatibility
INSERT INTO menu_item_categories (menu_code, category_code, sort_order)
SELECT menu_code, category_code, 0
FROM menu_items
WHERE category_code IS NOT NULL
ON CONFLICT (menu_code, category_code) DO NOTHING;
