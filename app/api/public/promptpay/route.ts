/**
 * Public PromptPay ID API
 *
 * Returns ONLY the promptpay_id from admin_settings.
 * Uses service role key on server-side to avoid exposing staff_pin_hash.
 *
 * This is the ONLY safe way for customer-facing code to access promptpay_id.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create server-side client with service role key
function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(url, key)
}

// Fallback PromptPay ID if not configured
const FALLBACK_PROMPTPAY_ID = '0988799990'

export async function GET() {
  try {
    const supabase = getServerSupabase()

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
