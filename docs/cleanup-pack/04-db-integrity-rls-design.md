# Database Integrity & RLS Design

## Overview

This document proposes:
1. **DB-005**: `orders.status` constraint (enum or CHECK)
2. **DB-006**: RLS strategy for menu-related tables

---

## DB-005: orders.status Constraint

### Current State

- `orders.status` is stored as `TEXT` with no database-level constraint
- Valid values are enforced only at application level
- Risk: Invalid statuses could be inserted via direct DB access

### Known Valid Statuses

```
pending    → Initial state after order creation
approved   → Admin approved payment
rejected   → Admin rejected payment
ready      → Staff marked as ready for pickup
picked_up  → Customer picked up order
```

### Option A: CHECK Constraint (Recommended)

**Pros:**
- Simple to implement
- Easy to modify (add new statuses)
- No new types to manage
- Works with existing NULL default

**Cons:**
- Less strict than enum
- Status list duplicated in constraint and app code

**SQL (Forward):**
```sql
-- Add CHECK constraint for valid statuses
ALTER TABLE orders
ADD CONSTRAINT chk_orders_status
CHECK (status IS NULL OR status IN ('pending', 'approved', 'rejected', 'ready', 'picked_up'));
```

**SQL (Rollback):**
```sql
ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_status;
```

---

### Option B: Enum Type

**Pros:**
- Strict type safety
- Self-documenting
- Prevents typos at DB level

**Cons:**
- Harder to modify (ALTER TYPE is complex)
- Requires migration for new statuses
- Enum changes require special handling

**SQL (Forward):**
```sql
-- Create enum type
CREATE TYPE order_status AS ENUM ('pending', 'approved', 'rejected', 'ready', 'picked_up');

-- Add new column with enum type
ALTER TABLE orders ADD COLUMN status_enum order_status;

-- Backfill from existing status column
UPDATE orders SET status_enum = status::order_status WHERE status IS NOT NULL;

-- Optional: Drop old column and rename
-- ALTER TABLE orders DROP COLUMN status;
-- ALTER TABLE orders RENAME COLUMN status_enum TO status;
```

**SQL (Rollback):**
```sql
-- If columns were swapped, reverse them
-- ALTER TABLE orders RENAME COLUMN status TO status_enum;
-- ALTER TABLE orders ADD COLUMN status TEXT;
-- UPDATE orders SET status = status_enum::TEXT;

ALTER TABLE orders DROP COLUMN IF EXISTS status_enum;
DROP TYPE IF EXISTS order_status;
```

---

### Recommendation: Option A (CHECK Constraint)

Rationale:
- Simpler implementation
- Easier to add new statuses in future
- Lower risk of migration issues
- Matches existing pattern (no enums used elsewhere)

---

## DB-006: RLS Strategy for Menu Tables

### Current State

| Table | RLS | Current Access |
|-------|-----|----------------|
| `menu_items` | Disabled | Anon: full access |
| `categories` | Disabled | Anon: full access |
| `option_groups` | Disabled | Anon: full access |
| `options` | Disabled | Anon: full access |
| `menu_item_categories` | Disabled | Anon: full access |
| `menu_option_groups` | Disabled | Anon: full access |
| `category_option_groups` | Disabled | Anon: full access |
| `category_schedules` | Disabled | Anon: full access |

### Risk Assessment

- **Read Access**: Public menu data should be readable (low risk)
- **Write Access**: Only admins should modify (HIGH RISK with anon key)
- Current Protection: App-level `checkAdminAuth` on write routes

### Strategy Options

#### Option A: Full Lockdown (Like orders/order_items)

Lock all menu tables to service_role only.

**Pros:**
- Maximum security
- Consistent with order tables pattern

**Cons:**
- Requires migrating ALL menu reads to API routes
- Significant code changes
- Server pages using anon client would break

**Verdict**: Too disruptive, not recommended

---

#### Option B: Read-Public, Write-Restricted (Recommended)

Allow public reads, restrict writes to service_role.

**Pros:**
- Maintains current read behavior
- Protects against unauthorized writes
- Minimal code changes needed
- Server pages continue to work

