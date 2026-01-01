import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
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

    console.log('[API:TOGGLE] Success:', enabled ? 'OPEN' : 'CLOSED')
    return NextResponse.json({ enabled, message })
  } catch (error) {
    console.error('[API:TOGGLE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET() {
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
