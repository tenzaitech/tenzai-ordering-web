-- Post-SQL Verification Queries
-- Generated: 2026-01-10T20:47:51.829Z
-- Run these in Supabase SQL Editor to verify changes

-- List all policies on target tables
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('admin_settings', 'orders', 'order_items', 'system_settings')
ORDER BY tablename, policyname;

-- Check for old permissive policies
SELECT policyname, tablename
FROM pg_policies
WHERE policyname LIKE 'Allow all operations on %'
  AND tablename IN ('admin_settings', 'orders', 'order_items', 'system_settings');

-- Verify RLS enabled on tables
SELECT relname AS table_name, relrowsecurity AS rls_enabled, relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relname IN ('admin_settings', 'orders', 'order_items', 'system_settings')
  AND relkind = 'r';

-- Verify indexes on orders table
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'orders'
  AND indexname IN (
    'idx_orders_customer_line_user_id',
    'idx_orders_status',
    'idx_orders_status_created_at'
  );

