import { NextResponse } from 'next/server'
import { STAFF_COOKIE_NAME } from '@/lib/staffAuth'

export async function POST(): Promise<NextResponse> {
  const response = NextResponse.json({ ok: true })

  // Clear the staff session cookie
  response.cookies.set(STAFF_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0 // Expire immediately
  })

  return response
}
