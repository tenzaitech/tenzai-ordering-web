# Cleanup Backlog

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

---

### DB-006: Add RLS policies to menu tables
**Priority**: P2
**Why it matters**: Menu/category/option tables have no RLS, relying on app-level auth. Direct DB access could modify menu.
**Risk Level**: Medium - admin-only concern
**Blast Radius**: All menu management
**Action**: Add `USING(true)` for SELECT, restrict INSERT/UPDATE/DELETE to service_role

---

## API

### API-001: Add CSRF protection to all admin mutation routes
**Priority**: P1
**Why it matters**: Only `approve-order` and `adjust-order` have CSRF. Other admin mutations (menu, categories, settings) lack it.
**Risk Level**: Medium - CSRF vulnerability
**Blast Radius**: All admin write operations
**Action**: Add `validateCsrf(request)` to all admin POST/PATCH/DELETE routes

---

### API-002: Migrate admin menu routes from anon to service-role client
**Priority**: P2
**Why it matters**: Admin routes for menu/category/option management use anon client. While auth-gated, they rely on absent RLS.
**Risk Level**: Low - auth gates exist
**Blast Radius**: 25+ admin API routes
**Action**: Switch imports from `@/lib/supabase` to `@/lib/supabase-server`

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

---

## Summary by Priority

| Priority | Count | Categories |
|----------|-------|------------|
| P0 | 0 | - |
| P1 | 2 | DB (FK validation), API (CSRF) |
| P2 | 7 | DB (status enum, RLS), API (service-role, rate limit), CODE (decimals), FOLDER (tests) |
| P3 | 9 | DB (redundant columns), API (errors), CODE (cleanup), FOLDER (organization) |

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
