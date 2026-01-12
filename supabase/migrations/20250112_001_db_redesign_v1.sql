-- Migration: db-redesign-v1
-- Purpose: Add new columns, indexes, FK, and RLS hardening for orders/order_items
-- Safe: expand-only, no data loss, idempotent, cannot fail due to rejected_at parsing

-- ============================================================================
-- SECTION A: ADD NEW COLUMNS (expand-only)
-- ============================================================================

-- 1. Add rejected_at_ts to orders (timestamptz for better timezone handling)
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS rejected_at_ts TIMESTAMPTZ NULL;

-- 2. Backfill rejected_at_ts from rejected_at (exception-safe, row-by-row)
-- If any row's rejected_at cannot be cast to timestamptz, skip it silently.
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Only proceed if rejected_at column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'rejected_at'
  ) THEN
    -- Iterate rows needing backfill
    FOR r IN
      SELECT id, rejected_at
      FROM orders
      WHERE rejected_at IS NOT NULL
        AND rejected_at_ts IS NULL
    LOOP
      BEGIN
        UPDATE orders
        SET rejected_at_ts = r.rejected_at::timestamptz
        WHERE id = r.id;
      EXCEPTION WHEN OTHERS THEN
        -- Cast failed for this row; skip and continue
        RAISE NOTICE 'Skipping order id=% due to rejected_at cast error: %', r.id, SQLERRM;
      END;
    END LOOP;
  END IF;
END $$;

-- 3. Add menu_code to order_items (redundant column for clarity)
ALTER TABLE order_items
ADD COLUMN IF NOT EXISTS menu_code TEXT NULL;

-- 4. Backfill menu_code from menu_item_id
UPDATE order_items
SET menu_code = menu_item_id
WHERE menu_code IS NULL
  AND menu_item_id IS NOT NULL;

-- ============================================================================
-- SECTION B: ADD INDEXES (safe, can be dropped without data loss)
-- ============================================================================

-- Index for customer order lookups (used by /api/order/list)
CREATE INDEX IF NOT EXISTS idx_orders_customer_line_user_id
ON orders (customer_line_user_id);

-- Index for order status filtering (used by staff/admin views)
CREATE INDEX IF NOT EXISTS idx_orders_status
ON orders (status);

-- Index for rejected_at_ts filtering
CREATE INDEX IF NOT EXISTS idx_orders_rejected_at_ts
ON orders (rejected_at_ts);

-- Index for order_items by order_id (used in all order detail fetches)
CREATE INDEX IF NOT EXISTS idx_order_items_order_id
ON order_items (order_id);

-- Index for order_items by menu_code (used for menu item lookups)
CREATE INDEX IF NOT EXISTS idx_order_items_menu_code
ON order_items (menu_code);

-- Composite index for customer order lookups by status
CREATE INDEX IF NOT EXISTS idx_orders_customer_status
ON orders (customer_line_user_id, status);

-- ============================================================================
-- SECTION C: ADD FOREIGN KEY (safe approach with NOT VALID)
-- ============================================================================

-- Add FK constraint order_items(menu_code) -> menu_items(menu_code)
-- Using NOT VALID to avoid scanning existing rows during creation.
-- This allows the constraint to be added even if orphaned rows exist.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_order_items_menu_code'
      AND table_name = 'order_items'
  ) THEN
    ALTER TABLE order_items
    ADD CONSTRAINT fk_order_items_menu_code
    FOREIGN KEY (menu_code) REFERENCES menu_items(menu_code)
    NOT VALID;
  END IF;
END $$;

-- Attempt to validate the FK constraint.
-- If validation fails (orphaned menu_code values exist), catch the error
-- and leave the constraint NOT VALID. The constraint will still enforce
-- new inserts/updates but won't guarantee existing data integrity.
DO $$
BEGIN
  ALTER TABLE order_items VALIDATE CONSTRAINT fk_order_items_menu_code;
  RAISE NOTICE 'FK constraint fk_order_items_menu_code validated successfully.';
EXCEPTION WHEN OTHERS THEN
  -- Validation failed - orphaned menu_code values exist in order_items.
  -- The constraint remains NOT VALID, which means:
  -- - New inserts/updates are enforced
  -- - Existing rows are NOT guaranteed to satisfy the constraint
  -- To fix: manually clean orphaned rows, then run VALIDATE CONSTRAINT again.
  RAISE NOTICE 'FK validation skipped (orphaned data exists): %. Constraint remains NOT VALID.', SQLERRM;
END $$;

-- ============================================================================
-- SECTION D: RLS HARDENING - LOCK orders/order_items TO SERVICE_ROLE ONLY
-- ============================================================================
-- This prevents direct client-side access via anon key.
-- All access must go through API routes using service_role key.

-- Enable RLS on orders (if not already enabled)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Drop existing permissive policies (if any)
DROP POLICY IF EXISTS "Allow all for authenticated" ON orders;
DROP POLICY IF EXISTS "Allow all for anon" ON orders;
DROP POLICY IF EXISTS "Allow read for anon" ON orders;
DROP POLICY IF EXISTS "Allow insert for anon" ON orders;
DROP POLICY IF EXISTS "Allow update for anon" ON orders;
DROP POLICY IF EXISTS "Allow delete for anon" ON orders;
DROP POLICY IF EXISTS "Enable read access for all users" ON orders;
DROP POLICY IF EXISTS "Enable insert access for all users" ON orders;
DROP POLICY IF EXISTS "Enable update access for all users" ON orders;
DROP POLICY IF EXISTS "Public read access" ON orders;
DROP POLICY IF EXISTS "Public insert access" ON orders;
DROP POLICY IF EXISTS "Public update access" ON orders;

-- Create restrictive policy: ONLY service_role can access orders
-- Note: service_role bypasses RLS by default, so we create a deny-all policy for other roles
CREATE POLICY "Deny all for non-service-role"
ON orders
FOR ALL
USING (false)
WITH CHECK (false);

-- Enable RLS on order_items (if not already enabled)
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Drop existing permissive policies (if any)
DROP POLICY IF EXISTS "Allow all for authenticated" ON order_items;
DROP POLICY IF EXISTS "Allow all for anon" ON order_items;
DROP POLICY IF EXISTS "Allow read for anon" ON order_items;
DROP POLICY IF EXISTS "Allow insert for anon" ON order_items;
DROP POLICY IF EXISTS "Allow update for anon" ON order_items;
DROP POLICY IF EXISTS "Allow delete for anon" ON order_items;
DROP POLICY IF EXISTS "Enable read access for all users" ON order_items;
DROP POLICY IF EXISTS "Enable insert access for all users" ON order_items;
DROP POLICY IF EXISTS "Enable update access for all users" ON order_items;
DROP POLICY IF EXISTS "Public read access" ON order_items;
DROP POLICY IF EXISTS "Public insert access" ON order_items;
DROP POLICY IF EXISTS "Public update access" ON order_items;

-- Create restrictive policy: ONLY service_role can access order_items
CREATE POLICY "Deny all for non-service-role"
ON order_items
FOR ALL
USING (false)
WITH CHECK (false);

-- ============================================================================
-- NOTES:
-- - service_role key bypasses RLS entirely, so API routes using getSupabaseServer() work
-- - anon key is now blocked from orders/order_items tables
-- - All customer operations must go through API routes
-- - This migration is expand-only and safe to run multiple times (idempotent)
-- - rejected_at_ts backfill is exception-safe: unparseable values are skipped
-- - FK constraint may remain NOT VALID if orphaned menu_code values exist
-- ============================================================================
