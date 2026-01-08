import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { supabase } from '@/lib/supabase'

type OrderRow = {
  id: string
  status: string
  slip_notified_at: string | null
  total_amount_dec: number
}

type MenuItemRow = {
  price: number
}

type OrderItemRow = {
  final_price: number
  qty: number
}

type NewItemRow = {
  id: string
}

// Add a new item to an existing order (DB-only, no cart)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params

    // Server-side userId retrieval from LIFF session cookie
    const cookieStore = await cookies()
    const userIdCookie = cookieStore.get('tenzai_liff_user')

    if (!userIdCookie || !userIdCookie.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = userIdCookie.value

    // Fetch order with ownership check
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('id, status, slip_notified_at, total_amount_dec')
      .eq('id', orderId)
      .eq('customer_line_user_id', userId)
      .single()

    const order = orderData as OrderRow | null

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Check if editable (no slip uploaded, not approved/rejected)
    const isEditable = !order.slip_notified_at && order.status !== 'approved' && order.status !== 'rejected'
    if (!isEditable) {
      return NextResponse.json({ error: 'Order is locked' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { menu_item_id, name_th, name_en, qty, base_price, final_price, note, selected_options_json } = body

    // Validation
    if (!menu_item_id || typeof menu_item_id !== 'string') {
      return NextResponse.json({ error: 'Invalid menu_item_id' }, { status: 400 })
    }
    if (!qty || typeof qty !== 'number' || qty < 1) {
      return NextResponse.json({ error: 'Invalid qty' }, { status: 400 })
    }
    if (typeof base_price !== 'number' || isNaN(base_price)) {
      return NextResponse.json({ error: 'Invalid base_price' }, { status: 400 })
    }
    if (typeof final_price !== 'number' || isNaN(final_price)) {
      return NextResponse.json({ error: 'Invalid final_price' }, { status: 400 })
    }

    // Server-side price verification
    const { data: menuData } = await supabase
      .from('menu_items')
      .select('price')
      .eq('menu_code', menu_item_id)
      .single()

    const menuItem = menuData as MenuItemRow | null

    let verifiedFinalPrice = final_price
    if (menuItem) {
      // Recalculate based on server price + options delta
      let optionsDelta = 0
      if (selected_options_json && Array.isArray(selected_options_json)) {
        for (const opt of selected_options_json) {
          if (typeof opt.price_delta_thb === 'number') {
            optionsDelta += opt.price_delta_thb
          }
        }
      }
      verifiedFinalPrice = menuItem.price + optionsDelta

      if (Math.abs(verifiedFinalPrice - final_price) > 1) {
        console.warn(`[API:ADD_ITEM] Price mismatch for ${menu_item_id}: client=${final_price}, server=${verifiedFinalPrice}`)
      }
    }

    // Insert new order item
    const { data: newItemData, error: insertError } = await supabase
      .from('order_items')
      .insert({
        order_id: orderId,
        menu_item_id,
        name_th,
        name_en,
        qty,
        base_price: menuItem?.price ?? base_price,
        final_price: verifiedFinalPrice,
        note: note || null,
        selected_options_json: selected_options_json || null,
      } as never)
      .select('id')
      .single()

    const newItem = newItemData as NewItemRow | null

    if (insertError) {
      console.error('[API:ADD_ITEM] Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to add item' }, { status: 500 })
    }

    // Recalculate totals from DB (race-safe)
    const VAT_RATE = 7 // 7%
    const { data: allItemsData, error: itemsError } = await supabase
      .from('order_items')
      .select('final_price, qty')
      .eq('order_id', orderId)

    if (itemsError || !allItemsData) {
      console.error('[API:ADD_ITEM] Failed to fetch items for total recalculation:', itemsError)
      return NextResponse.json({ error: 'Failed to recalculate total' }, { status: 500 })
    }

    const allItems = allItemsData as OrderItemRow[]
    const subtotalAmount = allItems.reduce((sum, item) => sum + (item.final_price * item.qty), 0)
    const vatAmount = subtotalAmount * VAT_RATE / 100
    const totalAmount = subtotalAmount + vatAmount

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        subtotal_amount_dec: subtotalAmount,
        vat_amount_dec: vatAmount,
        total_amount_dec: totalAmount,
      } as never)
      .eq('id', orderId)

    if (updateError) {
      console.error('[API:ADD_ITEM] Update total error:', updateError)
      return NextResponse.json({ error: 'Failed to update total' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      item_id: newItem!.id,
      new_total: totalAmount,
    })
  } catch (error) {
    console.error('[API:ADD_ITEM] Error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
