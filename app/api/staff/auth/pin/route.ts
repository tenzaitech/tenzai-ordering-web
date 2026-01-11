import { NextRequest, NextResponse } from 'next/server'
import { scrypt } from 'crypto'
import { promisify } from 'util'
import { supabase } from '@/lib/supabase'
import { STAFF_COOKIE_NAME, getStaffCookieOptions } from '@/lib/staffAuth'
import {
  checkRateLimit,
  recordFailedAttempt,
  clearRateLimit,
  getClientIp
} from '@/lib/rate-limiter'

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
  const rateLimitKey = `staff:${clientIp}`

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

    // Fetch PIN hash from DB
    const { data: settingsData, error: fetchError } = await supabase
      .from('admin_settings')
      .select('staff_pin_hash, pin_version')
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

    const settings = settingsData as SettingsRow | null

    // Validate PIN
    let pinValid = false
    let pinVersion = 1

    if (settings && settings.staff_pin_hash) {
      pinValid = await verifyPin(settings.staff_pin_hash, pin)
      pinVersion = settings.pin_version
    } else {
      // Fallback to env STAFF_PIN (plaintext comparison for backward compat)
      const envPin = process.env.STAFF_PIN
      if (!envPin) {
        console.error('[STAFF:AUTH:PIN] No PIN configured (DB or env)')
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
      pinValid = pin === envPin
    }

    if (!pinValid) {
      recordFailedAttempt(rateLimitKey)
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
    clearRateLimit(rateLimitKey)

    const response = NextResponse.json({ ok: true })
    response.cookies.set(
      STAFF_COOKIE_NAME,
      `STAFF_VERIFIED:${pinVersion}`,
      getStaffCookieOptions()
    )

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
