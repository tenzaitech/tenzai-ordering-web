# Execution Plan

## Overview

Step-by-step execution order for cleanup tasks with verification gates and rollback points.

---

## Prerequisites

Before starting:
- [ ] Database backup taken
- [ ] Staging/test environment available
- [ ] All changes tested in staging first
- [ ] Rollback scripts reviewed and ready
- [ ] Monitoring in place (error logs, DB queries)

---

## Execution Order

```
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE 1: DB-001 FK Validation (Low Risk)                           │
│  ├── Can run independently                                          │
│  └── No application changes required                                │
├─────────────────────────────────────────────────────────────────────┤
│  PHASE 2: DB-005 Status Constraint (Low Risk)                       │
│  ├── Can run independently                                          │
│  └── No application changes required                                │
├─────────────────────────────────────────────────────────────────────┤
│  PHASE 3: API-004 Rate Limiting (Medium Risk)                       │
│  ├── Backend changes only                                           │
│  └── Progressive rollout                                            │
├─────────────────────────────────────────────────────────────────────┤
│  PHASE 4: API-001 CSRF Hardening (Medium Risk)                      │
│  ├── Requires frontend + backend coordination                       │
│  └── Progressive rollout                                            │
├─────────────────────────────────────────────────────────────────────┤
│  PHASE 5: DB-006 Menu RLS (High Risk)                               │
│  ├── REQUIRES: Admin routes migrated to service-role FIRST         │
│  └── Run after API routes are updated                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: DB-001 FK Validation

**Risk Level**: LOW
**Dependencies**: None
**Estimated Time**: 15-30 minutes

### Step 1.1: Detect Orphans
```sql
-- Run detection query from 01-db-fk-validation.sql
SELECT COUNT(*) AS orphaned_count
FROM order_items oi
WHERE oi.menu_code IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM menu_items mi WHERE mi.menu_code = oi.menu_code
  );
```

**Expected Outcome**: Count of orphaned rows (may be 0)

**Decision Gate**:
- If count = 0 → Proceed to Step 1.3
- If count > 0 → Proceed to Step 1.2

### Step 1.2: Resolve Orphans
Choose resolution strategy based on business needs:

| Count | Recommendation |
|-------|----------------|
| < 10 | Review manually, decide per-row |
| 10-100 | Option A: Set menu_code to NULL |
| > 100 | Option B: Create placeholder menu_items |

```sql
-- Option A: Nullify orphans
UPDATE order_items
SET menu_code = NULL
WHERE menu_code IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM menu_items WHERE menu_code = order_items.menu_code);
```

**Verification**: Re-run detection query, confirm count = 0

### Step 1.3: Validate Constraint
```sql
ALTER TABLE order_items VALIDATE CONSTRAINT fk_order_items_menu_code;
```

**Verification**:
```sql
SELECT convalidated FROM pg_constraint WHERE conname = 'fk_order_items_menu_code';
-- Expected: true
```

### Step 1.4: Verify Complete
```sql
-- Test insert of invalid menu_code (should fail)
-- DO NOT RUN IN PRODUCTION - manual test only
```

**STOP Condition**: If validation fails, run rollback from `01-db-fk-validation-rollback.sql`

---

## Phase 2: DB-005 Status Constraint

**Risk Level**: LOW
**Dependencies**: None
**Estimated Time**: 10-15 minutes

### Step 2.1: Check Existing Data
```sql
-- Find any invalid status values
SELECT DISTINCT status, COUNT(*)
FROM orders
WHERE status NOT IN ('pending', 'approved', 'rejected', 'ready', 'picked_up')
  AND status IS NOT NULL
