# Post-SQL Verification Report

Generated: 2026-01-10T20:47:51.829Z

## Overall Status: CRITICAL_FAIL

---

## 1. RLS Policies

**Status:** PASS

### Test Results

| Table | Service Role SELECT | Anon SELECT | Notes |
|-------|---------------------|-------------|-------|
| admin_settings | OK | ALLOWED | Status 200 |
| orders | OK | ALLOWED | Status 200 |
| order_items | OK | ALLOWED | Status 200 |
| system_settings | OK | ALLOWED | Status 200 |

---

## 2. RLS Enabled Status

**Status:** INFERRED_PASS

| Table | Accessible | RLS Status |
|-------|------------|------------|
| admin_settings | YES | ENABLED (cannot verify directly via REST) |
| orders | YES | ENABLED (cannot verify directly via REST) |
| order_items | YES | ENABLED (cannot verify directly via REST) |
| system_settings | YES | ENABLED (cannot verify directly via REST) |

---

## 3. Indexes

**Status:** MANUAL_CHECK_REQUIRED

Expected indexes on `orders` table:
- `idx_orders_customer_line_user_id` (partial index on customer_line_user_id)
- `idx_orders_status`
- `idx_orders_status_created_at` (composite)

**Action Required:** Run manual SQL verification (see post_sql_verification.sql)

---

## 4. Anon Exposure Check (CRITICAL)

**Status:** CRITICAL_FAIL

### Findings

- Anon can SELECT from admin_settings: **YES**
- staff_pin_hash exposed: **YES (CRITICAL!)**
- Visible columns: `id`, `line_approver_id`, `line_staff_id`, `staff_pin_hash`, `pin_version`, `created_at`, `updated_at`, `promptpay_id`

### Issues
- **CRITICAL: staff_pin_hash is exposed to anon key**
- **staff_pin_hash column is in the visible columns list**

---

## 5. Risks Summary

- CRITICAL: staff_pin_hash is exposed to anon key
- staff_pin_hash column is in the visible columns list

---

## 6. Required Actions

### CRITICAL: Fix admin_settings Exposure

The `staff_pin_hash` column is currently exposed to anonymous users. This is a security vulnerability.

**Recommended Fix:** See `reports/fix_admin_settings_exposure.sql`

Three options are provided:
1. Remove anon SELECT entirely (simplest, may break app)
2. Create a view excluding sensitive columns (recommended)
3. Split into separate tables (most robust)

### Manual Verification Required

Run the SQL queries in `reports/post_sql_verification.sql` to verify:
- Indexes were created
- RLS is enabled on all tables
- Policy details match expected

