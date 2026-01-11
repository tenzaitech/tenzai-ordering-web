-- ============================================================
-- ADD MISSING INDEXES (if verification shows they don't exist)
-- Generated: 2026-01-11
-- Safe to run multiple times (IF NOT EXISTS)
-- ============================================================

-- Index 1: Customer order lookups by LINE user ID
CREATE INDEX IF NOT EXISTS idx_orders_customer_line_user_id
  ON orders(customer_line_user_id)
  WHERE customer_line_user_id IS NOT NULL;

-- Index 2: Status-based filtering
CREATE INDEX IF NOT EXISTS idx_orders_status
  ON orders(status);

-- Index 3: Admin dashboard queries (status + date sorting)
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at
  ON orders(status, created_at DESC);

-- Verify after running
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'orders'
  AND indexname LIKE 'idx_orders_%';
