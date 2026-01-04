import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Admin session cookie config
const ADMIN_COOKIE_NAME = 'tenzai_admin_session'
const ADMIN_COOKIE_VERSION = 'v1'

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
 * Generate admin session token using Web Crypto
 */
async function generateAdminSessionToken(): Promise<string | null> {
  const adminKey = process.env.ADMIN_API_KEY
  if (!adminKey) return null

  const signature = await hmacSha256Hex(adminKey, 'tenzai_admin')
  return `${ADMIN_COOKIE_VERSION}:${signature}`
}

/**
 * Constant-time string comparison
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

function hasValidAdminHeader(request: NextRequest): boolean {
  const adminKey = process.env.ADMIN_API_KEY
  if (!adminKey) return false
  return request.headers.get('x-admin-key') === adminKey
}

async function hasValidAdminCookie(request: NextRequest): Promise<boolean> {
  const cookie = request.cookies.get(ADMIN_COOKIE_NAME)
  if (!cookie?.value) return false

  const expectedToken = await generateAdminSessionToken()
  if (!expectedToken) return false

  return constantTimeEqual(cookie.value, expectedToken)
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // Handle /admin/* routes - set session cookie if authenticated via header
  if (pathname.startsWith('/admin')) {
    // Already has valid cookie - proceed
    if (await hasValidAdminCookie(request)) {
      return NextResponse.next()
    }

    // Has valid header - mint cookie for subsequent browser requests
    if (hasValidAdminHeader(request)) {
      const token = await generateAdminSessionToken()
      if (token) {
        const response = NextResponse.next()
        response.cookies.set(ADMIN_COOKIE_NAME, token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 8 // 8 hours
        })
        return response
      }
    }

    // Dev mode: allow cookie minting for local testing without header
    if (process.env.NODE_ENV === 'development') {
      const existingCookie = request.cookies.get(ADMIN_COOKIE_NAME)
      if (!existingCookie) {
        const token = await generateAdminSessionToken()
        if (token) {
          const response = NextResponse.next()
          response.cookies.set(ADMIN_COOKIE_NAME, token, {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 8 // 8 hours
          })
          return response
        }
      }
    }

    // No auth - let the page/API handle the 401
    return NextResponse.next()
  }

  // Guard all /order/* routes
  if (pathname.startsWith('/order')) {
    const liffUserCookie = request.cookies.get('tenzai_liff_user')

    if (!liffUserCookie) {
      // DEV-ONLY bypass: allow desktop testing with ?dev=1
      const isDev = process.env.NODE_ENV === 'development'
      const devBypass = searchParams.get('dev') === '1'

      if (isDev && devBypass) {
        // Set dummy LIFF user cookie for dev testing
        const url = request.nextUrl.clone()
        url.searchParams.delete('dev')

        const response = NextResponse.redirect(url)
        response.cookies.set('tenzai_liff_user', 'DEV_DESKTOP', {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 2 // 2 hours
        })
        return response
      }

      // Production guard: redirect to LIFF if no session
      const url = request.nextUrl.clone()
      url.pathname = '/liff'
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/order/:path*', '/admin/:path*', '/api/admin/:path*']
}
