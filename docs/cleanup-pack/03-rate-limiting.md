# Rate Limiting Preparation

## Overview

The system has an existing rate limiter (`lib/rate-limiter.ts`) using Supabase Postgres for persistent state. Currently used for:
- Admin login (`admin:login:ip:{ip}`)
- Staff PIN login (`staff:pin:ip:{ip}`)

This document identifies additional endpoints needing rate limiting.

## Current Rate Limiter Configuration

```typescript
const MAX_ATTEMPTS = 5       // Max attempts before lockout
const WINDOW_MINUTES = 15    // Sliding window duration
const LOCKOUT_MINUTES = 15   // Lockout duration after max attempts
```

## Endpoints Requiring Rate Limiting

### Tier 1: Critical - Already Protected
| Endpoint | Key Pattern | Current State |
|----------|-------------|---------------|
| `/api/admin/auth/login` | `admin:login:ip:{ip}` | Protected |
| `/api/staff/auth/pin` | `staff:pin:ip:{ip}` | Protected |

### Tier 2: High Priority - Public Endpoints

| Endpoint | Method | Risk | Recommended Limit |
|----------|--------|------|-------------------|
| `/api/order/validate-cart` | POST | Abuse, resource exhaustion | 30 req/min/IP |
| `/api/public/promptpay` | GET | Info disclosure, scraping | 10 req/min/IP |
| `/api/liff/session` | POST | Session creation abuse | 10 req/min/IP |

### Tier 3: Medium Priority - Authenticated but Sensitive

| Endpoint | Method | Risk | Recommended Limit |
|----------|--------|------|-------------------|
| `/api/order/create` | POST | Order spam | 5 orders/min/user |
| `/api/order/[id]/slip` | POST | Upload abuse | 10 uploads/min/user |
| `/api/admin/import-menu` | POST | Resource exhaustion | 2 req/min/admin |
| `/api/admin/export-menu` | POST | Resource exhaustion | 5 req/min/admin |

### Tier 4: Lower Priority - Internal

| Endpoint | Method | Risk | Recommended Limit |
|----------|--------|------|-------------------|
| `/api/admin/settings/test-message` | POST | LINE API abuse | 5 req/min/admin |
| `/api/admin/image-import/*` | POST | Processing load | 10 req/min/admin |

---

## Recommended Rate Limit Configuration

### New Key Patterns

```typescript
// Public endpoints (by IP)
export function publicEndpointKey(endpoint: string, ip: string): string {
  return `public:${endpoint}:ip:${ip}`
}

// Customer endpoints (by LINE user ID)
export function customerEndpointKey(endpoint: string, userId: string): string {
  return `customer:${endpoint}:user:${userId}`
}

// Admin endpoints (by admin session or IP)
export function adminEndpointKey(endpoint: string, identifier: string): string {
  return `admin:${endpoint}:${identifier}`
}
```

### Configurable Limits

```typescript
export const RATE_LIMITS = {
  // Public
  'validate-cart': { maxAttempts: 30, windowMinutes: 1, lockoutMinutes: 5 },
  'promptpay': { maxAttempts: 10, windowMinutes: 1, lockoutMinutes: 5 },
  'liff-session': { maxAttempts: 10, windowMinutes: 1, lockoutMinutes: 5 },

  // Customer
  'order-create': { maxAttempts: 5, windowMinutes: 1, lockoutMinutes: 5 },
  'slip-upload': { maxAttempts: 10, windowMinutes: 1, lockoutMinutes: 5 },

  // Admin
  'import-menu': { maxAttempts: 2, windowMinutes: 1, lockoutMinutes: 5 },
  'export-menu': { maxAttempts: 5, windowMinutes: 1, lockoutMinutes: 5 },
  'test-message': { maxAttempts: 5, windowMinutes: 1, lockoutMinutes: 5 },
} as const
```

---

## Integration Plan

### Option A: Extend Existing Rate Limiter

Modify `lib/rate-limiter.ts` to support configurable limits:

```typescript
export type RateLimitConfig = {
  maxAttempts: number
  windowMinutes: number
  lockoutMinutes: number
}

export async function checkAndIncrementRateLimitWithConfig(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  // Same logic as existing, but use config instead of constants
}
```

