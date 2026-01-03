import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

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
  matcher: '/order/:path*'
}
