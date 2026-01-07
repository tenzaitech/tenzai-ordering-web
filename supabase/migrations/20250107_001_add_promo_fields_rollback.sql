-- Rollback: Remove promotion fields from menu_items
-- Date: 2025-01-07
-- Stage: 2 - Promotions per menu item

ALTER TABLE menu_items
  DROP COLUMN IF EXISTS promo_price;

ALTER TABLE menu_items
  DROP COLUMN IF EXISTS promo_label;
