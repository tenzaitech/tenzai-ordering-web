import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'tenzai_admin_session'
const COOKIE_VERSION = 'v1'

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
 * Generate the admin session cookie value using HMAC-SHA256
 * This ensures the cookie cannot be forged without knowing ADMIN_API_KEY
 */
export async function generateAdminSessionToken(): Promise<string | null> {
  const adminKey = process.env.ADMIN_API_KEY
  if (!adminKey) return null

  const signature = await hmacSha256Hex(adminKey, 'tenzai_admin')
  return `${COOKIE_VERSION}:${signature}`
}

/**
 * Validate the admin session cookie value
 */
async function isValidAdminSessionCookie(cookieValue: string): Promise<boolean> {
  const adminKey = process.env.ADMIN_API_KEY
  if (!adminKey) return false

  const expectedToken = await generateAdminSessionToken()
  if (!expectedToken) return false

  return constantTimeEqual(cookieValue, expectedToken)
}

/**
 * Check if request has valid x-admin-key header
 */
function hasValidAdminHeader(request: NextRequest | Request): boolean {
  const adminKey = process.env.ADMIN_API_KEY
  if (!adminKey) return false

  const providedKey = request.headers.get('x-admin-key')
  return providedKey === adminKey
}

/**
 * Check if request has valid admin session cookie
 */
async function hasValidAdminCookie(request: NextRequest | Request): Promise<boolean> {
  let cookieValue: string | undefined

  // Handle NextRequest (has cookies helper)
  if ('cookies' in request && typeof request.cookies?.get === 'function') {
    const cookie = (request as NextRequest).cookies.get(COOKIE_NAME)
    cookieValue = cookie?.value
  } else {
    // Fallback: parse Cookie header manually
    const cookieHeader = request.headers.get('cookie')
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').map(c => c.trim())
      for (const cookie of cookies) {
        const [name, ...valueParts] = cookie.split('=')
        if (name === COOKIE_NAME) {
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
 * Cookie name export for middleware use
 */
export const ADMIN_COOKIE_NAME = COOKIE_NAME
