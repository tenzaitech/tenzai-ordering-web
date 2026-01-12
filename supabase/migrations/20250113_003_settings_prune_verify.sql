-- =============================================================================
-- TENZAI Settings Prune VERIFICATION
-- Date: 2025-01-13
-- Purpose: Verify migration was successful and schema is clean
-- Run these queries manually in Supabase SQL Editor
-- =============================================================================

-- =============================================================================
-- CHECK 1: List all tables/columns containing 'promptpay'
-- Expected: ONLY admin_settings.promptpay_id
-- =============================================================================

SELECT
  'CHECK 1: promptpay columns' AS check_name,
  table_name,
  column_name,
  data_type,
  CASE
    WHEN table_name = 'admin_settings' AND column_name = 'promptpay_id'
    THEN 'CANONICAL'
    WHEN table_name LIKE '_deprecated%' OR table_name LIKE '_backup%'
    THEN 'DEPRECATED'
    ELSE 'UNEXPECTED - INVESTIGATE'
  END AS status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name LIKE '%promptpay%'
ORDER BY table_name;

-- =============================================================================
-- CHECK 2: List all tables/columns containing 'line_approver' or 'line_staff'
-- Expected: ONLY admin_settings.line_approver_id, admin_settings.line_staff_id
-- =============================================================================

SELECT
  'CHECK 2: LINE ID columns' AS check_name,
  table_name,
  column_name,
  data_type,
  CASE
    WHEN table_name = 'admin_settings'
    THEN 'CANONICAL'
    WHEN table_name LIKE '_deprecated%' OR table_name LIKE '_backup%'
    THEN 'DEPRECATED'
    ELSE 'UNEXPECTED - INVESTIGATE'
  END AS status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (column_name LIKE '%line_approver%' OR column_name LIKE '%line_staff%')
ORDER BY table_name;

-- =============================================================================
-- CHECK 3: List all settings-related tables
-- Expected: admin_settings, system_settings (plus any _deprecated_*)
-- =============================================================================

SELECT
  'CHECK 3: Settings tables' AS check_name,
  table_name,
  CASE
    WHEN table_name IN ('admin_settings', 'system_settings')
    THEN 'CANONICAL'
    WHEN table_name LIKE '_deprecated%' OR table_name LIKE '_backup%'
    THEN 'DEPRECATED (can be dropped later)'
    WHEN table_name LIKE '%setting%'
    THEN 'UNEXPECTED - INVESTIGATE'
    ELSE 'OTHER'
  END AS status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%setting%'
ORDER BY table_name;

-- =============================================================================
-- CHECK 4: List all views that might expose settings
-- Expected: NONE (admin_settings_public should be dropped)
-- =============================================================================

SELECT
  'CHECK 4: Settings views' AS check_name,
  table_name AS view_name,
  CASE
    WHEN table_name = 'admin_settings_public'
    THEN 'LEGACY - SHOULD NOT EXIST'
    ELSE 'OTHER'
  END AS status
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name LIKE '%setting%';

-- If no rows returned, that's good (no settings views exist)

-- =============================================================================
-- CHECK 5: Verify admin_settings has canonical row
-- Expected: 1 row with promptpay_id populated (or empty if not configured)
-- =============================================================================

SELECT
  'CHECK 5: admin_settings data' AS check_name,
  id,
  CASE WHEN promptpay_id IS NOT NULL AND promptpay_id != '' THEN 'configured' ELSE 'empty' END AS promptpay_status,
  CASE WHEN line_approver_id IS NOT NULL AND line_approver_id != '' THEN 'configured' ELSE 'empty' END AS approver_status,
  CASE WHEN line_staff_id IS NOT NULL AND line_staff_id != '' THEN 'configured' ELSE 'empty' END AS staff_status
FROM admin_settings
LIMIT 1;

-- =============================================================================
-- CHECK 6: Verify system_settings has canonical keys
-- Expected: order_accepting, category_order, hidden_categories, popular_menus
-- =============================================================================

SELECT
  'CHECK 6: system_settings keys' AS check_name,
  key,
  CASE
    WHEN key IN ('order_accepting', 'category_order', 'hidden_categories', 'popular_menus')
    THEN 'CANONICAL'
    ELSE 'CUSTOM'
  END AS status,
  updated_at
FROM system_settings
ORDER BY key;

-- =============================================================================
-- CHECK 7: Verify RLS on admin_settings (deny-all)
-- Expected: 1 policy "Deny all for non-service-role"
-- =============================================================================

SELECT
  'CHECK 7: admin_settings RLS' AS check_name,
  policyname,
  cmd AS applies_to,
  CASE
    WHEN policyname = 'Deny all for non-service-role'
    THEN 'CORRECT - Deny all'
    ELSE 'INVESTIGATE'
  END AS status
FROM pg_policies
WHERE tablename = 'admin_settings';

-- =============================================================================
-- CHECK 8: Verify RLS on system_settings (public read)
-- Expected: 4 policies (public read, deny insert/update/delete)
-- =============================================================================

SELECT
  'CHECK 8: system_settings RLS' AS check_name,
  policyname,
  cmd AS applies_to
FROM pg_policies
WHERE tablename = 'system_settings'
ORDER BY policyname;

-- =============================================================================
-- CHECK 9: List deprecated tables for cleanup review
-- Expected: May be empty, or contain _deprecated_* tables
-- =============================================================================

SELECT
  'CHECK 9: Deprecated tables' AS check_name,
  table_name,
  'Can be dropped after verification' AS note
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (table_name LIKE '_deprecated%' OR table_name LIKE '_backup%')
ORDER BY table_name;

-- =============================================================================
-- CHECK 10: Table comments verify canonical status
-- Expected: Comments contain "CANONICAL"
-- =============================================================================

SELECT
  'CHECK 10: Table comments' AS check_name,
  c.relname AS table_name,
  COALESCE(d.description, '(no comment)') AS comment,
  CASE
    WHEN d.description LIKE '%CANONICAL%' THEN 'documented'
    ELSE 'not documented'
  END AS canonical_status
FROM pg_class c
LEFT JOIN pg_description d ON c.oid = d.objoid AND d.objsubid = 0
WHERE c.relname IN ('admin_settings', 'system_settings')
  AND c.relkind = 'r';

-- =============================================================================
-- SUMMARY
-- =============================================================================

SELECT '=== VERIFICATION COMPLETE ===' AS summary,
  'Review each check above. All should show expected values.' AS notes;

-- Expected results summary:
-- CHECK 1: Only admin_settings.promptpay_id (CANONICAL)
-- CHECK 2: Only admin_settings LINE columns (CANONICAL)
-- CHECK 3: admin_settings + system_settings (CANONICAL)
-- CHECK 4: No views (empty result is good)
-- CHECK 5: 1 row with settings data
-- CHECK 6: 4 canonical keys
-- CHECK 7: Deny-all policy present
-- CHECK 8: 4 RLS policies
-- CHECK 9: May have deprecated tables (safe to drop later)
-- CHECK 10: Comments contain CANONICAL
