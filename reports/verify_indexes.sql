-- ============================================================
-- VERIFICATION: Orders Table Indexes
-- Generated: 2026-01-11
-- ============================================================

-- Query to verify all 3 expected indexes exist on orders table
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'orders'
  AND indexname IN (
    'idx_orders_customer_line_user_id',
    'idx_orders_status',
    'idx_orders_status_created_at'
  )
ORDER BY indexname;

-- Expected results (3 rows):
-- idx_orders_customer_line_user_id | CREATE INDEX ... ON orders(customer_line_user_id) WHERE ...
-- idx_orders_status                | CREATE INDEX ... ON orders(status)
-- idx_orders_status_created_at     | CREATE INDEX ... ON orders(status, created_at DESC)

-- Full index list on orders (for reference)
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'orders'
ORDER BY indexname;
