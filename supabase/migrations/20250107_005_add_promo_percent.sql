-- Add promo_percent column to menu_items
-- This allows manual entry of discount percentage instead of auto-calculating from prices
-- Nullable: if NULL, no percent badge shown; if set, shows the specified percent

ALTER TABLE menu_items
ADD COLUMN IF NOT EXISTS promo_percent INTEGER NULL;

-- Add check constraint: promo_percent must be 0-100 or NULL
ALTER TABLE menu_items
ADD CONSTRAINT check_promo_percent_range
CHECK (promo_percent IS NULL OR (promo_percent >= 0 AND promo_percent <= 100));

COMMENT ON COLUMN menu_items.promo_percent IS 'Manual discount percentage (0-100). If NULL, no percent badge shown.';
