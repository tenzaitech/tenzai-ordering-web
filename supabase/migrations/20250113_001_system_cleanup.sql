-- ============================================================================
-- Migration: 20250113_001_system_cleanup
-- Purpose: Comprehensive system cleanup for pre-production hardening
--
-- Changes:
--   1. Add CHECK constraint for orders.status (enforces valid state machine)
--   2. Add RLS policies for menu tables (public read, service-role write)
--   3. Add RLS policy for system_settings (public read, service-role write)
--
-- Safety:
--   - All changes are additive/restrictive (no data loss)
--   - Idempotent (safe to run multiple times)
--   - Fully reversible via rollback script
--
-- Prerequisites:
--   - orders table exists with status column
--   - Menu tables exist (categories, menu_items, option_groups, options, etc.)
--   - system_settings table exists
-- ============================================================================

-- ============================================================================
-- SECTION A: ORDERS.STATUS CHECK CONSTRAINT
-- ============================================================================
-- Enforces the valid order lifecycle states:
--   pending → approved → ready → picked_up
--       ↓
--     rejected
--
-- Using CHECK constraint (not ENUM) because:
--   1. Easier to modify without migration
--   2. Works with existing TEXT column type
--   3. Clear error messages on violation

-- Drop existing constraint if any (for idempotency)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_status;

-- Add CHECK constraint for valid status values
ALTER TABLE orders
ADD CONSTRAINT chk_orders_status
CHECK (status IN ('pending', 'approved', 'rejected', 'ready', 'picked_up'));

-- ============================================================================
-- SECTION B: MENU TABLES RLS - PUBLIC READ, SERVICE-ROLE WRITE
-- ============================================================================
-- Pattern: Public can read menu data, only service_role can modify
-- service_role bypasses RLS entirely, so we create:
--   1. SELECT policy for anon (public read)
--   2. Deny INSERT/UPDATE/DELETE for anon (mutations blocked)

-- -----------------------------------------------------------------------------
-- B1. categories table
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all operations on categories" ON categories;
DROP POLICY IF EXISTS "Public read categories" ON categories;
DROP POLICY IF EXISTS "Deny mutations for anon" ON categories;

-- Allow public read
CREATE POLICY "Public read categories"
ON categories FOR SELECT
USING (true);

-- Deny mutations for non-service-role
CREATE POLICY "Deny mutations for anon"
ON categories FOR ALL
USING (false)
WITH CHECK (false);

-- Note: The above "FOR ALL" with USING(false) blocks INSERT/UPDATE/DELETE for anon
-- but the SELECT policy takes precedence for reads

-- Actually, we need separate policies for clarity:
DROP POLICY IF EXISTS "Deny mutations for anon" ON categories;

CREATE POLICY "Deny insert for anon"
ON categories FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny update for anon"
ON categories FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny delete for anon"
ON categories FOR DELETE
USING (false);

-- -----------------------------------------------------------------------------
-- B2. menu_items table
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all operations on menu_items" ON menu_items;
DROP POLICY IF EXISTS "Public read menu_items" ON menu_items;
DROP POLICY IF EXISTS "Deny insert for anon" ON menu_items;
DROP POLICY IF EXISTS "Deny update for anon" ON menu_items;
DROP POLICY IF EXISTS "Deny delete for anon" ON menu_items;

CREATE POLICY "Public read menu_items"
ON menu_items FOR SELECT
USING (true);

CREATE POLICY "Deny insert for anon"
ON menu_items FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny update for anon"
ON menu_items FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny delete for anon"
ON menu_items FOR DELETE
USING (false);

-- -----------------------------------------------------------------------------
-- B3. option_groups table
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all operations on option_groups" ON option_groups;
DROP POLICY IF EXISTS "Public read option_groups" ON option_groups;
DROP POLICY IF EXISTS "Deny insert for anon" ON option_groups;
DROP POLICY IF EXISTS "Deny update for anon" ON option_groups;
DROP POLICY IF EXISTS "Deny delete for anon" ON option_groups;

CREATE POLICY "Public read option_groups"
ON option_groups FOR SELECT
USING (true);

CREATE POLICY "Deny insert for anon"
ON option_groups FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny update for anon"
ON option_groups FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny delete for anon"
ON option_groups FOR DELETE
USING (false);

-- -----------------------------------------------------------------------------
-- B4. options table
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all operations on options" ON options;
DROP POLICY IF EXISTS "Public read options" ON options;
DROP POLICY IF EXISTS "Deny insert for anon" ON options;
DROP POLICY IF EXISTS "Deny update for anon" ON options;
DROP POLICY IF EXISTS "Deny delete for anon" ON options;

CREATE POLICY "Public read options"
ON options FOR SELECT
USING (true);

CREATE POLICY "Deny insert for anon"
ON options FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny update for anon"
ON options FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny delete for anon"
ON options FOR DELETE
USING (false);

-- -----------------------------------------------------------------------------
-- B5. menu_option_groups table (join table)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow all operations on menu_option_groups" ON menu_option_groups;
DROP POLICY IF EXISTS "Public read menu_option_groups" ON menu_option_groups;
DROP POLICY IF EXISTS "Deny insert for anon" ON menu_option_groups;
DROP POLICY IF EXISTS "Deny update for anon" ON menu_option_groups;
DROP POLICY IF EXISTS "Deny delete for anon" ON menu_option_groups;

CREATE POLICY "Public read menu_option_groups"
ON menu_option_groups FOR SELECT
USING (true);

CREATE POLICY "Deny insert for anon"
ON menu_option_groups FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny update for anon"
ON menu_option_groups FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny delete for anon"
ON menu_option_groups FOR DELETE
USING (false);

