import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/admin-gate'
import { validateCsrf, csrfError } from '@/lib/csrf'
import { auditLog, getRequestMeta } from '@/lib/audit-log'
import { revokeAllAdminSessions, generateAdminSessionToken, ADMIN_COOKIE_NAME, getAdminCookieOptions } from '@/lib/adminAuth'
import { revokeAllStaffSessions } from '@/lib/staffAuth'

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth check
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  // CSRF check
  if (!validateCsrf(request)) {
    return csrfError()
  }

  const { ip, userAgent } = getRequestMeta(request)

  try {
    const body = await request.json()
    const { target } = body // 'admin' | 'staff' | 'all'

    if (!target || !['admin', 'staff', 'all'].includes(target)) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message_th: 'กรุณาระบุประเภท session ที่ต้องการยกเลิก' } },
        { status: 400 }
      )
    }

    let revokedAdmin = false
    let revokedStaff = false

    if (target === 'admin' || target === 'all') {
      await revokeAllAdminSessions()
      revokedAdmin = true

      await auditLog({
        actor_type: 'admin',
        ip,
        user_agent: userAgent,
        action_code: 'ADMIN_SESSIONS_REVOKED',
        metadata: { target }
      })
    }

    if (target === 'staff' || target === 'all') {
      await revokeAllStaffSessions()
      revokedStaff = true

      await auditLog({
        actor_type: 'admin',
        ip,
        user_agent: userAgent,
        action_code: 'STAFF_SESSIONS_REVOKED',
        metadata: { target }
      })
    }

    // If admin sessions were revoked, issue new session for current user
    const response = NextResponse.json({
      success: true,
      revoked: { admin: revokedAdmin, staff: revokedStaff }
    })

    if (revokedAdmin) {
      // Get fresh token with new version
      const newToken = await generateAdminSessionToken()
      if (newToken) {
        response.cookies.set(ADMIN_COOKIE_NAME, newToken, getAdminCookieOptions())
      }
    }

    return response
  } catch (error) {
    console.error('[ADMIN:SECURITY:REVOKE] Error:', error)
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message_th: 'เกิดข้อผิดพลาด กรุณาลองใหม่' } },
      { status: 500 }
    )
  }
}
