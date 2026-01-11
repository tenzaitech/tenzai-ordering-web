import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  generateAdminSessionToken,
  hasValidAdminHeader,
  hasValidAdminCookie,
  ADMIN_COOKIE_NAME
} from '@/lib/adminAuth'

const STAFF_COOKIE_NAME = 'tenzai_staff'

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // Handle /admin/* routes - set session cookie if authenticated via header
  if (pathname.startsWith('/admin')) {
    // Skip login page - don't require auth
    if (pathname === '/admin/login') {
      return NextResponse.next()
    }

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

    // Redirect to login page (production behavior)
    if (process.env.NODE_ENV === 'production') {
      const loginUrl = new URL('/admin/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
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

  // Handle /staff/* routes - require staff session
  if (pathname.startsWith('/staff')) {
    // Skip login page - don't require auth
    if (pathname === '/staff/login') {
      return NextResponse.next()
    }

    const staffCookie = request.cookies.get(STAFF_COOKIE_NAME)

    if (!staffCookie?.value || !staffCookie.value.startsWith('STAFF_VERIFIED:')) {
      // Redirect to staff login
      const loginUrl = new URL('/staff/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
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
  matcher: ['/order/:path*', '/admin/:path*', '/api/admin/:path*', '/staff/:path*']
}
