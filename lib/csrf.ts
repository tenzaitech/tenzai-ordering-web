/**
 * CSRF Protection using double-submit cookie pattern
 *
 * How it works:
 * 1. Server sets a random token in httpOnly cookie (csrf_token)
 * 2. Client reads token from response header (X-CSRF-Token) or meta tag
 * 3. Client sends token back in X-CSRF-Token header on mutating requests
 * 4. Server validates cookie token matches header token
 *
 * Safe methods (GET, HEAD, OPTIONS) don't require CSRF check
 */

import { NextRequest, NextResponse } from 'next/server'

export const CSRF_COOKIE_NAME = 'tenzai_csrf'
export const CSRF_HEADER_NAME = 'x-csrf-token'
const TOKEN_LENGTH = 32

/**
 * Generate cryptographically secure random token
 */
function generateToken(): string {
  const array = new Uint8Array(TOKEN_LENGTH)
  crypto.getRandomValues(array)
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
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

/**
 * Check if method requires CSRF validation
 */
function isSafeMethod(method: string): boolean {
  return ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())
}

/**
 * Get CSRF token from request cookie
 */
export function getCsrfTokenFromCookie(request: NextRequest | Request): string | null {
  if ('cookies' in request && typeof request.cookies?.get === 'function') {
    const cookie = (request as NextRequest).cookies.get(CSRF_COOKIE_NAME)
    return cookie?.value || null
  }

  // Fallback for plain Request
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null

  const cookies = cookieHeader.split(';').map(c => c.trim())
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.split('=')
    if (name === CSRF_COOKIE_NAME) {
      return valueParts.join('=') || null
    }
  }
  return null
}

/**
 * Get CSRF token from request header
 */
export function getCsrfTokenFromHeader(request: Request): string | null {
  return request.headers.get(CSRF_HEADER_NAME)
}

/**
 * Validate CSRF token (cookie must match header)
 * Returns true if valid, false if invalid
 * Safe methods always return true
 */
export function validateCsrf(request: NextRequest | Request): boolean {
  // Safe methods don't need CSRF check
  if (isSafeMethod(request.method)) {
    return true
  }

  const cookieToken = getCsrfTokenFromCookie(request)
  const headerToken = getCsrfTokenFromHeader(request)

  if (!cookieToken || !headerToken) {
    return false
  }

  return constantTimeEqual(cookieToken, headerToken)
}

/**
 * CSRF validation error response
 */
export function csrfError(): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: 'CSRF_INVALID',
        message_th: 'คำขอไม่ถูกต้อง กรุณารีเฟรชหน้าและลองใหม่'
      }
    },
    { status: 403 }
  )
}

/**
 * Set CSRF token cookie on response
 * Call this on page loads to ensure token is available
 */
export function setCsrfCookie(response: NextResponse, token?: string): string {
  const csrfToken = token || generateToken()
  response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false, // Client needs to read this for header
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 // 24 hours
  })
  // Also set in header for easy client access
  response.headers.set(CSRF_HEADER_NAME, csrfToken)
  return csrfToken
}

/**
 * Ensure CSRF token exists, generate if missing
 * Returns the token value
 */
export function ensureCsrfToken(request: NextRequest, response: NextResponse): string {
  const existingToken = getCsrfTokenFromCookie(request)
  if (existingToken) {
    // Refresh the token in response headers for client
    response.headers.set(CSRF_HEADER_NAME, existingToken)
    return existingToken
  }
  return setCsrfCookie(response)
}

/**
 * Higher-order function to wrap API route handler with CSRF validation
 */
export function withCsrf<T extends Request>(
  handler: (request: T) => Promise<NextResponse>
): (request: T) => Promise<NextResponse> {
  return async (request: T) => {
    if (!validateCsrf(request as unknown as NextRequest)) {
      return csrfError()
    }
    return handler(request)
  }
}
