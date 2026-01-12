# Settings Prune Execution Plan

**Date**: 2025-01-13
**Migration**: `20250113_003_settings_prune.sql`
**Risk Level**: LOW (defensive cleanup, no data deletion)

---

## Executive Summary

### What This Migration Does

| Action | Target | Result |
|--------|--------|--------|
| DROP | `admin_settings_public` view | Removed (if existed) |
| DROP | `public_settings` view | Removed (if existed) |
| DROP | `settings_public` view | Removed (if existed) |
| RENAME | `admin_settings_sensitive` table | → `_deprecated_admin_settings_sensitive_20250113` |
| RENAME | `settings` table | → `_deprecated_settings_20250113` |
| VERIFY | Schema uniqueness | Assert only ONE location for each setting |
| DOCUMENT | Canonical sources | Add CANONICAL comments to tables/columns |

### Canonical Sources (UNCHANGED)

| Setting | Canonical Location | Status After Migration |
|---------|-------------------|----------------------|
| `promptpay_id` | `admin_settings.promptpay_id` | **ONLY** location |
| `line_approver_id` | `admin_settings.line_approver_id` | **ONLY** location |
| `line_staff_id` | `admin_settings.line_staff_id` | **ONLY** location |
| Feature flags | `system_settings` (key-value) | **ONLY** location |

### Duplicates Removed/Deprecated

Based on analysis, no actual duplicates exist in the deployed schema:
- `admin_settings_public` view: **proposed but not deployed**
- `admin_settings_sensitive` table: **proposed but not deployed**

This migration is defensive - it ensures cleanup even if these were accidentally deployed.

---

## Pre-Execution Checklist

### 1. Backup Verification

```bash
# Verify recent backup exists in Supabase dashboard
# Go to: Database → Backups → Verify timestamp < 1 hour
```

### 2. Preflight Queries

Run these in Supabase SQL Editor **BEFORE** the migration:

```sql
-- PREFLIGHT 1: Canonical tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('admin_settings', 'system_settings');
-- Expected: 2 rows

-- PREFLIGHT 2: List all promptpay columns (detect duplicates)
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name = 'promptpay_id';
-- Expected: 1 row (admin_settings)

-- PREFLIGHT 3: List settings-related views
SELECT table_name FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name LIKE '%setting%';
-- Expected: 0 rows (no legacy views)

-- PREFLIGHT 4: List settings-related tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%setting%';
-- Expected: 2 rows (admin_settings, system_settings)
```

### 3. STOP Conditions

**DO NOT proceed if:**

1. ❌ `admin_settings` table doesn't exist
2. ❌ `promptpay_id` column doesn't exist in `admin_settings`
3. ❌ `system_settings` table doesn't exist
4. ❌ Multiple tables have `promptpay_id` column (unexpected duplicate)

---

## Execution Steps

### Step 1: Run Migration

1. Open Supabase SQL Editor
2. Paste contents of `20250113_003_settings_prune.sql`
3. Execute

**Expected Output:**
- `NOTICE: VERIFIED: promptpay_id exists only in admin_settings (canonical)`
- `NOTICE: VERIFIED: line_approver_id exists only in admin_settings (canonical)`
- `NOTICE: VERIFIED: line_staff_id exists only in admin_settings (canonical)`
- `NOTICE: No deprecated settings tables found. Schema is clean.`
- `NOTICE: === SETTINGS PRUNE MIGRATION COMPLETE ===`

### Step 2: Run Verification

Execute `20250113_003_settings_prune_verify.sql` in SQL Editor.

**Expected Results:**

| Check | Expected Result |
|-------|-----------------|
| CHECK 1 | Only `admin_settings.promptpay_id` (CANONICAL) |
| CHECK 2 | Only `admin_settings` LINE columns (CANONICAL) |
| CHECK 3 | `admin_settings`, `system_settings` (CANONICAL) |
| CHECK 4 | No views (empty result) |
| CHECK 5 | 1 row with settings data |
| CHECK 6 | 4 canonical keys |
| CHECK 7 | Deny-all policy present |
| CHECK 8 | 4 RLS policies on system_settings |
| CHECK 9 | May have deprecated tables (safe to drop) |
| CHECK 10 | Comments contain CANONICAL |

