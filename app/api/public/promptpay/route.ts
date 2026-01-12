/**
 * Public PromptPay ID API
 *
 * CANONICAL SOURCE: admin_settings.promptpay_id
 * SAFETY FALLBACK: FALLBACK_PROMPTPAY_ID (for error scenarios)
 *
 * Returns ONLY the promptpay_id from admin_settings.
 * Uses service role key on server-side to bypass RLS and avoid exposing other fields.
 *
 * This is the ONLY safe way for customer-facing code to access promptpay_id.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import {
  checkAndIncrementRateLimitWithConfig,
  publicEndpointKey,
  getClientIp,
  RATE_LIMIT_CONFIGS
} from '@/lib/rate-limiter'

// Safety fallback for error scenarios - ensures payment flow doesn't break
const FALLBACK_PROMPTPAY_ID = '0988799990'

export async function GET(request: NextRequest) {
  // Rate limiting
  const ip = getClientIp(request)
  const rateLimitKey = publicEndpointKey('promptpay', ip)
  const rateLimit = await checkAndIncrementRateLimitWithConfig(rateLimitKey, RATE_LIMIT_CONFIGS['promptpay'])

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Too many requests',
        error_th: 'คำขอมากเกินไป กรุณารอสักครู่',
        retryAfter: rateLimit.retryAfterSeconds
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds || 60),
          'Cache-Control': 'no-store'
        }
      }
    )
  }

  try {
    const supabase = getSupabaseServer()

    const { data, error } = await supabase
      .from('admin_settings')
      .select('promptpay_id')
      .limit(1)
      .single()

    if (error) {
      console.error('[API:PROMPTPAY] Failed to fetch:', error.message)
      // Return fallback on error - don't expose internal errors
      return NextResponse.json(
        { promptpay_id: FALLBACK_PROMPTPAY_ID },
        {
          status: 200,
          headers: { 'Cache-Control': 'no-store' }
        }
      )
    }

    const promptpayId = data?.promptpay_id || FALLBACK_PROMPTPAY_ID

    return NextResponse.json(
      { promptpay_id: promptpayId },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' }
      }
    )
  } catch (error) {
    console.error('[API:PROMPTPAY] Unexpected error:', error)
    return NextResponse.json(
      { promptpay_id: FALLBACK_PROMPTPAY_ID },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' }
      }
    )
  }
}
