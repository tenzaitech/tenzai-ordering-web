import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import {
  checkAndIncrementRateLimitWithConfig,
  publicEndpointKey,
  getClientIp,
  RATE_LIMIT_CONFIGS
} from '@/lib/rate-limiter'

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip = getClientIp(request)
  const rateLimitKey = publicEndpointKey('liff-session', ip)
  const rateLimit = await checkAndIncrementRateLimitWithConfig(rateLimitKey, RATE_LIMIT_CONFIGS['liff-session'])

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Too many requests',
        error_th: 'คำขอมากเกินไป กรุณารอสักครู่',
        retryAfter: rateLimit.retryAfterSeconds
      },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds || 60) }
      }
    )
  }

  try {
    const body = await request.json()
    const { userId } = body

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid userId' },
        { status: 400 }
      )
    }

    // Set secure httpOnly cookie
    const cookieStore = await cookies()
    cookieStore.set('tenzai_liff_user', userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30 // 30 days
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[LIFF_SESSION] Error:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}
