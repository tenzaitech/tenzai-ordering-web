import { NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME } from '@/lib/adminAuth'

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true })

  // Clear the admin session cookie
  response.cookies.set(ADMIN_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0 // Expire immediately
  })

  return response
}
