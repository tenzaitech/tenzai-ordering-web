-- ============================================================================
-- Verification: 20250113_001_system_cleanup
-- Purpose: Verify that the migration was applied correctly
--
-- Run these queries after migration to confirm success.
-- All queries should return expected results as noted in comments.
-- ============================================================================

-- ============================================================================
-- V1: VERIFY orders.status CHECK CONSTRAINT EXISTS
-- ============================================================================
-- Expected: 1 row with constraint_name = 'chk_orders_status'
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'chk_orders_status';

-- ============================================================================
-- V2: VERIFY orders.status VALUES ARE VALID
-- ============================================================================
-- Expected: 0 rows (no orders with invalid status)
-- If any rows returned, those orders have invalid status values
SELECT id, order_number, status
FROM orders
WHERE status NOT IN ('pending', 'approved', 'rejected', 'ready', 'picked_up');

-- ============================================================================
-- V3: VERIFY RLS IS ENABLED ON ALL TABLES
-- ============================================================================
-- Expected: All tables should show rowsecurity = true
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'orders', 'order_items',
    'admin_settings', 'system_settings',
    'categories', 'menu_items', 'option_groups', 'options',
    'menu_option_groups', 'menu_item_categories',
    'category_option_groups', 'category_schedules'
  )
ORDER BY tablename;

-- ============================================================================
-- V4: VERIFY RLS POLICIES FOR MENU TABLES
-- ============================================================================
-- Expected: Each menu table should have:
--   - "Public read ..." policy (SELECT)
--   - "Deny insert for anon" policy (INSERT)
--   - "Deny update for anon" policy (UPDATE)
--   - "Deny delete for anon" policy (DELETE)
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'categories', 'menu_items', 'option_groups', 'options',
    'menu_option_groups', 'menu_item_categories',
    'category_option_groups', 'category_schedules'
  )
ORDER BY tablename, cmd;

-- ============================================================================
-- V5: VERIFY SYSTEM_SETTINGS POLICIES
-- ============================================================================
-- Expected: Public read + deny mutations
SELECT policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'system_settings'
ORDER BY cmd;

-- ============================================================================
-- V6: VERIFY ADMIN_SETTINGS IS LOCKED
-- ============================================================================
-- Expected: "Deny all for non-service-role" policy
SELECT policyname, permissive, roles, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'admin_settings';

-- ============================================================================
-- V7: VERIFY ORDERS AND ORDER_ITEMS ARE LOCKED
-- ============================================================================
-- Expected: "Deny all for non-service-role" policy on both tables
SELECT tablename, policyname, permissive, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('orders', 'order_items')
ORDER BY tablename;

-- ============================================================================
-- V8: COUNT ORDERS BY STATUS (sanity check)
-- ============================================================================
-- Expected: Shows distribution of orders by status
-- All status values should be one of: pending, approved, rejected, ready, picked_up
SELECT status, COUNT(*) as count
FROM orders
GROUP BY status
ORDER BY count DESC;

-- ============================================================================
-- V9: TEST ANON ACCESS TO MENU ITEMS (should work - public read)
-- ============================================================================
-- Run this as anon user to verify read access works
-- Expected: Returns menu items (if any exist)
SELECT menu_code, name_th, price, is_active
FROM menu_items
LIMIT 5;

-- ============================================================================
-- V10: VERIFY NO PERMISSIVE "Allow all" POLICIES REMAIN
-- ============================================================================
-- Expected: 0 rows (no "Allow all" policies should exist on protected tables)
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE 'Allow all%'
  AND tablename NOT IN ('auth_rate_limits') -- Exclude rate limits table if it has permissive policy
ORDER BY tablename;

-- ============================================================================
-- SUMMARY CHECKLIST
-- ============================================================================
-- After running all queries, verify:
-- [ ] V1: chk_orders_status constraint exists
-- [ ] V2: No invalid order status values
-- [ ] V3: RLS enabled on all tables (rowsecurity = true)
-- [ ] V4: Menu tables have public read + deny mutations policies
-- [ ] V5: system_settings has public read + deny mutations policies
-- [ ] V6: admin_settings has deny-all policy
-- [ ] V7: orders/order_items have deny-all policies
-- [ ] V8: Order status distribution looks reasonable
-- [ ] V9: Menu items are readable via anon key
-- [ ] V10: No permissive "Allow all" policies on protected tables
-- ============================================================================
