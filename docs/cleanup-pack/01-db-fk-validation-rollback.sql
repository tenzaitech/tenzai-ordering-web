-- ============================================================================
-- FK VALIDATION ROLLBACK: fk_order_items_menu_code
-- ============================================================================
-- Use this if validation causes issues or needs to be reverted.
-- These are safe operations that don't lose data.
--
-- DO NOT RUN WITHOUT REVIEW. This is a preparation document.
-- ============================================================================

-- ============================================================================
-- ROLLBACK OPTION 1: Drop and Re-create as NOT VALID
-- ============================================================================
-- Use when: Validation failed and you need to revert to NOT VALID state
-- Effect: Removes enforcement entirely, then re-adds without validation

-- Step 1: Drop the constraint
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS fk_order_items_menu_code;

-- Step 2: Re-create as NOT VALID (enforces new data only)
ALTER TABLE order_items
ADD CONSTRAINT fk_order_items_menu_code
FOREIGN KEY (menu_code) REFERENCES menu_items(menu_code)
NOT VALID;

-- Verify constraint exists but is NOT validated
SELECT
  conname AS constraint_name,
  convalidated AS is_validated
FROM pg_constraint
WHERE conname = 'fk_order_items_menu_code';
-- Expected: is_validated = false


-- ============================================================================
-- ROLLBACK OPTION 2: Drop Constraint Entirely
-- ============================================================================
-- Use when: FK constraint is causing operational issues
-- Effect: No referential integrity enforcement at DB level

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS fk_order_items_menu_code;

-- Verify constraint is gone
SELECT COUNT(*) AS constraint_count
FROM pg_constraint
WHERE conname = 'fk_order_items_menu_code';
-- Expected: 0


-- ============================================================================
-- ROLLBACK OPTION 3: Undo Orphan Fixes
-- ============================================================================
-- If you used OPTION A (set menu_code to NULL) and need to restore

-- Cannot automatically restore NULL'd values.
-- If you need recovery, restore from backup or use menu_item_id:

UPDATE order_items
SET menu_code = menu_item_id
WHERE menu_code IS NULL
  AND menu_item_id IS NOT NULL;


-- If you used OPTION B (created placeholder menu_items), remove them:

-- WARNING: Only delete items that were created as placeholders
-- Identify by is_active = false AND price = 0 AND name starts with [ARCHIVED]
DELETE FROM menu_items
WHERE is_active = false
  AND price = 0
  AND name_th LIKE '[ARCHIVED]%';


-- ============================================================================
-- ROLLBACK VERIFICATION
-- ============================================================================

-- Check constraint state
SELECT
  tc.constraint_name,
  tc.table_name,
  c.convalidated AS is_validated
FROM information_schema.table_constraints AS tc
JOIN pg_constraint c ON c.conname = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'order_items';

-- Check for any orphaned rows (should show current state)
SELECT COUNT(*) AS orphaned_count
FROM order_items oi
WHERE oi.menu_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM menu_items mi
    WHERE mi.menu_code = oi.menu_code
  );


-- ============================================================================
-- NOTES
-- ============================================================================
-- 1. NOT VALID constraints still enforce NEW inserts/updates
-- 2. Dropping constraint removes ALL enforcement (new and old)
-- 3. These rollbacks do not affect application functionality if:
--    - App doesn't rely on DB-level FK enforcement
--    - App uses service_role (bypasses some checks anyway)
-- 4. Consider backup before any rollback operation
