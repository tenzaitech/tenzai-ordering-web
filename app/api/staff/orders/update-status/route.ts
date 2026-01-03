import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendCustomerNotification } from '@/lib/line'

export async function POST(request: NextRequest) {
  // Verify staff session
  const staffCookie = request.cookies.get('tenzai_staff')

  if (!staffCookie || !staffCookie.value.startsWith('STAFF_VERIFIED')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { orderId, newStatus } = await request.json()

    if (!orderId || !newStatus) {
      return NextResponse.json({ error: 'Missing orderId or newStatus' }, { status: 400 })
    }

    // Validate status
    const validStatuses = ['ready', 'picked_up']
    if (!validStatuses.includes(newStatus)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Fetch current order
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, order_number, status, customer_line_user_id')
      .eq('id', orderId)
      .single()

    if (fetchError || !order) {
      console.error('[STAFF:UPDATE] Fetch error:', fetchError?.message || 'Not found')
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Enforce state transitions
    const validTransitions: Record<string, string> = {
      'approved': 'ready',
      'ready': 'picked_up'
    }

    const expectedStatus = Object.keys(validTransitions).find(k => validTransitions[k] === newStatus)

    if (!expectedStatus || order.status !== expectedStatus) {
      return NextResponse.json({
        error: `Invalid transition: ${order.status} -> ${newStatus}`
      }, { status: 400 })
    }

    // Update with optimistic guard
    const { data: updated, error: updateError } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId)
      .eq('status', order.status)
      .select('id')

    if (updateError) {
      console.error('[STAFF:UPDATE] Update error:', updateError.message)
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
    }

    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'Order status conflict' }, { status: 409 })
    }

    // Send customer notification after successful update
    try {
      await sendCustomerNotification(orderId, newStatus as 'ready' | 'picked_up')
    } catch (notifyError) {
      console.error('[STAFF:UPDATE] Notification error:', String(notifyError))
      // Don't fail the request if notification fails
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[STAFF:UPDATE] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
