# Supabase Usage Map

## TL;DR
- **Anon client** (`@/lib/supabase`): Public reads + admin menu writes (subject to RLS where enabled)
- **Service-role client** (`@/lib/supabase-server`): ALL order operations, auth, storage (bypasses RLS)
- **Orders/order_items**: Service-role ONLY (RLS=DENY all for non-service-role)
- **Menu tables**: Anon client for admin operations (NO RLS, relies on app auth)
- **Client-side writes**: NONE detected (all mutations via API routes)
- **Key risk**: Admin menu routes use anon client without RLS (see backlog API-002, DB-006)

## When Confused → Do This
1. **"Which client for route X?"** → Ctrl+F route name in this file
2. **"Why can't I query orders?"** → orders/order_items require service-role (RLS locked)
3. **"Is table Y protected by RLS?"** → See "Summary by Table" section
4. **"Can client write to DB directly?"** → NO (see "Client-Side Direct DB Writes" = safe)
5. **"Why does admin use anon client?"** → Menu tables have NO RLS (app-level auth only)
6. **"Which routes touch table X?"** → Ctrl+F table name in sections below
7. **"Is this file server or client?"** → Check for `'use client'` directive in "Client Components" section

## Current Truth / Invariants
- **orders + order_items**: RLS policy `USING(false) WITH CHECK(false)` (service_role ONLY)
- **Menu/category/option tables**: NO RLS (public readable, app-auth for writes)
- **service_role key**: NEVER exposed to client (server API routes only)
- **Ownership verification**: Customer routes check `customer_line_user_id` in WHERE clause
- **Anon client usage**: Safe where RLS exists; gap for menu tables (backlog items DB-006, API-002)

## Client Definitions

### Anon Client (`lib/supabase.ts`)
- **Import**: `import { supabase } from '@/lib/supabase'`
- **Credentials**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **RLS**: Subject to Row Level Security policies
- **Use Case**: Public reads, client-side operations (where safe)

### Service-Role Client (`lib/supabase-server.ts`)
- **Import**: `import { getSupabaseServer } from '@/lib/supabase-server'`
- **Credentials**: `SUPABASE_SERVICE_ROLE_KEY`
- **RLS**: Bypasses all RLS policies
- **Use Case**: Server-side API routes only

---

## Files Using Anon Client (`@/lib/supabase`)

### Server Pages (Safe - Server-Side Rendering)

| File | Tables Accessed | Operations |
|------|-----------------|------------|
| `app/order/menu/page.tsx` | menu_items, categories, option_groups | SELECT |
| `app/order/menu/[id]/page.tsx` | menu_items, option_groups | SELECT |
| `app/order/closed/page.tsx` | system_settings | SELECT |
| `app/admin/menu/page.tsx` | menu_items | SELECT |
| `app/admin/categories/page.tsx` | categories, option_groups, menu_items | SELECT |
| `app/admin/option-groups/page.tsx` | option_groups | SELECT |
| `app/admin/option-groups/[group_code]/page.tsx` | option_groups, options | SELECT |

### Client Components (Flagged)

| File | Directive | Tables | Operations | Risk |
|------|-----------|--------|------------|------|
| `app/order/layout.tsx` | `'use client'` | system_settings | SELECT only | **LOW** - Read-only config check |

### API Routes Using Anon Client

