import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabaseServer } from '@/lib/supabase-server'

export const runtime = 'nodejs'

type OrderRow = {
  id: string
  order_number: string
  status: string
  created_at: string
  pickup_type: string
  pickup_time: string | null
  total_amount_dec: number
  customer_note: string | null
  slip_notified_at: string | null
}

type MenuPriceRow = {
  menu_code: string
  price: number
}

type OrderItemIdRow = {
  id: string
}

// Safe order fields (slip_url excluded)
const ORDER_SAFE_FIELDS = 'id, order_number, status, created_at, pickup_type, pickup_time, total_amount_dec, customer_note, slip_notified_at'
const ITEM_SAFE_FIELDS = 'id, menu_item_id, name_th, name_en, qty, base_price, final_price, note, selected_options_json'

// GET: Fetch order for editing with ownership check
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
    const supabase = getSupabaseServer()

    // Fetch order with ownership check
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(ORDER_SAFE_FIELDS)
      .eq('id', orderId)
      .eq('customer_line_user_id', userId)
      .single()

    const order = orderData as OrderRow | null

    if (orderError || !order) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Check if editable
    const isEditable = !order.slip_notified_at && order.status !== 'approved' && order.status !== 'rejected'
    if (!isEditable) {
      return NextResponse.json({ error: 'Order is locked' }, { status: 403 })
    }

    // Fetch order items
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select(ITEM_SAFE_FIELDS)
      .eq('order_id', orderId)
      .order('id', { ascending: true })

    if (itemsError) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ order, items: items || [], editable: true })
  } catch (error) {
    console.error('[API:ORDER_EDIT:GET] Error:', error)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

// Item update payload type
type ItemUpdate = {
  id?: string // existing item id (if updating)
  menu_item_id: string
  name_th: string
  name_en: string
  qty: number
  base_price: number
  final_price: number
  note?: string | null
  selected_options_json?: any
}

// POST: Update order items with validation and safe sequence
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
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const userId = userIdCookie.value
    const supabase = getSupabaseServer()

    // Fetch order with ownership check
    const { data: postOrderData, error: orderError } = await supabase
      .from('orders')
      .select(ORDER_SAFE_FIELDS)
      .eq('id', orderId)
      .eq('customer_line_user_id', userId)
      .single()

    const order = postOrderData as OrderRow | null

    if (orderError || !order) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    // Check if editable
    const isEditable = !order.slip_notified_at && order.status !== 'approved' && order.status !== 'rejected'
    if (!isEditable) {
      return NextResponse.json({ error: 'Order is locked' }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { items, pickup_type, pickup_time, customer_note } = body as {
      items: ItemUpdate[]
      pickup_type?: string
      pickup_time?: string | null
      customer_note?: string | null
    }

    // === VALIDATION ===
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items required' }, { status: 400 })
    }

    // Validate each item
    for (const item of items) {
      if (!item.menu_item_id || typeof item.menu_item_id !== 'string' || item.menu_item_id.trim() === '') {
        return NextResponse.json({ error: 'Invalid menu_item_id' }, { status: 400 })
      }
      if (!item.qty || typeof item.qty !== 'number' || item.qty < 1) {
        return NextResponse.json({ error: 'Invalid qty' }, { status: 400 })
      }
      if (typeof item.base_price !== 'number' || isNaN(item.base_price)) {
        return NextResponse.json({ error: 'Invalid base_price' }, { status: 400 })
      }
      if (typeof item.final_price !== 'number' || isNaN(item.final_price)) {
        return NextResponse.json({ error: 'Invalid final_price' }, { status: 400 })
      }
    }

    // === SERVER-SIDE PRICE VERIFICATION (best effort) ===
    // Fetch menu prices for verification
    const menuIds = Array.from(new Set(items.map(i => i.menu_item_id)))
    const { data: menuPricesData } = await supabase
      .from('menu_items')
      .select('menu_code, price')
      .in('menu_code', menuIds)

    const menuPrices = (menuPricesData ?? []) as MenuPriceRow[]
    const priceMap = new Map<string, number>()
    for (const mp of menuPrices) {
      priceMap.set(mp.menu_code, mp.price)
    }

    // Recalculate totals using server-known base prices where available
    const VAT_RATE = 7 // 7%
    let subtotalAmount = 0
    const validatedItems: ItemUpdate[] = []

    for (const item of items) {
      const serverBasePrice = priceMap.get(item.menu_item_id)
      let finalPrice = item.final_price

      // If server knows the base price, validate/adjust
      if (serverBasePrice !== undefined) {
        // Calculate options delta from selected_options_json if present
        let optionsDelta = 0
        if (item.selected_options_json && Array.isArray(item.selected_options_json)) {
          for (const opt of item.selected_options_json) {
            if (typeof opt.price_delta_thb === 'number') {
              optionsDelta += opt.price_delta_thb
            }
          }
        }
        finalPrice = serverBasePrice + optionsDelta

        // Log if client price differs significantly
        if (Math.abs(finalPrice - item.final_price) > 1) {
          console.warn(`[API:ORDER_EDIT] Price mismatch for ${item.menu_item_id}: client=${item.final_price}, server=${finalPrice}`)
        }
      }

      validatedItems.push({
        ...item,
        base_price: serverBasePrice ?? item.base_price,
        final_price: finalPrice,
      })

      subtotalAmount += finalPrice * item.qty
    }

    // Calculate VAT and total (no rounding)
    const vatAmount = subtotalAmount * VAT_RATE / 100
    const totalAmount = subtotalAmount + vatAmount

    // === SAFE UPDATE SEQUENCE ===
    // Step 1: Get existing item IDs
    const { data: existingItemsData } = await supabase
      .from('order_items')
      .select('id')
      .eq('order_id', orderId)

    const existingItems = (existingItemsData ?? []) as OrderItemIdRow[]
    const existingIds = new Set(existingItems.map(i => i.id))
    const newItemIds = new Set(validatedItems.filter(i => i.id).map(i => i.id))

    // Step 2: Insert/Update items one by one (safer than delete-all)
    const insertItems = validatedItems.filter(i => !i.id || !existingIds.has(i.id))
    const updateItems = validatedItems.filter(i => i.id && existingIds.has(i.id))
    const deleteIds = Array.from(existingIds).filter(id => !newItemIds.has(id))

    // Insert new items
    if (insertItems.length > 0) {
      const toInsert = insertItems.map(item => ({
        order_id: orderId,
        menu_item_id: item.menu_item_id,
        name_th: item.name_th,
        name_en: item.name_en,
        qty: item.qty,
        base_price: item.base_price,
        final_price: item.final_price,
        note: item.note || null,
        selected_options_json: item.selected_options_json || null,
      }))

      const { error: insertError } = await supabase
        .from('order_items')
        .insert(toInsert as never)

      if (insertError) {
        console.error('[API:ORDER_EDIT] Insert error:', insertError)
        return NextResponse.json({ error: 'Failed to save items' }, { status: 500 })
      }
    }

    // Update existing items
    for (const item of updateItems) {
      const { error: updateError } = await supabase
        .from('order_items')
        .update({
          qty: item.qty,
          note: item.note || null,
          selected_options_json: item.selected_options_json || null,
          // Don't update menu_item_id/names/prices for existing items to preserve data integrity
        } as never)
        .eq('id', item.id!)
        .eq('order_id', orderId)

      if (updateError) {
        console.error('[API:ORDER_EDIT] Update error:', updateError)
        return NextResponse.json({ error: 'Failed to update items' }, { status: 500 })
      }
    }

    // Delete removed items (only after inserts/updates succeed)
    if (deleteIds.length > 0) {
      const { error: deleteError } = await supabase
        .from('order_items')
        .delete()
        .in('id', deleteIds)
        .eq('order_id', orderId)

      if (deleteError) {
        console.error('[API:ORDER_EDIT] Delete error:', deleteError)
        // Non-fatal: items are just orphaned but order is still valid
      }
    }

    // Step 3: Update order fields (all three *_dec fields)
    const orderUpdate: any = {
      subtotal_amount_dec: subtotalAmount,
      vat_amount_dec: vatAmount,
      total_amount_dec: totalAmount,
    }
    if (pickup_type !== undefined) {
      orderUpdate.pickup_type = pickup_type
    }
    if (pickup_time !== undefined) {
      orderUpdate.pickup_time = pickup_time
    }
    if (customer_note !== undefined) {
      orderUpdate.customer_note = customer_note?.trim() || null
    }

    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update(orderUpdate as never)
      .eq('id', orderId)
      .eq('customer_line_user_id', userId)

    if (orderUpdateError) {
      console.error('[API:ORDER_EDIT] Order update error:', orderUpdateError)
      return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
    }

    // Step 4: Fetch and return updated data
    const { data: updatedOrder } = await supabase
      .from('orders')
      .select(ORDER_SAFE_FIELDS)
      .eq('id', orderId)
      .single()

    const { data: updatedItems } = await supabase
      .from('order_items')
      .select(ITEM_SAFE_FIELDS)
      .eq('order_id', orderId)
      .order('id', { ascending: true })

    return NextResponse.json({
      success: true,
      order: updatedOrder,
      items: updatedItems || [],
    })
  } catch (error) {
    console.error('[API:ORDER_EDIT:POST] Error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
