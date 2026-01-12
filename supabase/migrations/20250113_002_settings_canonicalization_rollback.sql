-- =============================================================================
-- TENZAI Settings Canonicalization ROLLBACK
-- Date: 2025-01-13
-- Purpose: Revert settings canonicalization migration
-- WARNING: Only run if migration caused issues
-- =============================================================================

-- NOTE: This rollback does NOT:
-- 1. Remove deny-all policy on admin_settings (security must remain)
-- 2. Remove public-read policy on system_settings (required for app function)
-- 3. Drop added columns (data preservation)

-- This rollback DOES:
-- 1. Remove table comments (documentation only)
-- 2. Remove column comments (documentation only)

-- =============================================================================
-- SECTION A: Remove documentation comments (safe)
-- =============================================================================

COMMENT ON TABLE admin_settings IS NULL;
COMMENT ON TABLE system_settings IS NULL;

COMMENT ON COLUMN admin_settings.promptpay_id IS NULL;
COMMENT ON COLUMN admin_settings.line_approver_id IS NULL;
COMMENT ON COLUMN admin_settings.line_staff_id IS NULL;
COMMENT ON COLUMN admin_settings.staff_pin_hash IS NULL;
COMMENT ON COLUMN admin_settings.pin_version IS NULL;

-- Only remove if columns exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'staff_session_version'
  ) THEN
    COMMENT ON COLUMN admin_settings.staff_session_version IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'admin_session_version'
  ) THEN
    COMMENT ON COLUMN admin_settings.admin_session_version IS NULL;
  END IF;
END $$;

-- =============================================================================
-- SECTION B: DO NOT rollback RLS policies
-- =============================================================================

-- The following are intentionally NOT reverted for security:
-- - admin_settings deny-all policy
-- - system_settings public-read policy
-- - system_settings deny-write policies

-- If you need to restore permissive access for debugging:
-- 1. Do NOT run in production
-- 2. Manually create temporary policies
-- 3. Remove them immediately after debugging

-- =============================================================================
-- SECTION C: DO NOT remove default system_settings rows
-- =============================================================================

-- The following are intentionally NOT deleted:
-- - order_accepting
-- - category_order
-- - hidden_categories
-- - popular_menus

-- These are required for app function. Deleting them would break the UI.

-- =============================================================================
-- Rollback complete (minimal changes - security preserved)
-- =============================================================================
