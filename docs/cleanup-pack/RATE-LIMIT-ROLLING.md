# Rate Limiting Rollout (API-004)

## Overview

This document covers the rollout procedure for rate limiting on public/unauthenticated API endpoints.

**Scope**: 3 public endpoints that don't require authentication.

**Infrastructure**: Uses existing `auth_rate_limits` table in Supabase for persistent, cloud-safe rate tracking.

---

## Pre-Deployment Checklist

- [ ] Rate limiting code added to all 3 public endpoints
- [ ] `auth_rate_limits` table exists in Supabase
- [ ] Verify with `npm run verify:rate-limit`
- [ ] Environment variables configured for Supabase access

---

## Protected Endpoints

| Endpoint | Limit | Window | Lockout | Purpose |
|----------|-------|--------|---------|---------|
| `/api/order/validate-cart` | 30 req | 1 min | 5 min | Cart validation before checkout |
| `/api/public/promptpay` | 10 req | 1 min | 5 min | PromptPay ID lookup |
| `/api/liff/session` | 10 req | 1 min | 5 min | LIFF session creation |

### Already Protected (Pre-existing)

| Endpoint | Notes |
|----------|-------|
| `/api/admin/auth/login` | Uses default 5 attempts / 15 min window |
| `/api/staff/auth/pin` | Uses default 5 attempts / 15 min window |

---

## Rate Limit Configuration

Located in `lib/rate-limiter.ts`:

```typescript
export const RATE_LIMIT_CONFIGS = {
  'validate-cart': { maxAttempts: 30, windowMinutes: 1, lockoutMinutes: 5 },
  'promptpay': { maxAttempts: 10, windowMinutes: 1, lockoutMinutes: 5 },
  'liff-session': { maxAttempts: 10, windowMinutes: 1, lockoutMinutes: 5 },
} as const
```

### Adjusting Limits

To change limits, update the config and redeploy:

```typescript
// Example: Increase validate-cart to 50 requests/min
'validate-cart': { maxAttempts: 50, windowMinutes: 1, lockoutMinutes: 5 },
```

---

## Rollout Procedure

### Step 1: Verify Database Table

Ensure `auth_rate_limits` table exists:

```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_name = 'auth_rate_limits'
);
```

If missing, create it:

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
ON auth_rate_limits(updated_at);
```

### Step 2: Verify Coverage

```bash
npm run verify:rate-limit
```

Expected output:
```
Rate Limit Coverage Report
==========================
Public endpoints checked: 3
Protected: 3
Missing protection: 0

All public endpoints have rate limiting.
```

### Step 3: Deploy to Staging

1. Deploy updated routes
2. Test each endpoint with normal usage
3. Verify rate limiting triggers at threshold

### Step 4: Test Rate Limiting

Use curl to verify rate limiting works:

```bash
# Test validate-cart (should allow 30 requests)
for i in {1..35}; do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://staging.example.com/api/order/validate-cart \
    -H "Content-Type: application/json" \
    -d '{"items":[]}'
done

# After 30 requests, should see 429 responses
```

### Step 5: Production Deploy

1. Deploy to production
2. Monitor for false positives (legitimate users hitting limits)
3. Adjust limits if needed

---

## Verification Commands

```bash
# Check all public endpoints have rate limiting
npm run verify:rate-limit

# Run all verification scripts
npm run verify:all

# Check environment variables
npm run preflight
```

---

## Monitoring

### Check Current Rate Limit State

```sql
-- See all active rate limits
SELECT key, attempts, first_attempt_at, locked_until
FROM auth_rate_limits
WHERE updated_at > NOW() - INTERVAL '1 hour'
ORDER BY updated_at DESC;

-- Count locked IPs for public endpoints
SELECT
  SUBSTRING(key FROM 'public:([^:]+):') as endpoint,
  COUNT(*) as locked_count
FROM auth_rate_limits
WHERE locked_until > NOW()
  AND key LIKE 'public:%'
