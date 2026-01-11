import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { checkAdminAuth } from '@/lib/admin-gate'
import { validateCsrf, csrfError } from '@/lib/csrf'
import { auditLog, getRequestMeta } from '@/lib/audit-log'
import { revokeAllAdminSessions, generateAdminSessionToken, ADMIN_COOKIE_NAME, getAdminCookieOptions } from '@/lib/adminAuth'
import { scrypt, randomBytes } from 'crypto'
import { promisify } from 'util'

export const runtime = 'nodejs'

const scryptAsync = promisify(scrypt)

type SettingsRow = {
  id: string
  admin_password_hash?: string
  admin_session_version?: number
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const buf = (await scryptAsync(password, salt, 64)) as Buffer
  return `${buf.toString('hex')}.${salt}`
}

async function verifyPassword(storedHash: string, suppliedPassword: string): Promise<boolean> {
  const [hashedPassword, salt] = storedHash.split('.')
  if (!hashedPassword || !salt) return false
  const buf = (await scryptAsync(suppliedPassword, salt, 64)) as Buffer
  return buf.toString('hex') === hashedPassword
}

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
    const { current_password, new_password } = body

    // Validate input
    if (!current_password || typeof current_password !== 'string') {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message_th: 'กรุณากรอกรหัสผ่านปัจจุบัน' } },
        { status: 400 }
      )
    }

    if (!new_password || typeof new_password !== 'string' || new_password.length < 8) {
      return NextResponse.json(
        { error: { code: 'INVALID_INPUT', message_th: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร' } },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServer()

    // Fetch current password hash
    const { data: settingsData, error: fetchError } = await supabase
      .from('admin_settings')
      .select('id, admin_password_hash, admin_session_version')
      .limit(1)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[ADMIN:SECURITY:PASSWORD] Fetch error:', fetchError.message)
      return NextResponse.json(
        { error: { code: 'SERVER_ERROR', message_th: 'เกิดข้อผิดพลาด กรุณาลองใหม่' } },
        { status: 500 }
      )
    }

    const settings = settingsData as SettingsRow | null

    if (!settings?.admin_password_hash) {
      return NextResponse.json(
        { error: { code: 'NO_PASSWORD', message_th: 'ยังไม่ได้ตั้งรหัสผ่าน กรุณาติดต่อผู้ดูแลระบบ' } },
        { status: 400 }
      )
    }

    // Verify current password
    const passwordValid = await verifyPassword(settings.admin_password_hash, current_password)
    if (!passwordValid) {
      await auditLog({
        actor_type: 'admin',
        ip,
        user_agent: userAgent,
        action_code: 'ADMIN_LOGIN_FAIL',
        metadata: { reason: 'invalid_current_password', action: 'password_change' }
      })

      return NextResponse.json(
        { error: { code: 'INVALID_CURRENT_PASSWORD', message_th: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' } },
        { status: 401 }
      )
    }

    // Hash new password
    const newPasswordHash = await hashPassword(new_password)
    const newSessionVersion = (settings.admin_session_version || 1) + 1

    // Update password and session version
    const { error: updateError } = await supabase
      .from('admin_settings')
      .update({
        admin_password_hash: newPasswordHash,
        admin_session_version: newSessionVersion,
        updated_at: new Date().toISOString()
      } as never)
      .eq('id', settings.id)

    if (updateError) {
      console.error('[ADMIN:SECURITY:PASSWORD] Update error:', updateError.message)
      return NextResponse.json(
        { error: { code: 'SERVER_ERROR', message_th: 'เกิดข้อผิดพลาดในการบันทึก' } },
        { status: 500 }
      )
    }

    // Revoke all admin sessions (version bump already happened)
    await revokeAllAdminSessions()

    // Audit log
    await auditLog({
      actor_type: 'admin',
      ip,
      user_agent: userAgent,
      action_code: 'ADMIN_PASSWORD_CHANGED',
      metadata: { revoked_sessions: true }
    })

    // Issue new session token for current user
    const newToken = await generateAdminSessionToken(newSessionVersion)
    if (!newToken) {
      return NextResponse.json(
        { error: { code: 'SERVER_ERROR', message_th: 'เกิดข้อผิดพลาดในการสร้าง session ใหม่' } },
        { status: 500 }
      )
    }

    const response = NextResponse.json({ success: true })
    response.cookies.set(ADMIN_COOKIE_NAME, newToken, getAdminCookieOptions())

    return response
  } catch (error) {
    console.error('[ADMIN:SECURITY:PASSWORD] Error:', error)
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message_th: 'เกิดข้อผิดพลาด กรุณาลองใหม่' } },
      { status: 500 }
    )
  }
}