| File | Tables | Operations | Auth |
|------|--------|------------|------|
| `app/api/admin/menu/route.ts` | menu_items | SELECT, INSERT | checkAdminAuth |
| `app/api/admin/menu/[menu_code]/route.ts` | menu_items | SELECT, UPDATE, DELETE | checkAdminAuth |
| `app/api/admin/menu/[menu_code]/toggle/route.ts` | menu_items | UPDATE | checkAdminAuth |
| `app/api/admin/menu/[menu_code]/categories/route.ts` | menu_item_categories | SELECT, INSERT, DELETE | checkAdminAuth |
| `app/api/admin/menu/[menu_code]/option-groups/route.ts` | menu_option_groups | SELECT, INSERT, DELETE | checkAdminAuth |
| `app/api/admin/categories/route.ts` | categories | SELECT, INSERT | checkAdminAuth |
| `app/api/admin/categories/[category_code]/route.ts` | categories | SELECT, UPDATE, DELETE | checkAdminAuth |
| `app/api/admin/categories/[category_code]/menu-order/route.ts` | menu_item_categories | UPDATE | checkAdminAuth |
| `app/api/admin/categories/[category_code]/option-groups/route.ts` | category_option_groups | SELECT, INSERT, DELETE | checkAdminAuth |
| `app/api/admin/categories/[category_code]/schedules/route.ts` | category_schedules | SELECT, INSERT, UPDATE, DELETE | checkAdminAuth |
| `app/api/admin/categories/order/route.ts` | categories | UPDATE | checkAdminAuth |
| `app/api/admin/categories/visibility/route.ts` | categories | UPDATE | checkAdminAuth |
| `app/api/admin/option-groups/route.ts` | option_groups | SELECT, INSERT | checkAdminAuth |
| `app/api/admin/option-groups/[group_code]/route.ts` | option_groups | SELECT, UPDATE, DELETE | checkAdminAuth |
| `app/api/admin/option-groups/[group_code]/options/route.ts` | options | SELECT, INSERT, UPDATE, DELETE | checkAdminAuth |
| `app/api/admin/settings/route.ts` | admin_settings | SELECT, UPDATE | checkAdminAuth |
| `app/api/admin/settings/test-message/route.ts` | admin_settings | SELECT | checkAdminAuth |
| `app/api/admin/toggle-accepting/route.ts` | system_settings | SELECT, UPSERT | checkAdminAuth |
| `app/api/admin/import-menu/route.ts` | menu_items, categories, option_groups | INSERT, UPDATE | checkAdminAuth |
| `app/api/admin/export-menu/route.ts` | menu_items, categories, option_groups | SELECT | checkAdminAuth |
| `app/api/admin/image-import/apply/route.ts` | menu_items | UPDATE | checkAdminAuth |
| `app/api/admin/image-import/regenerate/route.ts` | menu_items | SELECT, UPDATE | checkAdminAuth |
| `app/api/admin/menu-image/apply-from-storage/route.ts` | menu_items | UPDATE | checkAdminAuth |
| `app/api/order/validate-cart/route.ts` | menu_items | SELECT | None (public) |
| `app/api/staff/session/route.ts` | admin_settings | SELECT | Staff cookie |

---

## Files Using Service-Role Client (`@/lib/supabase-server`)

### Order Flow (Critical Path)

| File | Tables | Operations | Auth |
|------|--------|------------|------|
| `app/api/order/create/route.ts` | orders, order_items, menu_items | INSERT, SELECT | LIFF session |
| `app/api/order/list/route.ts` | orders | SELECT | LIFF session |
| `app/api/order/[id]/route.ts` | orders, order_items | SELECT | LIFF session + ownership |
| `app/api/order/status/[id]/route.ts` | orders | SELECT | LIFF session + ownership |
| `app/api/order/[id]/slip/route.ts` | orders | UPDATE | LIFF session + ownership |
| `app/api/order/edit/[id]/route.ts` | orders, order_items | SELECT, UPDATE, INSERT, DELETE | LIFF session + ownership |
| `app/api/order/[id]/add-item/route.ts` | order_items, menu_items | INSERT, SELECT | LIFF session + ownership |

### Admin Order Management

| File | Tables | Operations | Auth |
|------|--------|------------|------|
| `app/api/admin/orders/route.ts` | orders | SELECT | checkAdminAuth |
| `app/api/admin/orders/[id]/route.ts` | orders, order_items | SELECT | checkAdminAuth |
| `app/api/admin/approve-order/route.ts` | orders | UPDATE | checkAdminAuth + CSRF |
| `app/api/admin/reject-order/route.ts` | orders | UPDATE | checkAdminAuth |
| `app/api/admin/adjust-order/route.ts` | orders | UPDATE | checkAdminAuth + CSRF |
| `app/api/admin/invoice-preview/route.ts` | orders, order_items | SELECT | checkAdminAuth |

### Staff Operations

