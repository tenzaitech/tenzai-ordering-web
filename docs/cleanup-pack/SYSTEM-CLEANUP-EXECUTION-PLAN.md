# System Cleanup Execution Plan

**Date**: 2025-01-13
**Status**: PRE-PRODUCTION / FULL REBUILD WINDOW
**Migration**: `20250113_001_system_cleanup.sql`

---

## Overview

This cleanup hardens the system for production readiness:
1. Enforces order status state machine via CHECK constraint
2. Applies proper RLS policies to menu tables (public read, service-role write)
3. Locks down system_settings and admin_settings appropriately

---

## Pre-Execution Checklist

- [ ] Database backup taken
- [ ] No active orders being processed (pre-production, should be zero or test data)
- [ ] Access to Supabase SQL Editor or CLI
- [ ] Rollback script ready: `20250113_001_system_cleanup_rollback.sql`

---

## Execution Steps

### Step 1: Backup (Required)

Before running any SQL, create a backup:
- Supabase Dashboard → Settings → Database → Create backup
- Or export critical tables: `orders`, `order_items`, `admin_settings`

### Step 2: Verify Pre-Conditions

Run these queries to ensure clean state:

```sql
-- Check for invalid order status values
SELECT id, order_number, status
FROM orders
WHERE status NOT IN ('pending', 'approved', 'rejected', 'ready', 'picked_up');

-- Expected: 0 rows
-- If rows returned: Fix or delete invalid orders before proceeding
```

### Step 3: Run Migration

Execute the migration script in Supabase SQL Editor:
- File: `supabase/migrations/20250113_001_system_cleanup.sql`
- Method: Copy/paste entire file into SQL Editor and run

### Step 4: Verify Migration

Run verification script:
- File: `supabase/migrations/20250113_001_system_cleanup_verify.sql`
- Check all assertions pass (see checklist in file)

### Step 5: Test Application

1. **Customer Flow** (via LIFF):
   - [ ] Can browse menu (categories, items, options)
   - [ ] Can view order status (should fail - goes through API)
   - [ ] Order creation works (via API)

2. **Admin Flow**:
   - [ ] Can login
   - [ ] Can view orders
   - [ ] Can approve/reject orders
   - [ ] Can toggle order accepting
   - [ ] Can manage menu items

3. **Staff Flow**:
   - [ ] Can login with PIN
   - [ ] Can view approved orders
   - [ ] Can mark orders as ready/picked_up

---

## STOP Conditions

**STOP and ROLLBACK if:**
1. Any critical flow fails (order creation, approval, status updates)
2. Customers cannot browse menu
3. Admin cannot login or access orders
4. Verification queries show unexpected results

---

## Rollback Procedure

If issues occur:

1. Run rollback script:
   - File: `supabase/migrations/20250113_001_system_cleanup_rollback.sql`

2. Verify rollback:
```sql
-- Confirm CHECK constraint removed
SELECT constraint_name FROM information_schema.check_constraints
WHERE constraint_name = 'chk_orders_status';
-- Expected: 0 rows

-- Confirm permissive policies restored
SELECT tablename, policyname FROM pg_policies
WHERE policyname LIKE 'Allow all%';
-- Expected: Menu tables have "Allow all" policies
```

3. Report issue for investigation

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Invalid order status blocks CHECK constraint | Low | Medium | Pre-check query in Step 2 |
| RLS blocks legitimate access | Low | High | Extensive verification queries |
| Menu not browsable | Low | High | Public read policy ensures access |
| Admin functions break | Low | High | service_role bypasses RLS |
| Rollback fails | Very Low | High | Script tested, idempotent |

**Overall Risk: LOW**
- All changes are additive/restrictive (no data loss)
- service_role bypasses RLS (admin/API routes unaffected)
- Public read for menu ensures customer browsing works
- Full rollback available

---

## Post-Migration Notes

After successful migration:
1. Update team that RLS is now enforced
2. Document that menu mutations require API routes (no direct client DB writes)
3. Monitor for any 403/permission errors in logs

---

## Files Reference

| File | Purpose |
|------|---------|
| `20250113_001_system_cleanup.sql` | Main migration |
| `20250113_001_system_cleanup_rollback.sql` | Rollback script |
| `20250113_001_system_cleanup_verify.sql` | Verification queries |
| `SYSTEM-CLEANUP-EXECUTION-PLAN.md` | This document |
| `SETTINGS-ARCHITECTURE.md` | Settings design documentation |
| `LEGACY-COLUMNS.md` | Legacy column documentation |