**Cons:**
- Anon key can still read all menu data (acceptable)

---

#### Option C: No RLS, Rely on App Auth

Keep current state, trust application-level auth.

**Pros:**
- No changes needed
- Works if anon key not exposed

**Cons:**
- Vulnerable if anon key is compromised
- No defense in depth

---

### Recommended: Option B Implementation

**SQL (Forward):**

```sql
-- ============================================================================
-- MENU TABLES RLS: Read-Public, Write-Service-Role
-- ============================================================================

-- menu_items
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access" ON menu_items;
DROP POLICY IF EXISTS "Service role write access" ON menu_items;

CREATE POLICY "Public read access"
ON menu_items FOR SELECT
USING (true);

CREATE POLICY "Deny write for non-service-role"
ON menu_items FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny update for non-service-role"
ON menu_items FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny delete for non-service-role"
ON menu_items FOR DELETE
USING (false);

-- categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read access" ON categories;

CREATE POLICY "Public read access"
ON categories FOR SELECT
USING (true);

CREATE POLICY "Deny write for non-service-role"
ON categories FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny update for non-service-role"
ON categories FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny delete for non-service-role"
ON categories FOR DELETE
USING (false);

-- option_groups
ALTER TABLE option_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
ON option_groups FOR SELECT
USING (true);

CREATE POLICY "Deny write for non-service-role"
ON option_groups FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny update for non-service-role"
ON option_groups FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny delete for non-service-role"
ON option_groups FOR DELETE
USING (false);

-- options
ALTER TABLE options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
ON options FOR SELECT
USING (true);

CREATE POLICY "Deny write for non-service-role"
ON options FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny update for non-service-role"
ON options FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny delete for non-service-role"
ON options FOR DELETE
USING (false);

-- menu_item_categories
ALTER TABLE menu_item_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
ON menu_item_categories FOR SELECT
USING (true);

CREATE POLICY "Deny write for non-service-role"
ON menu_item_categories FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny update for non-service-role"
ON menu_item_categories FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny delete for non-service-role"
ON menu_item_categories FOR DELETE
USING (false);

-- menu_option_groups
ALTER TABLE menu_option_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
ON menu_option_groups FOR SELECT
USING (true);

CREATE POLICY "Deny write for non-service-role"
ON menu_option_groups FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny update for non-service-role"
ON menu_option_groups FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny delete for non-service-role"
ON menu_option_groups FOR DELETE
USING (false);

-- category_option_groups
ALTER TABLE category_option_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
ON category_option_groups FOR SELECT
USING (true);

CREATE POLICY "Deny write for non-service-role"
ON category_option_groups FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny update for non-service-role"
ON category_option_groups FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny delete for non-service-role"
ON category_option_groups FOR DELETE
USING (false);

-- category_schedules
ALTER TABLE category_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access"
ON category_schedules FOR SELECT
USING (true);

CREATE POLICY "Deny write for non-service-role"
ON category_schedules FOR INSERT
WITH CHECK (false);

CREATE POLICY "Deny update for non-service-role"
ON category_schedules FOR UPDATE
USING (false)
WITH CHECK (false);

CREATE POLICY "Deny delete for non-service-role"
ON category_schedules FOR DELETE
USING (false);
```

**SQL (Rollback):**

