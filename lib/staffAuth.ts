import { NextRequest, NextResponse } from 'next/server'

export const STAFF_COOKIE_NAME = 'tenzai_staff'
const SESSION_TTL_SECONDS = 8 * 60 * 60 // 8 hours

/**
 * Check if request has valid staff session cookie
 */
export function hasValidStaffCookie(request: NextRequest | Request): boolean {
  let cookieValue: string | undefined

  // Handle NextRequest (has cookies helper)
  if ('cookies' in request && typeof request.cookies?.get === 'function') {
    const cookie = (request as NextRequest).cookies.get(STAFF_COOKIE_NAME)
    cookieValue = cookie?.value
  } else {
    // Fallback: parse Cookie header manually
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
  return cookieValue.startsWith('STAFF_VERIFIED:')
}

/**
 * Check if request is authorized for staff access
 */
export function isStaffAuthorized(request: NextRequest | Request): boolean {
  return hasValidStaffCookie(request)
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
export function getStaffCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS
  }
}
