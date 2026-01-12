# TENZAI Settings Cleanup Map

**Status**: Full Clean Program - Settings Inventory & Canonicalization
**Date**: 2025-01-13
**Version**: 1.0

---

## 1. Settings Tables Inventory

### Table: `admin_settings`

| Column | Type | Classification | Purpose | Code References |
|--------|------|----------------|---------|-----------------|
| `id` | UUID | CANONICAL | Primary key | All admin_settings queries |
| `created_at` | TIMESTAMPTZ | CANONICAL | Creation timestamp | Audit |
| `updated_at` | TIMESTAMPTZ | CANONICAL | Last update | Audit |
| `admin_username` | TEXT | CANONICAL (SENSITIVE) | Admin login username | `api/admin/auth/login` |
| `admin_password_hash` | TEXT | CANONICAL (SENSITIVE) | Scrypt-hashed admin password | `api/admin/auth/login`, `api/admin/security/password` |
| `staff_pin_hash` | TEXT | CANONICAL (SENSITIVE) | Scrypt-hashed 4-digit staff PIN | `api/staff/auth/pin`, `api/admin/settings` |
| `pin_version` | INT | CANONICAL | PIN invalidation counter | `api/staff/auth/pin`, `lib/staffAuth.ts` |
| `staff_session_version` | INT | CANONICAL | Staff session invalidation | `lib/staffAuth.ts` |
| `admin_session_version` | INT | CANONICAL | Admin session invalidation | `lib/adminAuth.ts` |
| `promptpay_id` | TEXT | CANONICAL | PromptPay merchant ID | `api/public/promptpay`, `api/admin/settings` |
| `line_approver_id` | TEXT | CANONICAL | LINE User ID for approver | `lib/line.ts`, `api/admin/settings` |
| `line_staff_id` | TEXT | CANONICAL | LINE User/Group ID for staff | `lib/line.ts`, `api/admin/settings` |

**RLS Policy**: DENY ALL for anon (service-role only access)

---

### Table: `system_settings`

| Key | Value Type | Classification | Purpose | Code References |
|-----|------------|----------------|---------|-----------------|
| `order_accepting` | `{ enabled: bool, message?: string }` | CANONICAL | Shop open/closed toggle | `api/admin/toggle-accepting`, `app/order/layout.tsx` |
| `category_order` | `{ order: string[] }` | CANONICAL | Category display order | `api/admin/categories/order` |
| `hidden_categories` | `{ hidden: string[] }` | CANONICAL | Hidden category codes | `api/admin/categories/visibility` |
| `popular_menus` | `{ menu_codes: string[] }` | CANONICAL | Featured menu items | `api/admin/menu/popular` |

**RLS Policy**: Public READ, service-role WRITE

---

## 2. Fallback/Legacy Sources

### Environment Variables (LEGACY - Bootstrap Only)

| Env Variable | Canonical Location | Status | Notes |
|--------------|-------------------|--------|-------|
| `LINE_APPROVER_ID` | `admin_settings.line_approver_id` | LEGACY-BOOTSTRAP | Used only when DB row doesn't exist |
| `LINE_STAFF_ID` | `admin_settings.line_staff_id` | LEGACY-BOOTSTRAP | Used only when DB row doesn't exist |

**Migration Path**: These env vars serve as initial defaults before admin saves settings via UI. Once `admin_settings` row exists with values, env vars are ignored.

### Hardcoded Fallbacks (SAFETY - Keep)

| Constant | Location | Canonical | Status | Notes |
|----------|----------|-----------|--------|-------|
| `FALLBACK_PROMPTPAY_ID` | `api/public/promptpay/route.ts` | `admin_settings.promptpay_id` | SAFETY-FALLBACK | Error fallback only |
| `FALLBACK_PROMPTPAY_ID` | `app/order/payment/page.tsx` | `admin_settings.promptpay_id` | SAFETY-FALLBACK | Client error fallback |

**Note**: These are intentional safety fallbacks for error scenarios, NOT ambiguity sources.

---

## 3. Classification Legend

| Classification | Meaning | Action |
|----------------|---------|--------|
| **CANONICAL** | Single source of truth | Keep, document |
| **CANONICAL (SENSITIVE)** | Single source, requires protection | Keep, deny public access |
| **LEGACY-BOOTSTRAP** | Used for initial setup only | Document behavior, do not remove |
| **SAFETY-FALLBACK** | Error-case fallback | Keep, ensures system resilience |
| **DEPRECATED** | Scheduled for removal | Add migration, update code |
| **REMOVE-LATER** | Low priority cleanup | Track for future |

---

## 4. Code Reference Summary

### Files Reading `admin_settings`

