import { NextRequest, NextResponse } from 'next/server'

export const ADMIN_COOKIE_NAME = 'tenzai_admin_session'
const COOKIE_VERSION = 'v2' // Updated for password-based auth
const SESSION_TTL_SECONDS = 8 * 60 * 60 // 8 hours

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
 * Generate a signed session token with expiry
 * Format: version:expiry:signature
 */
export async function generateAdminSessionToken(expiryTimestamp?: number): Promise<string | null> {
  const adminKey = process.env.ADMIN_API_KEY
  if (!adminKey) return null

  const expiry = expiryTimestamp || (Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS)
  const payload = `admin:${expiry}`
  const signature = await hmacSha256Hex(adminKey, payload)
  return `${COOKIE_VERSION}:${expiry}:${signature}`
}

/**
 * Validate the admin session cookie value
 * Checks signature AND expiry
 */
async function isValidAdminSessionCookie(cookieValue: string): Promise<boolean> {
  const adminKey = process.env.ADMIN_API_KEY
  if (!adminKey) return false

  const parts = cookieValue.split(':')

  // Support both old v1 format and new v2 format
  if (parts[0] === 'v1' && parts.length === 2) {
    // Legacy v1 format: v1:signature (no expiry)
    const legacySignature = await hmacSha256Hex(adminKey, 'tenzai_admin')
    return constantTimeEqual(parts[1], legacySignature)
  }

  if (parts[0] !== COOKIE_VERSION || parts.length !== 3) {
    return false
  }

  const [, expiryStr, signature] = parts
  const expiry = parseInt(expiryStr, 10)

  // Check expiry
  if (isNaN(expiry) || Date.now() / 1000 > expiry) {
    return false
  }

  // Verify signature
  const payload = `admin:${expiry}`
  const expectedSignature = await hmacSha256Hex(adminKey, payload)
  return constantTimeEqual(signature, expectedSignature)
}

/**
 * Check if request has valid x-admin-key header
 */
export function hasValidAdminHeader(request: NextRequest | Request): boolean {
  const adminKey = process.env.ADMIN_API_KEY
  if (!adminKey) return false

  const providedKey = request.headers.get('x-admin-key')
  return providedKey === adminKey
}

/**
 * Check if request has valid admin session cookie
 */
export async function hasValidAdminCookie(request: NextRequest | Request): Promise<boolean> {
  let cookieValue: string | undefined

  // Handle NextRequest (has cookies helper)
  if ('cookies' in request && typeof request.cookies?.get === 'function') {
    const cookie = (request as NextRequest).cookies.get(ADMIN_COOKIE_NAME)
    cookieValue = cookie?.value
  } else {
    // Fallback: parse Cookie header manually
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
 * Returns true if either:
 * - Valid x-admin-key header is present
 * - Valid httpOnly admin session cookie is present
 */
export async function isAdminAuthorized(request: NextRequest | Request): Promise<boolean> {
  if (hasValidAdminHeader(request)) return true
  return hasValidAdminCookie(request)
}

/**
 * Return 401 Unauthorized response
 */
export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

/**
 * Create admin session cookie options
 */
export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS
  }
}
