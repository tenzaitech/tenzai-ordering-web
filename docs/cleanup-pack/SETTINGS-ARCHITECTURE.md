# Settings Architecture

**Status**: Finalized as Single Source of Truth

---

## Overview

The TENZAI system uses a **two-table settings pattern**:

| Table | Purpose | Access | Contains |
|-------|---------|--------|----------|
| `admin_settings` | Sensitive config | Service-role only | Credentials, PINs, LINE IDs |
| `system_settings` | Public config | Public read, service-role write | Feature flags, display preferences |

This architecture is **final and intentional**. Do not consolidate into a single table.

---

## admin_settings Table

**RLS Policy**: Deny all for anon (service-role only)

### Schema

| Column | Type | Purpose |
|--------|------|---------|
| `id` | UUID | Primary key |
| `promptpay_id` | TEXT | PromptPay number for payments |
| `line_approver_id` | TEXT | LINE User ID for payment approvals |
| `line_staff_id` | TEXT | LINE User/Group ID for kitchen |
| `staff_pin_hash` | TEXT | Hashed 4-digit staff PIN |
| `pin_version` | INT | Session invalidation counter |
| `admin_username` | TEXT | Admin login username |
| `admin_password_hash` | TEXT | Hashed admin password |
| `admin_session_version` | INT | Admin session invalidation |
| `staff_session_version` | INT | Staff session invalidation |

### Access Patterns

1. **Read** (via API only):
   - `/api/admin/settings` - Full access for authenticated admin
   - `/api/public/promptpay` - Returns ONLY `promptpay_id` (public)
   - `lib/line.ts` - Reads LINE IDs with env fallback
   - `lib/staffAuth.ts` - Reads PIN hash and session versions

2. **Write** (via API only):
   - `/api/admin/settings` - Admin updates all settings
   - No direct client writes ever allowed

### Security Notes

- Never expose `staff_pin_hash` to client
- Never expose `admin_password_hash` to client
- `promptpay_id` is safe to expose (public payment ID)
- Session versions allow immediate logout on credential change

---

## system_settings Table

**RLS Policy**: Public read, service-role write

### Schema

| Column | Type | Purpose |
|--------|------|---------|
| `key` | TEXT (PK) | Setting identifier |
| `value` | JSONB | Setting value (flexible structure) |
| `updated_at` | TIMESTAMPTZ | Last modification |

### Known Keys

| Key | Value Structure | Purpose |
|-----|-----------------|---------|
| `order_accepting` | `{ enabled: bool, message: string }` | Shop open/closed toggle |
| `category_order` | `{ order: string[] }` | Category display order |
| `hidden_categories` | `{ hidden: string[] }` | Hidden category codes |
| `popular_menus` | `{ menu_codes: string[] }` | Featured menu items |

### Access Patterns

1. **Read** (client-safe):
   - `app/order/layout.tsx` - Checks `order_accepting` (client)
   - `app/order/menu/page.tsx` - Reads display settings (server)
   - `app/admin/*` pages - Reads for admin display

2. **Write** (via API only):
   - `/api/admin/toggle-accepting` - Toggle shop open/closed
   - `/api/admin/categories/order` - Update category order
   - `/api/admin/categories/visibility` - Toggle category visibility
   - `/api/admin/menu/popular` - Update popular items

---

## Access Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     SETTINGS ACCESS FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CUSTOMER (LIFF)                                               │
│    │                                                            │
│    ├─► system_settings (read via anon) ✓                       │
│    │     - order_accepting                                      │
│    │     - category_order                                       │
│    │     - hidden_categories                                    │
│    │     - popular_menus                                        │
│    │                                                            │
│    └─► admin_settings (blocked by RLS) ✗                       │
│                                                                 │
│  ADMIN (Authenticated)                                          │
│    │                                                            │
│    └─► API Routes (service-role)                               │
│          │                                                      │
│          ├─► admin_settings (full access) ✓                    │
│          └─► system_settings (full access) ✓                   │
│                                                                 │
│  STAFF (PIN Auth)                                              │
│    │                                                            │
│    └─► API Routes (service-role)                               │
│          │                                                      │
│          └─► admin_settings (read PIN hash only) ✓             │
│                                                                 │
│  PUBLIC (No auth)                                              │
│    │                                                            │
│    └─► /api/public/promptpay                                   │
│          │                                                      │
│          └─► admin_settings.promptpay_id ONLY ✓                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Why Two Tables?

### Separation of Concerns

1. **Security boundary**: Sensitive data (credentials) isolated from public config
2. **RLS simplicity**: Different policies for different sensitivity levels
3. **Audit clarity**: Easy to see what's public vs private

### Alternatives Considered and Rejected

| Alternative | Why Rejected |
|-------------|--------------|
| Single table with row-level access | Complex RLS rules, error-prone |
| Env vars only | No runtime updates without deploy |
| JSON file | No persistence across instances |

---

## Code Reference

### Reading Settings

```typescript
// Public config (safe in client/server)
const { data } = await supabase
  .from('system_settings')
  .select('value')
  .eq('key', 'order_accepting')
  .single()

// Sensitive config (API routes only, with service-role)
const { data } = await getSupabaseServer()
  .from('admin_settings')
  .select('promptpay_id, line_approver_id')
  .single()
```

### Writing Settings

```typescript
// Always through API routes, never client-side
// Example: /api/admin/toggle-accepting/route.ts
await supabase
  .from('system_settings')
  .upsert({
    key: 'order_accepting',
    value: { enabled: false, message: 'Closed for lunch' },
    updated_at: new Date().toISOString()
  })
```

---

## Maintenance Notes

1. **Adding new public config**: Add to `system_settings` with new key
2. **Adding new sensitive config**: Add column to `admin_settings`
3. **Never**: Expose `admin_settings` columns beyond `promptpay_id`
4. **Always**: Use API routes for mutations (CSRF protected)
