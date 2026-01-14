-- Admin Settings Table
-- Stores configurable runtime settings (LINE IDs, Staff PIN)
-- Run this AFTER supabase-schema.sql

CREATE TABLE admin_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  line_approver_id TEXT NOT NULL DEFAULT '',
  line_staff_id TEXT NOT NULL DEFAULT '',
  staff_pin_hash TEXT NOT NULL,
  pin_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy (allow all for MVP)
CREATE POLICY "Allow all operations on admin_settings" ON admin_settings FOR ALL USING (true) WITH CHECK (true);

-- Index for fast lookups (only 1 row expected)
CREATE INDEX idx_admin_settings_id ON admin_settings(id);

-- Insert default row (fallback to env vars if empty)
-- Default PIN hash for "1234" using Node crypto scrypt
INSERT INTO admin_settings (line_approver_id, line_staff_id, staff_pin_hash, pin_version)
VALUES ('', '', '', 1);

-- Note: The app will initialize this row on first admin/settings page load if empty
