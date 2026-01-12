# CSRF Hardening Rollout (API-001)

## Overview

This document covers the rollout procedure for CSRF protection on 27 admin API routes.

**Scope**: All admin mutation endpoints (POST, PATCH, DELETE) except pre-authentication routes.

**Pattern Used**: Double-submit cookie validation via `validateCsrf()` from `lib/csrf.ts`.

---

## Pre-Deployment Checklist

- [ ] All 27 routes have been updated (verify with `npm run verify:csrf`)
- [ ] Admin panel already sends `X-CSRF-Token` header (implemented in earlier phase)
- [ ] CSRF token is stored in localStorage and attached to all fetch requests
- [ ] No business logic changes in any route handler

---

## Protected Routes (27 Total)

### Menu Management (7 routes)
| Route | Methods |
|-------|---------|
| `/api/admin/menu` | POST |
| `/api/admin/menu/[menu_code]` | PATCH, DELETE |
| `/api/admin/menu/[menu_code]/toggle` | PATCH |
| `/api/admin/menu/[menu_code]/categories` | POST |
| `/api/admin/menu/[menu_code]/option-groups` | POST |
| `/api/admin/menu/popular` | POST |

### Category Management (7 routes)
| Route | Methods |
|-------|---------|
| `/api/admin/categories` | POST |
| `/api/admin/categories/[category_code]` | PATCH, DELETE |
| `/api/admin/categories/order` | POST |
| `/api/admin/categories/visibility` | POST |
| `/api/admin/categories/[category_code]/menu-order` | POST |
| `/api/admin/categories/[category_code]/option-groups` | POST |
| `/api/admin/categories/[category_code]/schedules` | POST |

### Option Groups (4 routes)
| Route | Methods |
|-------|---------|
| `/api/admin/option-groups` | POST |
| `/api/admin/option-groups/[group_code]` | PATCH, DELETE |
| `/api/admin/option-groups/[group_code]/options` | POST, PATCH, DELETE |

### Import/Export (2 routes)
| Route | Methods |
|-------|---------|
| `/api/admin/import-menu` | POST |
| `/api/admin/parse-xlsx` | POST |

### Settings (2 routes)
| Route | Methods |
|-------|---------|
| `/api/admin/toggle-accepting` | POST |
| `/api/admin/settings/test-message` | POST |

### Storage/Images (7 routes)
| Route | Methods |
|-------|---------|
| `/api/admin/storage-upload-url` | POST |
| `/api/admin/upload-image` | POST, DELETE |
| `/api/admin/menu-image` | POST, DELETE |
| `/api/admin/menu-image/discard-upload` | POST |
| `/api/admin/menu-image/apply-from-storage` | POST |
| `/api/admin/image-import/apply` | POST |
| `/api/admin/image-import/preview` | POST |
| `/api/admin/image-import/preview-processed` | POST |
| `/api/admin/image-import/regenerate` | POST |

### Exempt Routes (Pre-Authentication)
| Route | Reason |
|-------|--------|
| `/api/admin/auth/login` | No session exists yet |
| `/api/admin/auth/logout` | Destroying session, low risk |

---

## Rollout Procedure

### Step 1: Verify Coverage
```bash
npm run verify:csrf
```

Expected output:
```
CSRF Coverage Report
====================
Routes checked: 27
Protected: 27
Missing protection: 0

All admin mutation routes have CSRF protection.
```

### Step 2: Verify Admin Panel Sends Token

Check browser DevTools on any admin action:
1. Open Network tab
2. Perform any admin action (e.g., toggle menu item)
3. Inspect request headers
4. Confirm `X-CSRF-Token` header is present

### Step 3: Deploy to Staging

1. Deploy the updated routes to staging environment
2. Log into admin panel
3. Perform each operation type at least once:
   - Create a menu item
   - Edit a menu item
   - Delete a menu item (can use test item)
   - Toggle menu availability
   - Reorder categories
   - Upload an image

### Step 4: Monitor for CSRF Errors

Check server logs for `CSRF_INVALID` responses:
```bash
# In production logs
grep "CSRF_INVALID" /var/log/app.log
```

Or check Vercel/hosting logs for 403 responses on admin routes.

### Step 5: Production Deploy

After staging verification:
1. Deploy to production
2. Have admin team perform normal operations
3. Monitor for any 403 errors in first 24 hours

---

## Verification Commands

```bash
# Check all admin routes have CSRF
npm run verify:csrf

# Full quality check (typecheck + lint + build)
npm run quality:check

# Run all verification scripts
npm run verify:all
```

---

## Rollback Procedure

If CSRF protection causes issues in production:

### Immediate Rollback (Per-Route)

Remove CSRF check from affected route:

```typescript
// Before (protected)
export async function POST(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  if (!validateCsrf(request)) {
    return csrfError()
  }
  // ... handler
}

// After (rollback)
export async function POST(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  // CSRF check temporarily disabled - see incident #XXX
  // if (!validateCsrf(request)) {
  //   return csrfError()
  // }
  // ... handler
}
```

### Full Rollback

```bash
# Revert the CSRF commits
git revert <csrf-commit-hash>
git push origin main
```

---

## Troubleshooting

### Issue: Admin actions return 403 Forbidden

**Cause**: CSRF token not being sent or token mismatch.

**Check**:
1. Is `X-CSRF-Token` header present in request?
2. Does localStorage have `csrf_token` value?
3. Is the token being refreshed on login?

**Fix**:
```typescript
// Ensure admin fetch wrapper includes token
const csrfToken = localStorage.getItem('csrf_token')
fetch(url, {
  headers: {
    'X-CSRF-Token': csrfToken || '',
    // ... other headers
  }
})
```

### Issue: Token expires mid-session

**Cause**: Long admin session without refresh.

**Fix**: CSRF token should be refreshed on:
- Initial login
- Page refresh
- Every N minutes (configurable)

### Issue: Multiple tabs have different tokens

**Cause**: Each tab generates its own token.

**Current behavior**: Last token wins (stored in localStorage).

**Note**: This is acceptable for admin panel usage.

---

## Security Notes

1. **GET routes are intentionally unprotected** - GET should be idempotent
2. **Pre-auth routes are exempt** - No session to protect
3. **Token rotation** - Consider implementing token rotation on sensitive operations
4. **SameSite cookies** - CSRF protection works alongside SameSite cookie attribute

---

## Completion Checklist

- [ ] `npm run verify:csrf` passes
- [ ] Staging tested all operation types
- [ ] No 403 errors in first 24 hours
- [ ] Team notified of CSRF protection activation
- [ ] Monitoring alerts configured for unusual 403 rates
