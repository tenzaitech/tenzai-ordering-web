/**
 * Category Order API
 *
 * Stores the display order of categories in system_settings.
 * No DB schema changes - uses existing system_settings table.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAdminAuth } from '@/lib/admin-gate'
import { validateCsrf, csrfError } from '@/lib/csrf'

export const runtime = 'nodejs'

const SETTINGS_KEY = 'category_order'

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(url, key)
}

/**
 * GET /api/admin/categories/order
 *
 * Returns the current category order as an array of category_codes.
 * If no order is set, returns empty array (use default ordering).
 */
export async function GET(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  try {
    const supabase = getSupabaseClient()

    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', SETTINGS_KEY)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found (ok, return empty)
      console.error('[CATEGORY_ORDER] GET error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Parse the stored order (array of category_codes)
    const order: string[] = data?.value?.order || []

    return NextResponse.json({ order })
  } catch (error) {
    console.error('[CATEGORY_ORDER] Unexpected error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/categories/order
 *
 * Saves the category display order.
 *
 * Input JSON:
 * - order: string[] (array of category_codes in desired order)
 */
export async function POST(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  if (!validateCsrf(request)) {
    return csrfError()
  }

  try {
    const body = await request.json()
    const order = body.order

    if (!Array.isArray(order)) {
      return NextResponse.json(
        { error: 'order must be an array of category_codes' },
        { status: 400 }
      )
    }

    // Validate all entries are strings
    if (!order.every(item => typeof item === 'string')) {
      return NextResponse.json(
        { error: 'order must contain only string category_codes' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    // Upsert the order setting
    const { error } = await supabase
      .from('system_settings')
      .upsert(
        { key: SETTINGS_KEY, value: { order } },
        { onConflict: 'key' }
      )

    if (error) {
      console.error('[CATEGORY_ORDER] POST error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, order })
  } catch (error) {
    console.error('[CATEGORY_ORDER] Unexpected error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
