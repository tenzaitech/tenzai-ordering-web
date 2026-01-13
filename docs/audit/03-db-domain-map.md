# Database Domain Map

## TL;DR
- **17 tables** across 5 domains: Orders, Menu, Options, Schedule, Settings/Security
- **RLS locked**: orders, order_items (service_role ONLY)
- **No RLS**: All menu/category/option tables (app-level auth)
- **Key redundancies**: `menu_code` vs `menu_item_id`, `rejected_at` vs `rejected_at_ts`, `category_code` legacy column
- **Schema state**: Stable post-redesign, changes allowed but controlled (migration required)
- **Foreign key gap**: `fk_order_items_menu_code` is NOT VALID (orphans may exist)

## When Confused → Do This
1. **"What columns in table X?"** → Ctrl+F table name, see column list
2. **"Is table Y protected by RLS?"** → See "RLS Policy Summary" section
3. **"Which tables store money?"** → orders (`subtotal_amount_dec`, `vat_amount_dec`, `total_amount_dec`)
4. **"Where is order status?"** → `orders.status` (TEXT, no constraint - see backlog DB-005)
5. **"Where are menu options stored?"** → `options` table (belongs to `option_groups`)
6. **"How to find order items?"** → `order_items.order_id` FK → `orders.id`
7. **"Known schema issues?"** → See "Redundancies & Concerns" section + [04-cleanup-backlog.md](04-cleanup-backlog.md)

## Current Truth / Invariants
- **Order state**: `orders.status` is authoritative (pending/approved/rejected/ready/picked_up)
- **Money columns**: DECIMAL(10,2) (use string or Decimal.js in TypeScript to avoid precision loss)
- **Order ownership**: `orders.customer_line_user_id` (TEXT, nullable)
- **Menu reference**: `order_items.menu_code` snapshots item at order time
- **VAT rate**: `orders.vat_rate` (typically 7% = 0.07)
- **Payment proof**: `orders.slip_url` (TEXT, Supabase Storage path)
- **Foreign keys**: NOT VALID constraint on `order_items.menu_code` (needs validation - see backlog DB-001)
- **Legacy columns**: `menu_items.category_code`, `orders.rejected_at` (TEXT) exist but superseded

## Overview

**Total Tables**: 17
**Domains**: Orders, Menu, Options, Schedule, Settings/Security

---

## Tables by Domain

### ORDERS Domain

#### `orders` (Core Business Entity)
Primary order record tracking the complete lifecycle.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `order_number` | TEXT | NO | Human-readable order code |
| `status` | TEXT | YES | Order state (pending/approved/rejected/ready/picked_up) |
| `customer_name` | TEXT | NO | Customer display name |
| `customer_phone` | TEXT | NO | Contact phone |
| `customer_line_user_id` | TEXT | YES | LINE user ID for ownership |
| `customer_line_display_name` | TEXT | YES | LINE display name |
| `customer_note` | TEXT | YES | Special instructions |
| `pickup_type` | TEXT | NO | ASAP or SCHEDULED |
| `pickup_time` | TIMESTAMPTZ | YES | Scheduled pickup time |
| `subtotal_amount_dec` | DECIMAL(10,2) | YES | Pre-tax amount |
| `vat_rate` | DECIMAL(5,2) | YES | VAT percentage (7%) |
| `vat_amount_dec` | DECIMAL(10,2) | YES | Calculated VAT |
| `total_amount_dec` | DECIMAL(10,2) | YES | Final total |
| `slip_url` | TEXT | YES | Payment slip image URL |
| `slip_notified_at` | TIMESTAMPTZ | YES | When slip notification sent |
| `approved_by` | TEXT | YES | Admin who approved |
| `approved_at` | TIMESTAMPTZ | YES | Approval timestamp |
| `rejected_by` | TEXT | YES | (via rejected_at) |
| `rejected_at` | TEXT | YES | Legacy rejection timestamp |
| `rejected_at_ts` | TIMESTAMPTZ | YES | New rejection timestamp |
| `adjusted_by` | TEXT | YES | Admin who adjusted |
| `adjusted_at` | TIMESTAMPTZ | YES | Adjustment timestamp |
| `adjustment_note` | TEXT | YES | Adjustment details |
| `invoice_requested` | BOOLEAN | YES | Customer requested invoice |
| `invoice_company_name` | TEXT | YES | Invoice company |
| `invoice_tax_id` | TEXT | YES | Invoice tax ID |
| `invoice_address` | TEXT | YES | Invoice address |
| `invoice_buyer_phone` | TEXT | YES | Invoice phone |
| `created_at` | TIMESTAMPTZ | NO | Order creation time |
| `updated_at` | TIMESTAMPTZ | YES | Last update time |

**RLS Policy**: `Deny all for non-service-role` (locked to service_role only)

**Indexes**:
- `idx_orders_customer_line_user_id` - Customer order lookups
- `idx_orders_status` - Status filtering
- `idx_orders_rejected_at_ts` - Rejection queries
- `idx_orders_customer_status` - Composite for customer+status

