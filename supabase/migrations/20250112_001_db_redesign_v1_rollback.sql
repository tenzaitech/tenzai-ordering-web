-- Rollback: db-redesign-v1
-- WARNING: Run this only if you need to revert the RLS hardening
-- This will restore anon access to orders/order_items tables

-- ============================================================================
-- SECTION C ROLLBACK: RESTORE ANON ACCESS
-- ============================================================================

-- Drop restrictive policies
DROP POLICY IF EXISTS "Deny all for non-service-role" ON orders;
DROP POLICY IF EXISTS "Deny all for non-service-role" ON order_items;

-- Restore permissive policies for orders (read/write for anon)
CREATE POLICY "Public read access"
ON orders FOR SELECT
USING (true);

CREATE POLICY "Public insert access"
ON orders FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public update access"
ON orders FOR UPDATE
USING (true)
WITH CHECK (true);

-- Restore permissive policies for order_items (read/write for anon)
CREATE POLICY "Public read access"
ON order_items FOR SELECT
USING (true);

CREATE POLICY "Public insert access"
ON order_items FOR INSERT
WITH CHECK (true);

CREATE POLICY "Public update access"
ON order_items FOR UPDATE
USING (true)
WITH CHECK (true);

-- ============================================================================
-- SECTION B ROLLBACK: DROP INDEXES (optional, indexes are harmless to keep)
-- ============================================================================

-- DROP INDEX IF EXISTS idx_orders_customer_line_user_id;
-- DROP INDEX IF EXISTS idx_orders_status;
-- DROP INDEX IF EXISTS idx_order_items_order_id;
-- DROP INDEX IF EXISTS idx_orders_customer_status;

-- ============================================================================
-- SECTION A ROLLBACK: DROP NEW COLUMNS (optional, columns are harmless to keep)
-- ============================================================================

-- ALTER TABLE orders DROP COLUMN IF EXISTS rejected_at_ts;
-- ALTER TABLE order_items DROP COLUMN IF EXISTS menu_code;

-- ============================================================================
-- NOTE: Section A and B rollbacks are commented out because:
-- - New columns don't break existing code
-- - Indexes don't break existing code
-- - Removing them may cause data loss (rejected_at_ts, menu_code values)
-- Only run these if you're sure you want to remove the columns
-- ============================================================================
