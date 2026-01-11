# Post-SQL Verification Checklist

Generated: 2026-01-11
Purpose: Verify `proposed_fixes.sql` was applied correctly

---

## 1. Summary of Intended Fixes (5 bullets)

1. **Harden `admin_settings` RLS**: Replace permissive "Allow all" policy with service_role-only write access + anon read access (protects `staff_pin_hash`)

2. **Harden `orders` RLS**: Replace single permissive policy with granular policies: service_role full access, anon INSERT/SELECT/UPDATE (MVP-level, still open but explicit)

3. **Harden `order_items` RLS**: Same pattern as orders - service_role full access, anon INSERT/SELECT

4. **Harden `system_settings` RLS**: Restrict writes to service_role only, allow anon read

5. **Add performance indexes**: Three new indexes on `orders` table for customer lookup, status filtering, and admin dashboard queries

---

## 2. Changes Attempted (by category)

### RLS / Policies

| Table | Action | Policy Name |
|-------|--------|-------------|
| `admin_settings` | DROP | `Allow all operations on admin_settings` |
| `admin_settings` | CREATE | `Service role full access on admin_settings` (ALL, service_role) |
| `admin_settings` | CREATE | `Allow anon to read admin_settings display fields` (SELECT, true) |
| `orders` | DROP | `Allow all operations on orders` |
| `orders` | CREATE | `Service role full access on orders` (ALL, service_role) |
| `orders` | CREATE | `Anon can create orders` (INSERT, true) |
| `orders` | CREATE | `Anon can read all orders (MVP)` (SELECT, true) |
| `orders` | CREATE | `Anon can update orders (MVP)` (UPDATE, true) |
| `order_items` | DROP | `Allow all operations on order_items` |
| `order_items` | CREATE | `Service role full access on order_items` (ALL, service_role) |
| `order_items` | CREATE | `Anon can create order_items` (INSERT, true) |
| `order_items` | CREATE | `Anon can read order_items (MVP)` (SELECT, true) |
| `system_settings` | DROP | `Allow all operations on system_settings` |
| `system_settings` | CREATE | `Service role full access on system_settings` (ALL, service_role) |
| `system_settings` | CREATE | `Anon can read system_settings` (SELECT, true) |

**Total: 4 policies dropped, 14 policies created**

### Grants / Privileges

None attempted.

### Indexes

| Table | Index Name | Columns | Type |
|-------|------------|---------|------|
| `orders` | `idx_orders_customer_line_user_id` | `customer_line_user_id` | Partial (WHERE NOT NULL) |
| `orders` | `idx_orders_status` | `status` | Regular |
| `orders` | `idx_orders_status_created_at` | `status, created_at DESC` | Composite |

**Total: 3 indexes created**

### Schema Changes (Commented Out - NOT Applied)

These were commented out in the SQL file:
- `DROP COLUMN orders.total_amount` (not executed)
- `DROP COLUMN orders.subtotal_amount` (not executed)
- `DROP COLUMN orders.vat_amount` (not executed)
- `ADD CONSTRAINT check_invoice_fields` (not executed)

### Storage Bucket Changes

None via SQL. Note in file recommends:
- Set `menu-images` file_size_limit to 10MB via Dashboard

### Anything Else

None.

---

## 3. Verification Queries

Run these in **Supabase SQL Editor** to confirm changes.

### 3.1 Verify RLS Policies Exist

```sql
-- List all policies on affected tables
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('admin_settings', 'orders', 'order_items', 'system_settings')
ORDER BY tablename, policyname;
```

**Expected Results:**

| tablename | policyname | cmd |
|-----------|------------|-----|
| admin_settings | Allow anon to read admin_settings display fields | SELECT |
| admin_settings | Service role full access on admin_settings | ALL |
| order_items | Anon can create order_items | INSERT |
| order_items | Anon can read order_items (MVP) | SELECT |
| order_items | Service role full access on order_items | ALL |
| orders | Anon can create orders | INSERT |
| orders | Anon can read all orders (MVP) | SELECT |
| orders | Anon can update orders (MVP) | UPDATE |
| orders | Service role full access on orders | ALL |
| system_settings | Anon can read system_settings | SELECT |
| system_settings | Service role full access on system_settings | ALL |

### 3.2 Verify OLD Policies Are Gone

```sql
-- Confirm old permissive policies no longer exist
SELECT policyname
FROM pg_policies
WHERE policyname LIKE 'Allow all operations on %'
  AND tablename IN ('admin_settings', 'orders', 'order_items', 'system_settings');
```

**Expected Result:** Empty (0 rows)

### 3.3 Verify Policy Details (admin_settings)

