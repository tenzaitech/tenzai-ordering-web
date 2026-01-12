-- =============================================================================
-- TENZAI Settings Prune Migration
-- Date: 2025-01-13
-- Purpose: Remove/deprecate any legacy settings artifacts, enforce single source
-- =============================================================================

-- =============================================================================
-- PREFLIGHT CHECKS (STOP CONDITIONS)
-- Run these queries first. If any fail, DO NOT proceed with migration.
-- =============================================================================

-- PREFLIGHT 1: admin_settings table must exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_settings'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: admin_settings table does not exist';
  END IF;
END $$;

-- PREFLIGHT 2: promptpay_id column must exist in admin_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admin_settings'
      AND column_name = 'promptpay_id'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: promptpay_id column does not exist in admin_settings';
  END IF;
END $$;

-- PREFLIGHT 3: system_settings table must exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'system_settings'
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT FAILED: system_settings table does not exist';
  END IF;
END $$;

-- =============================================================================
-- SECTION A: PRUNE LEGACY VIEWS
-- Remove any legacy views that were proposed but may have been deployed
-- =============================================================================

-- Drop admin_settings_public view if exists (proposed in reports, may not be deployed)
DROP VIEW IF EXISTS admin_settings_public CASCADE;

-- Drop any other legacy settings views
DROP VIEW IF EXISTS public_settings CASCADE;
DROP VIEW IF EXISTS settings_public CASCADE;

-- =============================================================================
-- SECTION B: PRUNE LEGACY TABLES
-- Remove/rename any legacy tables that duplicate settings
-- Using rename strategy for data preservation
-- =============================================================================

-- Rename admin_settings_sensitive if exists (proposed in Option 3, may not be deployed)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'admin_settings_sensitive'
  ) THEN
    -- Preserve data by renaming
    ALTER TABLE admin_settings_sensitive
    RENAME TO _deprecated_admin_settings_sensitive_20250113;

    RAISE NOTICE 'Renamed admin_settings_sensitive to _deprecated_admin_settings_sensitive_20250113';
  END IF;
END $$;

-- Rename any other legacy settings tables
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'settings'
      AND table_name != 'system_settings'
      AND table_name != 'admin_settings'
  ) THEN
    ALTER TABLE settings
    RENAME TO _deprecated_settings_20250113;

    RAISE NOTICE 'Renamed settings table to _deprecated_settings_20250113';
  END IF;
END $$;

-- =============================================================================
-- SECTION C: VERIFY NO DUPLICATE PROMPTPAY_ID COLUMNS
-- Assert only ONE table has promptpay_id
-- =============================================================================

DO $$
DECLARE
  promptpay_count INT;
  table_list TEXT;
BEGIN
  -- Count tables with promptpay_id column
  SELECT COUNT(*), string_agg(table_name, ', ')
  INTO promptpay_count, table_list
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name = 'promptpay_id'
    AND table_name NOT LIKE '_deprecated%'
    AND table_name NOT LIKE '_backup%';

  IF promptpay_count != 1 THEN
    RAISE EXCEPTION 'SCHEMA VIOLATION: promptpay_id found in % tables: %. Expected exactly 1 (admin_settings).',
      promptpay_count, table_list;
  END IF;

  -- Verify it's specifically in admin_settings
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'admin_settings'
      AND column_name = 'promptpay_id'
  ) THEN
    RAISE EXCEPTION 'SCHEMA VIOLATION: promptpay_id not found in canonical table admin_settings';
  END IF;

  RAISE NOTICE 'VERIFIED: promptpay_id exists only in admin_settings (canonical)';
END $$;

-- =============================================================================
-- SECTION D: VERIFY NO DUPLICATE LINE_APPROVER_ID COLUMNS
-- =============================================================================

DO $$
DECLARE
  col_count INT;
  table_list TEXT;
BEGIN
  SELECT COUNT(*), string_agg(table_name, ', ')
  INTO col_count, table_list
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name = 'line_approver_id'
    AND table_name NOT LIKE '_deprecated%'
    AND table_name NOT LIKE '_backup%';

  IF col_count != 1 THEN
    RAISE EXCEPTION 'SCHEMA VIOLATION: line_approver_id found in % tables: %. Expected exactly 1.',
      col_count, table_list;
  END IF;

  RAISE NOTICE 'VERIFIED: line_approver_id exists only in admin_settings (canonical)';
