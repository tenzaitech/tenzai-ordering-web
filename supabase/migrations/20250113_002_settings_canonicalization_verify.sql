-- =============================================================================
-- TENZAI Settings Canonicalization VERIFICATION
-- Date: 2025-01-13
-- Purpose: Verify migration was successful
-- Run these queries manually in Supabase SQL Editor
-- =============================================================================

-- =============================================================================
-- CHECK 1: admin_settings RLS is enabled and deny-all
-- Expected: row_security_active = true
-- =============================================================================

SELECT
  'CHECK 1: admin_settings RLS enabled' AS check_name,
  relname AS table_name,
  relrowsecurity AS row_security_active
FROM pg_class
WHERE relname = 'admin_settings';

-- =============================================================================
-- CHECK 2: admin_settings has deny-all policy
-- Expected: 1 row with policyname = 'Deny all for non-service-role'
-- =============================================================================

SELECT
  'CHECK 2: admin_settings deny-all policy' AS check_name,
  policyname,
  cmd AS applies_to,
  qual AS using_clause,
  with_check
FROM pg_policies
WHERE tablename = 'admin_settings';

-- =============================================================================
-- CHECK 3: system_settings RLS is enabled
-- Expected: row_security_active = true
-- =============================================================================

SELECT
  'CHECK 3: system_settings RLS enabled' AS check_name,
  relname AS table_name,
  relrowsecurity AS row_security_active
FROM pg_class
WHERE relname = 'system_settings';

-- =============================================================================
-- CHECK 4: system_settings has correct policies
-- Expected: 4 policies (public read, deny insert/update/delete)
-- =============================================================================

SELECT
  'CHECK 4: system_settings policies' AS check_name,
  policyname,
  cmd AS applies_to
FROM pg_policies
WHERE tablename = 'system_settings'
ORDER BY policyname;

-- =============================================================================
-- CHECK 5: admin_settings has required columns
-- Expected: All columns present
-- =============================================================================

SELECT
  'CHECK 5: admin_settings columns' AS check_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'admin_settings'
ORDER BY ordinal_position;

-- =============================================================================
-- CHECK 6: system_settings has required columns
-- Expected: key (text), value (jsonb), updated_at (timestamp)
-- =============================================================================

SELECT
  'CHECK 6: system_settings columns' AS check_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'system_settings'
ORDER BY ordinal_position;

-- =============================================================================
-- CHECK 7: system_settings has default keys
-- Expected: 4 rows (order_accepting, category_order, hidden_categories, popular_menus)
-- =============================================================================

SELECT
  'CHECK 7: system_settings default keys' AS check_name,
  key,
  value,
  updated_at
FROM system_settings
ORDER BY key;

-- =============================================================================
-- CHECK 8: admin_settings row exists (if configured)
-- Expected: 0 or 1 row (depending on whether admin has set up)
-- =============================================================================

SELECT
  'CHECK 8: admin_settings row count' AS check_name,
  COUNT(*) AS row_count
FROM admin_settings;

-- =============================================================================
-- CHECK 9: Verify anon cannot read admin_settings
-- Run this with anon key (not service-role) to verify RLS blocks access
-- Expected: ERROR or 0 rows
-- =============================================================================

-- NOTE: This check should be run from client-side or with anon key
-- SELECT * FROM admin_settings; -- Should fail or return empty

SELECT
  'CHECK 9: MANUAL - Test anon access blocked' AS check_name,
  'Run SELECT * FROM admin_settings with anon key. Should return 0 rows or error.' AS instruction;

-- =============================================================================
-- CHECK 10: Verify anon CAN read system_settings
-- Run this with anon key to verify public read works
-- Expected: 4 rows
-- =============================================================================

-- NOTE: This check should be run from client-side or with anon key
-- SELECT * FROM system_settings; -- Should succeed

SELECT
  'CHECK 10: MANUAL - Test anon read works' AS check_name,
  'Run SELECT * FROM system_settings with anon key. Should return 4 rows.' AS instruction;

-- =============================================================================
-- CHECK 11: Table comments exist
-- Expected: Comments on both tables
-- =============================================================================

SELECT
  'CHECK 11: Table comments' AS check_name,
  c.relname AS table_name,
  d.description AS comment
FROM pg_class c
LEFT JOIN pg_description d ON c.oid = d.objoid AND d.objsubid = 0
WHERE c.relname IN ('admin_settings', 'system_settings')
AND c.relkind = 'r';

-- =============================================================================
-- SUMMARY QUERY: All checks in one view
-- =============================================================================

SELECT 'VERIFICATION COMPLETE' AS status,
  'Review each check above. All should pass for migration success.' AS notes;
