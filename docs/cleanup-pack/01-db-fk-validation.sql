-- ============================================================================
-- FK VALIDATION PACK: fk_order_items_menu_code
-- ============================================================================
-- Context: The FK constraint was added with NOT VALID, meaning:
--   - New inserts/updates ARE enforced
--   - Existing orphaned rows are NOT checked
-- This script provides safe steps to identify and resolve orphans.
--
-- DO NOT RUN WITHOUT REVIEW. This is a preparation document.
-- ============================================================================

-- ============================================================================
-- STEP 1: DETECT ORPHANED ROWS
-- ============================================================================
-- Find order_items rows where menu_code references a non-existent menu_items record

-- Query: Count orphaned rows
SELECT COUNT(*) AS orphaned_count
FROM order_items oi
WHERE oi.menu_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM menu_items mi
    WHERE mi.menu_code = oi.menu_code
  );

-- Query: List orphaned rows with details (for review)
SELECT
  oi.id AS order_item_id,
  oi.order_id,
  oi.menu_code AS orphaned_menu_code,
  oi.menu_item_id,
  oi.name_th,
  oi.name_en,
  oi.qty,
  oi.final_price,
  oi.created_at,
  o.order_number,
  o.status AS order_status,
  o.created_at AS order_created_at
FROM order_items oi
LEFT JOIN orders o ON o.id = oi.order_id
WHERE oi.menu_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM menu_items mi
    WHERE mi.menu_code = oi.menu_code
  )
ORDER BY oi.created_at DESC;

-- Query: Group orphans by menu_code to understand scope
SELECT
  oi.menu_code AS orphaned_menu_code,
  COUNT(*) AS occurrence_count,
  MIN(oi.created_at) AS first_occurrence,
  MAX(oi.created_at) AS last_occurrence
FROM order_items oi
WHERE oi.menu_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM menu_items mi
    WHERE mi.menu_code = oi.menu_code
  )
GROUP BY oi.menu_code
ORDER BY occurrence_count DESC;


-- ============================================================================
-- STEP 2: RESOLUTION OPTIONS (Non-Destructive)
-- ============================================================================
-- Choose ONE of the following strategies based on business requirements.

-- OPTION A: Set orphaned menu_code to NULL
-- Use when: Historical orders should remain but FK doesn't need to be valid
-- Effect: Keeps order_items intact, just clears the FK reference
-- Risk: LOW - preserves all data

UPDATE order_items
SET menu_code = NULL
WHERE menu_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM menu_items mi
    WHERE mi.menu_code = order_items.menu_code
  );


-- OPTION B: Create placeholder menu_items for orphaned codes
-- Use when: Want to maintain referential integrity with historical products
-- Effect: Creates inactive menu_items as tombstones
-- Risk: LOW - adds data, doesn't delete

-- First, identify unique orphaned menu_codes
WITH orphaned_codes AS (
  SELECT DISTINCT oi.menu_code, oi.name_th, oi.name_en
  FROM order_items oi
  WHERE oi.menu_code IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM menu_items mi
      WHERE mi.menu_code = oi.menu_code
    )
)
INSERT INTO menu_items (menu_code, name_th, name_en, price, is_active, created_at, updated_at)
SELECT
  menu_code,
  COALESCE(name_th, '[ARCHIVED] ' || menu_code),
  name_en,
  0,  -- Price unknown
  false,  -- Mark as inactive
  NOW(),
  NOW()
FROM orphaned_codes
ON CONFLICT (menu_code) DO NOTHING;


-- OPTION C: Copy menu_item_id to menu_code where different
-- Use when: menu_code was backfilled incorrectly
-- Check first if menu_item_id is valid

-- Check: Are there rows where menu_item_id IS valid but menu_code is not?
SELECT
  oi.id,
  oi.menu_item_id,
  oi.menu_code,
  EXISTS (SELECT 1 FROM menu_items WHERE menu_code = oi.menu_item_id) AS menu_item_id_valid,
  EXISTS (SELECT 1 FROM menu_items WHERE menu_code = oi.menu_code) AS menu_code_valid
FROM order_items oi
WHERE oi.menu_code IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM menu_items WHERE menu_code = oi.menu_code)
  AND oi.menu_item_id IS NOT NULL
LIMIT 20;

-- Fix: Update menu_code from valid menu_item_id
UPDATE order_items
SET menu_code = menu_item_id
WHERE menu_code IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM menu_items WHERE menu_code = order_items.menu_code)
  AND menu_item_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM menu_items WHERE menu_code = order_items.menu_item_id);


-- ============================================================================
-- STEP 3: VALIDATE CONSTRAINT
-- ============================================================================
-- Run ONLY after orphans are resolved

-- Verify no orphans remain
SELECT COUNT(*) AS remaining_orphans
FROM order_items oi
WHERE oi.menu_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM menu_items mi
    WHERE mi.menu_code = oi.menu_code
  );

-- If count = 0, proceed with validation
ALTER TABLE order_items VALIDATE CONSTRAINT fk_order_items_menu_code;

-- Verify constraint is now VALID
SELECT
  conname AS constraint_name,
  convalidated AS is_validated
FROM pg_constraint
WHERE conname = 'fk_order_items_menu_code';


-- ============================================================================
-- STEP 4: VERIFICATION QUERIES
-- ============================================================================

-- Confirm constraint exists and is validated
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  c.convalidated AS is_validated
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN pg_constraint c
  ON c.conname = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'order_items'
  AND tc.constraint_name = 'fk_order_items_menu_code';

-- Test constraint enforcement (should fail if constraint is active)
-- DO NOT RUN IN PRODUCTION - this is a test query
-- INSERT INTO order_items (order_id, menu_code, name_th, qty, base_price, final_price)
-- VALUES ('00000000-0000-0000-0000-000000000000', 'NONEXISTENT_CODE', 'Test', 1, 0, 0);
