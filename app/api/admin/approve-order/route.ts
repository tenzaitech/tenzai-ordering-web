import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendStaffNotification } from '@/lib/line'

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
      .select('status, approved_at')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error('[API:APPROVE] Order not found:', orderId)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Idempotency: exit if already approved
    if (order.approved_at) {
      console.log('[API:APPROVE] Already approved:', orderId)
      return NextResponse.json({ status: 'already_approved' })
    }

    // Update order status to approved
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: 'admin'
      })
      .eq('id', orderId)

    if (updateError) {
      console.error('[API:APPROVE] Failed to update order:', updateError)
      return NextResponse.json({ error: 'Failed to approve order' }, { status: 500 })
    }

    // Send staff notification (fire-and-forget)
    Promise.resolve().then(async () => {
      try {
        await sendStaffNotification(orderId)
        await supabase
          .from('orders')
          .update({ staff_notified_at: new Date().toISOString() })
          .eq('id', orderId)
      } catch (err) {
        console.error('[API:APPROVE] Staff notification failed:', err)
      }
    })

    console.log('[API:APPROVE] Success:', orderId)
    return NextResponse.json({ status: 'approved' })
  } catch (error) {
    console.error('[API:APPROVE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
