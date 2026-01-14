import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { isStaffAuthorized, unauthorized } from '@/lib/staffAuth'

export const runtime = 'nodejs'

/**
 * GET /api/staff/orders/history
 * Fetches today's picked_up orders for staff history (server-side, uses service role)
 */
export async function GET(request: NextRequest) {
  // Require staff session
  if (!await isStaffAuthorized(request)) {
    return unauthorized()
  }

  const supabase = getSupabaseServer()

  try {
    // Calculate Bangkok today (00:00 - 23:59)
    const now = new Date()
    const bangkokOffset = 7 * 60 // UTC+7
    const bangkokNow = new Date(now.getTime() + bangkokOffset * 60 * 1000)

    const startOfDay = new Date(bangkokNow)
    startOfDay.setUTCHours(0, 0, 0, 0)
    const startISO = new Date(startOfDay.getTime() - bangkokOffset * 60 * 1000).toISOString()

    const endOfDay = new Date(bangkokNow)
    endOfDay.setUTCHours(23, 59, 59, 999)
    const endISO = new Date(endOfDay.getTime() - bangkokOffset * 60 * 1000).toISOString()

    // Fetch picked_up orders for today
    const { data: ordersData, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'picked_up')
      .gte('created_at', startISO)
      .lte('created_at', endISO)
      .order('created_at', { ascending: false })
      .limit(50)

    if (ordersError) {
      console.error('[API:STAFF:HISTORY] Failed to fetch orders:', ordersError)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    const orders = ordersData || []

    // Fetch items for each order
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const { data: items } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', order.id)
        return { ...order, items: items || [] }
      })
    )

    return NextResponse.json({ orders: ordersWithItems })
  } catch (error) {
    console.error('[API:STAFF:HISTORY] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
