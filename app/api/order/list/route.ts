import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabaseServer } from '@/lib/supabase-server'

export const runtime = 'nodejs'

/**
 * GET /api/order/list
 * Lists orders for the authenticated customer (server-side, uses service role)
 */
export async function GET(request: NextRequest) {
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

    const supabase = getSupabaseServer()

    // Fetch orders for this user (explicit select, slip_url excluded for privacy)
    const { data: orders, error: queryError } = await supabase
      .from('orders')
      .select('id, order_number, status, pickup_type, pickup_time, total_amount_dec, customer_note, created_at, slip_notified_at')
      .eq('customer_line_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (queryError) {
      console.error('[API:ORDER_LIST] Query error:', queryError)
      return NextResponse.json(
        { error: 'Failed to fetch orders', error_th: 'ไม่สามารถโหลดรายการออเดอร์ได้' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      orders: orders || [],
    })
  } catch (error) {
    console.error('[API:ORDER_LIST] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Server error', error_th: 'เกิดข้อผิดพลาด กรุณาลองใหม่' },
      { status: 500 }
    )
  }
}
