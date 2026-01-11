-- Fix: admin_settings Exposure to Anon Key
-- Generated: 2026-01-10T20:47:51.829Z
--
-- PROBLEM: The "Allow anon to read admin_settings display fields" policy
-- allows anon to SELECT all columns, including staff_pin_hash.
--
-- This file provides 3 options. Choose ONE and apply manually.
-- DO NOT apply automatically - review first!

-- =============================================================
-- OPTION 1: Remove anon SELECT entirely (SIMPLEST)
-- =============================================================
-- Pros: Immediate fix, no schema changes
-- Cons: May break app if client reads promptpay_id directly
--
-- After applying, all admin_settings reads must use service_role key.

DROP POLICY IF EXISTS "Allow anon to read admin_settings display fields" ON admin_settings;

-- To verify: SELECT * FROM pg_policies WHERE tablename = 'admin_settings';
-- Expected: Only "Service role full access on admin_settings" remains


-- =============================================================
-- OPTION 2: Create a view with safe columns (RECOMMENDED)
-- =============================================================
-- Pros: Clean separation, app can read safe fields via view
-- Cons: Requires app code change (read from view instead of table)

-- Step 2a: Create the safe view
CREATE OR REPLACE VIEW admin_settings_public AS
SELECT
  id,
  promptpay_id,
  line_approver_id,
  line_staff_id,
  pin_version,
  created_at,
  updated_at
FROM admin_settings;
-- NOTE: staff_pin_hash is deliberately excluded

-- Step 2b: Grant anon access to the view
GRANT SELECT ON admin_settings_public TO anon;

-- Step 2c: Remove anon access from the base table
DROP POLICY IF EXISTS "Allow anon to read admin_settings display fields" ON admin_settings;

-- Step 2d: Update app code to read from admin_settings_public instead of admin_settings
-- Files to update:
--   app/order/payment/page.tsx (reads promptpay_id)
--   Any other client-side reads of admin_settings


-- =============================================================
-- OPTION 3: Split sensitive data into separate table (MOST ROBUST)
-- =============================================================
-- Pros: Clear data classification, follows security best practices
-- Cons: Requires migration and more code changes

-- Step 3a: Create sensitive settings table (service_role only)
CREATE TABLE IF NOT EXISTS admin_settings_sensitive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_pin_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Step 3b: Enable RLS with service_role only
ALTER TABLE admin_settings_sensitive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only on admin_settings_sensitive"
  ON admin_settings_sensitive FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Step 3c: Migrate data
INSERT INTO admin_settings_sensitive (staff_pin_hash)
SELECT staff_pin_hash FROM admin_settings LIMIT 1;

-- Step 3d: Remove sensitive column from admin_settings
-- WARNING: Only run after confirming data migration!
-- ALTER TABLE admin_settings DROP COLUMN staff_pin_hash;

-- Step 3e: Update app code to read PIN hash from new table


-- =============================================================
-- VERIFICATION QUERIES (run after applying any option)
-- =============================================================

-- Check policies on admin_settings
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'admin_settings';

-- Test anon access (should return empty or error if Option 1 applied)
-- Run with anon key: SELECT * FROM admin_settings LIMIT 1;

-- If Option 2: Test view access
-- SELECT * FROM admin_settings_public LIMIT 1;
