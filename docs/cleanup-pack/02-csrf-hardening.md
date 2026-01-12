# CSRF Hardening Preparation

## Overview

CSRF (Cross-Site Request Forgery) protection prevents malicious sites from making authenticated requests on behalf of users. The system already has CSRF infrastructure in `lib/csrf.ts` but it's not consistently applied to all admin mutation routes.

## Current State

### Routes WITH CSRF Protection (6 routes)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/admin/approve-order` | POST | Order approval |
| `/api/admin/reject-order` | POST | Order rejection |
| `/api/admin/adjust-order` | POST | Order adjustment |
| `/api/admin/settings` | POST | Settings update |
| `/api/admin/security/password` | POST | Password change |
| `/api/admin/security/revoke-sessions` | POST | Session revocation |

### Routes MISSING CSRF Protection (27 routes)

#### Critical - Data Modification
| Route | Method | Risk | Priority |
|-------|--------|------|----------|
| `/api/admin/menu` | POST | Menu creation | HIGH |
| `/api/admin/menu/[menu_code]` | PATCH, DELETE | Menu modification | HIGH |
| `/api/admin/menu/[menu_code]/toggle` | POST | Toggle active status | HIGH |
| `/api/admin/categories` | POST | Category creation | HIGH |
| `/api/admin/categories/[category_code]` | PATCH, DELETE | Category modification | HIGH |
| `/api/admin/option-groups` | POST | Option group creation | HIGH |
| `/api/admin/option-groups/[group_code]` | PATCH, DELETE | Option group modification | HIGH |
| `/api/admin/option-groups/[group_code]/options` | POST, PATCH, DELETE | Option modification | HIGH |
| `/api/admin/import-menu` | POST | Bulk menu import | CRITICAL |
| `/api/admin/toggle-accepting` | POST | Toggle order accepting | CRITICAL |

#### Medium - Configuration
| Route | Method | Risk | Priority |
|-------|--------|------|----------|
| `/api/admin/categories/order` | POST | Reorder categories | MEDIUM |
| `/api/admin/categories/visibility` | POST | Toggle visibility | MEDIUM |
| `/api/admin/categories/[category_code]/menu-order` | POST | Reorder items | MEDIUM |
| `/api/admin/categories/[category_code]/option-groups` | POST | Category options | MEDIUM |
| `/api/admin/categories/[category_code]/schedules` | POST | Category schedules | MEDIUM |
| `/api/admin/menu/[menu_code]/categories` | POST | Item categories | MEDIUM |
| `/api/admin/menu/[menu_code]/option-groups` | POST | Item options | MEDIUM |
| `/api/admin/settings/test-message` | POST | Test LINE message | MEDIUM |

#### Lower - Storage Operations
| Route | Method | Risk | Priority |
|-------|--------|------|----------|
| `/api/admin/storage-upload-url` | POST | Get upload URL | LOW |
| `/api/admin/menu-image` | POST | Upload menu image | LOW |
| `/api/admin/menu-image/discard-upload` | POST | Discard upload | LOW |
| `/api/admin/menu-image/apply-from-storage` | POST | Apply image | LOW |
| `/api/admin/upload-image` | POST, DELETE | Generic image upload | LOW |
| `/api/admin/image-import/*` | POST | Image import operations | LOW |
| `/api/admin/parse-xlsx` | POST | Parse XLSX (no DB write) | LOW |

#### Auth Routes - EXEMPT
| Route | Method | Reason |
|-------|--------|--------|
| `/api/admin/auth/login` | POST | Pre-authentication, no session to forge |
| `/api/admin/auth/logout` | POST | Only clears own session |

---

## CSRF Implementation Pattern

### Existing Pattern (from `lib/csrf.ts`)

```typescript
import { validateCsrf, csrfError } from '@/lib/csrf'

export async function POST(request: NextRequest) {
  // Auth check first
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  // CSRF check second
  if (!validateCsrf(request)) {
    return csrfError()
  }

  // ... rest of handler
}
```

### Alternative: HOC Pattern

