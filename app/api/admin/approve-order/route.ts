import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { sendStaffNotification, sendCustomerApprovedNotification } from '@/lib/line'

type OrderRow = {
  status: string
  approved_at: string | null
}

type OrderApproval = {
  status: string
  approved_at: string
  approved_by: string
}

type StaffNotifiedUpdate = {
  staff_notified_at: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { orderId } = body

    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
    }

    // Fetch order
    const { data, error: orderError } = await supabase
      .from('orders')
      .select('status, approved_at')
      .eq('id', orderId)
      .single()

    const order = data as OrderRow | null

    if (orderError || !order) {
      console.error('[API:APPROVE] Order not found:', orderId)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Idempotency: exit if already approved
    if (order.approved_at) {
      return NextResponse.json({ status: 'already_approved' })
    }

    // Update order status to approved
    const approvalPayload: OrderApproval = {
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: 'admin'
    }
    const { error: updateError } = await supabase
      .from('orders')
      .update(approvalPayload as never)
      .eq('id', orderId)

    if (updateError) {
      console.error('[API:APPROVE] Failed to update order:', updateError)
      return NextResponse.json({ error: 'Failed to approve order' }, { status: 500 })
    }

    // Send notifications (fire-and-forget)
    Promise.resolve().then(async () => {
      const now = new Date().toISOString()

      // Send staff notification
      try {
        await sendStaffNotification(orderId)
        const staffUpdate: StaffNotifiedUpdate = { staff_notified_at: now }
        await supabase
          .from('orders')
          .update(staffUpdate as never)
          .eq('id', orderId)
      } catch (err) {
        console.error('[API:APPROVE] Staff notification failed:', err)
      }

      // Send customer notification
      try {
        await sendCustomerApprovedNotification(orderId)
      } catch (err) {
        console.error('[API:APPROVE] Customer notification failed:', err)
      }
    })

    return NextResponse.json({ status: 'approved' })
  } catch (error) {
    console.error('[API:APPROVE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
