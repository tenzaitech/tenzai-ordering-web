import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE_NAME } from '@/lib/adminAuth'
import { auditLog, getRequestMeta } from '@/lib/audit-log'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { ip, userAgent } = getRequestMeta(request)

  // Audit log - admin logout
  await auditLog({
    actor_type: 'admin',
    ip,
    user_agent: userAgent,
    action_code: 'ADMIN_LOGOUT'
  })

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
