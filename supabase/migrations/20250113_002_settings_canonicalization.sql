-- =============================================================================
-- TENZAI Settings Canonicalization Migration
-- Date: 2025-01-13
-- Purpose: Enforce canonical settings architecture with proper RLS
-- =============================================================================

-- This migration ensures the two-table settings architecture is correctly enforced:
-- 1. admin_settings: Sensitive data (credentials, PINs, IDs) - deny-all for anon
-- 2. system_settings: Public config (feature flags) - public read, service-role write

-- =============================================================================
-- SECTION A: Ensure admin_settings RLS is locked down
-- =============================================================================

-- Enable RLS on admin_settings (idempotent)
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Drop any permissive policies that might exist
DROP POLICY IF EXISTS "Allow all operations on admin_settings" ON admin_settings;
DROP POLICY IF EXISTS "Public read admin_settings" ON admin_settings;
DROP POLICY IF EXISTS "Anyone can read admin_settings" ON admin_settings;
DROP POLICY IF EXISTS "Admin read admin_settings" ON admin_settings;

-- Ensure deny-all policy exists (idempotent recreation)
DROP POLICY IF EXISTS "Deny all for non-service-role" ON admin_settings;
CREATE POLICY "Deny all for non-service-role"
ON admin_settings
FOR ALL
USING (false)
WITH CHECK (false);

-- =============================================================================
-- SECTION B: Ensure system_settings RLS is correctly configured
-- =============================================================================

-- Enable RLS on system_settings (idempotent)
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- Drop any overly permissive policies
DROP POLICY IF EXISTS "Allow all operations on system_settings" ON system_settings;
DROP POLICY IF EXISTS "Anyone can write system_settings" ON system_settings;

-- Ensure public read policy exists (idempotent recreation)
DROP POLICY IF EXISTS "Public read system_settings" ON system_settings;
CREATE POLICY "Public read system_settings"
ON system_settings FOR SELECT
USING (true);

-- Ensure deny-write policies exist (idempotent recreation)
DROP POLICY IF EXISTS "Deny insert for anon" ON system_settings;
CREATE POLICY "Deny insert for anon"
ON system_settings FOR INSERT
WITH CHECK (false);

DROP POLICY IF EXISTS "Deny update for anon" ON system_settings;
CREATE POLICY "Deny update for anon"
ON system_settings FOR UPDATE
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "Deny delete for anon" ON system_settings;
CREATE POLICY "Deny delete for anon"
ON system_settings FOR DELETE
USING (false);

-- =============================================================================
-- SECTION C: Ensure required columns exist in admin_settings
-- =============================================================================

-- Add staff_session_version if not exists (for session invalidation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'staff_session_version'
  ) THEN
    ALTER TABLE admin_settings ADD COLUMN staff_session_version INT DEFAULT 1;
  END IF;
END $$;

-- Add admin_session_version if not exists (for session invalidation)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_settings' AND column_name = 'admin_session_version'
  ) THEN
    ALTER TABLE admin_settings ADD COLUMN admin_session_version INT DEFAULT 1;
  END IF;
END $$;

-- =============================================================================
-- SECTION D: Ensure system_settings has correct schema
-- =============================================================================

-- Ensure primary key on 'key' column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'system_settings'
    AND constraint_type = 'PRIMARY KEY'
  ) THEN
    ALTER TABLE system_settings ADD PRIMARY KEY (key);
  END IF;
END $$;

-- Ensure updated_at column exists with default
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'system_settings' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE system_settings ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- =============================================================================
-- SECTION E: Initialize default system_settings if empty
-- =============================================================================

-- Insert default order_accepting if not exists
INSERT INTO system_settings (key, value, updated_at)
VALUES ('order_accepting', '{"enabled": true}'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

-- Insert default category_order if not exists
INSERT INTO system_settings (key, value, updated_at)
VALUES ('category_order', '{"order": []}'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

-- Insert default hidden_categories if not exists
INSERT INTO system_settings (key, value, updated_at)
VALUES ('hidden_categories', '{"hidden": []}'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

-- Insert default popular_menus if not exists
INSERT INTO system_settings (key, value, updated_at)
VALUES ('popular_menus', '{"menu_codes": []}'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- SECTION F: Add comment documentation
-- =============================================================================

COMMENT ON TABLE admin_settings IS 'Sensitive admin configuration: credentials, PINs, LINE IDs, PromptPay. RLS: deny-all for anon, service-role only.';
COMMENT ON TABLE system_settings IS 'Public system configuration: feature flags, display preferences. RLS: public read, service-role write.';

COMMENT ON COLUMN admin_settings.promptpay_id IS 'CANONICAL: PromptPay merchant ID for payment QR generation';
COMMENT ON COLUMN admin_settings.line_approver_id IS 'CANONICAL: LINE User ID for payment approval notifications';
COMMENT ON COLUMN admin_settings.line_staff_id IS 'CANONICAL: LINE User/Group ID for kitchen staff notifications';
COMMENT ON COLUMN admin_settings.staff_pin_hash IS 'CANONICAL: Scrypt-hashed 4-digit staff PIN';
COMMENT ON COLUMN admin_settings.pin_version IS 'CANONICAL: PIN version counter for session invalidation';
COMMENT ON COLUMN admin_settings.staff_session_version IS 'CANONICAL: Staff session version for invalidation';
COMMENT ON COLUMN admin_settings.admin_session_version IS 'CANONICAL: Admin session version for invalidation';

-- =============================================================================
-- Migration complete
-- =============================================================================