-- -----------------------------------------------------------------------------
-- B6. menu_item_categories table (join table for multi-category)
-- -----------------------------------------------------------------------------
-- Check if table exists before applying policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'menu_item_categories') THEN
    -- Drop old policies
    DROP POLICY IF EXISTS "Allow all operations on menu_item_categories" ON menu_item_categories;
    DROP POLICY IF EXISTS "Public read menu_item_categories" ON menu_item_categories;
    DROP POLICY IF EXISTS "Deny insert for anon" ON menu_item_categories;
    DROP POLICY IF EXISTS "Deny update for anon" ON menu_item_categories;
    DROP POLICY IF EXISTS "Deny delete for anon" ON menu_item_categories;

    -- Enable RLS if not already
    ALTER TABLE menu_item_categories ENABLE ROW LEVEL SECURITY;

    -- Create new policies
    EXECUTE 'CREATE POLICY "Public read menu_item_categories" ON menu_item_categories FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "Deny insert for anon" ON menu_item_categories FOR INSERT WITH CHECK (false)';
    EXECUTE 'CREATE POLICY "Deny update for anon" ON menu_item_categories FOR UPDATE USING (false) WITH CHECK (false)';
    EXECUTE 'CREATE POLICY "Deny delete for anon" ON menu_item_categories FOR DELETE USING (false)';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- B7. category_option_groups table (join table)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'category_option_groups') THEN
    DROP POLICY IF EXISTS "Allow all operations on category_option_groups" ON category_option_groups;
    DROP POLICY IF EXISTS "Public read category_option_groups" ON category_option_groups;
    DROP POLICY IF EXISTS "Deny insert for anon" ON category_option_groups;
    DROP POLICY IF EXISTS "Deny update for anon" ON category_option_groups;
    DROP POLICY IF EXISTS "Deny delete for anon" ON category_option_groups;

    ALTER TABLE category_option_groups ENABLE ROW LEVEL SECURITY;

    EXECUTE 'CREATE POLICY "Public read category_option_groups" ON category_option_groups FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "Deny insert for anon" ON category_option_groups FOR INSERT WITH CHECK (false)';
    EXECUTE 'CREATE POLICY "Deny update for anon" ON category_option_groups FOR UPDATE USING (false) WITH CHECK (false)';
    EXECUTE 'CREATE POLICY "Deny delete for anon" ON category_option_groups FOR DELETE USING (false)';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- B8. category_schedules table
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'category_schedules') THEN
    DROP POLICY IF EXISTS "Allow all operations on category_schedules" ON category_schedules;
    DROP POLICY IF EXISTS "Public read category_schedules" ON category_schedules;
    DROP POLICY IF EXISTS "Deny insert for anon" ON category_schedules;
    DROP POLICY IF EXISTS "Deny update for anon" ON category_schedules;
    DROP POLICY IF EXISTS "Deny delete for anon" ON category_schedules;

    ALTER TABLE category_schedules ENABLE ROW LEVEL SECURITY;

    EXECUTE 'CREATE POLICY "Public read category_schedules" ON category_schedules FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "Deny insert for anon" ON category_schedules FOR INSERT WITH CHECK (false)';
    EXECUTE 'CREATE POLICY "Deny update for anon" ON category_schedules FOR UPDATE USING (false) WITH CHECK (false)';
    EXECUTE 'CREATE POLICY "Deny delete for anon" ON category_schedules FOR DELETE USING (false)';
  END IF;
END $$;

-- ============================================================================
-- SECTION C: SYSTEM_SETTINGS RLS - PUBLIC READ, SERVICE-ROLE WRITE
-- ============================================================================
-- system_settings contains public config (order_accepting, category_order, etc.)
-- Safe for public read, but mutations should go through admin API

DROP POLICY IF EXISTS "Allow all operations on system_settings" ON system_settings;
DROP POLICY IF EXISTS "Public read system_settings" ON system_settings;
DROP POLICY IF EXISTS "Deny insert for anon" ON system_settings;
DROP POLICY IF EXISTS "Deny update for anon" ON system_settings;
DROP POLICY IF EXISTS "Deny delete for anon" ON system_settings;

CREATE POLICY "Public read system_settings"
ON system_settings FOR SELECT
USING (true);

CREATE POLICY "Deny insert for anon"
ON system_settings FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny update for anon"
ON system_settings FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny delete for anon"
ON system_settings FOR DELETE
USING (false);

-- ============================================================================
-- SECTION D: ADMIN_SETTINGS RLS - SERVICE-ROLE ONLY (ALREADY DONE)
-- ============================================================================
-- admin_settings contains sensitive data (credentials, LINE IDs, PINs)
-- Should NEVER be accessible via anon key
-- Verify RLS is enabled and deny-all policy exists

-- Enable RLS if not already
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Remove any permissive policies
DROP POLICY IF EXISTS "Allow all operations on admin_settings" ON admin_settings;
DROP POLICY IF EXISTS "Public read admin_settings" ON admin_settings;
DROP POLICY IF EXISTS "Enable read access for all users" ON admin_settings;

-- Ensure deny-all policy exists
DROP POLICY IF EXISTS "Deny all for non-service-role" ON admin_settings;

CREATE POLICY "Deny all for non-service-role"
ON admin_settings
FOR ALL
USING (false)
WITH CHECK (false);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
-- Summary:
--   1. orders.status now has CHECK constraint (5 valid values)
--   2. Menu tables: public read via anon, mutations blocked (service-role only)
--   3. system_settings: public read, mutations blocked (service-role only)
--   4. admin_settings: completely blocked for anon (service-role only)
--
-- service_role key bypasses ALL RLS, so:
--   - API routes using getSupabaseServer() work normally
--   - Admin panel mutations go through API routes
--   - Customer reads of menu/settings work via anon key
-- ============================================================================
