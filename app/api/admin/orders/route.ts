import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { checkAdminAuth } from '@/lib/admin-gate'

export const runtime = 'nodejs'

/**
 * GET /api/admin/orders
 * Fetches orders list for admin dashboard (server-side, uses service role)
 */
export async function GET(request: NextRequest) {
  // Auth check
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  const supabase = getSupabaseServer()

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const date = searchParams.get('date')
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = 50

    let query = supabase
      .from('orders')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .not('slip_url', 'is', null)

    // Status filter
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    // Date filter (Today in Bangkok timezone)
    if (date === 'today') {
      const now = new Date()
      const bangkokOffset = 7 * 60
      const bangkokNow = new Date(now.getTime() + bangkokOffset * 60 * 1000)
      const startOfDay = new Date(bangkokNow)
      startOfDay.setUTCHours(0, 0, 0, 0)
      const startISO = new Date(startOfDay.getTime() - bangkokOffset * 60 * 1000).toISOString()
      const endOfDay = new Date(bangkokNow)
      endOfDay.setUTCHours(23, 59, 59, 999)
      const endISO = new Date(endOfDay.getTime() - bangkokOffset * 60 * 1000).toISOString()
      query = query.gte('created_at', startISO).lte('created_at', endISO)
    }

    // Pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error('[API:ADMIN:ORDERS] Failed to fetch orders:', error)
      return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
    }

    return NextResponse.json({ orders: data || [], count: count || 0 })
  } catch (error) {
    console.error('[API:ADMIN:ORDERS] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
