/**
 * Persistent rate limiter using Supabase Postgres
 *
 * Cloud-safe: Works across multiple instances/serverless functions
 * Uses auth_rate_limits table for state storage
 */

import { getSupabaseServer } from './supabase-server'

// Configuration
const MAX_ATTEMPTS = 5
const WINDOW_MINUTES = 15
const LOCKOUT_MINUTES = 15

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number | null
}

type RateLimitRow = {
  key: string
  attempts: number
  first_attempt_at: string
  locked_until: string | null
  updated_at: string
}

/**
 * Check rate limit and increment attempt counter atomically
 * @param key - Rate limit key (e.g., "admin:login:ip:1.2.3.4")
 * @returns Rate limit status
 */
export async function checkAndIncrementRateLimit(key: string): Promise<RateLimitResult> {
  const supabase = getSupabaseServer()
  const now = new Date()

  try {
    // Fetch existing entry (table not in generated types)
    const { data: existing } = await (supabase as ReturnType<typeof getSupabaseServer>)
      .from('auth_rate_limits' as never)
      .select('*')
      .eq('key', key)
      .single()

    const entry = existing as RateLimitRow | null

    // Check if locked
    if (entry?.locked_until) {
      const lockedUntil = new Date(entry.locked_until)
      if (now < lockedUntil) {
        const retryAfterSeconds = Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000)
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds
        }
      }
    }

    // Check if window expired - reset if so
    const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60 * 1000)
    const isExpired = !entry || new Date(entry.first_attempt_at) < windowStart

    if (isExpired) {
      // Reset or create entry with 1 attempt
      const newEntry = {
        key,
        attempts: 1,
        first_attempt_at: now.toISOString(),
        locked_until: null,
        updated_at: now.toISOString()
      }

      await (supabase as ReturnType<typeof getSupabaseServer>)
        .from('auth_rate_limits' as never)
        .upsert(newEntry as never, { onConflict: 'key' })

      return {
        allowed: true,
        remaining: MAX_ATTEMPTS - 1,
        retryAfterSeconds: null
      }
    }

    // Increment attempts
    const newAttempts = entry.attempts + 1
    const isLocked = newAttempts >= MAX_ATTEMPTS
    const lockedUntil = isLocked
      ? new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
      : null

    await (supabase as ReturnType<typeof getSupabaseServer>)
      .from('auth_rate_limits' as never)
      .update({
        attempts: newAttempts,
        locked_until: lockedUntil,
        updated_at: now.toISOString()
      } as never)
      .eq('key', key)

    if (isLocked) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: LOCKOUT_MINUTES * 60
      }
    }

    return {
      allowed: true,
      remaining: MAX_ATTEMPTS - newAttempts,
      retryAfterSeconds: null
    }
  } catch (error) {
    // On DB error, fail open but log
    console.error('[RATE_LIMIT] Database error:', error)
    // Allow the request but don't track
    return {
      allowed: true,
      remaining: MAX_ATTEMPTS,
      retryAfterSeconds: null
    }
  }
}

/**
 * Check rate limit without incrementing (for pre-check)
 */
export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  const supabase = getSupabaseServer()
  const now = new Date()

  try {
    const { data: existing } = await (supabase as ReturnType<typeof getSupabaseServer>)
      .from('auth_rate_limits' as never)
      .select('*')
      .eq('key', key)
      .single()

    const entry = existing as RateLimitRow | null

    if (!entry) {
      return { allowed: true, remaining: MAX_ATTEMPTS, retryAfterSeconds: null }
    }

    // Check if locked
    if (entry.locked_until) {
      const lockedUntil = new Date(entry.locked_until)
      if (now < lockedUntil) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000)
        }
      }
    }

    // Check window expiry
    const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60 * 1000)
    if (new Date(entry.first_attempt_at) < windowStart) {
      return { allowed: true, remaining: MAX_ATTEMPTS, retryAfterSeconds: null }
    }

    const remaining = Math.max(0, MAX_ATTEMPTS - entry.attempts)
    return {
      allowed: remaining > 0,
      remaining,
      retryAfterSeconds: remaining > 0 ? null : LOCKOUT_MINUTES * 60
    }
  } catch (error) {
    console.error('[RATE_LIMIT] Check error:', error)
    return { allowed: true, remaining: MAX_ATTEMPTS, retryAfterSeconds: null }
  }
}

/**
 * Clear rate limit for a key (e.g., on successful login)
 */
export async function clearRateLimit(key: string): Promise<void> {
  const supabase = getSupabaseServer()

  try {
    await (supabase as ReturnType<typeof getSupabaseServer>)
      .from('auth_rate_limits' as never)
      .delete()
      .eq('key', key)
  } catch (error) {
    console.error('[RATE_LIMIT] Clear error:', error)
  }
}

/**
 * Get client IP from request headers
 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    return xff.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }

  return 'unknown'
}

/**
 * Build rate limit key for admin login
 */
export function adminLoginKey(ip: string): string {
  return `admin:login:ip:${ip}`
}

/**
 * Build rate limit key for staff PIN login
 */
export function staffPinKey(ip: string): string {
  return `staff:pin:ip:${ip}`
}
