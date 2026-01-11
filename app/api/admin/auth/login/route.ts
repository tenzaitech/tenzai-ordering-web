import { NextRequest, NextResponse } from 'next/server'
import { scrypt } from 'crypto'
import { promisify } from 'util'
import { supabase } from '@/lib/supabase'
import {
  generateAdminSessionToken,
  ADMIN_COOKIE_NAME,
  getAdminCookieOptions
} from '@/lib/adminAuth'
import {
  checkRateLimit,
  recordFailedAttempt,
  clearRateLimit,
  getClientIp
} from '@/lib/rate-limiter'

const scryptAsync = promisify(scrypt)

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
 * Verify password against stored scrypt hash
 */
async function verifyPassword(storedHash: string, suppliedPassword: string): Promise<boolean> {
  const [hashedPassword, salt] = storedHash.split('.')
  if (!hashedPassword || !salt) return false
  const buf = (await scryptAsync(suppliedPassword, salt, 64)) as Buffer
  return buf.toString('hex') === hashedPassword
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const clientIp = getClientIp(request)
  const rateLimitKey = `admin:${clientIp}`

  // Check rate limit
  const rateLimit = checkRateLimit(rateLimitKey)
  if (!rateLimit.allowed) {
    const retryAfterSeconds = Math.ceil((rateLimit.retryAfterMs || 0) / 1000)
    return NextResponse.json<ErrorResponse>(
      {
        error: {
          code: 'RATE_LIMITED',
          message_th: `เข้าสู่ระบบล้มเหลวหลายครั้ง กรุณารอ ${retryAfterSeconds} วินาที`
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

    // Fetch admin credentials from DB
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
      // Fall back to ADMIN_API_KEY if no DB credentials set
      const adminApiKey = process.env.ADMIN_API_KEY
      if (adminApiKey && username === 'admin' && password === adminApiKey) {
        clearRateLimit(rateLimitKey)
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

        const response = NextResponse.json({ ok: true })
        response.cookies.set(ADMIN_COOKIE_NAME, token, getAdminCookieOptions())
        return response
      }

      recordFailedAttempt(rateLimitKey)
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
      recordFailedAttempt(rateLimitKey)
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
    const passwordValid = await verifyPassword(settings.admin_password_hash, password)
    if (!passwordValid) {
      recordFailedAttempt(rateLimitKey)
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
    clearRateLimit(rateLimitKey)
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