```sql
-- ============================================================================
-- ROLLBACK: Disable RLS on menu tables
-- ============================================================================

-- menu_items
DROP POLICY IF EXISTS "Public read access" ON menu_items;
DROP POLICY IF EXISTS "Deny write for non-service-role" ON menu_items;
DROP POLICY IF EXISTS "Deny update for non-service-role" ON menu_items;
DROP POLICY IF EXISTS "Deny delete for non-service-role" ON menu_items;
ALTER TABLE menu_items DISABLE ROW LEVEL SECURITY;

-- categories
DROP POLICY IF EXISTS "Public read access" ON categories;
DROP POLICY IF EXISTS "Deny write for non-service-role" ON categories;
DROP POLICY IF EXISTS "Deny update for non-service-role" ON categories;
DROP POLICY IF EXISTS "Deny delete for non-service-role" ON categories;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;

-- option_groups
DROP POLICY IF EXISTS "Public read access" ON option_groups;
DROP POLICY IF EXISTS "Deny write for non-service-role" ON option_groups;
DROP POLICY IF EXISTS "Deny update for non-service-role" ON option_groups;
DROP POLICY IF EXISTS "Deny delete for non-service-role" ON option_groups;
ALTER TABLE option_groups DISABLE ROW LEVEL SECURITY;

-- options
DROP POLICY IF EXISTS "Public read access" ON options;
DROP POLICY IF EXISTS "Deny write for non-service-role" ON options;
DROP POLICY IF EXISTS "Deny update for non-service-role" ON options;
DROP POLICY IF EXISTS "Deny delete for non-service-role" ON options;
ALTER TABLE options DISABLE ROW LEVEL SECURITY;

-- menu_item_categories
DROP POLICY IF EXISTS "Public read access" ON menu_item_categories;
DROP POLICY IF EXISTS "Deny write for non-service-role" ON menu_item_categories;
DROP POLICY IF EXISTS "Deny update for non-service-role" ON menu_item_categories;
DROP POLICY IF EXISTS "Deny delete for non-service-role" ON menu_item_categories;
ALTER TABLE menu_item_categories DISABLE ROW LEVEL SECURITY;

-- menu_option_groups
DROP POLICY IF EXISTS "Public read access" ON menu_option_groups;
DROP POLICY IF EXISTS "Deny write for non-service-role" ON menu_option_groups;
DROP POLICY IF EXISTS "Deny update for non-service-role" ON menu_option_groups;
DROP POLICY IF EXISTS "Deny delete for non-service-role" ON menu_option_groups;
ALTER TABLE menu_option_groups DISABLE ROW LEVEL SECURITY;

-- category_option_groups
DROP POLICY IF EXISTS "Public read access" ON category_option_groups;
DROP POLICY IF EXISTS "Deny write for non-service-role" ON category_option_groups;
DROP POLICY IF EXISTS "Deny update for non-service-role" ON category_option_groups;
DROP POLICY IF EXISTS "Deny delete for non-service-role" ON category_option_groups;
ALTER TABLE category_option_groups DISABLE ROW LEVEL SECURITY;

-- category_schedules
DROP POLICY IF EXISTS "Public read access" ON category_schedules;
DROP POLICY IF EXISTS "Deny write for non-service-role" ON category_schedules;
DROP POLICY IF EXISTS "Deny update for non-service-role" ON category_schedules;
DROP POLICY IF EXISTS "Deny delete for non-service-role" ON category_schedules;
ALTER TABLE category_schedules DISABLE ROW LEVEL SECURITY;
```

---

## Code Changes Required for RLS

After enabling RLS with write-deny policies, admin API routes using anon client will fail. These routes must migrate to service-role:

| Route | Current | Required |
|-------|---------|----------|
| `/api/admin/menu/*` | `@/lib/supabase` | `@/lib/supabase-server` |
| `/api/admin/categories/*` | `@/lib/supabase` | `@/lib/supabase-server` |
| `/api/admin/option-groups/*` | `@/lib/supabase` | `@/lib/supabase-server` |
| `/api/admin/import-menu` | `@/lib/supabase` | `@/lib/supabase-server` |

**Total routes to update**: ~25

---

## Risk Notes

### DB-005 (Status Constraint)
| Risk | Mitigation |
|------|------------|
| Existing invalid data | Query first to identify violations |
| New status needed | Simple ALTER to modify CHECK |
| Application code mismatch | Update constants file |

### DB-006 (Menu RLS)
| Risk | Mitigation |
|------|------------|
| Admin routes break | Migrate to service-role BEFORE enabling RLS |
| Server pages break | Reads still work (public read policy) |
| Performance impact | Minimal - RLS adds policy check overhead |
| Rollback needed | Drop policies, disable RLS |

---

## Execution Dependencies

```
DB-005 (Status Constraint)
  └── Can run independently

DB-006 (Menu RLS)
  └── Requires: Admin routes migrated to service-role client
      └── See docs/audit/02-supabase-usage-map.md for full list
```
