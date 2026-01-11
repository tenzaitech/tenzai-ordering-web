/**
 * Simple in-memory rate limiter for brute-force protection
 *
 * LIMITATIONS:
 * - In-memory storage: resets on server restart
 * - Per-instance: in serverless/multi-instance deployments, each instance has separate state
 * - For production scaling: consider Redis or KV-based solution
 */

type RateLimitEntry = {
  attempts: number
  firstAttempt: number
  lockedUntil: number | null
}

const store = new Map<string, RateLimitEntry>()

// Configuration
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const LOCKOUT_MS = 15 * 60 * 1000 // 15 minutes lockout after max attempts

/**
 * Clean up old entries periodically
 */
function cleanup() {
  const now = Date.now()
  const keysToDelete: string[] = []

  store.forEach((entry, key) => {
    // Mark entries older than window + lockout period for deletion
    if (now - entry.firstAttempt > WINDOW_MS + LOCKOUT_MS) {
      keysToDelete.push(key)
    }
  })

  keysToDelete.forEach(key => store.delete(key))
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanup, 5 * 60 * 1000)
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterMs: number | null
}

/**
 * Check and record a login attempt
 * @param identifier - Usually IP address or combination of IP + username
 * @returns Whether the attempt is allowed and retry information
 */
export function checkRateLimit(identifier: string): RateLimitResult {
  const now = Date.now()
  let entry = store.get(identifier)

  // Check if locked out
  if (entry?.lockedUntil && now < entry.lockedUntil) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: entry.lockedUntil - now
    }
  }

  // Reset if window expired or new entry
  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    entry = {
      attempts: 0,
      firstAttempt: now,
      lockedUntil: null
    }
  }

  // Clear lockout if expired
  if (entry.lockedUntil && now >= entry.lockedUntil) {
    entry.lockedUntil = null
    entry.attempts = 0
    entry.firstAttempt = now
  }

  return {
    allowed: entry.attempts < MAX_ATTEMPTS,
    remaining: Math.max(0, MAX_ATTEMPTS - entry.attempts),
    retryAfterMs: null
  }
}

/**
 * Record a failed login attempt
 * @param identifier - Usually IP address
 */
export function recordFailedAttempt(identifier: string): void {
  const now = Date.now()
  let entry = store.get(identifier)

  if (!entry || now - entry.firstAttempt > WINDOW_MS) {
    entry = {
      attempts: 1,
      firstAttempt: now,
      lockedUntil: null
    }
  } else {
    entry.attempts++

    // Lock out if max attempts reached
    if (entry.attempts >= MAX_ATTEMPTS) {
      entry.lockedUntil = now + LOCKOUT_MS
    }
  }

  store.set(identifier, entry)
}

/**
 * Clear rate limit for an identifier (e.g., on successful login)
 */
export function clearRateLimit(identifier: string): void {
  store.delete(identifier)
}

/**
 * Get client IP from request headers
 */
export function getClientIp(request: Request): string {
  // Check various headers in order of preference
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    // Take first IP if multiple (client IP is first)
    return xff.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }

  // Fallback to a generic identifier
  return 'unknown'
}
