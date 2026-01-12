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

export async function POST(request: NextRequest) {
  // Require LIFF session
  const cookieStore = await cookies()
  const userIdCookie = cookieStore.get('tenzai_liff_user')

  if (!userIdCookie || !userIdCookie.value) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userId = userIdCookie.value
  const supabase = getSupabaseServer()

  try {
    const body = await request.json()
    const { orderId } = body

    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
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
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Idempotency: exit if already notified
    if (order.slip_notified_at) {
      return NextResponse.json({ status: 'already_notified' })
    }

    // Exit if slip not uploaded yet
    if (!order.slip_url) {
      return NextResponse.json({ status: 'slip_not_uploaded' })
    }

    // Send notification to approver
    await sendSlipNotification(orderId)

    // Send confirmation to customer (fire-and-forget, don't block on error)
    sendCustomerSlipConfirmation(orderId).catch(err => {
      console.error('[API:LINE:NOTIFY] Customer notification failed (non-blocking):', err)
    })

    // Mark as notified
    const updatePayload: SlipNotifiedUpdate = { slip_notified_at: new Date().toISOString() }
    const { error: updateError } = await supabase
      .from('orders')
      .update(updatePayload as never)
      .eq('id', orderId)

    if (updateError) {
      console.error('[API:LINE:NOTIFY] Failed to update slip_notified_at:', updateError)
      return NextResponse.json({ error: 'Failed to mark as notified' }, { status: 500 })
    }

    return NextResponse.json({ status: 'sent' })
  } catch (error) {
    console.error('[API:LINE:NOTIFY] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
