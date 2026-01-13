# Cleanup Backlog

## TL;DR
- **19 items** across DB (6), API (5), CODE (5), FOLDER (3)
- **0 P0 (critical)**, 2 P1 (high), 7 P2 (medium), 10 P3 (low)
- **Top priorities**: Validate FK constraint (DB-001), Add CSRF protection (API-001), Status enum (DB-005)
- **No blockers**: All items are cleanup/hardening (system functional as-is)
- **Execution order**: See "Recommended Execution Order" section

## When Confused → Do This
1. **"What should I work on next?"** → See "Recommended Execution Order" or filter by priority
2. **"Why is this a priority?"** → Check "Why it matters" field for each item
3. **"What's the risk?"** → See "Risk Level" (Critical/Medium/Low)
4. **"How many files affected?"** → See "Blast Radius"
5. **"Is this safe to skip?"** → P3 items are low-priority (nice-to-have)
6. **"How do I fix item X?"** → See "Action" field for each item

## Current Truth / Invariants
- **System is functional**: All backlog items are improvements, not blockers
- **DB schema**: Stable but has redundancies (legacy columns, NOT VALID FK)
- **Security gaps**: Missing CSRF on admin mutations, no RLS on menu tables, no rate limiting on public endpoints
- **Code quality**: Works but has inconsistencies (error formats, Supabase client patterns, magic strings)
- **Priority focus**: Security (P1) → Data integrity (P2) → Consistency/maintainability (P3)

Prioritized list of cleanup items grouped by category. Each item includes rationale, risk level, and blast radius.

---

## Priority Legend

| Priority | Description |
|----------|-------------|
| P0 | Critical - security or data integrity risk |
| P1 | High - technical debt affecting reliability |
| P2 | Medium - consistency and maintainability |
| P3 | Low - nice-to-have cleanup |

---

## DATABASE

### DB-001: Validate FK constraint `fk_order_items_menu_code`
**Priority**: P1
**Why it matters**: The FK was added with `NOT VALID`, meaning existing orphaned `menu_code` values may exist. The constraint only enforces new inserts/updates.
**Risk Level**: Medium - data inconsistency possible
**Blast Radius**: `order_items` table, order detail views
**Action**: Query for orphaned rows, clean up, then run `ALTER TABLE order_items VALIDATE CONSTRAINT fk_order_items_menu_code`
**Acceptance**: (1) Query confirms no orphaned rows, (2) Constraint validated successfully, (3) Migration with rollback SQL committed

---

### DB-002: Remove redundant `menu_items.category_code` column
**Priority**: P3
**Why it matters**: Legacy FK superseded by `menu_item_categories` join table. Dead column adds confusion.
**Risk Level**: Low - column is unused
**Blast Radius**: `menu_items` table, migration required
**Action**: Verify no code references it, create migration to drop column

---

### DB-003: Remove redundant `order_items.menu_code` column
**Priority**: P3
**Why it matters**: Added as "redundant column for clarity" but `menu_item_id` serves same purpose. Two columns storing same value.
**Risk Level**: Low - both columns exist
**Blast Radius**: `order_items` table
**Action**: Decide which to keep, deprecate the other

---

### DB-004: Consolidate `orders.rejected_at` and `orders.rejected_at_ts`
**Priority**: P2
**Why it matters**: Two columns tracking same event with different types (TEXT vs TIMESTAMPTZ). Confusing for queries.
**Risk Level**: Low - both columns populated
**Blast Radius**: Rejection queries, admin views
**Action**: Migrate all code to use `rejected_at_ts`, deprecate `rejected_at`

---

### DB-005: Add enum constraint for `orders.status`
**Priority**: P2
**Why it matters**: Status stored as unconstrained TEXT. Invalid statuses could be inserted directly.
**Risk Level**: Medium - data integrity
**Blast Radius**: Order state machine
**Action**: Create enum type or CHECK constraint for valid statuses
**Acceptance**: (1) Constraint allows only: pending, approved, rejected, ready, picked_up, (2) Existing rows validated, (3) Migration with rollback committed

---

### DB-006: Add RLS policies to menu tables
**Priority**: P2
**Why it matters**: Menu/category/option tables have no RLS, relying on app-level auth. Direct DB access could modify menu.
**Risk Level**: Medium - admin-only concern
**Blast Radius**: All menu management
**Action**: Add `USING(true)` for SELECT, restrict INSERT/UPDATE/DELETE to service-role
**Acceptance**: (1) RLS enabled on menu/category/option tables, (2) Public reads work, (3) Admin writes via anon client fail (trigger migration to service-role per API-002)

---

## API

### API-001: Add CSRF protection to all admin mutation routes
**Priority**: P1
**Why it matters**: Only `approve-order` and `adjust-order` have CSRF. Other admin mutations (menu, categories, settings) lack it.
**Risk Level**: Medium - CSRF vulnerability
**Blast Radius**: All admin write operations
**Action**: Add `validateCsrf(request)` to all admin POST/PATCH/DELETE routes
**Acceptance**: (1) All admin POST/PATCH/DELETE routes include CSRF validation, (2) Routes return 403 on invalid CSRF token, (3) No false positives on valid requests

---