---

#### `order_items` (Line Items)
Individual items within an order.

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `order_id` | UUID | NO | FK → orders.id |
| `menu_item_id` | TEXT | YES | Product reference (primary) |
| `menu_code` | TEXT | YES | Product reference (redundant) |
| `name_th` | TEXT | NO | Thai name (snapshot) |
| `name_en` | TEXT | YES | English name (snapshot) |
| `base_price` | DECIMAL | NO | Original price |
| `final_price` | DECIMAL | NO | Price after options |
| `qty` | INTEGER | NO | Quantity |
| `selected_options_json` | JSONB | YES | Selected option choices |
| `note` | TEXT | YES | Item-specific note |
| `created_at` | TIMESTAMPTZ | NO | Creation time |

**RLS Policy**: `Deny all for non-service-role` (locked to service_role only)

**Indexes**:
- `idx_order_items_order_id` - Order item lookups
- `idx_order_items_menu_code` - Menu item reference

**Foreign Keys**:
- `order_id` → `orders.id`
- `fk_order_items_menu_code` → `menu_items.menu_code` (NOT VALID)

---

### MENU Domain

#### `menu_items` (Product Catalog)
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `menu_code` | TEXT | NO | Primary key |
| `name_th` | TEXT | NO | Thai name |
| `name_en` | TEXT | YES | English name |
| `description` | TEXT | YES | Description |
| `price` | DECIMAL | NO | Base price |
| `promo_price` | DECIMAL | YES | Promotional price |
| `promo_label` | TEXT | YES | Promo badge text |
| `promo_percent` | INTEGER | YES | Discount percentage (0-100) |
| `image_url` | TEXT | YES | Image URL |
| `image_focus_y_1x1` | DECIMAL | YES | 1:1 crop focus point |
| `image_focus_y_4x3` | DECIMAL | YES | 4:3 crop focus point |
| `barcode` | TEXT | YES | Product barcode |
| `category_code` | TEXT | YES | Legacy FK (superseded) |
| `is_active` | BOOLEAN | NO | Availability flag |
| `created_at` | TIMESTAMPTZ | NO | Creation time |
| `updated_at` | TIMESTAMPTZ | YES | Last update |

**RLS**: None (public readable)

---

#### `categories` (Menu Sections)
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `category_code` | TEXT | NO | Primary key |
| `name` | TEXT | NO | Category name |
| `created_at` | TIMESTAMPTZ | NO | Creation time |
| `updated_at` | TIMESTAMPTZ | YES | Last update |

**RLS**: None (public readable)

---

#### `menu_item_categories` (Multi-Category Join)
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `menu_code` | TEXT | NO | FK → menu_items |
| `category_code` | TEXT | NO | FK → categories |
| `sort_order` | INTEGER | YES | Display order in category |

**Primary Key**: (`menu_code`, `category_code`)

**Index**: `idx_menu_item_categories_category`

---

### OPTIONS Domain

#### `option_groups` (Option Categories)
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `group_code` | TEXT | NO | Primary key |
| `group_name` | TEXT | NO | Display name |
| `is_required` | BOOLEAN | NO | Must select at least one |
| `max_select` | INTEGER | YES | Max selections allowed |
| `created_at` | TIMESTAMPTZ | NO | Creation time |
| `updated_at` | TIMESTAMPTZ | YES | Last update |

---

#### `options` (Option Choices)
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `group_code` | TEXT | NO | FK → option_groups |
| `option_code` | TEXT | NO | Option identifier |
| `option_name` | TEXT | NO | Display name |
| `price_delta` | DECIMAL | NO | Price modifier |
| `sort_order` | INTEGER | YES | Display order |
| `created_at` | TIMESTAMPTZ | NO | Creation time |
| `updated_at` | TIMESTAMPTZ | YES | Last update |

**Primary Key**: (`group_code`, `option_code`)

---

#### `menu_option_groups` (Item-Level Options)
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `menu_code` | TEXT | NO | FK → menu_items |
| `group_code` | TEXT | NO | FK → option_groups |
| `created_at` | TIMESTAMPTZ | NO | Creation time |

**Primary Key**: (`menu_code`, `group_code`)

---

#### `category_option_groups` (Category-Level Defaults)
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `category_code` | TEXT | NO | FK → categories |
| `group_code` | TEXT | NO | FK → option_groups |

**Primary Key**: (`category_code`, `group_code`)

---

### SCHEDULE Domain

#### `category_schedules` (Time-Based Visibility)
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | SERIAL | NO | Primary key |
| `category_code` | TEXT | NO | FK → categories |
| `day_of_week` | INTEGER | NO | 0=Sunday, 6=Saturday |
| `start_time` | TIME | NO | Visibility start |
| `end_time` | TIME | NO | Visibility end |

**Constraint**: `CHECK (start_time < end_time)`
**Unique**: `(category_code, day_of_week, start_time)`