GROUP BY status;
```

**Expected Outcome**: Empty result (no invalid statuses)

**Decision Gate**:
- If result empty → Proceed to Step 2.2
- If invalid statuses found → STOP, review data, decide on cleanup

### Step 2.2: Add CHECK Constraint
```sql
ALTER TABLE orders
ADD CONSTRAINT chk_orders_status
CHECK (status IS NULL OR status IN ('pending', 'approved', 'rejected', 'ready', 'picked_up'));
```

### Step 2.3: Verify Constraint
```sql
SELECT conname, contype
FROM pg_constraint
WHERE conname = 'chk_orders_status';
-- Expected: 1 row
```

**STOP Condition**: If constraint creation fails due to existing invalid data
**Rollback**: `ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_status;`

---

## Phase 3: API-004 Rate Limiting

**Risk Level**: MEDIUM
**Dependencies**: None (uses existing rate-limiter infrastructure)
**Estimated Time**: 1-2 hours

### Step 3.1: Extend Rate Limiter (Code Change)
Add configurable limits support to `lib/rate-limiter.ts`

**Verification**: Unit test rate limiter with different configs

### Step 3.2: Add to Public Endpoints (Progressive)

| Order | Endpoint | Limit |
|-------|----------|-------|
| 1 | `/api/public/promptpay` | 10/min/IP |
| 2 | `/api/order/validate-cart` | 30/min/IP |
| 3 | `/api/liff/session` | 10/min/IP |

**Per-endpoint verification**:
- [ ] Normal request succeeds
- [ ] 429 returned after limit exceeded
- [ ] Retry-After header present

### Step 3.3: Add to Customer Endpoints

| Order | Endpoint | Limit |
|-------|----------|-------|
| 4 | `/api/order/create` | 5/min/user |
| 5 | `/api/order/[id]/slip` | 10/min/user |

### Step 3.4: Monitor
- Watch error logs for 429 responses
- Adjust limits if false positives detected

**STOP Condition**: High rate of legitimate requests blocked
**Rollback**: Remove rate limit checks from affected routes

---

## Phase 4: API-001 CSRF Hardening

**Risk Level**: MEDIUM
**Dependencies**: Frontend must send CSRF token
**Estimated Time**: 2-4 hours

### Step 4.1: Frontend Preparation
Add CSRF token to admin API calls:

```typescript
// Add to admin fetch wrapper
headers: {
  'X-CSRF-Token': getCsrfToken()
}
```

**Verification**: Inspect network requests, confirm header present

### Step 4.2: Backend Updates (Progressive)

| Order | Routes | Priority |
|-------|--------|----------|
| 1 | Storage routes (low-risk) | LOW |
| 2 | Menu/category routes | MEDIUM |
| 3 | import-menu, toggle-accepting | HIGH |

**Per-route procedure**:
1. Add `validateCsrf` check
2. Deploy
3. Test manually
4. Monitor for 403 CSRF_INVALID errors

### Step 4.3: Verify All Routes Protected
```bash
# Check all admin POST routes have CSRF
grep -r "validateCsrf" app/api/admin/
```

**STOP Condition**: Frontend not sending token correctly
**Rollback**: Remove `validateCsrf` calls

---

## Phase 5: DB-006 Menu RLS

**Risk Level**: HIGH
**Dependencies**: Admin routes MUST use service-role client
**Estimated Time**: 4-8 hours (includes prerequisite)

### Prerequisite: Migrate Admin Routes

**CRITICAL**: Before enabling RLS, update admin routes to use service-role:

| Route | Change |
|-------|--------|
| `/api/admin/menu/*` | `@/lib/supabase` → `@/lib/supabase-server` |
| `/api/admin/categories/*` | `@/lib/supabase` → `@/lib/supabase-server` |
| `/api/admin/option-groups/*` | `@/lib/supabase` → `@/lib/supabase-server` |

**Verification per route**:
- [ ] Import changed to `getSupabaseServer`
- [ ] Route tested manually (CRUD operations work)

### Step 5.1: Enable RLS with Policies

Run SQL from `04-db-integrity-rls-design.md`:
- Enable RLS on each table
- Add "Public read access" policy
- Add "Deny write for non-service-role" policies

### Step 5.2: Verify Read Access
```sql
-- As anon role (or via anon key in app)
SELECT COUNT(*) FROM menu_items;
-- Expected: Returns count (read works)
```

### Step 5.3: Verify Write Blocked for Anon
```sql
-- As anon role (should fail)
INSERT INTO menu_items (menu_code, name_th, price, is_active)
VALUES ('TEST', 'Test', 0, false);
-- Expected: Permission denied
```

### Step 5.4: Verify Admin Routes Still Work
- [ ] Create menu item via admin UI
- [ ] Update menu item via admin UI
- [ ] Delete menu item via admin UI

**STOP Condition**: Admin operations failing
**Rollback**: Run rollback SQL to disable RLS on all menu tables

---

## Rollback Procedures

### Quick Reference

| Phase | Rollback Command |
|-------|-----------------|
| Phase 1 | See `01-db-fk-validation-rollback.sql` |
| Phase 2 | `ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_status;` |
| Phase 3 | Remove rate limit checks from routes |
| Phase 4 | Remove `validateCsrf` calls from routes |
| Phase 5 | Run menu RLS rollback SQL |

### Emergency Rollback Order

If system is broken, rollback in reverse order:
1. Phase 5 → Disable menu RLS
2. Phase 4 → Remove CSRF
3. Phase 3 → Remove rate limits
4. Phase 2 → Remove status constraint
5. Phase 1 → Leave FK as NOT VALID

---

## Post-Execution Checklist

### After All Phases Complete

- [ ] All verification queries pass
- [ ] Admin panel fully functional
- [ ] Customer ordering works end-to-end
- [ ] Staff board works
- [ ] No unexpected 403/429 errors in logs
- [ ] Backup removed or archived
- [ ] Documentation updated

### Monitoring Period (24-48 hours)

- [ ] Watch error rates
- [ ] Monitor DB query performance
- [ ] Check for blocked legitimate requests
- [ ] Verify no customer complaints

---

## Summary Timeline

| Phase | Risk | Time | Dependencies |
|-------|------|------|--------------|
| Phase 1 (FK) | LOW | 30m | None |
| Phase 2 (Status) | LOW | 15m | None |
| Phase 3 (Rate Limit) | MEDIUM | 2h | None |
| Phase 4 (CSRF) | MEDIUM | 4h | Frontend update |
| Phase 5 (Menu RLS) | HIGH | 8h | Route migration |

**Total Estimated Time**: 1-2 days with testing
