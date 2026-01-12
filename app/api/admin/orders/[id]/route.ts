import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { checkAdminAuth } from '@/lib/admin-gate'

export const runtime = 'nodejs'

/**
 * GET /api/admin/orders/[id]
 * Fetches a single order with items for admin (server-side, uses service role)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth check
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  const supabase = getSupabaseServer()

  try {
    const { id: orderId } = await params

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID required' }, { status: 400 })
    }

    // Fetch order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      console.error('[API:ADMIN:ORDER] Order not found:', orderError)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Fetch order items
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)

    if (itemsError) {
      console.error('[API:ADMIN:ORDER] Failed to fetch items:', itemsError)
    }

    return NextResponse.json({ order, items: items || [] })
  } catch (error) {
    console.error('[API:ADMIN:ORDER] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
