import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendSlipNotification } from '@/lib/line'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderId } = body

    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
    }

    // Fetch order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('slip_url, slip_notified_at')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error('[API:LINE:NOTIFY] Order not found:', orderId)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Idempotency: exit if already notified
    if (order.slip_notified_at) {
      console.log('[API:LINE:NOTIFY] Already notified:', orderId)
      return NextResponse.json({ status: 'already_notified' })
    }

    // Exit if slip not uploaded yet
    if (!order.slip_url) {
      console.log('[API:LINE:NOTIFY] Slip not uploaded yet:', orderId)
      return NextResponse.json({ status: 'slip_not_uploaded' })
    }

    // Send notification
    await sendSlipNotification(orderId)

    // Mark as notified
    const { error: updateError } = await supabase
      .from('orders')
      .update({ slip_notified_at: new Date().toISOString() })
      .eq('id', orderId)

    if (updateError) {
      console.error('[API:LINE:NOTIFY] Failed to update slip_notified_at:', updateError)
      return NextResponse.json({ error: 'Failed to mark as notified' }, { status: 500 })
    }

    console.log('[API:LINE:NOTIFY] Success:', orderId)
    return NextResponse.json({ status: 'sent' })
  } catch (error) {
    console.error('[API:LINE:NOTIFY] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
