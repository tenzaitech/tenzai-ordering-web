# Settings Canonicalization Execution Plan

**Date**: 2025-01-13
**Migration**: `20250113_002_settings_canonicalization.sql`
**Risk Level**: LOW (idempotent, no data changes)

---

## Overview

This migration enforces the canonical two-table settings architecture:
- `admin_settings`: Sensitive data (deny-all RLS)
- `system_settings`: Public config (public-read RLS)

---

## Pre-Execution Checklist

### 1. Backup Verification
```bash
# Verify recent backup exists in Supabase dashboard
# Go to: Database → Backups → Verify timestamp
```

### 2. Current State Check
```sql
-- Run in Supabase SQL Editor to document current state

-- Check admin_settings row count
SELECT COUNT(*) as admin_settings_rows FROM admin_settings;

-- Check system_settings keys
SELECT key, updated_at FROM system_settings ORDER BY key;

-- Check current RLS status
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname IN ('admin_settings', 'system_settings');
```

### 3. Environment Verification
```bash
# Verify service role key is configured
echo $SUPABASE_SERVICE_ROLE_KEY | head -c 20

# Verify app can connect
curl -s https://your-project.supabase.co/rest/v1/ \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" | head -c 50
```

---

## Execution Steps

### Step 1: Deploy Code Changes (No Downtime)

1. Deploy the following updated files:
   - `lib/line.ts` (documentation only)
   - `app/api/admin/settings/route.ts` (documentation + service-role)
   - `app/api/admin/settings/test-message/route.ts` (service-role fix + error format)
   - `app/api/public/promptpay/route.ts` (use shared client)

2. Verify deployment:
   ```bash
   # Check app is responding
   curl -s https://your-app.vercel.app/api/health
   ```

### Step 2: Run Migration

1. Open Supabase SQL Editor
2. Paste contents of `20250113_002_settings_canonicalization.sql`
3. Execute

**Expected Output**:
- No errors
- Comments like "ALTER TABLE", "CREATE POLICY" execute successfully

### Step 3: Run Verification Queries

Execute `20250113_002_settings_canonicalization_verify.sql` in SQL Editor.

**Expected Results**:

| Check | Expected |
|-------|----------|
| CHECK 1: admin_settings RLS | row_security_active = true |
| CHECK 2: admin_settings policy | "Deny all for non-service-role" |
| CHECK 3: system_settings RLS | row_security_active = true |
| CHECK 4: system_settings policies | 4 policies |
| CHECK 7: system_settings keys | 4 rows (defaults) |

---

## Smoke Tests

### Test 1: Admin Settings Save (Critical)

1. Login to admin panel
2. Navigate to Settings
3. Change PromptPay ID (or any field)
4. Click Save

**Expected**: Success toast, settings persist on refresh

### Test 2: Admin Test Message

1. In admin Settings, click "Test" next to LINE Approver
2. Check LINE app for test message

**Expected**: Test message received

### Test 3: Customer PromptPay Display

1. Open customer ordering flow
2. Add item to cart, proceed to payment
3. View PromptPay QR screen

**Expected**: Correct PromptPay ID displayed (not fallback unless error)

### Test 4: Staff PIN Login

1. Navigate to staff login
2. Enter correct PIN
3. Verify session established

**Expected**: Staff dashboard loads

### Test 5: Public Order Status Toggle

1. Admin: Toggle "Order Accepting" off
2. Customer: Visit order page

**Expected**: "Shop Closed" message displayed

### Test 6: Menu Edit (Verify No Regression)

1. Admin: Navigate to Menu Edit
2. Edit any menu item
3. Save changes

**Expected**: Save succeeds, no 403/500 errors

---

## STOP Conditions

**STOP and rollback if ANY of these occur:**

1. ❌ Admin login fails (500/403)
2. ❌ Admin settings save returns 500
3. ❌ Customer payment page shows error instead of QR
4. ❌ Staff PIN login fails (not just wrong PIN)
5. ❌ System-wide 500 errors in logs

---

## Rollback Procedure

### Option A: Rollback SQL (Documentation Only)

```sql
-- Run 20250113_002_settings_canonicalization_rollback.sql
-- This only removes comments, NOT security policies
```

### Option B: Full Revert (If Needed)

```sql
-- WARNING: Only if security policies caused issues

-- Temporarily allow admin_settings access (DO NOT USE IN PRODUCTION)
DROP POLICY IF EXISTS "Deny all for non-service-role" ON admin_settings;
CREATE POLICY "temp_allow_all" ON admin_settings FOR ALL USING (true);

-- Investigate and fix root cause, then restore deny-all
```

### Option C: Code Revert

```bash
# Revert to previous commit
git revert HEAD --no-commit
git commit -m "Revert settings canonicalization"
vercel --prod
```

---

## Post-Execution

### 1. Monitor Logs (15 minutes)

```bash
# Watch for errors
vercel logs --follow | grep -i "error\|500\|403"
```

### 2. Update Documentation

- [ ] Confirm CLEANUP-MAP.md is accurate
- [ ] Update team on canonical sources
- [ ] Archive old documentation references

### 3. Clean Up

- [ ] Remove any debug flags (`DEBUG_ADMIN_SETTINGS`)
- [ ] Verify no env var fallbacks are hit in production logs

---

## Verification Summary

| Component | Status | Notes |
|-----------|--------|-------|
| admin_settings RLS | ⬜ | Deny-all for anon |
| system_settings RLS | ⬜ | Public read, deny write |
| Service-role client | ⬜ | All admin routes |
| Error format | ⬜ | `{ error: { code, message_th } }` |
| CSRF enforced | ⬜ | All mutations |
| Rate limits | ⬜ | Login, PIN, promptpay |

---

## Contact

If issues occur during execution:
1. Check Supabase dashboard for DB errors
2. Check Vercel logs for API errors
3. Rollback if STOP conditions met
