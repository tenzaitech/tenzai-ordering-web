/**
 * Popular Menus API
 *
 * Stores the list of popular menu items in system_settings.
 * No DB schema changes - uses existing system_settings table.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAdminAuth } from '@/lib/admin-gate'
import { validateCsrf, csrfError } from '@/lib/csrf'

export const runtime = 'nodejs'

const SETTINGS_KEY = 'popular_menus'

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(url, key)
}

/**
 * GET /api/admin/menu/popular
 *
 * Returns the current list of popular menu_codes.
 * If not set, returns empty array.
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
      console.error('[POPULAR_MENUS] GET error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const menu_codes: string[] = data?.value?.menu_codes || []

    return NextResponse.json({ menu_codes })
  } catch (error) {
    console.error('[POPULAR_MENUS] Unexpected error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/menu/popular
 *
 * Saves the list of popular menu_codes.
 *
 * Input JSON:
 * - menu_codes: string[] (array of menu_codes marked as popular)
 */
export async function POST(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  if (!validateCsrf(request)) {
    return csrfError()
  }

  try {
    const body = await request.json()
    const menu_codes = body.menu_codes

    if (!Array.isArray(menu_codes)) {
      return NextResponse.json(
        { error: 'menu_codes must be an array' },
        { status: 400 }
      )
    }

    if (!menu_codes.every(item => typeof item === 'string')) {
      return NextResponse.json(
        { error: 'menu_codes must contain only strings' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    const { error } = await supabase
      .from('system_settings')
      .upsert(
        { key: SETTINGS_KEY, value: { menu_codes } },
        { onConflict: 'key' }
      )

    if (error) {
      console.error('[POPULAR_MENUS] POST error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, menu_codes })
  } catch (error) {
    console.error('[POPULAR_MENUS] Unexpected error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
