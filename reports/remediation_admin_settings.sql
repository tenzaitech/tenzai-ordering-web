-- ============================================================
-- REMEDIATION: admin_settings RLS Policy Fix
-- Generated: 2026-01-11
-- Purpose: Remove anon access to staff_pin_hash
-- ============================================================
--
-- PROBLEM:
-- The policy "Allow anon to read admin_settings display fields"
-- allows anon key to SELECT all columns including staff_pin_hash.
-- This exposes the PIN hash to anyone with the anon API key.
--
-- SOLUTION:
-- Remove anon SELECT access entirely from admin_settings.
-- Customer code now uses /api/public/promptpay (server-side with service role).
--
-- VERIFICATION:
-- After running this, anon key queries to admin_settings should fail.
-- Admin functionality is unaffected (uses service role key).
-- ============================================================

-- Step 1: Remove the permissive anon SELECT policy
DROP POLICY IF EXISTS "Allow anon to read admin_settings display fields" ON admin_settings;

-- Step 2: Verify only service role policy remains
-- Expected: Only "Service role full access on admin_settings" should exist

-- ============================================================
-- VERIFICATION QUERIES (run after applying the above)
-- ============================================================

-- Query 1: List remaining policies on admin_settings
-- Expected: 1 row with policyname = 'Service role full access on admin_settings'
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'admin_settings';

-- Query 2: Test anon cannot read (run with anon key - should fail or return empty)
-- This should return an error or empty result after fix
-- SELECT staff_pin_hash FROM admin_settings LIMIT 1;

-- ============================================================
-- ROLLBACK (if needed - NOT recommended)
-- ============================================================
-- Only use this if application breaks unexpectedly:
--
-- CREATE POLICY "Allow anon to read admin_settings display fields"
--   ON admin_settings FOR SELECT
--   USING (true);
--
-- WARNING: This re-exposes staff_pin_hash. Only use temporarily for debugging.
