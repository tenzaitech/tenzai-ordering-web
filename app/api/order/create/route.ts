import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabaseServer } from '@/lib/supabase-server'
import { checkLiffGate } from '@/lib/liffGate'
import type { Database } from '@/types/supabase'

export const runtime = 'nodejs'

type CartItem = {
  menuId: string
  name_th: string
  name_en: string
  quantity: number
  base_price_thb: number
  final_price_thb: number
  note?: string | null
  options?: any
}

type CreateOrderRequest = {
  order_number: string
  customer_name: string
  customer_phone: string
  pickup_type: 'ASAP' | 'SCHEDULED'
  pickup_time: string | null
  subtotal_amount_dec: number
  vat_rate: number
  vat_amount_dec: number
  total_amount_dec: number
  invoice_requested: boolean
  invoice_company_name?: string | null
  invoice_tax_id?: string | null
  invoice_address?: string | null
  invoice_buyer_phone?: string | null
  customer_note?: string | null
  items: CartItem[]
}

/**
 * POST /api/order/create
 * Creates a new order with items (server-side, uses service role)
 */
export async function POST(request: NextRequest) {
  // Check LIFF gate (friendship + freshness)
  const gateError = await checkLiffGate()
  if (gateError) return gateError

  try {
    // Get userId from LIFF session cookie
    const cookieStore = await cookies()
    const userIdCookie = cookieStore.get('tenzai_liff_user')

    if (!userIdCookie || !userIdCookie.value) {
      return NextResponse.json(
        { error: 'Unauthorized', error_th: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      )
    }

    const userId = userIdCookie.value

    // Parse request body
    const body: CreateOrderRequest = await request.json()
    const {
      order_number,
      customer_name,
      customer_phone,
      pickup_type,
      pickup_time,
      subtotal_amount_dec,
      vat_rate,
      vat_amount_dec,
      total_amount_dec,
      invoice_requested,
      invoice_company_name,
      invoice_tax_id,
      invoice_address,
      invoice_buyer_phone,
      customer_note,
      items,
    } = body

    // Validation
    if (!order_number || typeof order_number !== 'string') {
      return NextResponse.json(
        { error: 'Invalid order_number', error_th: 'หมายเลขออเดอร์ไม่ถูกต้อง' },
        { status: 400 }
      )
    }
    // customer_phone is required, customer_name is optional (will fallback to profile)
    if (!customer_phone?.trim()) {
      return NextResponse.json(
        { error: 'Missing customer phone', error_th: 'กรุณากรอกเบอร์โทรศัพท์' },
        { status: 400 }
      )
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Items required', error_th: 'กรุณาเพิ่มรายการสินค้า' },
        { status: 400 }
      )
    }

    // Validate each item
    for (const item of items) {
      if (!item.menuId || typeof item.menuId !== 'string') {
        return NextResponse.json(
          { error: 'Invalid menuId', error_th: 'รหัสสินค้าไม่ถูกต้อง' },
          { status: 400 }
        )
      }
      if (!item.quantity || typeof item.quantity !== 'number' || item.quantity < 1) {
        return NextResponse.json(
          { error: 'Invalid quantity', error_th: 'จำนวนสินค้าไม่ถูกต้อง' },
          { status: 400 }
        )
      }
    }

    const supabase = getSupabaseServer()

    // === STEP 1: UPSERT customer profile ===
    // Upsert customer record (creates if not exists, updates only provided fields)
    const customerUpsertData: Database['public']['Tables']['customers']['Insert'] = {
      line_user_id: userId,
      updated_at: new Date().toISOString(),
    }

    // Only update fields that are provided (non-empty)
    // DO NOT overwrite existing data with null/empty values
    if (customer_name?.trim()) {
      customerUpsertData.display_name = customer_name.trim()
    }
    if (customer_phone?.trim()) {
      customerUpsertData.phone = customer_phone.trim()
    }
    // email not in current request body, skip for now

    const { data: customerData, error: customerError } = await supabase
      .from('customers')
      .upsert(customerUpsertData, {
        onConflict: 'line_user_id',
        ignoreDuplicates: false, // Always update
      })
      .select('id, display_name')
      .single()

    if (customerError || !customerData) {
      console.error('[API:ORDER_CREATE] Customer upsert error:', customerError)
      return NextResponse.json(
        { error: 'Failed to save customer', error_th: 'ไม่สามารถบันทึกข้อมูลลูกค้าได้' },
        { status: 500 }
      )
    }

    const customerId = customerData.id
    const customerDisplayName = customerData.display_name

    // Server-side price verification
    const menuIds = Array.from(new Set(items.map(i => i.menuId)))
    const { data: menuPricesData } = await supabase
      .from('menu_items')
      .select('menu_code, price')
      .in('menu_code', menuIds)

    const priceMap = new Map<string, number>()
    for (const mp of (menuPricesData ?? [])) {
      priceMap.set(mp.menu_code, mp.price)
    }

    // Recalculate totals using server-known prices
    const VAT_RATE = 7
    let serverSubtotal = 0
    const validatedItems: any[] = []

    for (const item of items) {
      const serverBasePrice = priceMap.get(item.menuId)
      let finalPrice = item.final_price_thb

      if (serverBasePrice !== undefined) {
        // Calculate options delta
        let optionsDelta = 0
        if (item.options && Array.isArray(item.options)) {
          for (const opt of item.options) {
            if (typeof opt.price_delta_thb === 'number') {
              optionsDelta += opt.price_delta_thb
            }
          }
        }
        finalPrice = serverBasePrice + optionsDelta
      }

      validatedItems.push({
        menu_item_id: item.menuId,
        menu_code: item.menuId,
        name_th: item.name_th,
        name_en: item.name_en,
        qty: item.quantity,
        base_price: serverBasePrice ?? item.base_price_thb,
        final_price: finalPrice,
        note: item.note || null,
        selected_options_json: item.options || null,
      })

      serverSubtotal += finalPrice * item.quantity
    }

    const serverVat = serverSubtotal * VAT_RATE / 100
    const serverTotal = serverSubtotal + serverVat

    // === STEP 2: Determine snapshot customer_name ===
    // Business rule: Use provided name, else fallback to profile display_name, else "ลูกค้า"
    let snapshotCustomerName = customer_name?.trim()
    if (!snapshotCustomerName) {
      // Fallback: use customers.display_name if available
      snapshotCustomerName = customerDisplayName?.trim() || 'ลูกค้า'
    }

    // Create order (using service role - bypasses RLS)
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number,
        customer_id: customerId, // FK to customers table
        customer_name: snapshotCustomerName, // Snapshot for historical record
        customer_phone: customer_phone.trim(),
        customer_line_user_id: userId,
        pickup_type,
        pickup_time,
        subtotal_amount_dec: serverSubtotal,
        vat_rate: VAT_RATE,
        vat_amount_dec: serverVat,
        total_amount_dec: serverTotal,
        invoice_requested,
        invoice_company_name: invoice_requested ? invoice_company_name?.trim() : null,
        invoice_tax_id: invoice_requested ? invoice_tax_id?.trim() : null,
        invoice_address: invoice_requested ? invoice_address?.trim() : null,
        invoice_buyer_phone: invoice_requested && invoice_buyer_phone?.trim() ? invoice_buyer_phone.trim() : null,
        customer_note: customer_note?.trim() || null,
        slip_url: null,
        status: 'pending',
      })
      .select('id, order_number')
      .single()

    if (orderError || !orderData) {
      console.error('[API:ORDER_CREATE] Order insert error:', orderError)
      return NextResponse.json(
        { error: 'Failed to create order', error_th: 'ไม่สามารถสร้างออเดอร์ได้' },
        { status: 500 }
      )
    }

    // Insert order items
    const orderItems = validatedItems.map(item => ({
      order_id: orderData.id,
      ...item,
    }))

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)

    if (itemsError) {
      console.error('[API:ORDER_CREATE] Items insert error:', itemsError)
      // Note: Order was created but items failed - should ideally be transactional
      // For now, return error but order exists
      return NextResponse.json(
        {
          error: 'Failed to save items',
          error_th: 'ไม่สามารถบันทึกรายการได้',
          order_id: orderData.id,
          order_number: orderData.order_number
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      order_id: orderData.id,
      order_number: orderData.order_number,
      total_amount_dec: serverTotal,
    })
  } catch (error) {
    console.error('[API:ORDER_CREATE] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Server error', error_th: 'เกิดข้อผิดพลาด กรุณาลองใหม่' },
      { status: 500 }
    )
  }
}