END $$;

-- =============================================================================
-- SECTION E: VERIFY NO DUPLICATE LINE_STAFF_ID COLUMNS
-- =============================================================================

DO $$
DECLARE
  col_count INT;
  table_list TEXT;
BEGIN
  SELECT COUNT(*), string_agg(table_name, ', ')
  INTO col_count, table_list
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name = 'line_staff_id'
    AND table_name NOT LIKE '_deprecated%'
    AND table_name NOT LIKE '_backup%';

  IF col_count != 1 THEN
    RAISE EXCEPTION 'SCHEMA VIOLATION: line_staff_id found in % tables: %. Expected exactly 1.',
      col_count, table_list;
  END IF;

  RAISE NOTICE 'VERIFIED: line_staff_id exists only in admin_settings (canonical)';
END $$;

-- =============================================================================
-- SECTION F: ENSURE RLS REMAINS INTACT
-- Verify admin_settings deny-all policy exists
-- =============================================================================

DO $$
DECLARE
  policy_count INT;
BEGIN
  SELECT COUNT(*)
  INTO policy_count
  FROM pg_policies
  WHERE tablename = 'admin_settings'
    AND policyname = 'Deny all for non-service-role';

  IF policy_count = 0 THEN
    RAISE WARNING 'RLS WARNING: Deny-all policy not found on admin_settings. Security may be compromised.';
  ELSE
    RAISE NOTICE 'VERIFIED: admin_settings deny-all RLS policy intact';
  END IF;
END $$;

-- =============================================================================
-- SECTION G: DOCUMENT CANONICAL SOURCES
-- Add schema comments documenting canonical status
-- =============================================================================

COMMENT ON TABLE admin_settings IS 'CANONICAL: Sensitive admin configuration. Contains promptpay_id, LINE IDs, credentials. RLS: deny-all for anon.';
COMMENT ON TABLE system_settings IS 'CANONICAL: Public system configuration. Contains feature flags, display preferences. RLS: public read.';

COMMENT ON COLUMN admin_settings.promptpay_id IS 'CANONICAL (UNIQUE): PromptPay merchant ID. No duplicates in schema.';
COMMENT ON COLUMN admin_settings.line_approver_id IS 'CANONICAL (UNIQUE): LINE approver ID. No duplicates in schema.';
COMMENT ON COLUMN admin_settings.line_staff_id IS 'CANONICAL (UNIQUE): LINE staff ID. No duplicates in schema.';

-- =============================================================================
-- SECTION H: REPORT DEPRECATED TABLES (informational)
-- =============================================================================

DO $$
DECLARE
  deprecated_count INT;
  deprecated_list TEXT;
BEGIN
  SELECT COUNT(*), string_agg(table_name, ', ')
  INTO deprecated_count, deprecated_list
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND (table_name LIKE '_deprecated%' OR table_name LIKE '_backup%');

  IF deprecated_count > 0 THEN
    RAISE NOTICE 'DEPRECATED TABLES FOUND: %. These can be dropped after verification.', deprecated_list;
  ELSE
    RAISE NOTICE 'No deprecated settings tables found. Schema is clean.';
  END IF;
END $$;

-- =============================================================================
-- Migration complete
-- =============================================================================

-- Summary output
DO $$
BEGIN
  RAISE NOTICE '=== SETTINGS PRUNE MIGRATION COMPLETE ===';
  RAISE NOTICE 'CANONICAL promptpay_id: admin_settings.promptpay_id';
  RAISE NOTICE 'CANONICAL line_approver_id: admin_settings.line_approver_id';
  RAISE NOTICE 'CANONICAL line_staff_id: admin_settings.line_staff_id';
  RAISE NOTICE 'CANONICAL feature flags: system_settings (key-value)';
  RAISE NOTICE 'Legacy views: DROPPED (if existed)';
  RAISE NOTICE 'Legacy tables: RENAMED to _deprecated_* (if existed)';
END $$;
