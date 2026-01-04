import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params

    // Server-side userId retrieval from LIFF session cookie
    const cookieStore = await cookies()
    const userIdCookie = cookieStore.get('tenzai_liff_user')

    if (!userIdCookie || !userIdCookie.value) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const userId = userIdCookie.value

    // Secure query: explicit SELECT (slip_url excluded) + ownership check
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, status, created_at, pickup_type, pickup_time, total_amount, customer_note, slip_notified_at')
      .eq('id', orderId)
      .eq('customer_line_user_id', userId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Fetch order items with explicit columns (no slip-related data)
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('id, menu_item_id, name_th, name_en, qty, base_price, final_price, note, selected_options_json')
      .eq('order_id', orderId)
      .order('id', { ascending: true })

    if (itemsError) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ order, items: items || [] })
  } catch (error) {
    console.error('[API:ORDER_STATUS] Error:', error)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