**Indexes**:
- `idx_category_schedules_category`
- `idx_category_schedules_day`

---

### SETTINGS/SECURITY Domain

#### `admin_settings` (Singleton Configuration)
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key (single row) |
| `line_approver_id` | TEXT | YES | LINE user ID for approver |
| `line_staff_id` | TEXT | YES | LINE user ID for staff |
| `staff_pin_hash` | TEXT | YES | Hashed staff PIN |
| `pin_version` | INTEGER | YES | PIN version for session invalidation |
| `admin_username` | TEXT | YES | Admin login username |
| `admin_password_hash` | TEXT | YES | Hashed admin password |
| `session_version` | INTEGER | YES | Session version for invalidation |
| `promptpay_id` | TEXT | YES | PromptPay account ID |
| `created_at` | TIMESTAMPTZ | NO | Creation time |
| `updated_at` | TIMESTAMPTZ | YES | Last update |

---

#### `system_settings` (Key-Value Store)
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `key` | TEXT | NO | Primary key |
| `value` | JSONB | YES | Configuration value |
| `updated_at` | TIMESTAMPTZ | YES | Last update |

**Known Keys**:
- `order_accepting` - Whether orders are being accepted

---

#### `auth_rate_limits` (Login Attempt Tracking)
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `key` | TEXT | NO | Primary key (identifier) |
| `attempts` | INTEGER | NO | Attempt count |
| `blocked_until` | TIMESTAMPTZ | YES | Lockout expiry |
| `updated_at` | TIMESTAMPTZ | NO | Last update |

---

#### `audit_logs` (Security Audit Trail)
| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | UUID | NO | Primary key |
| `action` | TEXT | NO | Action type |
| `actor` | TEXT | YES | Who performed action |
| `details` | JSONB | YES | Additional context |
| `ip_address` | TEXT | YES | Client IP |
| `user_agent` | TEXT | YES | Client user agent |
| `created_at` | TIMESTAMPTZ | NO | Event time |

---

## Redundancies & Concerns

### Duplicated Concepts

| Item | Location 1 | Location 2 | Status |
|------|-----------|-----------|--------|
| Category assignment | `menu_items.category_code` | `menu_item_categories` table | Legacy column retained |
| Menu item reference | `order_items.menu_item_id` | `order_items.menu_code` | Both store same value |
| Rejection timestamp | `orders.rejected_at` (TEXT) | `orders.rejected_at_ts` (TIMESTAMPTZ) | Both retained for compat |
| PromptPay config | `admin_settings.promptpay_id` | - | Single location (good) |

### Type Inconsistencies

| Field | Schema Type | TypeScript Type | Risk |
|-------|-------------|-----------------|------|
| `subtotal_amount_dec` | DECIMAL(10,2) | `number \| null` | Precision loss possible |
| `vat_amount_dec` | DECIMAL(10,2) | `number \| null` | Precision loss possible |
| `total_amount_dec` | DECIMAL(10,2) | `number \| null` | Precision loss possible |

### Data Integrity Notes

| Item | Issue | Risk Level |
|------|-------|------------|
| `fk_order_items_menu_code` | NOT VALID constraint | Medium - orphaned rows may exist |
| `orders.status` | No enum constraint | Low - app-level enforcement |
| `image_focus_y_*` | No range constraint | Low - display issue only |

---

## RLS Policy Summary

### Locked Tables (service_role only)

| Table | Policy Name | Effect |
|-------|-------------|--------|
| `orders` | Deny all for non-service-role | USING(false) WITH CHECK(false) |
| `order_items` | Deny all for non-service-role | USING(false) WITH CHECK(false) |

### Unprotected Tables (rely on app-level auth)

- `menu_items` - Public readable, admin writable via app auth
- `categories` - Public readable, admin writable via app auth
- `option_groups` - Public readable, admin writable via app auth
- `options` - Public readable, admin writable via app auth
- `menu_item_categories` - Public readable, admin writable via app auth
- `menu_option_groups` - Public readable, admin writable via app auth
- `category_option_groups` - Public readable, admin writable via app auth
- `category_schedules` - Public readable, admin writable via app auth
- `admin_settings` - App-level auth protection
- `system_settings` - Public readable
- `auth_rate_limits` - Service-role only (no explicit RLS)
- `audit_logs` - Service-role only (no explicit RLS)

---

## Entity Relationship Summary

```
ORDERS
  orders ──┬── order_items ···> menu_items
           │
           └── (approved_by, rejected_by, adjusted_by = TEXT, not FK)

MENU
  categories ──┬── menu_item_categories ──┬── menu_items
               │                          │
               └── category_option_groups ├── menu_option_groups ── option_groups ── options
                                          │
                                          └── (legacy category_code FK)

  category_schedules ── categories

SETTINGS
  admin_settings (singleton)
  system_settings (key-value)
  auth_rate_limits (security)
  audit_logs (immutable trail)
```
