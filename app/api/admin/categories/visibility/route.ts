/**
 * Category Visibility API
 *
 * Stores hidden categories in system_settings.
 * No DB schema changes - uses existing system_settings table.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAdminAuth } from '@/lib/admin-gate'

export const runtime = 'nodejs'

const SETTINGS_KEY = 'hidden_categories'

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(url, key)
}

/**
 * GET /api/admin/categories/visibility
 *
 * Returns the list of hidden category_codes.
 * If not set, returns empty array (all visible).
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
      console.error('[HIDDEN_CATEGORIES] GET error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const hidden: string[] = data?.value?.hidden || []

    return NextResponse.json({ hidden })
  } catch (error) {
    console.error('[HIDDEN_CATEGORIES] Unexpected error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/categories/visibility
 *
 * Saves the list of hidden category_codes.
 *
 * Input JSON:
 * - hidden: string[] (array of category_codes that are hidden)
 */
export async function POST(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const hidden = body.hidden

    if (!Array.isArray(hidden)) {
      return NextResponse.json(
        { error: 'hidden must be an array of category_codes' },
        { status: 400 }
      )
    }

    if (!hidden.every(item => typeof item === 'string')) {
      return NextResponse.json(
        { error: 'hidden must contain only string category_codes' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseClient()

    const { error } = await supabase
      .from('system_settings')
      .upsert(
        { key: SETTINGS_KEY, value: { hidden } },
        { onConflict: 'key' }
      )

    if (error) {
      console.error('[HIDDEN_CATEGORIES] POST error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, hidden })
  } catch (error) {
    console.error('[HIDDEN_CATEGORIES] Unexpected error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}
