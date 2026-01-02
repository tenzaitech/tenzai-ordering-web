import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Guard all /order/* routes
  if (pathname.startsWith('/order')) {
    const liffUserCookie = request.cookies.get('tenzai_liff_user')

    if (!liffUserCookie) {
      // Redirect to LIFF if no session
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
