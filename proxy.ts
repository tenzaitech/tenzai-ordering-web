import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { hasValidAdminCookie } from '@/lib/adminAuth'
import { hasValidStaffCookie } from '@/lib/staffAuth'

const FRIEND_CHECK_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

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

  // Guard all /order and /order/* routes with LIFF Hard Gate (TTL 6h)
  if (pathname === '/order' || pathname.startsWith('/order/')) {
    const userCookie = request.cookies.get('tenzai_liff_user')
    const friendCheckedAtCookie = request.cookies.get('tenzai_liff_friend_checked_at')

    // DEV-ONLY bypass: allow desktop testing with ?dev=1
    const isDev = process.env.NODE_ENV === 'development'
    const devBypass = searchParams.get('dev') === '1'

    if (isDev && devBypass && !userCookie) {
      // Set dummy LIFF cookies for dev testing
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
      response.cookies.set('tenzai_liff_friend_checked_at', Date.now().toString(), {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 2 // 2 hours
      })
      return response
    }

    // No session or no friendship timestamp -> redirect to /liff with returnTo
    if (!userCookie || !friendCheckedAtCookie) {
      const returnTo = pathname + request.nextUrl.search
      const url = new URL('/liff', request.url)
      url.searchParams.set('returnTo', returnTo)
      return NextResponse.redirect(url)
    }

    // Check timestamp freshness
    const checkedAt = parseInt(friendCheckedAtCookie.value, 10)
    if (isNaN(checkedAt) || Date.now() - checkedAt > FRIEND_CHECK_TTL_MS) {
      // Expired -> redirect to /liff with returnTo
      const returnTo = pathname + request.nextUrl.search
      const url = new URL('/liff', request.url)
      url.searchParams.set('returnTo', returnTo)
      return NextResponse.redirect(url)
    }

    // Valid session and fresh friendship check -> allow through
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/order', '/order/:path*', '/admin/:path*', '/api/admin/:path*', '/staff/:path*']
}
