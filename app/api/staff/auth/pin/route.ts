import { NextRequest, NextResponse } from 'next/server'
import { scrypt } from 'crypto'
import { promisify } from 'util'
import { getSupabaseServer } from '@/lib/supabase-server'
import {
  STAFF_COOKIE_NAME,
  getStaffCookieOptions,
  generateStaffSessionToken
} from '@/lib/staffAuth'
import {
  checkAndIncrementRateLimit,
  clearRateLimit,
  getClientIp,
  staffPinKey
} from '@/lib/rate-limiter'
import { auditLog, getRequestMeta } from '@/lib/audit-log'

export const runtime = 'nodejs'

const scryptAsync = promisify(scrypt)

type SettingsRow = {
  staff_pin_hash: string | null
  pin_version: number
}

type ErrorResponse = {
  error: {
    code: string
    message_th: string
  }
}

/**
 * Verify PIN against stored scrypt hash
 */
async function verifyPin(storedHash: string, suppliedPin: string): Promise<boolean> {
  const [hashedPassword, salt] = storedHash.split('.')
  if (!hashedPassword || !salt) return false
  const buf = (await scryptAsync(suppliedPin, salt, 64)) as Buffer
  return buf.toString('hex') === hashedPassword
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const clientIp = getClientIp(request)
  const rateLimitKey = staffPinKey(clientIp)
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
    const { pin } = body

    // Validate input
    if (!pin || typeof pin !== 'string') {
      return NextResponse.json<ErrorResponse>(
        {
          error: {
            code: 'INVALID_INPUT',
            message_th: 'กรุณากรอก PIN'
          }
        },
        { status: 400 }
      )
    }

    // Fetch PIN hash from DB (using server-side client)
    const supabase = getSupabaseServer()
    const { data: settingsData, error: fetchError } = await supabase
      .from('admin_settings')
      .select('staff_pin_hash, pin_version, staff_session_version')
      .limit(1)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[STAFF:AUTH:PIN] Settings fetch error:', fetchError.message)
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

    const settings = settingsData as (SettingsRow & { staff_session_version?: number }) | null

    // Validate PIN
    let pinValid = false

    if (settings && settings.staff_pin_hash) {
      pinValid = await verifyPin(settings.staff_pin_hash, pin)
    } else {
      // Fallback to env STAFF_PIN ONLY in dev with explicit flag
      if (
        process.env.NODE_ENV === 'development' &&
        process.env.ALLOW_STAFF_PIN_FALLBACK === 'true'
      ) {
        const envPin = process.env.STAFF_PIN
        if (envPin) {
          pinValid = pin === envPin
        }
      }

      if (!pinValid) {
        console.error('[STAFF:AUTH:PIN] No PIN configured (DB or env fallback disabled)')
        return NextResponse.json<ErrorResponse>(
          {
            error: {
              code: 'SERVER_ERROR',
              message_th: 'ระบบยังไม่ได้ตั้งค่า PIN'
            }
          },
          { status: 500 }
        )
      }
    }

    if (!pinValid) {
      await auditLog({
        actor_type: 'staff',
        ip,
        user_agent: userAgent,
        action_code: 'STAFF_PIN_FAIL',
        metadata: { reason: 'invalid_pin' }
      })

      return NextResponse.json<ErrorResponse>(
        {
          error: {
            code: 'INVALID_PIN',
            message_th: 'PIN ไม่ถูกต้อง'
          }
        },
        { status: 401 }
      )
    }

    // Success - clear rate limit and issue session
    await clearRateLimit(rateLimitKey)

    // Use session version from DB (prefer staff_session_version, fall back to pin_version)
    const sessionVersion = settings?.staff_session_version || settings?.pin_version || 1
    const token = await generateStaffSessionToken(sessionVersion)

    // Audit log - successful login
    await auditLog({
      actor_type: 'staff',
      ip,
      user_agent: userAgent,
      action_code: 'STAFF_PIN_OK',
      metadata: { session_version: sessionVersion }
    })

    const response = NextResponse.json({ ok: true })
    response.cookies.set(STAFF_COOKIE_NAME, token, getStaffCookieOptions())

    return response
  } catch (error) {
    console.error('[STAFF:AUTH:PIN] Error:', error)
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
