# Legacy Columns Documentation

**Status**: Documented for awareness. Do NOT remove without explicit approval.

---

## Overview

The database contains some redundant columns that exist for historical compatibility.
These columns are **intentionally kept** to support gradual migration and fallback scenarios.

---

## 1. menu_items.category_code (Legacy Fallback)

### Context

Originally, menu items had a single category via `menu_items.category_code`.
Multi-category support was added via the `menu_item_categories` join table.

### Current State

| Column | Location | Purpose |
|--------|----------|---------|
| `category_code` | `menu_items` | **Legacy fallback** for items without multi-category assignment |
| `category_code` | `menu_item_categories` | **Primary** for multi-category support |

### Usage Pattern

```typescript
// From validate-cart route (app/api/order/validate-cart/route.ts)
// 1. First, try menu_item_categories
const menuCategories = await supabase
  .from('menu_item_categories')
  .select('menu_code, category_code')
  .in('menu_code', menuCodes)

// 2. Fallback to legacy column for items without join table entries
const legacyMenuItems = await supabase
  .from('menu_items')
  .select('menu_code, category_code')
  .in('menu_code', menuCodes)

// 3. Merge: use join table if exists, else use legacy
for (const item of legacyMenuItems) {
  if (!menuCategoryMap.has(item.menu_code) && item.category_code) {
    menuCategoryMap.set(item.menu_code, [item.category_code])
  }
}
```

### Why Keep It

1. **Gradual migration**: Existing items work without updating join table
2. **FK constraint**: `menu_items.category_code` references `categories(category_code)`
3. **Admin panel**: May still create items with single category initially

### Future Removal Criteria

Remove `menu_items.category_code` when:
- [ ] All menu items have entries in `menu_item_categories`
- [ ] Admin panel always creates join table entries
- [ ] No code references the legacy column
- [ ] FK constraint dropped

---

## 2. order_items.menu_code (Redundant Clarity)

### Context

Originally, `order_items.menu_item_id` stored the menu code (TEXT).
`order_items.menu_code` was added for clarity and FK relationship.

### Current State

| Column | Location | Purpose |
|--------|----------|---------|
| `menu_item_id` | `order_items` | Original reference (still used) |
| `menu_code` | `order_items` | Redundant for clarity + FK |

### Relationship

```sql
-- From migration 20250112_001_db_redesign_v1.sql
-- menu_code is backfilled from menu_item_id
UPDATE order_items
SET menu_code = menu_item_id
WHERE menu_code IS NULL
  AND menu_item_id IS NOT NULL;

-- FK constraint (NOT VALID - may have orphaned data)
ALTER TABLE order_items
ADD CONSTRAINT fk_order_items_menu_code
FOREIGN KEY (menu_code) REFERENCES menu_items(menu_code)
NOT VALID;
```

### Why Keep Both

1. **Backward compatibility**: Existing code uses `menu_item_id`
2. **FK enforcement**: `menu_code` enables FK relationship
3. **Low cost**: Storage overhead is minimal
4. **Query flexibility**: Either column works for lookups

### Future Removal Criteria

Consider consolidating when:
- [ ] All code migrated to use `menu_code` consistently
- [ ] FK constraint validated (no orphaned data)
- [ ] TypeScript types updated
- [ ] Rename `menu_code` to `menu_item_id` or vice versa

---

## 3. orders.rejected_at vs rejected_at_ts

### Context

Originally, `rejected_at` was a text/timestamp column with inconsistent format.
`rejected_at_ts` was added as TIMESTAMPTZ for proper timezone handling.

### Current State

| Column | Type | Purpose |
|--------|------|---------|
| `rejected_at` | TEXT/TIMESTAMP (legacy) | Original rejection timestamp |
| `rejected_at_ts` | TIMESTAMPTZ | Normalized rejection timestamp |

### Backfill Logic

```sql
-- From migration 20250112_001_db_redesign_v1.sql
-- Exception-safe backfill (skips unparseable values)
UPDATE orders
SET rejected_at_ts = rejected_at::timestamptz
WHERE rejected_at IS NOT NULL
  AND rejected_at_ts IS NULL;
```

### Why Keep Both

1. **Data preservation**: Some `rejected_at` values may not parse cleanly
2. **Audit trail**: Original values preserved
3. **Code transition**: Gradual migration to use `rejected_at_ts`

### Future Removal Criteria

Remove `rejected_at` when:
- [ ] All queries use `rejected_at_ts`
- [ ] Backfill verified complete (no NULL `rejected_at_ts` where `rejected_at` exists)
- [ ] TypeScript types updated
- [ ] API responses updated

---

## Summary Table

| Column | Table | Status | Action |
|--------|-------|--------|--------|
| `menu_items.category_code` | menu_items | Legacy fallback | Keep until multi-category fully adopted |
| `order_items.menu_code` | order_items | Redundant | Keep for FK relationship |
| `order_items.menu_item_id` | order_items | Original | Keep for backward compatibility |
| `orders.rejected_at` | orders | Legacy | Keep until `rejected_at_ts` adoption complete |
| `orders.rejected_at_ts` | orders | Canonical | Use this for new code |

---

## Cleanup Priority

**Low priority** - These columns do not cause issues:
- Storage overhead is minimal
- No runtime performance impact
- Provides migration flexibility

**Do not remove** without:
1. Explicit owner approval
2. Full code audit
3. Data migration verification
4. TypeScript type updates