```typescript
import { withCsrf } from '@/lib/csrf'
import { checkAdminAuth } from '@/lib/admin-gate'

async function handler(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError
  // ... handler logic
}

export const POST = withCsrf(handler)
```

---

## Example Diff Snippets (NOT APPLIED)

### Example 1: `/api/admin/menu/route.ts`

```diff
 import { NextRequest, NextResponse } from 'next/server'
 import { supabase } from '@/lib/supabase'
 import { checkAdminAuth } from '@/lib/admin-gate'
+import { validateCsrf, csrfError } from '@/lib/csrf'

 export async function POST(request: NextRequest) {
   const authError = await checkAdminAuth(request)
   if (authError) return authError

+  if (!validateCsrf(request)) {
+    return csrfError()
+  }
+
   // ... existing POST logic
 }
```

### Example 2: `/api/admin/toggle-accepting/route.ts`

```diff
 import { NextRequest, NextResponse } from 'next/server'
 import { supabase } from '@/lib/supabase'
 import { checkAdminAuth } from '@/lib/admin-gate'
+import { validateCsrf, csrfError } from '@/lib/csrf'

 export async function POST(request: NextRequest) {
   const authError = await checkAdminAuth(request)
   if (authError) return authError

+  if (!validateCsrf(request)) {
+    return csrfError()
+  }
+
   const body = await request.json()
   // ... existing logic
 }
```

### Example 3: `/api/admin/import-menu/route.ts`

```diff
 import { NextRequest, NextResponse } from 'next/server'
 import { supabase } from '@/lib/supabase'
 import { checkAdminAuth } from '@/lib/admin-gate'
+import { validateCsrf, csrfError } from '@/lib/csrf'

 export async function POST(request: NextRequest) {
   const authError = await checkAdminAuth(request)
   if (authError) return authError

+  // CSRF protection for bulk import
+  if (!validateCsrf(request)) {
+    return csrfError()
+  }
+
   try {
     const body = await request.json()
     // ... existing import logic
   }
 }
```

---

## Frontend Requirements

For CSRF to work, the frontend must:

1. **Read the CSRF token** from cookie or response header
2. **Include token** in `X-CSRF-Token` header on all mutation requests

### Current Admin Panel Pattern

```typescript
// In admin components making API calls
const response = await fetch('/api/admin/some-route', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': getCsrfToken(), // Must implement this
  },
  body: JSON.stringify(data),
})
```

### Helper Function

```typescript
// lib/client-csrf.ts
export function getCsrfToken(): string {
  const match = document.cookie.match(/tenzai_csrf=([^;]+)/)
  return match ? match[1] : ''
}
```

---

## Rollout Checklist

### Phase 1: Audit & Prepare
- [ ] Review all 27 routes listed above
- [ ] Identify any frontend code making direct API calls
- [ ] Create list of admin UI components to update

### Phase 2: Frontend Updates
- [ ] Add `getCsrfToken()` helper to admin client code
- [ ] Update admin API fetch wrapper to include CSRF header
- [ ] Test CSRF token cookie is being set on admin page loads

### Phase 3: Backend Updates (Route by Route)
- [ ] Start with LOW priority routes (storage operations)
- [ ] Progress to MEDIUM (configuration)
- [ ] End with HIGH/CRITICAL (menu, toggle-accepting)
- [ ] Each route: add import + validation + test

### Phase 4: Verification
- [ ] Manual test each protected route
- [ ] Verify CSRF error response on missing token
- [ ] Verify valid requests succeed
- [ ] Check error handling in frontend

### Phase 5: Monitoring
- [ ] Monitor for 403 CSRF_INVALID errors in logs
- [ ] Have rollback plan ready (remove CSRF checks)

---

## Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Breaking Change** | Yes - frontend must send CSRF token |
| **Rollback Difficulty** | Low - remove validation calls |
| **Test Coverage Needed** | Each route + frontend integration |
| **Estimated Effort** | 2-4 hours for full rollout |

---

## Rollback Plan

If CSRF causes issues post-deployment:

1. Revert backend changes (remove `validateCsrf` calls)
2. Deploy backend
3. Frontend changes can remain (extra header is harmless)
4. Investigate root cause (token not set, cookie blocked, etc.)