| File | Tables | Operations | Auth |
|------|--------|------------|------|
| `app/api/staff/orders/route.ts` | orders, order_items | SELECT | Staff cookie |
| `app/api/staff/orders/update-status/route.ts` | orders | UPDATE | Staff cookie |
| `app/api/staff/orders/history/route.ts` | orders, order_items | SELECT | Staff cookie |

### Authentication

| File | Tables | Operations | Auth |
|------|--------|------------|------|
| `app/api/admin/auth/login/route.ts` | admin_settings | SELECT | None (public) |
| `app/api/admin/security/password/route.ts` | admin_settings | UPDATE | checkAdminAuth |
| `app/api/staff/auth/pin/route.ts` | admin_settings | SELECT | None (public) |

### Image/Storage Operations

| File | Tables | Operations | Auth |
|------|--------|------------|------|
| `app/api/admin/menu-image/route.ts` | - | Storage only | checkAdminAuth |
| `app/api/admin/menu-image/discard-upload/route.ts` | - | Storage only | checkAdminAuth |
| `app/api/admin/upload-image/route.ts` | - | Storage only | checkAdminAuth |
| `app/api/admin/storage-upload-url/route.ts` | - | Storage only | checkAdminAuth |
| `app/api/admin/image-import/preview/route.ts` | - | Storage only | checkAdminAuth |
| `app/api/admin/image-import/preview-processed/route.ts` | - | Storage only | checkAdminAuth |

### Public

| File | Tables | Operations | Auth |
|------|--------|------------|------|
| `app/api/public/promptpay/route.ts` | admin_settings | SELECT | None |

---

## Library Files Using Supabase

| File | Client | Tables | Operations | Purpose |
|------|--------|--------|------------|---------|
| `lib/line.ts` | service-role | admin_settings, orders, order_items | SELECT | LINE notifications |
| `lib/rate-limiter.ts` | service-role | auth_rate_limits | SELECT, UPSERT, UPDATE, DELETE | Rate limiting |
| `lib/audit-log.ts` | service-role | audit_logs | INSERT | Security audit trail |
| `lib/adminAuth.ts` | service-role | admin_settings | SELECT, UPDATE | Admin authentication |
| `lib/staffAuth.ts` | service-role | admin_settings | SELECT, UPDATE | Staff authentication |

---

## Client-Side Direct DB Writes

### Flagged Files

| File | Type | Tables | Operations | Risk Assessment |
|------|------|--------|------------|-----------------|
| `app/order/layout.tsx` | `'use client'` | system_settings | **READ ONLY** | **SAFE** - No writes |

**Result**: No client-side direct DB writes detected. All mutations go through API routes.

---

## Summary by Table

| Table | Anon Access | Service-Role Access | Notes |
|-------|-------------|---------------------|-------|
| **orders** | None | Full CRUD | RLS locked to service_role only |
| **order_items** | None | Full CRUD | RLS locked to service_role only |
| **menu_items** | Read + Admin Write | Admin operations | No RLS, auth-gated |
| **categories** | Read + Admin Write | - | No RLS, auth-gated |
| **option_groups** | Read + Admin Write | - | No RLS, auth-gated |
| **options** | Read + Admin Write | - | No RLS, auth-gated |
| **admin_settings** | Admin Read/Write | Auth operations | Sensitive, auth-gated |
| **system_settings** | Read + Admin Write | - | Public config |
| **auth_rate_limits** | None | Service-only | Security table |
| **audit_logs** | None | Insert-only | Immutable audit trail |

---

## Security Observations

### Good Practices
- Orders/order_items locked to service-role (RLS hardened)
- All writes go through API routes
- No service-role key exposed to client
- Ownership verification on customer routes

### Areas for Review
- Admin menu/category routes use anon client with RLS not enforced
- `system_settings` readable by client components (public config)
- Some admin routes lack CSRF protection (approve/adjust have it, others don't)

---

## Glossary

| Term | Meaning |
|------|---------|
| **service-role** | Supabase admin client (bypasses all RLS) |
| **anon client** | Supabase public client (enforces RLS where enabled) |
| **RLS** | Row Level Security (Postgres table-level access control) |
| **checkAdminAuth** | Middleware verifying `tenzai_admin` cookie |
