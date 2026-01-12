-- ============================================================================
-- Rollback: 20250113_001_system_cleanup
-- Purpose: Revert all changes from the system cleanup migration
--
-- WARNING: This restores permissive policies. Only use if migration causes issues.
-- ============================================================================

-- ============================================================================
-- SECTION A: REMOVE orders.status CHECK CONSTRAINT
-- ============================================================================
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_status;

-- ============================================================================
-- SECTION B: RESTORE PERMISSIVE POLICIES FOR MENU TABLES
-- ============================================================================

-- -----------------------------------------------------------------------------
-- B1. categories table
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read categories" ON categories;
DROP POLICY IF EXISTS "Deny insert for anon" ON categories;
DROP POLICY IF EXISTS "Deny update for anon" ON categories;
DROP POLICY IF EXISTS "Deny delete for anon" ON categories;

CREATE POLICY "Allow all operations on categories"
ON categories FOR ALL
USING (true)
WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- B2. menu_items table
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read menu_items" ON menu_items;
DROP POLICY IF EXISTS "Deny insert for anon" ON menu_items;
DROP POLICY IF EXISTS "Deny update for anon" ON menu_items;
DROP POLICY IF EXISTS "Deny delete for anon" ON menu_items;

CREATE POLICY "Allow all operations on menu_items"
ON menu_items FOR ALL
USING (true)
WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- B3. option_groups table
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read option_groups" ON option_groups;
DROP POLICY IF EXISTS "Deny insert for anon" ON option_groups;
DROP POLICY IF EXISTS "Deny update for anon" ON option_groups;
DROP POLICY IF EXISTS "Deny delete for anon" ON option_groups;

CREATE POLICY "Allow all operations on option_groups"
ON option_groups FOR ALL
USING (true)
WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- B4. options table
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read options" ON options;
DROP POLICY IF EXISTS "Deny insert for anon" ON options;
DROP POLICY IF EXISTS "Deny update for anon" ON options;
DROP POLICY IF EXISTS "Deny delete for anon" ON options;

CREATE POLICY "Allow all operations on options"
ON options FOR ALL
USING (true)
WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- B5. menu_option_groups table
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public read menu_option_groups" ON menu_option_groups;
DROP POLICY IF EXISTS "Deny insert for anon" ON menu_option_groups;
DROP POLICY IF EXISTS "Deny update for anon" ON menu_option_groups;
DROP POLICY IF EXISTS "Deny delete for anon" ON menu_option_groups;

CREATE POLICY "Allow all operations on menu_option_groups"
ON menu_option_groups FOR ALL
USING (true)
WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- B6. menu_item_categories table
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'menu_item_categories') THEN
    DROP POLICY IF EXISTS "Public read menu_item_categories" ON menu_item_categories;
    DROP POLICY IF EXISTS "Deny insert for anon" ON menu_item_categories;
    DROP POLICY IF EXISTS "Deny update for anon" ON menu_item_categories;
    DROP POLICY IF EXISTS "Deny delete for anon" ON menu_item_categories;

    EXECUTE 'CREATE POLICY "Allow all operations on menu_item_categories" ON menu_item_categories FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- B7. category_option_groups table
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'category_option_groups') THEN
    DROP POLICY IF EXISTS "Public read category_option_groups" ON category_option_groups;
    DROP POLICY IF EXISTS "Deny insert for anon" ON category_option_groups;
    DROP POLICY IF EXISTS "Deny update for anon" ON category_option_groups;
    DROP POLICY IF EXISTS "Deny delete for anon" ON category_option_groups;

    EXECUTE 'CREATE POLICY "Allow all operations on category_option_groups" ON category_option_groups FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- B8. category_schedules table
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'category_schedules') THEN
    DROP POLICY IF EXISTS "Public read category_schedules" ON category_schedules;
    DROP POLICY IF EXISTS "Deny insert for anon" ON category_schedules;
    DROP POLICY IF EXISTS "Deny update for anon" ON category_schedules;
    DROP POLICY IF EXISTS "Deny delete for anon" ON category_schedules;

    EXECUTE 'CREATE POLICY "Allow all operations on category_schedules" ON category_schedules FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ============================================================================
-- SECTION C: RESTORE PERMISSIVE POLICY FOR SYSTEM_SETTINGS
-- ============================================================================
DROP POLICY IF EXISTS "Public read system_settings" ON system_settings;
DROP POLICY IF EXISTS "Deny insert for anon" ON system_settings;
DROP POLICY IF EXISTS "Deny update for anon" ON system_settings;
DROP POLICY IF EXISTS "Deny delete for anon" ON system_settings;

CREATE POLICY "Allow all operations on system_settings"
ON system_settings FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================================================
-- SECTION D: ADMIN_SETTINGS - KEEP RESTRICTIVE (DO NOT RESTORE PERMISSIVE)
-- ============================================================================
-- IMPORTANT: Do NOT restore permissive policies for admin_settings
-- This table contains sensitive data and should remain locked to service_role

-- ============================================================================
-- END OF ROLLBACK
-- ============================================================================
-- After running this rollback:
--   - orders.status has no CHECK constraint
--   - Menu tables allow all operations via anon key
--   - system_settings allows all operations via anon key
--   - admin_settings remains locked (intentionally not reverted)
-- ============================================================================
