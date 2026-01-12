import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { checkAdminAuth } from '@/lib/admin-gate'

export const runtime = 'nodejs'
import { validateCsrf, csrfError } from '@/lib/csrf'
import { auditLog, getRequestMeta } from '@/lib/audit-log'

type OrderRow = {
  status: string
  rejected_at: string | null
}

type OrderRejection = {
  status: string
  rejected_at: string
  rejected_reason: string | null
}

export async function POST(request: NextRequest) {
  // Auth check
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  // CSRF check
  if (!validateCsrf(request)) {
    return csrfError()
  }

  const { ip, userAgent } = getRequestMeta(request)
  const supabase = getSupabaseServer()

  try {
    const body = await request.json()
    const { orderId, reason } = body

    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
    }

    // Fetch order
    const { data, error: orderError } = await supabase
      .from('orders')
      .select('status, rejected_at')
      .eq('id', orderId)
      .single()

    const order = data as OrderRow | null

    if (orderError || !order) {
      console.error('[API:REJECT] Order not found:', orderId)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Idempotency: exit if already rejected
    if (order.rejected_at) {
      return NextResponse.json({ status: 'already_rejected' })
    }

    // Update order status to rejected
    const rejectionPayload: OrderRejection = {
      status: 'rejected',
      rejected_at: new Date().toISOString(),
      rejected_reason: reason || null
    }
    const { error: updateError } = await supabase
      .from('orders')
      .update(rejectionPayload as never)
      .eq('id', orderId)

    if (updateError) {
      console.error('[API:REJECT] Failed to update order:', updateError)
      return NextResponse.json({ error: 'Failed to reject order' }, { status: 500 })
    }

    // Audit log - order rejected
    await auditLog({
      actor_type: 'admin',
      ip,
      user_agent: userAgent,
      action_code: 'ORDER_REJECTED',
      metadata: { order_id: orderId, reason: reason || null }
    })

    return NextResponse.json({ status: 'rejected' })
  } catch (error) {
    console.error('[API:REJECT] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
