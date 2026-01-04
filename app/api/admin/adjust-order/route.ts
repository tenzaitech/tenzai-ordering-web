import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendStaffAdjustmentNotification } from '@/lib/line'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderId, note } = body

    if (!orderId || !note) {
      return NextResponse.json({ error: 'Missing orderId or note' }, { status: 400 })
    }

    // Fetch order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('approved_at, rejected_at')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error('[API:ADJUST] Order not found:', orderId)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Validate order is approved
    if (!order.approved_at) {
      return NextResponse.json({ error: 'Order must be approved first' }, { status: 400 })
    }

    // Update adjustment fields
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        adjustment_note: note.trim(),
        adjusted_at: new Date().toISOString(),
        adjusted_by: 'admin'
      })
      .eq('id', orderId)

    if (updateError) {
      console.error('[API:ADJUST] Failed to update order:', updateError)
      return NextResponse.json({ error: 'Failed to save adjustment' }, { status: 500 })
    }

    // Send staff notification (fire-and-forget)
    Promise.resolve().then(async () => {
      try {
        await sendStaffAdjustmentNotification(orderId)
      } catch (err) {
        console.error('[API:ADJUST] Notification failed:', err)
      }
    })

    return NextResponse.json({ status: 'adjusted' })
  } catch (error) {
    console.error('[API:ADJUST] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
