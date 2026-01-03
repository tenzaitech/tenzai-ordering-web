import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  // Verify staff session
  const staffCookie = request.cookies.get('tenzai_staff')

  if (!staffCookie || staffCookie.value !== 'STAFF_VERIFIED') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Fetch orders with status 'approved' or 'ready'
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('*')
      .in('status', ['approved', 'ready'])
      .order('created_at', { ascending: true })

    if (ordersError) {
      console.error('[STAFF:ORDERS] Query error:', ordersError)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    // Fetch items for each order
    const ordersWithItems = await Promise.all(
      (orders || []).map(async (order) => {
        const { data: items, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', order.id)

        if (itemsError) {
          console.error('[STAFF:ORDERS] Items query error:', itemsError)
          return { ...order, items: [] }
        }

        return { ...order, items: items || [] }
      })
    )

    return NextResponse.json({ orders: ordersWithItems })
  } catch (error) {
    console.error('[STAFF:ORDERS] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
