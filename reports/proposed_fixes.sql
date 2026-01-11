-- TENZAI Proposed Fixes (NOT YET APPLIED)
-- Generated: 2026-01-11
-- Review carefully before executing!

-- =============================================================
-- SECTION 1: RLS Policy Hardening (HIGH PRIORITY)
-- =============================================================

-- 1a. Restrict admin_settings to service_role only
-- This table contains sensitive data (staff_pin_hash)
DROP POLICY IF EXISTS "Allow all operations on admin_settings" ON admin_settings;

CREATE POLICY "Service role full access on admin_settings"
  ON admin_settings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Allow anon to read non-sensitive columns only
CREATE POLICY "Allow anon to read admin_settings display fields"
  ON admin_settings FOR SELECT
  USING (true);
-- Note: This still exposes all columns. Consider creating a VIEW for public fields.

-- 1b. Restrict orders to own customer only (for LIFF users)
-- Note: Requires customer_line_user_id to be set properly
DROP POLICY IF EXISTS "Allow all operations on orders" ON orders;

-- Service role has full access (for admin operations)
CREATE POLICY "Service role full access on orders"
  ON orders FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Anon can INSERT new orders
CREATE POLICY "Anon can create orders"
  ON orders FOR INSERT
  WITH CHECK (true);

-- Anon can SELECT/UPDATE their own orders
-- This requires implementing RLS with custom claims or using a different auth model
-- For now, keeping open but flagging for review
CREATE POLICY "Anon can read all orders (MVP)"
  ON orders FOR SELECT
  USING (true);

CREATE POLICY "Anon can update orders (MVP)"
  ON orders FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 1c. Same pattern for order_items
DROP POLICY IF EXISTS "Allow all operations on order_items" ON order_items;

CREATE POLICY "Service role full access on order_items"
  ON order_items FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Anon can create order_items"
  ON order_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anon can read order_items (MVP)"
  ON order_items FOR SELECT
  USING (true);

-- 1d. Restrict system_settings writes
DROP POLICY IF EXISTS "Allow all operations on system_settings" ON system_settings;

CREATE POLICY "Service role full access on system_settings"
  ON system_settings FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Anon can read system_settings"
  ON system_settings FOR SELECT
  USING (true);

-- =============================================================
-- SECTION 2: Storage Bucket Hardening
-- =============================================================

-- 2a. Add file size limit to menu-images bucket
-- Note: This requires Supabase dashboard or management API
-- SQL cannot directly modify bucket settings

-- Recommended: Set menu-images file_size_limit to 10485760 (10MB)
-- Via Dashboard: Storage > menu-images > Settings > File size limit

-- 2b. Add storage policies for object-level control (future)
-- Example: Restrict invoice downloads to signed URLs only
-- This is already handled by the bucket being private

-- =============================================================
-- SECTION 3: Schema Cleanup (LOW PRIORITY)
-- =============================================================

-- 3a. Drop legacy columns if no longer used
-- Verify no code references before executing!
-- ALTER TABLE orders DROP COLUMN IF EXISTS total_amount;
-- ALTER TABLE orders DROP COLUMN IF EXISTS subtotal_amount;
-- ALTER TABLE orders DROP COLUMN IF EXISTS vat_amount;

-- 3b. Add check constraint for invoice fields consistency
-- ALTER TABLE orders ADD CONSTRAINT check_invoice_fields
--   CHECK (
--     (invoice_requested = false) OR
--     (invoice_requested = true AND invoice_company_name IS NOT NULL AND invoice_tax_id IS NOT NULL AND invoice_address IS NOT NULL)
--   );

-- =============================================================
-- SECTION 4: Index Optimization (OPTIONAL)
-- =============================================================

-- 4a. Add index for customer-based order lookups
CREATE INDEX IF NOT EXISTS idx_orders_customer_line_user_id
  ON orders(customer_line_user_id)
  WHERE customer_line_user_id IS NOT NULL;

-- 4b. Add index for status-based order queries (staff/admin)
CREATE INDEX IF NOT EXISTS idx_orders_status
  ON orders(status);

-- 4c. Composite index for admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at
  ON orders(status, created_at DESC);

-- =============================================================
-- NOTES
-- =============================================================

-- 1. RLS policies above are MVP-level. For production hardening:
--    - Implement proper user authentication via Supabase Auth
--    - Use auth.uid() or custom claims to identify customers
--    - Remove "anon can read all" policies

-- 2. The current system uses server-side auth (ADMIN_API_KEY, STAFF_PIN)
--    which bypasses RLS via service_role key. This is acceptable for
--    admin/staff routes but customer routes should be hardened.

-- 3. Storage bucket policies should be reviewed when implementing
--    customer-specific invoice access (currently uses signed URLs).
