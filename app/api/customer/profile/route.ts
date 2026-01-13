import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabaseServer } from '@/lib/supabase-server'
import { checkLiffGate } from '@/lib/liffGate'

export const runtime = 'nodejs'

/**
 * GET /api/customer/profile
 * Returns customer profile (display_name, phone, email) for current LIFF user
 * Server-side only, uses service role to query customers table
 */
export async function GET(request: NextRequest) {
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

    const supabase = getSupabaseServer()

    // Query customers by line_user_id (uses service role - bypasses RLS)
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('display_name, phone, email')
      .eq('line_user_id', userId)
      .maybeSingle()

    if (customerError) {
      console.error('[API:CUSTOMER_PROFILE] Query error:', customerError)
      return NextResponse.json(
        { error: 'Failed to fetch profile', error_th: 'ไม่สามารถดึงข้อมูลได้' },
        { status: 500 }
      )
    }

    // Customer not found - this is expected for first-time users
    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found', error_th: 'ไม่พบข้อมูลลูกค้า' },
        { status: 404 }
      )
    }

    // Return profile data
    return NextResponse.json({
      display_name: customer.display_name,
      phone: customer.phone,
      email: customer.email,
    })
  } catch (error) {
    console.error('[API:CUSTOMER_PROFILE] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Server error', error_th: 'เกิดข้อผิดพลาด กรุณาลองใหม่' },
      { status: 500 }
    )
  }
}
