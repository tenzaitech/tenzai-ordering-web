-- ============================================================
-- ADD ADMIN CREDENTIALS TO admin_settings
-- Generated: 2026-01-11
-- ============================================================
--
-- This migration adds username/password authentication for admin users.
-- The password is stored as a scrypt hash (same format as staff_pin_hash).
--
-- BEFORE RUNNING:
-- 1. Take a database backup
-- 2. Test in staging first
--
-- ============================================================

-- Step 1: Add columns for admin authentication
ALTER TABLE admin_settings
ADD COLUMN IF NOT EXISTS admin_username TEXT,
ADD COLUMN IF NOT EXISTS admin_password_hash TEXT;

-- Step 2: Add comment for documentation
COMMENT ON COLUMN admin_settings.admin_username IS 'Admin login username';
COMMENT ON COLUMN admin_settings.admin_password_hash IS 'Admin password hash (scrypt format: hash.salt)';

-- Step 3: Verify columns were added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'admin_settings'
  AND column_name IN ('admin_username', 'admin_password_hash');

-- ============================================================
-- SETTING INITIAL ADMIN PASSWORD
-- ============================================================
--
-- To set the initial admin password, you have two options:
--
-- Option A: Use the fallback (ADMIN_API_KEY env var)
--   - No DB update needed
--   - Login with username: "admin", password: <your ADMIN_API_KEY value>
--
-- Option B: Generate a password hash and insert it
--   - Use the Node.js script below to generate a hash:
--
--   const { scrypt, randomBytes } = require('crypto');
--   const { promisify } = require('util');
--   const scryptAsync = promisify(scrypt);
--
--   async function hashPassword(password) {
--     const salt = randomBytes(16).toString('hex');
--     const buf = await scryptAsync(password, salt, 64);
--     return `${buf.toString('hex')}.${salt}`;
--   }
--
--   hashPassword('your-secure-password').then(console.log);
--
--   Then update the database:
--   UPDATE admin_settings
--   SET admin_username = 'admin',
--       admin_password_hash = '<generated-hash>'
--   WHERE id = (SELECT id FROM admin_settings LIMIT 1);
--
-- ============================================================
