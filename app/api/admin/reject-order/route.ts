import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { sendCustomerRejectedNotification } from '@/lib/line'
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

  // CSRF check (relaxed in dev after successful admin auth)
  // DEV-ONLY BYPASS: Allow admin mutations with valid session but missing/invalid CSRF
  // Production: full CSRF enforcement remains unchanged
  const csrfValid = validateCsrf(request)
  if (!csrfValid) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[API:REJECT] CSRF validation failed')
      return csrfError()
    } else {
      console.warn('[API:REJECT] CSRF validation bypassed in development (admin session is valid)')
    }
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
      .update(rejectionPayload)
      .eq('id', orderId)

    if (updateError) {
      console.error('[API:REJECT] Failed to update order:', orderId, updateError)
      return NextResponse.json({ error: 'Failed to reject order', reason: 'DB_UPDATE_FAILED' }, { status: 500 })
    }

    console.log('[API:REJECT] Order rejected successfully:', orderId)

    // Audit log - order rejected
    await auditLog({
      actor_type: 'admin',
      ip,
      user_agent: userAgent,
      action_code: 'ORDER_REJECTED',
      metadata: { order_id: orderId, reason: reason || null }
    })

    // Send customer notification (fire-and-forget)
    Promise.resolve().then(async () => {
      try {
        await sendCustomerRejectedNotification(orderId)
        console.log('[API:REJECT] Customer notification sent:', orderId)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error('[API:REJECT] Customer notification failed:', orderId, errorMsg)
      }
    })

    return NextResponse.json({ status: 'rejected', reason: 'SUCCESS' })
  } catch (error) {
    console.error('[API:REJECT] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