GROUP BY 1;
```

### Cleanup Old Entries

Rate limit entries older than 24 hours can be cleaned:

```sql
DELETE FROM auth_rate_limits
WHERE updated_at < NOW() - INTERVAL '24 hours';
```

### Log Monitoring

Watch for rate limit hits in server logs:

```bash
# Look for 429 responses
grep "429" /var/log/app.log | grep -E "(validate-cart|promptpay|liff-session)"

# Look for rate limit errors
grep "RATE_LIMIT" /var/log/app.log
```

---

## Rollback Procedure

### Immediate Rollback (Per-Endpoint)

Comment out rate limiting in affected route:

```typescript
// Before (protected)
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const rateLimitKey = publicEndpointKey('validate-cart', ip)
  const rateLimit = await checkAndIncrementRateLimitWithConfig(
    rateLimitKey,
    RATE_LIMIT_CONFIGS['validate-cart']
  )

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', ... },
      { status: 429, ... }
    )
  }
  // ... handler
}

// After (rollback)
export async function POST(request: NextRequest) {
  // Rate limiting temporarily disabled - see incident #XXX
  // const ip = getClientIp(request)
  // const rateLimitKey = publicEndpointKey('validate-cart', ip)
  // const rateLimit = await checkAndIncrementRateLimitWithConfig(...)
  // if (!rateLimit.allowed) { ... }

  // ... handler
}
```

### Full Rollback

```bash
# Revert the rate limiting commits
git revert <rate-limit-commit-hash>
git push origin main
```

### Clear Lockouts (Emergency)

If legitimate users are locked out:

```sql
-- Clear all public endpoint lockouts
UPDATE auth_rate_limits
SET locked_until = NULL, attempts = 0
WHERE key LIKE 'public:%';

-- Clear specific endpoint lockouts
UPDATE auth_rate_limits
SET locked_until = NULL, attempts = 0
WHERE key LIKE 'public:validate-cart:%';
```

---

## Troubleshooting

### Issue: Legitimate users getting 429 errors

**Cause**: Rate limit too aggressive for usage pattern.

**Fix**:
1. Increase `maxAttempts` in config
2. Or decrease `lockoutMinutes` for faster recovery

### Issue: Rate limits not being enforced

**Cause**: Database connection issue or table missing.

**Check**:
```bash
# Check preflight for Supabase connection
npm run preflight

# Check table exists
# (run SQL query from Step 1)
```

### Issue: Shared IP causing false positives

**Cause**: Users behind corporate NAT or VPN share IP.

**Options**:
1. Increase limits for affected endpoints
2. Consider adding user-based rate limiting for authenticated flows
3. Add IP allowlist for known corporate ranges (not recommended)

### Issue: Rate limit entries not cleaning up

**Cause**: No automatic cleanup job.

**Fix**: Add scheduled cleanup:
```sql
-- Run daily via cron or Supabase scheduled function
DELETE FROM auth_rate_limits
WHERE updated_at < NOW() - INTERVAL '7 days';
```

---

## Response Format

When rate limited, endpoints return:

```json
{
  "error": "Too many requests",
  "error_th": "คำขอมากเกินไป กรุณารอสักครู่",
  "retryAfter": 300
}
```

Headers include:
```
HTTP/1.1 429 Too Many Requests
Retry-After: 300
```

---

## Security Notes

1. **IP-based limiting** - Best effort; can be bypassed with IP rotation
2. **Fail-open policy** - On database errors, requests are allowed (prevents outage)
3. **Thai error messages** - Included for customer-facing endpoints
4. **Retry-After header** - Clients should respect this for backoff

---

## Completion Checklist

- [ ] `npm run verify:rate-limit` passes
- [ ] Database table exists and accessible
- [ ] Staging tested with threshold testing
- [ ] No false positives in first 24 hours
- [ ] Cleanup job scheduled (optional)
- [ ] Monitoring dashboard configured (optional)
