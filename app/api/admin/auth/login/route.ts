import { NextRequest, NextResponse } from 'next/server'
import { scryptSync, timingSafeEqual } from 'crypto'
import { getSupabaseServer } from '@/lib/supabase-server'
import {
  generateAdminSessionToken,
  ADMIN_COOKIE_NAME,
  getAdminCookieOptions
} from '@/lib/adminAuth'
import {
  checkAndIncrementRateLimit,
  clearRateLimit,
  getClientIp,
  adminLoginKey
} from '@/lib/rate-limiter'
import { auditLog, getRequestMeta } from '@/lib/audit-log'

export const runtime = 'nodejs'

type AdminSettingsRow = {
  admin_username: string | null
  admin_password_hash: string | null
}

type ErrorResponse = {
  error: {
    code: string
    message_th: string
  }
}

/**
 * Verify password against stored scrypt hash (sync for Vercel stability)
 */
function verifyPassword(storedHash: string, suppliedPassword: string): boolean {
  try {
    const [hashedPassword, salt] = storedHash.split('.')
    if (!hashedPassword || !salt) return false
    const buf = scryptSync(suppliedPassword, salt, 64)
    const storedBuf = Buffer.from(hashedPassword, 'hex')
    if (buf.length !== storedBuf.length) return false
    return timingSafeEqual(buf, storedBuf)
  } catch (err) {
    console.error('[ADMIN:AUTH:LOGIN] verifyPassword error:', err instanceof Error ? err.message : 'unknown')
    return false
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const clientIp = getClientIp(request)
  const rateLimitKey = adminLoginKey(clientIp)
  const { ip, userAgent } = getRequestMeta(request)

  // Check rate limit (persistent, cloud-safe)
  const rateLimit = await checkAndIncrementRateLimit(rateLimitKey)
  if (!rateLimit.allowed) {
    const retryAfterSeconds = rateLimit.retryAfterSeconds || 900
    return NextResponse.json<ErrorResponse>(
      {
        error: {
          code: 'RATE_LIMITED',
          message_th: `เข้าสู่ระบบล้มเหลวหลายครั้ง กรุณารอ ${Math.ceil(retryAfterSeconds / 60)} นาที`
        }
      },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSeconds) }
      }
    )
  }

  try {
    const body = await request.json()
    const { username, password } = body

    // Validate input
    if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json<ErrorResponse>(
        {
          error: {
            code: 'INVALID_INPUT',
            message_th: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'
          }
        },
        { status: 400 }
      )
    }

    // Fetch admin credentials from DB (using server-side client)
    const supabase = getSupabaseServer()
    const { data: settingsData, error: fetchError } = await supabase
      .from('admin_settings')
      .select('admin_username, admin_password_hash')
      .limit(1)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[ADMIN:AUTH:LOGIN] Settings fetch error:', fetchError.message)
      return NextResponse.json<ErrorResponse>(
        {
          error: {
            code: 'SERVER_ERROR',
            message_th: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
          }
        },
        { status: 500 }
      )
    }

    const settings = settingsData as AdminSettingsRow | null

    // Check if admin credentials are configured
    if (!settings?.admin_username || !settings?.admin_password_hash) {
      // ADMIN_API_KEY fallback ONLY in dev with explicit flag
      if (
        process.env.NODE_ENV === 'development' &&
        process.env.ALLOW_ADMIN_API_KEY_FALLBACK === 'true'
      ) {
        const adminApiKey = process.env.ADMIN_API_KEY
        if (adminApiKey && username === 'admin' && password === adminApiKey) {
          await clearRateLimit(rateLimitKey)
          const token = await generateAdminSessionToken()
          if (!token) {
            return NextResponse.json<ErrorResponse>(
              {
                error: {
                  code: 'SERVER_ERROR',
                  message_th: 'เกิดข้อผิดพลาดในระบบ'
                }
              },
              { status: 500 }
            )
          }

          // Audit log - dev fallback login
          await auditLog({
            actor_type: 'admin',
            actor_identifier: username,
            ip,
            user_agent: userAgent,
            action_code: 'ADMIN_LOGIN_OK',
            metadata: { method: 'api_key_fallback', env: 'development' }
          })

          const response = NextResponse.json({ ok: true })
          response.cookies.set(ADMIN_COOKIE_NAME, token, getAdminCookieOptions())
          return response
        }
      }

      // No credentials configured and fallback not allowed/matched
      await auditLog({
        actor_type: 'admin',
        actor_identifier: username,
        ip,
        user_agent: userAgent,
        action_code: 'ADMIN_LOGIN_FAIL',
        metadata: { reason: 'no_credentials_configured' }
      })

      return NextResponse.json<ErrorResponse>(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message_th: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
          }
        },
        { status: 401 }
      )
    }

    // Verify username (case-insensitive)
    if (username.toLowerCase() !== settings.admin_username.toLowerCase()) {
      await auditLog({
        actor_type: 'admin',
        actor_identifier: username,
        ip,
        user_agent: userAgent,
        action_code: 'ADMIN_LOGIN_FAIL',
        metadata: { reason: 'invalid_username' }
      })

      return NextResponse.json<ErrorResponse>(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message_th: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
          }
        },
        { status: 401 }
      )
    }

    // Verify password
    const passwordValid = verifyPassword(settings.admin_password_hash, password)
    if (!passwordValid) {
      await auditLog({
        actor_type: 'admin',
        actor_identifier: username,
        ip,
        user_agent: userAgent,
        action_code: 'ADMIN_LOGIN_FAIL',
        metadata: { reason: 'invalid_password' }
      })

      return NextResponse.json<ErrorResponse>(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message_th: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
          }
        },
        { status: 401 }
      )
    }

    // Success - clear rate limit and issue session
    await clearRateLimit(rateLimitKey)
    const token = await generateAdminSessionToken()
    if (!token) {
      return NextResponse.json<ErrorResponse>(
        {
          error: {
            code: 'SERVER_ERROR',
            message_th: 'เกิดข้อผิดพลาดในระบบ'
          }
        },
        { status: 500 }
      )
    }

    // Audit log - successful login
    await auditLog({
      actor_type: 'admin',
      actor_identifier: username,
      ip,
      user_agent: userAgent,
      action_code: 'ADMIN_LOGIN_OK',
      metadata: { method: 'password' }
    })

    const response = NextResponse.json({ ok: true })
    response.cookies.set(ADMIN_COOKIE_NAME, token, getAdminCookieOptions())
    return response
  } catch (error) {
    console.error('[ADMIN:AUTH:LOGIN] Error:', error)
    return NextResponse.json<ErrorResponse>(
      {
        error: {
          code: 'SERVER_ERROR',
          message_th: 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง'
        }
      },
      { status: 500 }
    )
  }
}
