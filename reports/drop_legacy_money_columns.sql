-- ============================================================
-- DROP LEGACY MONEY COLUMNS (OPTIONAL - DO NOT AUTO-APPLY)
-- Generated: 2026-01-11
-- ============================================================
--
-- These columns were replaced by *_dec (decimal) versions.
-- Codebase scan found ZERO references to these columns.
--
-- BEFORE RUNNING:
-- 1. Verify no external systems depend on these columns
-- 2. Take a database backup
-- 3. Test in staging first
--
-- COLUMNS TO DROP (if they exist):
-- - orders.total_amount (INTEGER, replaced by total_amount_dec)
-- - orders.subtotal_amount (INTEGER, replaced by subtotal_amount_dec)
-- - orders.vat_amount (INTEGER, replaced by vat_amount_dec)
-- ============================================================

-- Step 1: Check if columns exist before dropping
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name IN ('total_amount', 'subtotal_amount', 'vat_amount');

-- Step 2: Drop columns (ONLY if Step 1 returns rows)
-- UNCOMMENT THESE LINES ONLY AFTER VERIFICATION

-- ALTER TABLE orders DROP COLUMN IF EXISTS total_amount;
-- ALTER TABLE orders DROP COLUMN IF EXISTS subtotal_amount;
-- ALTER TABLE orders DROP COLUMN IF EXISTS vat_amount;

-- Step 3: Verify columns are gone
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name LIKE '%amount%'
ORDER BY column_name;

-- Expected remaining columns:
-- subtotal_amount_dec, vat_amount_dec, total_amount_dec (all numeric/decimal)
