import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from './supabase-server'

export const ADMIN_COOKIE_NAME = 'tenzai_admin_session'
const COOKIE_VERSION = 'v3' // v3 includes session versioning
const SESSION_TTL_SECONDS = 8 * 60 * 60 // 8 hours

type SessionVersionRow = {
  admin_session_version: number
}

/**
 * Convert string to Uint8Array (UTF-8)
 */
function toBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str)
}

/**
 * Convert ArrayBuffer to hex string
 */
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * HMAC-SHA256 using Web Crypto API (Edge-compatible)
 */
async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const keyData = toBytes(key)
  const msgData = toBytes(message)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData.buffer as ArrayBuffer)
  return bufferToHex(signature)
}

/**
 * Constant-time string comparison (Edge-compatible)
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/**
 * Get current admin session version from database
 */
async function getAdminSessionVersion(): Promise<number> {
  try {
    const supabase = getSupabaseServer()
    const { data } = await supabase
      .from('admin_settings')
      .select('*')
      .limit(1)
      .single()

    const settings = data as unknown as SessionVersionRow | null
    return settings?.admin_session_version || 1
  } catch {
    return 1
  }
}

/**
 * Generate a signed session token with expiry and version
 * Format: version:sessionVersion:expiry:signature
 */
export async function generateAdminSessionToken(sessionVersion?: number): Promise<string | null> {
  const adminKey = process.env.ADMIN_API_KEY
  if (!adminKey) return null

  const version = sessionVersion ?? await getAdminSessionVersion()
  const expiry = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  const payload = `admin:${version}:${expiry}`
  const signature = await hmacSha256Hex(adminKey, payload)
  return `${COOKIE_VERSION}:${version}:${expiry}:${signature}`
}

/**
 * Parse and validate admin session token
 * Returns session version if valid, null if invalid
 */
async function parseAdminSessionToken(cookieValue: string): Promise<{ valid: boolean; sessionVersion?: number }> {
  const adminKey = process.env.ADMIN_API_KEY
  if (!adminKey) return { valid: false }

  const parts = cookieValue.split(':')

  // v3 format: v3:sessionVersion:expiry:signature
  if (parts[0] === 'v3' && parts.length === 4) {
    const [, sessionVersionStr, expiryStr, signature] = parts
    const sessionVersion = parseInt(sessionVersionStr, 10)
    const expiry = parseInt(expiryStr, 10)

    // Check expiry
    if (isNaN(expiry) || Date.now() / 1000 > expiry) {
      return { valid: false }
    }

    // Verify signature
    const payload = `admin:${sessionVersion}:${expiry}`
    const expectedSignature = await hmacSha256Hex(adminKey, payload)
    if (!constantTimeEqual(signature, expectedSignature)) {
      return { valid: false }
    }

    return { valid: true, sessionVersion }
  }

  // v2 format (legacy): v2:expiry:signature - treat as session version 0
  if (parts[0] === 'v2' && parts.length === 3) {
    const [, expiryStr, signature] = parts
    const expiry = parseInt(expiryStr, 10)

    if (isNaN(expiry) || Date.now() / 1000 > expiry) {
      return { valid: false }
    }

    const payload = `admin:${expiry}`
    const expectedSignature = await hmacSha256Hex(adminKey, payload)
    if (!constantTimeEqual(signature, expectedSignature)) {
      return { valid: false }
    }

    // v2 tokens are considered session version 0 - will be invalidated on first version bump
    return { valid: true, sessionVersion: 0 }
  }

  return { valid: false }
}

/**
 * Validate admin session cookie including session version check
 */
async function isValidAdminSessionCookie(cookieValue: string): Promise<boolean> {
  const parsed = await parseAdminSessionToken(cookieValue)
  if (!parsed.valid) return false

  // Check session version against database
  const currentVersion = await getAdminSessionVersion()
  if (parsed.sessionVersion !== currentVersion) {
    return false // Session was revoked
  }

  return true
}

/**
 * Check if request has valid admin session cookie
 */
export async function hasValidAdminCookie(request: NextRequest | Request): Promise<boolean> {
  let cookieValue: string | undefined

  if ('cookies' in request && typeof request.cookies?.get === 'function') {
    const cookie = (request as NextRequest).cookies.get(ADMIN_COOKIE_NAME)
    cookieValue = cookie?.value
  } else {
    const cookieHeader = request.headers.get('cookie')
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').map(c => c.trim())
      for (const cookie of cookies) {
        const [name, ...valueParts] = cookie.split('=')
        if (name === ADMIN_COOKIE_NAME) {
          cookieValue = valueParts.join('=')
          break
        }
      }
    }
  }

  if (!cookieValue) return false
  return isValidAdminSessionCookie(cookieValue)
}

/**
 * Check if request is authorized for admin access
 * PRODUCTION: Only cookie-based auth is allowed
 * DEV with ALLOW_ADMIN_API_KEY_FALLBACK=true: Also allows x-admin-key header
 */
export async function isAdminAuthorized(request: NextRequest | Request): Promise<boolean> {
  // Check cookie first (preferred method)
  if (await hasValidAdminCookie(request)) {
    return true
  }

  // Header fallback ONLY in development with explicit flag
  if (process.env.NODE_ENV === 'development' && process.env.ALLOW_ADMIN_API_KEY_FALLBACK === 'true') {
    const adminKey = process.env.ADMIN_API_KEY
    if (adminKey) {
      const providedKey = request.headers.get('x-admin-key')
      if (providedKey === adminKey) {
        return true
      }
    }
  }

  return false
}

/**
 * Return 401 Unauthorized response
 */
export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

/**
 * Create admin session cookie options
 * Path scoped to /admin and /api/admin for security
 */
export function getAdminCookieOptions(path: '/admin' | '/api/admin' | '/' = '/') {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path,
    maxAge: SESSION_TTL_SECONDS
  }
}

/**
 * Increment admin session version to revoke all sessions
 */
export async function revokeAllAdminSessions(): Promise<boolean> {
  try {
    const supabase = getSupabaseServer()

    const { data: settings } = await supabase
      .from('admin_settings')
      .select('*')
      .limit(1)
      .single()

    if (!settings) return false

    const typedSettings = settings as unknown as { id: string; admin_session_version?: number }
    const currentVersion = typedSettings.admin_session_version || 1

    await supabase
      .from('admin_settings')
      .update({ admin_session_version: currentVersion + 1 } as never)
      .eq('id', typedSettings.id)

    return true
  } catch (error) {
    console.error('[ADMIN_AUTH] Failed to revoke sessions:', error)
    return false
  }
}
