import { NextRequest, NextResponse } from 'next/server'
import { STAFF_COOKIE_NAME } from '@/lib/staffAuth'
import { auditLog, getRequestMeta } from '@/lib/audit-log'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { ip, userAgent } = getRequestMeta(request)

  // Audit log - staff logout
  await auditLog({
    actor_type: 'staff',
    ip,
    user_agent: userAgent,
    action_code: 'STAFF_LOGOUT'
  })

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