```sql
-- Check admin_settings has exactly 2 policies
SELECT
  policyname,
  cmd,
  roles,
  qual AS using_clause,
  with_check
FROM pg_policies
WHERE tablename = 'admin_settings';
```

**Expected:**
- 2 rows
- One with `cmd = 'ALL'` and `qual` containing `service_role`
- One with `cmd = 'SELECT'` and `qual = 'true'`

### 3.4 Verify Indexes Exist

```sql
-- List indexes on orders table
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'orders'
  AND indexname IN (
    'idx_orders_customer_line_user_id',
    'idx_orders_status',
    'idx_orders_status_created_at'
  );
```

**Expected Results:**

| indexname | indexdef (contains) |
|-----------|---------------------|
| idx_orders_customer_line_user_id | `(customer_line_user_id) WHERE (customer_line_user_id IS NOT NULL)` |
| idx_orders_status | `(status)` |
| idx_orders_status_created_at | `(status, created_at DESC)` |

### 3.5 Verify RLS Is Still Enabled

```sql
-- Confirm RLS is enabled on all affected tables
SELECT
  relname AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relname IN ('admin_settings', 'orders', 'order_items', 'system_settings')
  AND relkind = 'r';
```

**Expected:** All rows should show `rls_enabled = true`

### 3.6 Verify Legacy Columns Still Exist (if NOT dropped)

```sql
-- Check if legacy columns still exist (they should, since DROP was commented out)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'orders'
  AND column_name IN ('total_amount', 'subtotal_amount', 'vat_amount');
```

**Expected (if drops were NOT applied):** 0-3 rows depending on prior state
**Expected (if drops WERE applied):** 0 rows

### 3.7 Quick Policy Count Check

```sql
-- Summary count of policies per table
SELECT
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE tablename IN ('admin_settings', 'orders', 'order_items', 'system_settings')
GROUP BY tablename
ORDER BY tablename;
```

**Expected:**

| tablename | policy_count |
|-----------|--------------|
| admin_settings | 2 |
| order_items | 3 |
| orders | 4 |
| system_settings | 2 |

---

## 4. If Verification Fails

### Policy Missing

**Symptom:** Expected policy not found in `pg_policies`

**Likely Causes:**
- SQL syntax error during execution (check Supabase logs)
- Policy name typo in CREATE statement
- DROP succeeded but CREATE failed

**Safe Next Action:**
1. Re-run the specific CREATE POLICY statement from `proposed_fixes.sql`
2. Check for error messages in SQL Editor output

### Old Policy Still Exists

**Symptom:** `Allow all operations on X` still appears in `pg_policies`

**Likely Causes:**
- DROP POLICY statement failed
- Policy name mismatch (case-sensitive)

**Safe Next Action:**
1. Verify exact policy name: `SELECT policyname FROM pg_policies WHERE tablename = 'X';`
2. Re-run DROP with exact name

### Index Missing

**Symptom:** Expected index not found in `pg_indexes`

**Likely Causes:**
- CREATE INDEX syntax error
- Index already exists with different name
- Insufficient privileges

**Safe Next Action:**
1. Check if similar index exists: `SELECT * FROM pg_indexes WHERE tablename = 'orders';`
2. Re-run CREATE INDEX IF NOT EXISTS

### RLS Disabled

**Symptom:** `rls_enabled = false` in pg_class

**Likely Causes:**
- RLS was disabled by another migration
- Table was recreated without RLS

**Safe Next Action:**
```sql
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
```

### Application Errors After Apply

**Symptom:** App returns 403/permission denied errors

**Likely Causes:**
- Policies too restrictive
- `auth.role()` not returning expected value
- Anon key operations now blocked

**Safe Next Action:**
1. Temporarily add permissive policy: `CREATE POLICY "temp_debug" ON <table> FOR ALL USING (true);`
2. Test app functionality
3. Remove temp policy and refine original

### General Troubleshooting Query

```sql
-- Full diagnostic for a specific table
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  p.policyname,
  p.cmd,
  p.qual,
  p.with_check
FROM pg_class c
LEFT JOIN pg_policies p ON c.relname = p.tablename
WHERE c.relname = 'orders'  -- Change table name as needed
  AND c.relkind = 'r';
```

---

## Summary Checklist

| Check | Query Section | Pass Criteria |
|-------|---------------|---------------|
| Old policies removed | 3.2 | 0 rows returned |
| New policies exist | 3.1 | 11 policies across 4 tables |
| admin_settings secured | 3.3 | 2 policies, 1 service_role-only |
| Indexes created | 3.4 | 3 indexes found |
| RLS still enabled | 3.5 | All tables show `true` |
| Policy counts correct | 3.7 | 2, 3, 4, 2 for each table |

---

*Run all verification queries before confirming deployment success.*
