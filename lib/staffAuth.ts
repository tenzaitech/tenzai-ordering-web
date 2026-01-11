import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from './supabase-server'

export const STAFF_COOKIE_NAME = 'tenzai_staff'
const SESSION_TTL_SECONDS = 8 * 60 * 60 // 8 hours

type SessionVersionRow = {
  staff_session_version: number
  pin_version: number
}

/**
 * Get current staff session version from database
 * Uses combination of pin_version (legacy) and staff_session_version (new)
 */
async function getStaffSessionVersion(): Promise<number> {
  try {
    const supabase = getSupabaseServer()
    const { data } = await supabase
      .from('admin_settings')
      .select('*')
      .limit(1)
      .single()

    const settings = data as unknown as SessionVersionRow | null
    // Use staff_session_version if available, otherwise fall back to pin_version
    return settings?.staff_session_version || settings?.pin_version || 1
  } catch {
    return 1
  }
}

/**
 * Generate staff session token
 * Format: STAFF_VERIFIED:version
 */
export async function generateStaffSessionToken(version?: number): Promise<string> {
  const sessionVersion = version ?? await getStaffSessionVersion()
  return `STAFF_VERIFIED:${sessionVersion}`
}

/**
 * Parse and validate staff session token
 */
function parseStaffSessionToken(cookieValue: string): { valid: boolean; sessionVersion?: number } {
  if (!cookieValue.startsWith('STAFF_VERIFIED:')) {
    return { valid: false }
  }

  const parts = cookieValue.split(':')
  if (parts.length !== 2) {
    return { valid: false }
  }

  const sessionVersion = parseInt(parts[1], 10)
  if (isNaN(sessionVersion)) {
    return { valid: false }
  }

  return { valid: true, sessionVersion }
}

/**
 * Validate staff session including version check
 */
async function isValidStaffSession(cookieValue: string): Promise<boolean> {
  const parsed = parseStaffSessionToken(cookieValue)
  if (!parsed.valid) return false

  // Check session version against database
  const currentVersion = await getStaffSessionVersion()
  if (parsed.sessionVersion !== currentVersion) {
    return false // Session was revoked (PIN changed)
  }

  return true
}

/**
 * Check if request has valid staff session cookie
 */
export function hasValidStaffCookie(request: NextRequest | Request): boolean {
  let cookieValue: string | undefined

  if ('cookies' in request && typeof request.cookies?.get === 'function') {
    const cookie = (request as NextRequest).cookies.get(STAFF_COOKIE_NAME)
    cookieValue = cookie?.value
  } else {
    const cookieHeader = request.headers.get('cookie')
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').map(c => c.trim())
      for (const cookie of cookies) {
        const [name, ...valueParts] = cookie.split('=')
        if (name === STAFF_COOKIE_NAME) {
          cookieValue = valueParts.join('=')
          break
        }
      }
    }
  }

  if (!cookieValue) return false
  // Basic format check (synchronous)
  return cookieValue.startsWith('STAFF_VERIFIED:')
}

/**
 * Check if request is authorized for staff access
 * Includes async session version validation
 */
export async function isStaffAuthorized(request: NextRequest | Request): Promise<boolean> {
  let cookieValue: string | undefined

  if ('cookies' in request && typeof request.cookies?.get === 'function') {
    const cookie = (request as NextRequest).cookies.get(STAFF_COOKIE_NAME)
    cookieValue = cookie?.value
  } else {
    const cookieHeader = request.headers.get('cookie')
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').map(c => c.trim())
      for (const cookie of cookies) {
        const [name, ...valueParts] = cookie.split('=')
        if (name === STAFF_COOKIE_NAME) {
          cookieValue = valueParts.join('=')
          break
        }
      }
    }
  }

  if (!cookieValue) return false
  return isValidStaffSession(cookieValue)
}

/**
 * Return 401 Unauthorized response
 */
export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

/**
 * Create staff session cookie options
 */
export function getStaffCookieOptions(path: '/staff' | '/api/staff' | '/' = '/') {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path,
    maxAge: SESSION_TTL_SECONDS
  }
}

/**
 * Increment staff session version to revoke all sessions
 */
export async function revokeAllStaffSessions(): Promise<boolean> {
  try {
    const supabase = getSupabaseServer()

    const { data: settings } = await supabase
      .from('admin_settings')
      .select('*')
      .limit(1)
      .single()

    if (!settings) return false

    const typedSettings = settings as unknown as { id: string; staff_session_version?: number; pin_version?: number }
    const currentVersion = typedSettings.staff_session_version || typedSettings.pin_version || 1

    await supabase
      .from('admin_settings')
      .update({
        staff_session_version: currentVersion + 1,
        pin_version: currentVersion + 1 // Keep in sync for backward compat
      } as never)
      .eq('id', typedSettings.id)

    return true
  } catch (error) {
    console.error('[STAFF_AUTH] Failed to revoke sessions:', error)
    return false
  }
}
