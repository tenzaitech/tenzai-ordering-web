-- Rollback: Remove promo_percent column from menu_items

ALTER TABLE menu_items
DROP CONSTRAINT IF EXISTS check_promo_percent_range;

ALTER TABLE menu_items
DROP COLUMN IF EXISTS promo_percent;
