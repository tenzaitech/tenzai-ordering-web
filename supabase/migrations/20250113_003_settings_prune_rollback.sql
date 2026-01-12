-- =============================================================================
-- TENZAI Settings Prune ROLLBACK
-- Date: 2025-01-13
-- Purpose: Restore renamed/dropped legacy settings objects if needed
-- =============================================================================

-- =============================================================================
-- SECTION A: RESTORE RENAMED TABLES
-- Only run if the deprecated tables exist from the prune migration
-- =============================================================================

-- Restore admin_settings_sensitive if it was renamed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = '_deprecated_admin_settings_sensitive_20250113'
  ) THEN
    ALTER TABLE _deprecated_admin_settings_sensitive_20250113
    RENAME TO admin_settings_sensitive;

    RAISE NOTICE 'Restored admin_settings_sensitive from _deprecated_admin_settings_sensitive_20250113';
  ELSE
    RAISE NOTICE 'No _deprecated_admin_settings_sensitive_20250113 found. Skipping.';
  END IF;
END $$;

-- Restore settings table if it was renamed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = '_deprecated_settings_20250113'
  ) THEN
    ALTER TABLE _deprecated_settings_20250113
    RENAME TO settings;

    RAISE NOTICE 'Restored settings from _deprecated_settings_20250113';
  ELSE
    RAISE NOTICE 'No _deprecated_settings_20250113 found. Skipping.';
  END IF;
END $$;

-- =============================================================================
-- SECTION B: RECREATE DROPPED VIEWS (if needed)
-- WARNING: Only use if your application depends on these views
-- =============================================================================

-- NOTE: admin_settings_public view was proposed but likely never deployed.
-- Uncomment below ONLY if your application actually used this view.

-- CREATE OR REPLACE VIEW admin_settings_public AS
-- SELECT
--   id,
--   promptpay_id,
--   line_approver_id,
--   line_staff_id,
--   pin_version,
--   created_at,
--   updated_at
-- FROM admin_settings;
--
-- GRANT SELECT ON admin_settings_public TO anon;
--
-- RAISE NOTICE 'Recreated admin_settings_public view';

-- =============================================================================
-- SECTION C: REMOVE DOCUMENTATION COMMENTS (optional)
-- =============================================================================

-- Only removes the "CANONICAL (UNIQUE)" prefix from comments
-- This does NOT affect functionality

-- COMMENT ON TABLE admin_settings IS 'Sensitive admin configuration. Contains promptpay_id, LINE IDs, credentials.';
-- COMMENT ON TABLE system_settings IS 'Public system configuration. Contains feature flags, display preferences.';
-- COMMENT ON COLUMN admin_settings.promptpay_id IS 'PromptPay merchant ID';
-- COMMENT ON COLUMN admin_settings.line_approver_id IS 'LINE approver ID';
-- COMMENT ON COLUMN admin_settings.line_staff_id IS 'LINE staff ID';

-- =============================================================================
-- IMPORTANT NOTES
-- =============================================================================

-- 1. The prune migration did NOT remove data, only renamed tables.
--    All data is preserved in _deprecated_* tables.

-- 2. RLS policies are NOT affected by this rollback.
--    admin_settings deny-all policy remains in place.

-- 3. If you need to restore a dropped view that wasn't backed up,
--    you'll need to recreate it from scratch using the original SQL.

-- 4. After rollback, verify your application works correctly with:
--    - /api/public/promptpay
--    - /api/admin/settings (GET and POST)
--    - /api/admin/settings/test-message

-- =============================================================================
-- Rollback complete
-- =============================================================================

DO $$
BEGIN
  RAISE NOTICE '=== SETTINGS PRUNE ROLLBACK COMPLETE ===';
  RAISE NOTICE 'Renamed tables restored (if existed)';
  RAISE NOTICE 'Dropped views NOT restored (uncomment SQL if needed)';
  RAISE NOTICE 'RLS policies unchanged';
END $$;
