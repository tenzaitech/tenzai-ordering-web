# API Surface Map

## Summary

| Category | Count | Auth Type |
|----------|-------|-----------|
| Admin Routes | 44 | `checkAdminAuth` |
| Customer Order Routes | 8 | LIFF session cookie |
| Staff Routes | 7 | Staff cookie or PIN |
| LIFF/LINE Routes | 3 | LIFF session or none |
| Public Routes | 1 | None |
| **Total** | **63** | |

---

## Admin Routes (`/api/admin/*`)

All admin routes use `checkAdminAuth` middleware unless noted.

### Authentication

| Path | Method | Auth | Supabase Client | Description |
|------|--------|------|-----------------|-------------|
| `/api/admin/auth/login` | POST | None (public) | service-role | Admin login |
| `/api/admin/auth/logout` | POST | checkAdminAuth | none | Admin logout |
| `/api/admin/auth/me` | GET | checkAdminAuth | none | Verify admin session |

### Order Management

| Path | Method | Auth | Supabase Client | Description |
|------|--------|------|-----------------|-------------|
| `/api/admin/orders` | GET | checkAdminAuth | service-role | List orders (filtered) |
| `/api/admin/orders/[id]` | GET | checkAdminAuth | service-role | Get order detail + items |
| `/api/admin/approve-order` | POST | checkAdminAuth + CSRF | service-role | Approve order, notify staff |
| `/api/admin/reject-order` | POST | checkAdminAuth | service-role | Reject order, notify customer |
| `/api/admin/adjust-order` | POST | checkAdminAuth + CSRF | service-role | Add adjustment note |
| `/api/admin/invoice-preview` | GET | checkAdminAuth | service-role | Preview invoice PDF |

### Menu Management

| Path | Method | Auth | Supabase Client | Description |
|------|--------|------|-----------------|-------------|
| `/api/admin/menu` | GET, POST | checkAdminAuth | anon | List/create menu items |
| `/api/admin/menu/popular` | GET | checkAdminAuth | anon | List popular items |
| `/api/admin/menu/[menu_code]` | GET, PATCH, DELETE | checkAdminAuth | anon | CRUD menu item |
| `/api/admin/menu/[menu_code]/toggle` | POST | checkAdminAuth | anon | Toggle active status |
| `/api/admin/menu/[menu_code]/categories` | GET, POST | checkAdminAuth | anon | Manage item categories |
| `/api/admin/menu/[menu_code]/option-groups` | GET, POST | checkAdminAuth | anon | Manage item options |

### Category Management

| Path | Method | Auth | Supabase Client | Description |
|------|--------|------|-----------------|-------------|
| `/api/admin/categories` | GET, POST | checkAdminAuth | anon | List/create categories |
| `/api/admin/categories/order` | POST | checkAdminAuth | anon | Reorder categories |
| `/api/admin/categories/visibility` | POST | checkAdminAuth | anon | Toggle visibility |
| `/api/admin/categories/[category_code]` | GET, PATCH, DELETE | checkAdminAuth | anon | CRUD category |
| `/api/admin/categories/[category_code]/menu-order` | POST | checkAdminAuth | anon | Reorder items in category |
| `/api/admin/categories/[category_code]/option-groups` | GET, POST | checkAdminAuth | anon | Category default options |
| `/api/admin/categories/[category_code]/schedules` | GET, POST | checkAdminAuth | anon | Category time windows |

### Option Groups Management

| Path | Method | Auth | Supabase Client | Description |
|------|--------|------|-----------------|-------------|
| `/api/admin/option-groups` | GET, POST | checkAdminAuth | anon | List/create option groups |
| `/api/admin/option-groups/[group_code]` | GET, PATCH, DELETE | checkAdminAuth | anon | CRUD option group |
| `/api/admin/option-groups/[group_code]/options` | POST, PATCH, DELETE | checkAdminAuth | anon | CRUD options in group |

### Settings & Security

| Path | Method | Auth | Supabase Client | Description |
|------|--------|------|-----------------|-------------|
| `/api/admin/settings` | GET, POST | checkAdminAuth | anon | Get/update admin settings |
| `/api/admin/settings/test-message` | POST | checkAdminAuth | anon | Test LINE messaging |
| `/api/admin/toggle-accepting` | GET, POST | checkAdminAuth | anon | Toggle order accepting |
| `/api/admin/security/password` | POST | checkAdminAuth | service-role | Change admin password |
| `/api/admin/security/revoke-sessions` | POST | checkAdminAuth | none | Revoke all sessions |

### Import/Export

| Path | Method | Auth | Supabase Client | Description |
|------|--------|------|-----------------|-------------|
| `/api/admin/import-menu` | POST | checkAdminAuth | anon | Bulk import menu |
| `/api/admin/export-menu` | POST | checkAdminAuth | anon | Export menu to XLSX |
| `/api/admin/parse-xlsx` | POST | checkAdminAuth | none | Parse XLSX file |

