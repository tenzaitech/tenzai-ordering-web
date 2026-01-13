import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabaseServer } from '@/lib/supabase-server'
import { sendSlipNotification, sendCustomerSlipConfirmation } from '@/lib/line'

export const runtime = 'nodejs'

type OrderRow = {
  slip_url: string | null
  slip_notified_at: string | null
}

type SlipNotifiedUpdate = {
  slip_notified_at: string
}

// Build version for deployment verification
const BUILD_VERSION = process.env.VERCEL_GIT_COMMIT_SHA || process.env.BUILD_ID || 'dev-local'

export async function POST(request: NextRequest) {
  // Require LIFF session
  const cookieStore = await cookies()
  const userIdCookie = cookieStore.get('tenzai_liff_user')

  if (!userIdCookie || !userIdCookie.value) {
    const response = NextResponse.json({ error: 'Unauthorized', reason: 'NO_SESSION' }, { status: 401 })
    response.headers.set('X-App-Build', BUILD_VERSION)
    return response
  }

  const userId = userIdCookie.value
  const supabase = getSupabaseServer()

  try {
    const body = await request.json()
    const { orderId, source } = body

    // Log source + build for observability (not stored in DB)
    const callSource = source || 'unknown'
    console.log('[API:LINE:NOTIFY] build=', BUILD_VERSION, 'source=', callSource, 'orderId=', orderId)

    if (!orderId) {
      const response = NextResponse.json({ error: 'Missing orderId', reason: 'MISSING_ORDER_ID' }, { status: 400 })
      response.headers.set('X-App-Build', BUILD_VERSION)
      return response
    }

    // Fetch order with ownership enforcement
    const { data, error: orderError } = await supabase
      .from('orders')
      .select('slip_url, slip_notified_at')
      .eq('id', orderId)
      .eq('customer_line_user_id', userId)
      .single()

    const order = data as OrderRow | null

    if (orderError || !order) {
      console.error('[API:LINE:NOTIFY] Order not found:', orderId)
      const response = NextResponse.json({ error: 'Order not found', reason: 'ORDER_NOT_FOUND' }, { status: 404 })
      response.headers.set('X-App-Build', BUILD_VERSION)
      return response
    }

    // Idempotency: exit if already notified
    if (order.slip_notified_at) {
      console.log('[API:LINE:NOTIFY] Already notified:', orderId, 'at', order.slip_notified_at)
      const response = NextResponse.json({ status: 'already_notified', reason: 'ALREADY_NOTIFIED', notified_at: order.slip_notified_at })
      response.headers.set('X-App-Build', BUILD_VERSION)
      return response
    }

    // Exit if slip not uploaded yet
    if (!order.slip_url) {
      console.log('[API:LINE:NOTIFY] Slip not uploaded yet:', orderId)
      const response = NextResponse.json({ status: 'slip_not_uploaded', reason: 'NO_SLIP_URL' })
      response.headers.set('X-App-Build', BUILD_VERSION)
      return response
    }

    // Send notification to approver (throws on failure)
    try {
      await sendSlipNotification(orderId)
      console.log('[API:LINE:NOTIFY] Approver notification sent:', orderId)
    } catch (notifyError) {
      // Log detailed error but return user-safe message
      const errorMsg = notifyError instanceof Error ? notifyError.message : String(notifyError)
      console.error('[API:LINE:NOTIFY] Approver notification failed:', orderId, errorMsg)

      // Determine reason code from error message
      let reasonCode = 'LINE_API_ERROR'
      if (errorMsg.includes('LINE_APPROVER_ID not configured')) reasonCode = 'NO_APPROVER_ID'
      else if (errorMsg.includes('Missing LINE_CHANNEL_ACCESS_TOKEN')) reasonCode = 'NO_ACCESS_TOKEN'
      else if (errorMsg.includes('LINE API error 400')) reasonCode = 'LINE_API_400_BAD_REQUEST'
      else if (errorMsg.includes('LINE API error 401')) reasonCode = 'LINE_API_401_UNAUTHORIZED'
      else if (errorMsg.includes('LINE API error 429')) reasonCode = 'LINE_API_429_RATE_LIMIT'

      const response = NextResponse.json({
        error: 'Failed to send notification',
        reason: reasonCode,
        retryable: true
      }, { status: 500 })
      response.headers.set('X-App-Build', BUILD_VERSION)
      return response
    }

    // Send confirmation to customer (fire-and-forget, don't block on error)
    sendCustomerSlipConfirmation(orderId).catch(err => {
      console.error('[API:LINE:NOTIFY] Customer confirmation failed (non-blocking):', orderId, err instanceof Error ? err.message : String(err))
    })

    // Mark as notified ONLY after successful approver notification
    const updatePayload: SlipNotifiedUpdate = { slip_notified_at: new Date().toISOString() }
    const { error: updateError } = await supabase
      .from('orders')
      .update(updatePayload as never)
      .eq('id', orderId)

    if (updateError) {
      console.error('[API:LINE:NOTIFY] Failed to update slip_notified_at:', orderId, updateError)
      const response = NextResponse.json({
        error: 'Failed to mark as notified',
        reason: 'DB_UPDATE_FAILED',
        retryable: true
      }, { status: 500 })
      response.headers.set('X-App-Build', BUILD_VERSION)
      return response
    }

    const response = NextResponse.json({ status: 'sent', reason: 'SUCCESS' })
    response.headers.set('X-App-Build', BUILD_VERSION)
    return response
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[API:LINE:NOTIFY] Unexpected error:', errorMsg)
    const response = NextResponse.json({
      error: 'Internal error',
      reason: 'UNEXPECTED_ERROR',
      retryable: true
    }, { status: 500 })
    response.headers.set('X-App-Build', BUILD_VERSION)
    return response
  }
}