| File | Operations | Client Used |
|------|------------|-------------|
| `app/api/admin/settings/route.ts` | SELECT, UPDATE, INSERT | service-role |
| `app/api/admin/auth/login/route.ts` | SELECT (credentials) | service-role |
| `app/api/admin/security/password/route.ts` | SELECT, UPDATE (password) | service-role |
| `app/api/admin/settings/test-message/route.ts` | SELECT (LINE IDs) | service-role |
| `app/api/public/promptpay/route.ts` | SELECT (promptpay_id only) | service-role |
| `app/api/staff/auth/pin/route.ts` | SELECT (PIN hash) | service-role |
| `app/api/staff/session/route.ts` | SELECT (session version) | service-role |
| `lib/line.ts` | SELECT (LINE IDs) | service-role |
| `lib/staffAuth.ts` | SELECT (session version) | service-role |
| `lib/adminAuth.ts` | SELECT (session version) | service-role |

### Files Reading `system_settings`

| File | Key(s) Read | Client Used |
|------|-------------|-------------|
| `app/api/admin/toggle-accepting/route.ts` | `order_accepting` | service-role |
| `app/api/admin/categories/order/route.ts` | `category_order` | service-role |
| `app/api/admin/categories/visibility/route.ts` | `hidden_categories` | service-role |
| `app/api/admin/menu/popular/route.ts` | `popular_menus` | service-role |
| `app/order/layout.tsx` | `order_accepting` | anon (public read) |
| `app/order/closed/page.tsx` | `order_accepting` | anon (public read) |

---

## 5. Non-Settings Duplications (Future Cleanup)

These items were identified but are NOT addressed in this pass:

### 5.1 `order_items.menu_item_id` vs `order_items.menu_code`
- **Status**: Documented in `docs/cleanup-pack/LEGACY-COLUMNS.md`
- **Action**: Future consolidation after full audit

### 5.2 `menu_items.category_code` (legacy single-category)
- **Status**: Documented in `docs/cleanup-pack/LEGACY-COLUMNS.md`
- **Action**: Keep until multi-category fully adopted

### 5.3 `orders.rejected_at` vs `orders.rejected_at_ts`
- **Status**: Documented in `docs/cleanup-pack/LEGACY-COLUMNS.md`
- **Action**: Migrate to `rejected_at_ts` usage

---

## 6. Security Posture

### RLS Summary

| Table | Anon Access | Service-Role Access |
|-------|-------------|---------------------|
| `admin_settings` | DENIED (all ops) | FULL |
| `system_settings` | READ only | FULL |
| `orders` | DENIED (all ops) | FULL |
| `order_items` | DENIED (all ops) | FULL |
| `menu_items` | READ only | FULL |
| `categories` | READ only | FULL |

### CSRF Protection
- All mutation endpoints require `validateCsrf()`
- Token set on admin login via `setCsrfCookie()`

### Rate Limiting
- Admin login: 5 attempts / 15 min
- Staff PIN: 5 attempts / 15 min
- Public promptpay: Rate limited

---

## 7. Canonical Source Matrix

| Setting | Canonical Source | Fallback | Public Readable |
|---------|------------------|----------|-----------------|
| Admin username | `admin_settings.admin_username` | None | No |
| Admin password | `admin_settings.admin_password_hash` | None | No |
| Staff PIN | `admin_settings.staff_pin_hash` | None | No |
| PromptPay ID | `admin_settings.promptpay_id` | Hardcoded fallback | Via API only |
| LINE Approver ID | `admin_settings.line_approver_id` | `process.env.LINE_APPROVER_ID` (bootstrap) | No |
| LINE Staff ID | `admin_settings.line_staff_id` | `process.env.LINE_STAFF_ID` (bootstrap) | No |
| Order accepting | `system_settings['order_accepting']` | `{ enabled: true }` | Yes |
| Category order | `system_settings['category_order']` | `{ order: [] }` | Yes |
| Hidden categories | `system_settings['hidden_categories']` | `{ hidden: [] }` | Yes |
| Popular menus | `system_settings['popular_menus']` | `{ menu_codes: [] }` | Yes |

---

## 8. Conclusion

The current two-table architecture is **correct and intentional**:
- `admin_settings`: Sensitive secrets, deny-all RLS
- `system_settings`: Public config, public-read RLS

**No table consolidation needed.** The architecture properly separates:
- Credentials (passwords, PINs) - protected
- Operational IDs (LINE, PromptPay) - accessible via service-role APIs
- Feature flags (toggles, display) - publicly readable

**Action Items Completed**:
1. Documented all settings columns and their canonical status
2. Identified env var fallbacks as bootstrap-only
3. Confirmed all API routes use service-role client
4. Verified RLS policies are correctly configured