---

## Smoke Tests

### Test 1: Public PromptPay Endpoint

```bash
curl -s https://your-app.vercel.app/api/public/promptpay
```

**Expected:** `{"promptpay_id":"0988799990"}` (or configured ID)

### Test 2: Admin Settings GET

1. Login to admin panel
2. Navigate to Settings
3. Verify current values are displayed

**Expected:** PromptPay ID, LINE IDs shown correctly

### Test 3: Admin Settings SAVE

1. In admin Settings, change any value
2. Click Save
3. Refresh page

**Expected:** Success toast, value persists

### Test 4: Admin Test Message

1. In admin Settings, click "Test" next to LINE Approver
2. Check LINE app

**Expected:** Test message received

### Test 5: Customer Payment QR

1. Open customer ordering flow
2. Add item, proceed to payment

**Expected:** PromptPay QR displayed with correct ID

---

## STOP Conditions (Post-Migration)

**Rollback immediately if:**

1. ❌ `/api/public/promptpay` returns 500
2. ❌ Admin settings page shows errors
3. ❌ Admin settings save returns 403/500
4. ❌ Customer payment page fails to load QR

---

## Rollback Procedure

### Option A: Run Rollback SQL

```sql
-- Execute 20250113_003_settings_prune_rollback.sql
-- This restores renamed tables to their original names
```

### Option B: Manual Restore

```sql
-- Restore renamed tables
ALTER TABLE _deprecated_admin_settings_sensitive_20250113
RENAME TO admin_settings_sensitive;

ALTER TABLE _deprecated_settings_20250113
RENAME TO settings;

-- Recreate dropped view (if needed)
CREATE OR REPLACE VIEW admin_settings_public AS
SELECT id, promptpay_id, line_approver_id, line_staff_id, pin_version, created_at, updated_at
FROM admin_settings;
```

---

## Post-Execution

### 1. Clean Up Deprecated Tables (Optional)

After 7 days with no issues, you can permanently remove deprecated tables:

```sql
-- ONLY run after confirming app works correctly
DROP TABLE IF EXISTS _deprecated_admin_settings_sensitive_20250113;
DROP TABLE IF EXISTS _deprecated_settings_20250113;
```

### 2. Update Documentation

- [x] CLEANUP-MAP.md reflects canonical sources
- [x] SETTINGS-ARCHITECTURE.md is accurate
- [x] No code references legacy tables

### 3. Remove Legacy Code References

Search codebase for any remaining references to dropped/deprecated objects:

```bash
grep -r "admin_settings_public" --include="*.ts" --include="*.tsx"
grep -r "admin_settings_sensitive" --include="*.ts" --include="*.tsx"
```

Expected: 0 matches (only in report files)

---

## Schema Summary After Migration

### Tables

| Table | Purpose | RLS |
|-------|---------|-----|
| `admin_settings` | Credentials, LINE IDs, PromptPay | Deny-all (service-role only) |
| `system_settings` | Feature flags, display prefs | Public read |

### Views

| View | Status |
|------|--------|
| `admin_settings_public` | **DROPPED** (if existed) |

### Deprecated (Can Be Dropped)

| Object | Status |
|--------|--------|
| `_deprecated_admin_settings_sensitive_20250113` | Renamed, can drop after 7 days |
| `_deprecated_settings_20250113` | Renamed, can drop after 7 days |

---

## Security Confirmation

| Security Control | Status |
|-----------------|--------|
| admin_settings RLS | ✅ Deny-all unchanged |
| system_settings RLS | ✅ Public-read unchanged |
| CSRF validation | ✅ Unchanged |
| Rate limiting | ✅ Unchanged |
| Service-role access | ✅ Required for all mutations |
