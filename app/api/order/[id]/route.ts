import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabaseServer } from '@/lib/supabase-server'
import { checkLiffGate } from '@/lib/liffGate'

export const runtime = 'nodejs'

/**
 * GET /api/order/[id]
 * Fetches a single order with items (server-side, uses service role)
 * Requires LIFF session and enforces ownership.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check LIFF gate (friendship + freshness)
  const gateError = await checkLiffGate()
  if (gateError) return gateError

  try {
    const { id: orderId } = await params

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID required', error_th: 'ไม่พบรหัสออเดอร์' },
        { status: 400 }
      )
    }

    // Require LIFF session
    const cookieStore = await cookies()
    const userIdCookie = cookieStore.get('tenzai_liff_user')

    if (!userIdCookie || !userIdCookie.value) {
      return NextResponse.json(
        { error: 'Unauthorized', error_th: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      )
    }

    const userId = userIdCookie.value
    const supabase = getSupabaseServer()

    // Fetch order with ownership enforcement in query
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('customer_line_user_id', userId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found', error_th: 'ไม่พบออเดอร์' },
        { status: 404 }
      )
    }

    // Fetch order items
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('id, menu_item_id, menu_code, name_th, name_en, qty, base_price, final_price, note, selected_options_json')
      .eq('order_id', orderId)
      .order('id', { ascending: true })

    if (itemsError) {
      console.error('[API:ORDER_GET] Items error:', itemsError)
    }

    // Remove sensitive fields from order before returning
    const safeOrder = {
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      created_at: order.created_at,
      pickup_type: order.pickup_type,
      pickup_time: order.pickup_time,
      subtotal_amount_dec: order.subtotal_amount_dec,
      vat_rate: order.vat_rate,
      vat_amount_dec: order.vat_amount_dec,
      total_amount_dec: order.total_amount_dec,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_note: order.customer_note,
      slip_notified_at: order.slip_notified_at,
      invoice_requested: order.invoice_requested,
      invoice_company_name: order.invoice_company_name,
      invoice_tax_id: order.invoice_tax_id,
      invoice_address: order.invoice_address,
      invoice_buyer_phone: order.invoice_buyer_phone,
      // Note: slip_url is excluded for privacy
    }

    return NextResponse.json({
      order: safeOrder,
      items: items || [],
    })
  } catch (error) {
    console.error('[API:ORDER_GET] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Server error', error_th: 'เกิดข้อผิดพลาด กรุณาลองใหม่' },
      { status: 500 }
    )
  }
}