### Option B: Create Endpoint-Specific Middleware

Create `lib/rate-limit-middleware.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { checkAndIncrementRateLimit, getClientIp } from './rate-limiter'

export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  keyPrefix: string,
  config?: RateLimitConfig
) {
  return async (request: NextRequest) => {
    const ip = getClientIp(request)
    const key = `${keyPrefix}:ip:${ip}`

    const result = await checkAndIncrementRateLimit(key)

    if (!result.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfter: result.retryAfterSeconds },
        {
          status: 429,
          headers: {
            'Retry-After': String(result.retryAfterSeconds || 60)
          }
        }
      )
    }

    return handler(request)
  }
}
```

---

## Example Usage Snippet (NOT APPLIED)

### Example 1: Public Endpoint `/api/order/validate-cart`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { checkAndIncrementRateLimit, getClientIp } from '@/lib/rate-limiter'

export async function POST(request: NextRequest) {
  // Rate limit check
  const ip = getClientIp(request)
  const rateLimitKey = `public:validate-cart:ip:${ip}`
  const rateLimit = await checkAndIncrementRateLimit(rateLimitKey)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfter: rateLimit.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    )
  }

  // ... existing validation logic
}
```

### Example 2: Customer Endpoint `/api/order/create`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { checkAndIncrementRateLimit } from '@/lib/rate-limiter'

export async function POST(request: NextRequest) {
  // Get user ID from LIFF session
  const cookieStore = await cookies()
  const userId = cookieStore.get('tenzai_liff_user')?.value

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit by user ID
  const rateLimitKey = `customer:order-create:user:${userId}`
  const rateLimit = await checkAndIncrementRateLimit(rateLimitKey)

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Order limit reached', retryAfter: rateLimit.retryAfterSeconds },
      { status: 429 }
    )
  }

  // ... existing order creation logic
}
```

### Example 3: Using Middleware Pattern

```typescript
// Route file
import { withRateLimit } from '@/lib/rate-limit-middleware'

async function handler(request: NextRequest) {
  // ... existing handler logic
}

export const POST = withRateLimit(handler, 'public:validate-cart')
```

---

## Response Format

Standard 429 response:

```json
{
  "error": "Too many requests",
  "error_th": "คำขอมากเกินไป กรุณารอสักครู่",
  "retryAfter": 60
}
```

HTTP Headers:
```
HTTP/1.1 429 Too Many Requests
Retry-After: 60
Content-Type: application/json
```

---

## Database Table

The existing `auth_rate_limits` table works for this:

```sql
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for cleanup queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_updated
ON auth_rate_limits (updated_at);
```

### Cleanup Query (Optional Cron)

```sql
-- Delete stale entries older than 24 hours
DELETE FROM auth_rate_limits
WHERE updated_at < NOW() - INTERVAL '24 hours';
```

---

## Rollout Checklist

### Phase 1: Infrastructure
- [ ] Extend rate limiter to support configurable limits
- [ ] Add rate limit key helper functions
- [ ] Test with existing auth endpoints

### Phase 2: Public Endpoints (Highest Risk)
- [ ] `/api/order/validate-cart` - 30/min/IP
- [ ] `/api/public/promptpay` - 10/min/IP
- [ ] `/api/liff/session` - 10/min/IP

### Phase 3: Customer Endpoints
- [ ] `/api/order/create` - 5/min/user
- [ ] `/api/order/[id]/slip` - 10/min/user

### Phase 4: Admin Endpoints
- [ ] `/api/admin/import-menu` - 2/min/admin
- [ ] `/api/admin/export-menu` - 5/min/admin

### Phase 5: Monitoring
- [ ] Log rate limit hits
- [ ] Monitor for false positives
- [ ] Adjust limits based on usage patterns

---

## Risk Assessment

| Factor | Assessment |
|--------|------------|
| **Breaking Change** | Minimal - adds protection |
| **False Positives** | Possible with aggressive limits |
| **Database Load** | Low - simple key-value ops |
| **Rollback Difficulty** | Low - remove checks |

---

## Rollback Plan

1. Remove rate limit checks from affected routes
2. Deploy
3. Rate limit entries in DB can remain (will auto-expire)