### Image Management

| Path | Method | Auth | Supabase Client | Description |
|------|--------|------|-----------------|-------------|
| `/api/admin/menu-image` | POST | checkAdminAuth | service-role (direct) | Upload menu image |
| `/api/admin/menu-image/discard-upload` | POST | checkAdminAuth | service-role (direct) | Discard uploaded image |
| `/api/admin/menu-image/apply-from-storage` | POST | checkAdminAuth | anon | Apply image from storage |
| `/api/admin/upload-image` | POST, DELETE | checkAdminAuth | service-role (direct) | Generic image upload |
| `/api/admin/storage-upload-url` | POST | checkAdminAuth | service-role (direct) | Get signed upload URL |
| `/api/admin/image-import/preview` | POST | checkAdminAuth | service-role | Preview image import |
| `/api/admin/image-import/preview-processed` | POST | checkAdminAuth | service-role | Preview processed import |
| `/api/admin/image-import/apply` | POST | checkAdminAuth | anon | Apply image import |
| `/api/admin/image-import/regenerate` | POST | checkAdminAuth | anon | Regenerate image |

---

## Customer Order Routes (`/api/order/*`)

All customer routes require LIFF session (`tenzai_liff_user` cookie) unless noted.

| Path | Method | Auth | Supabase Client | Description |
|------|--------|------|-----------------|-------------|
| `/api/order/create` | POST | LIFF session | service-role | Create new order |
| `/api/order/list` | GET | LIFF session | service-role | List customer's orders |
| `/api/order/[id]` | GET | LIFF session + ownership | service-role | Get order detail |
| `/api/order/status/[id]` | GET | LIFF session + ownership | service-role | Get order status |
| `/api/order/[id]/slip` | POST | LIFF session + ownership | service-role | Upload payment slip |
| `/api/order/edit/[id]` | GET, POST | LIFF session + ownership | service-role | Edit pending order |
| `/api/order/[id]/add-item` | POST | LIFF session + ownership | service-role | Add item to order |
| `/api/order/validate-cart` | POST | None (public) | anon | Validate cart items |

---

## Staff Routes (`/api/staff/*`)

| Path | Method | Auth | Supabase Client | Description |
|------|--------|------|-----------------|-------------|
| `/api/staff/auth/pin` | POST | None (public) | service-role | Staff PIN login |
| `/api/staff/auth/logout` | POST | None | none | Staff logout |
| `/api/staff/auth/me` | GET | Staff cookie | none | Verify staff session |
| `/api/staff/session` | GET, POST | Staff cookie / None | anon | Session management |
| `/api/staff/orders` | GET | Staff cookie | service-role | List approved/ready orders |
| `/api/staff/orders/update-status` | POST | Staff cookie | service-role | Update order status |
| `/api/staff/orders/history` | GET | Staff cookie | service-role | Today's completed orders |

---

## LIFF/LINE Routes

| Path | Method | Auth | Supabase Client | Description |
|------|--------|------|-----------------|-------------|
| `/api/liff/session` | POST | None (public) | none | Create LIFF session |
| `/api/liff/user` | GET | LIFF session | none | Get LIFF user info |
| `/api/line/notify-slip` | POST | LIFF session + ownership | service-role | Notify approver of slip |

---

## Public Routes

| Path | Method | Auth | Supabase Client | Description |
|------|--------|------|-----------------|-------------|
| `/api/public/promptpay` | GET | None | service-role (direct) | Get PromptPay QR config |

---

## Security Notes

### Supabase Client Usage Pattern

| Client | Usage Context | Risk Level |
|--------|--------------|------------|
| **service-role** | Order CRUD, auth verification, storage | Critical - bypasses RLS |
| **anon** | Menu/category/option CRUD | Medium - relies on RLS |
| **direct service-role** | Storage operations | Critical - creates signed URLs |
| **none** | Cookie-only operations | Low |

### Routes Without Auth (Public)

1. `/api/admin/auth/login` - Login endpoint (rate-limited)
2. `/api/staff/auth/pin` - PIN login (rate-limited)
3. `/api/liff/session` - Creates LIFF session from LINE token
4. `/api/order/validate-cart` - Cart validation (no sensitive data)
5. `/api/public/promptpay` - PromptPay config (public info)

### Routes With CSRF Protection

1. `/api/admin/approve-order` - Requires CSRF token
2. `/api/admin/adjust-order` - Requires CSRF token

### Ownership Enforcement

Customer routes (`/api/order/*`) enforce ownership by including `customer_line_user_id` in queries:
```sql
.eq('customer_line_user_id', userId)
```
