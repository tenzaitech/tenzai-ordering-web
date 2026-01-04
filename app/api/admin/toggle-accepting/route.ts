import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/admin-gate'

export async function POST(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  try {
    const body = await request.json()
    const { enabled, message } = body

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid enabled value' }, { status: 400 })
    }

    // Upsert the setting
    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'order_accepting',
        value: {
          enabled,
          message: message || ''
        },
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      })

    if (error) {
      console.error('[API:TOGGLE] Failed to update setting:', error)
      return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 })
    }

    return NextResponse.json({ enabled, message })
  } catch (error) {
    console.error('[API:TOGGLE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  try {
    const { data, error } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'order_accepting')
      .single()

    if (error) {
      // Return default if setting doesn't exist
      if (error.code === 'PGRST116') {
        return NextResponse.json({ enabled: true, message: '' })
      }
      console.error('[API:TOGGLE] Failed to fetch setting:', error)
      return NextResponse.json({ error: 'Failed to fetch setting' }, { status: 500 })
    }

    const { enabled, message } = data.value as { enabled: boolean; message?: string }
    return NextResponse.json({ enabled, message: message || '' })
  } catch (error) {
    console.error('[API:TOGGLE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
