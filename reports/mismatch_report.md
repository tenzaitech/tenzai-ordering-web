# TENZAI Supabase Alignment Report

Generated: 2026-01-11

## Summary

**Overall Status: ALIGNED**

The code expectations match the actual Supabase schema with minor observations.

---

## 1. Tables Comparison

### Expected (from types/supabase.ts)
| Table | Status |
|-------|--------|
| admin_settings | OK |
| categories | OK |
| category_option_groups | OK |
| category_schedules | OK |
| menu_item_categories | OK |
| menu_items | OK |
| menu_option_groups | OK |
| option_groups | OK |
| options | OK |
| order_items | OK |
| orders | OK |
| system_settings | OK |

**Result: All 12 tables exist in Supabase**

---

## 2. Column Mismatches

### orders table

| Column | Code Expects | Supabase Has | Status |
|--------|--------------|--------------|--------|
| total_amount | INTEGER (legacy) | NOT PRESENT | OK (deprecated) |
| subtotal_amount | INTEGER (migration) | NOT PRESENT | OK (uses _dec) |
| vat_amount | DECIMAL (migration) | NOT PRESENT | OK (uses _dec) |
| subtotal_amount_dec | number | number | OK |
| vat_amount_dec | number | number | OK |
| total_amount_dec | number | number | OK |

**Note**: The migration added `*_amount_dec` columns instead of the originally planned integer columns. Code correctly uses `*_dec` variants.

### All Other Tables
All columns match between types/supabase.ts and actual schema.

---

## 3. Storage Buckets

| Bucket | Expected | Actual | Public | Status |
|--------|----------|--------|--------|--------|
| slips | YES | YES | true | OK |
| menu-images | YES | YES | true | OK |
| invoices | YES | YES | false | OK |

### Storage Observations

1. **slips bucket**: Public (correct - slip URLs are stored in orders.slip_url and sent to approvers)
2. **menu-images bucket**: Public (correct - image URLs displayed on menu pages)
3. **invoices bucket**: Private (correct - uses signed URLs with 7-day expiry)

**File size limits**:
- slips: 5MB limit
- menu-images: No limit (consider adding)
- invoices: No limit (OK - server-generated PDFs)

---

## 4. RLS Status

All tables have RLS enabled with `USING (true)` policies.

| Table | RLS Enabled | Accessible | Notes |
|-------|-------------|------------|-------|
| admin_settings | YES | YES | SECURITY CONCERN |
| categories | YES | YES | OK (public menu data) |
| category_option_groups | YES | YES | OK |
| category_schedules | YES | YES | OK |
| menu_item_categories | YES | YES | OK |
| menu_items | YES | YES | OK |
| menu_option_groups | YES | YES | OK |
| option_groups | YES | YES | OK |
| options | YES | YES | OK |
| order_items | YES | YES | REVIEW NEEDED |
| orders | YES | YES | REVIEW NEEDED |
| system_settings | YES | YES | REVIEW NEEDED |

### RLS Security Concerns

**HIGH PRIORITY:**
- `admin_settings`: Contains `staff_pin_hash`. Should restrict to service role only.
- `orders`: Contains customer data. Should restrict to customer's own orders via `customer_line_user_id`.
- `order_items`: Should inherit orders restrictions.

**MEDIUM PRIORITY:**
- `system_settings`: Contains operational settings. Should restrict writes to service role.

**Acceptable (MVP):**
- Menu data tables are public read (categories, menu_items, options, etc.)

---

## 5. Missing Columns/Tables

### Code Uses But Not In Schema
None found.

### Schema Has But Code Doesn't Use
- `orders.total_amount` (INTEGER) - Legacy column, deprecated
- `orders.subtotal_amount` (INTEGER) - Legacy column, deprecated

---

## 6. Type Mismatches

| Table.Column | Code Type | DB Type | Issue |
|--------------|-----------|---------|-------|
| None | - | - | - |

All types are compatible.

---

## 7. Foreign Key Analysis

All expected FK relationships are present:
- order_items.order_id -> orders.id
- menu_items.category_code -> categories.category_code
- options.group_code -> option_groups.group_code
- menu_option_groups -> menu_items, option_groups
- category_option_groups -> categories, option_groups
- category_schedules.category_code -> categories.category_code
- menu_item_categories -> menu_items, categories

---

## Recommendations

### Immediate (Security)
1. Restrict `admin_settings` to service_role only
2. Add customer isolation policy to `orders` table
3. Add menu-images bucket file size limit (10MB suggested)

### Future (Hardening)
1. Remove deprecated legacy columns (total_amount, subtotal_amount, vat_amount INTEGER versions)
2. Add explicit NOT NULL constraints for required invoice fields when invoice_requested=true
3. Add storage bucket policies for object-level access control

---

## Appendix: Code Evidence

### Orders table usage
- `app/order/checkout/page.tsx:242-264` - Creates order with *_dec columns
- `lib/line.ts:446-469` - Reads order for notifications
- `app/api/admin/approve-order/route.ts:32-36` - Updates order status

### Storage usage
- `app/order/payment/page.tsx:298-301` - Uploads slips to 'slips' bucket
- `lib/invoice/storage.ts:29-47` - Uploads invoices to 'invoices' bucket
- `lib/storage-upload.ts` - Menu image uploads via signed URLs

### Admin settings usage
- `lib/line.ts:78-90` - Reads LINE recipient IDs
- `app/order/payment/page.tsx:115-123` - Reads promptpay_id
