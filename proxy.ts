import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { hasValidAdminCookie } from '@/lib/adminAuth'
import { hasValidStaffCookie } from '@/lib/staffAuth'

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // Handle /admin/* routes
  if (pathname.startsWith('/admin')) {
    // Skip login page - don't require auth
    if (pathname === '/admin/login') {
      return NextResponse.next()
    }

    // Validate admin session (includes version check)
    if (await hasValidAdminCookie(request)) {
      return NextResponse.next()
    }

    // Not authenticated - redirect to login
    const loginUrl = new URL('/admin/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Handle /staff/* routes - require staff session
  if (pathname.startsWith('/staff')) {
    // Skip login page - don't require auth
    if (pathname === '/staff/login') {
      return NextResponse.next()
    }

    // Fast format check (synchronous) - API routes do full version validation
    if (!hasValidStaffCookie(request)) {
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
