-- Migration: Add promotion fields to menu_items
-- Date: 2025-01-07
-- Stage: 2 - Promotions per menu item

-- Add promo_price (nullable) - promotional price in THB
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS promo_price INTEGER DEFAULT NULL;

-- Add promo_label (nullable) - badge text e.g. "ลด 20%"
ALTER TABLE menu_items
  ADD COLUMN IF NOT EXISTS promo_label TEXT DEFAULT NULL;

-- Comment for documentation
COMMENT ON COLUMN menu_items.promo_price IS 'Promotional price in THB. If set and < price, item is on promotion.';
COMMENT ON COLUMN menu_items.promo_label IS 'Promotional badge text displayed on menu cards.';
