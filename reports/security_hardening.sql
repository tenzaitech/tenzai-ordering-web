-- ============================================================
-- SECURITY HARDENING - MANUAL APPLY ONLY
-- Generated: 2026-01-12
-- Version: 1.0
-- ============================================================
-- This migration adds:
-- 1) auth_rate_limits table (persistent rate limiting)
-- 2) audit_logs table (audit trail)
-- 3) Session version columns on admin_settings
--
-- BEFORE RUNNING:
-- 1. Take a database backup
-- 2. Test in staging first
-- ============================================================

-- ============================================================
-- SECTION 1: AUTH RATE LIMITS (REQUIRED)
-- ============================================================
-- Persistent rate limiting for multi-instance deployments

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key TEXT PRIMARY KEY,
  attempts INT NOT NULL DEFAULT 0,
  first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_updated_at
  ON auth_rate_limits(updated_at);

-- Add comment
COMMENT ON TABLE auth_rate_limits IS 'Rate limiting state for admin/staff login attempts (cloud-safe, multi-instance)';

-- ============================================================
-- SECTION 2: AUDIT LOGS (REQUIRED)
-- ============================================================
-- Immutable audit trail for security-sensitive actions

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('admin', 'staff', 'system')),
  actor_identifier TEXT,
  ip TEXT,
  user_agent TEXT,
  action_code TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for querying
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_code
  ON audit_logs(action_code);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON audit_logs(actor_type, actor_identifier);

-- Add comment
COMMENT ON TABLE audit_logs IS 'Immutable audit trail for auth events and critical admin actions';

-- ============================================================
-- SECTION 3: SESSION VERSION COLUMNS (REQUIRED)
-- ============================================================
-- Add session version fields to admin_settings for revocation support

ALTER TABLE admin_settings
ADD COLUMN IF NOT EXISTS admin_session_version INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS staff_session_version INT NOT NULL DEFAULT 1;

-- Add comments
COMMENT ON COLUMN admin_settings.admin_session_version IS 'Incremented on admin password change to revoke all sessions';
COMMENT ON COLUMN admin_settings.staff_session_version IS 'Incremented on staff PIN change to revoke all sessions';

-- ============================================================
-- SECTION 3.5: ADMIN USERNAME/PASSWORD (IF NOT EXISTS)
-- ============================================================
-- These columns may already exist from initial setup

ALTER TABLE admin_settings
ADD COLUMN IF NOT EXISTS admin_username TEXT,
ADD COLUMN IF NOT EXISTS admin_password_hash TEXT;

COMMENT ON COLUMN admin_settings.admin_username IS 'Admin login username';
COMMENT ON COLUMN admin_settings.admin_password_hash IS 'scrypt hashed admin password (format: hash.salt)';

-- ============================================================
-- SECTION 4: VERIFY CHANGES
-- ============================================================

-- Verify auth_rate_limits table
SELECT 'auth_rate_limits' as table_name,
       COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'auth_rate_limits';

-- Verify audit_logs table
SELECT 'audit_logs' as table_name,
       COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'audit_logs';

-- Verify session version columns
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'admin_settings'
  AND column_name IN ('admin_session_version', 'staff_session_version');


-- ============================================================
-- OPTIONAL: RLS POLICIES (recommended for defense-in-depth)
-- ============================================================
-- These are OPTIONAL. Do not enable if you're unsure.
-- The application uses service role for these tables, so RLS
-- is not strictly required but adds defense-in-depth.

-- Option A: Deny all client access (recommended)
-- ALTER TABLE auth_rate_limits ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
-- -- No policies = no access for anon/authenticated roles

-- Option B: Allow only service role (explicit)
-- CREATE POLICY "Service role only" ON auth_rate_limits
--   FOR ALL USING (auth.role() = 'service_role');
-- CREATE POLICY "Service role only" ON audit_logs
--   FOR ALL USING (auth.role() = 'service_role');
