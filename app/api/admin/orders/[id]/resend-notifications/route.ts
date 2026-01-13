import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { checkAdminAuth } from '@/lib/admin-gate'
import { validateCsrf, csrfError } from '@/lib/csrf'
import {
  sendSlipNotification,
  sendCustomerSlipConfirmation,
  sendCustomerApprovedNotification,
  sendCustomerRejectedNotification,
  sendCustomerNotification,
  sendStaffNotification,
  sendStaffAdjustmentNotification
} from '@/lib/line'

export const runtime = 'nodejs'

type NotificationType = 'slip' | 'slip_confirmation' | 'approved' | 'rejected' | 'ready' | 'picked_up' | 'staff' | 'adjustment'

type ResendRequest = {
  types: NotificationType[]
  force?: boolean
}

type ResendResult = {
  type: NotificationType
  ok: boolean
  reason_code: string
}

/**
 * POST /api/admin/orders/[id]/resend-notifications
 *
 * Resends LINE notifications for a given order (admin recovery tool)
 *
 * Body:
 * {
 *   types: ["slip", "approved", "rejected", "ready", "picked_up", "staff", "adjustment", "slip_confirmation"],
 *   force: true  // Bypass idempotency checks (for slip only)
 * }
 *
 * Returns:
 * {
 *   results: [{ type, ok, reason_code }, ...]
 * }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Auth check
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  // CSRF check
  if (!validateCsrf(request)) {
    return csrfError()
  }

  const { id: orderId } = await context.params
  const supabase = getSupabaseServer()

  try {
    const body: ResendRequest = await request.json()
    const { types, force = false } = body

    if (!types || !Array.isArray(types) || types.length === 0) {
      return NextResponse.json({
        error: 'Missing or invalid types array',
        reason: 'INVALID_TYPES'
      }, { status: 400 })
    }

    // Fetch order to validate it exists and get status
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderError || !orderData) {
      return NextResponse.json({
        error: 'Order not found',
        reason: 'ORDER_NOT_FOUND'
      }, { status: 404 })
    }

    const order = orderData as {
      status: string
      slip_url: string | null
      slip_notified_at: string | null
      approved_at: string | null
      rejected_at: string | null
    }

    const results: ResendResult[] = []

    // Process each notification type
    for (const type of types) {
      let ok = false
      let reasonCode = 'UNKNOWN'

      try {
        switch (type) {
          case 'slip':
            // Check prerequisites unless force=true
            if (!order.slip_url) {
              reasonCode = 'NO_SLIP_URL'
              break
            }
            if (order.slip_notified_at && !force) {
              reasonCode = 'ALREADY_NOTIFIED_USE_FORCE'
              break
            }
            await sendSlipNotification(orderId)

            // Update slip_notified_at if force was used
            if (force && !order.slip_notified_at) {
              await supabase
                .from('orders')
                .update({ slip_notified_at: new Date().toISOString() } as never)
                .eq('id', orderId)
            }

            ok = true
            reasonCode = force ? 'FORCE_RESENT' : 'SENT'
            break

          case 'slip_confirmation':
            if (!order.slip_url) {
              reasonCode = 'NO_SLIP_URL'
              break
            }
            await sendCustomerSlipConfirmation(orderId)
            ok = true
            reasonCode = 'SENT'
            break

          case 'approved':
            if (!order.approved_at) {
              reasonCode = 'NOT_APPROVED_YET'
              break
            }
            await sendCustomerApprovedNotification(orderId)
            ok = true
            reasonCode = 'SENT'
            break

          case 'rejected':
            if (!order.rejected_at) {
              reasonCode = 'NOT_REJECTED_YET'
              break
            }
            await sendCustomerRejectedNotification(orderId)
            ok = true
            reasonCode = 'SENT'
            break

          case 'ready':
            if (order.status !== 'ready' && order.status !== 'picked_up') {
              reasonCode = 'NOT_READY_YET'
              break
            }
            await sendCustomerNotification(orderId, 'ready')
            ok = true
            reasonCode = 'SENT'
            break

          case 'picked_up':
            if (order.status !== 'picked_up') {
              reasonCode = 'NOT_PICKED_UP_YET'
              break
            }
            await sendCustomerNotification(orderId, 'picked_up')
            ok = true
            reasonCode = 'SENT'
            break

          case 'staff':
            if (!order.approved_at) {
              reasonCode = 'NOT_APPROVED_YET'
              break
            }
            await sendStaffNotification(orderId)
            ok = true
            reasonCode = 'SENT'
            break

          case 'adjustment':
            if (!order.approved_at) {
              reasonCode = 'NOT_APPROVED_YET'
              break
            }
            await sendStaffAdjustmentNotification(orderId)
            ok = true
            reasonCode = 'SENT'
            break

          default:
            reasonCode = 'UNKNOWN_TYPE'
            break
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error(`[API:ADMIN:RESEND] Failed to send ${type}:`, orderId, errorMsg)

        // Parse error message for reason code
        if (errorMsg.includes('LINE_APPROVER_ID not configured')) reasonCode = 'NO_APPROVER_ID'
        else if (errorMsg.includes('LINE_STAFF_ID not configured')) reasonCode = 'NO_STAFF_ID'
        else if (errorMsg.includes('No customer LINE user ID')) reasonCode = 'NO_CUSTOMER_LINE_ID'
        else if (errorMsg.includes('Missing LINE_CHANNEL_ACCESS_TOKEN')) reasonCode = 'NO_ACCESS_TOKEN'
        else if (errorMsg.includes('LINE API error 400')) reasonCode = 'LINE_API_400'
        else if (errorMsg.includes('LINE API error 401')) reasonCode = 'LINE_API_401'
        else if (errorMsg.includes('LINE API error 429')) reasonCode = 'LINE_API_429'
        else if (errorMsg.includes('Failed to fetch order')) reasonCode = 'ORDER_FETCH_FAILED'
        else reasonCode = 'LINE_API_ERROR'
      }

      results.push({ type, ok, reason_code: reasonCode })
    }

    return NextResponse.json({ results })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[API:ADMIN:RESEND] Unexpected error:', errorMsg)
    return NextResponse.json({
      error: 'Internal error',
      reason: 'UNEXPECTED_ERROR'
    }, { status: 500 })
  }
}