### API-002: Migrate admin menu routes from anon to service-role client
**Priority**: P2
**Why it matters**: Admin routes for menu/category/option management use anon client. While auth-gated, they rely on absent RLS.
**Risk Level**: Low - auth gates exist
**Blast Radius**: 25+ admin API routes
**Action**: Switch imports from `@/lib/supabase` to `@/lib/supabase-server`
**Acceptance**: (1) All admin menu/category/option routes use service-role client, (2) Admin dashboard functional, (3) Update 02-supabase-usage-map.md

---

### API-003: Standardize error response format
**Priority**: P3
**Why it matters**: Some routes return `{ error: string }`, others `{ error: string, error_th: string }`, others `{ error: string, details: object }`. Inconsistent.
**Risk Level**: Low - UX only
**Blast Radius**: All API routes, frontend error handling
**Action**: Define standard error schema, migrate all routes

---

### API-004: Add rate limiting to public endpoints
**Priority**: P2
**Why it matters**: `/api/order/validate-cart` and `/api/public/promptpay` have no auth or rate limiting.
**Risk Level**: Medium - abuse potential
**Blast Radius**: Public endpoints
**Action**: Implement rate limiting middleware
**Acceptance**: (1) Public endpoints enforce rate limit (e.g., 100 req/min per IP), (2) Limit returns 429 status, (3) Legit traffic unaffected

---

### API-005: Remove unused `/api/staff/session` route
**Priority**: P3
**Why it matters**: Staff auth uses PIN-based login (`/api/staff/auth/pin`). The `/api/staff/session` route appears redundant.
**Risk Level**: Low
**Blast Radius**: Staff auth flow
**Action**: Verify unused, remove route

---

## CODE

### CODE-001: Remove dead `OrderRow` type from `app/staff/page.tsx`
**Priority**: P3
**Why it matters**: Type defined but no longer used after API route migration. Dead code.
**Risk Level**: Low
**Blast Radius**: Single file
**Action**: Delete unused type

---

### CODE-002: Consolidate Supabase client instantiation patterns
**Priority**: P2
**Why it matters**: Some routes call `getSupabaseServer()`, others instantiate directly with `createClient()`. Inconsistent.
**Risk Level**: Low - both work
**Blast Radius**: API routes with direct instantiation
**Action**: Standardize on `getSupabaseServer()` for all server-side usage

---

### CODE-003: Add TypeScript strict null checks for decimal fields
**Priority**: P2
**Why it matters**: Decimal fields typed as `number | null` in TypeScript but are DECIMAL in DB. Precision loss possible.
**Risk Level**: Medium - rounding errors
**Blast Radius**: Order totals, VAT calculations
**Action**: Use string or Decimal.js for monetary calculations
**Acceptance**: (1) Money types use string or Decimal.js, (2) No floating-point arithmetic on money, (3) VAT calculations remain accurate to 2 decimals

---

### CODE-004: Extract magic strings to constants
**Priority**: P3
**Why it matters**: Status values ('pending', 'approved', etc.), cookie names, error messages scattered as strings.
**Risk Level**: Low - maintenance
**Blast Radius**: Entire codebase
**Action**: Create constants file for status enum, cookie names, etc.

---

### CODE-005: Add JSDoc to lib functions
**Priority**: P3
**Why it matters**: `lib/line.ts`, `lib/adminAuth.ts`, etc. lack documentation. Purpose and params unclear.
**Risk Level**: Low - maintainability
**Blast Radius**: Library files
**Action**: Add JSDoc comments to exported functions

---

## FOLDER/STRUCTURE

### FOLDER-001: Organize API routes by feature
**Priority**: P3
**Why it matters**: Routes split inconsistently (`/api/admin/orders` vs `/api/order`). Some overlap.
**Risk Level**: Low - works as-is
**Blast Radius**: Route organization
**Action**: Consider reorganizing to `/api/customer/*`, `/api/admin/*`, `/api/staff/*`, `/api/public/*`

---

### FOLDER-002: Create shared types directory
**Priority**: P3
**Why it matters**: Types scattered across files. `types/supabase.ts` exists but component-specific types inline.
**Risk Level**: Low - maintenance
**Blast Radius**: Type definitions
**Action**: Consolidate shared types (Order, MenuItem, etc.) to `types/` directory

---

### FOLDER-003: Add API route tests
**Priority**: P2
**Why it matters**: No test files observed. Critical paths (order creation, approval) untested.
**Risk Level**: Medium - regression risk
**Blast Radius**: All API routes
**Action**: Add integration tests for critical flows
**Acceptance**: (1) Tests cover: order create, approve, reject, status update, (2) Tests verify auth/ownership checks, (3) CI runs tests on PR

---

## Summary by Priority

| Priority | Count | Categories |
|----------|-------|------------|
| P0 | 0 | - |
| P1 | 2 | DB (FK validation), API (CSRF) |
| P2 | 7 | DB (status enum, RLS), API (service-role, rate limit), CODE (decimals), FOLDER (tests) |
| P3 | 10 | DB (redundant columns), API (errors), CODE (cleanup), FOLDER (organization) |

---

## Recommended Execution Order

1. **DB-001** - Validate FK constraint (quick win, data integrity)
2. **API-001** - Add CSRF protection (security)
3. **DB-005** - Add status enum constraint (data integrity)
4. **API-004** - Rate limiting on public endpoints (security)
5. **FOLDER-003** - Add API tests (stability before further changes)
6. **API-002** - Migrate admin routes to service-role (consistency)
7. **DB-006** - Add RLS to menu tables (defense in depth)
8. All P3 items (ongoing maintenance)
