import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/admin-gate'

type SystemSettingUpsert = {
  key: string
  value: { enabled: boolean; message: string }
  updated_at: string
}

type SystemSettingRow = {
  value: { enabled: boolean; message?: string }
}

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
    const upsertPayload: SystemSettingUpsert = {
      key: 'order_accepting',
      value: {
        enabled,
        message: message || ''
      },
      updated_at: new Date().toISOString()
    }
    const { error } = await supabase
      .from('system_settings')
      .upsert(upsertPayload as never, {
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
    const { data: rawData, error } = await supabase
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

    const data = rawData as SystemSettingRow | null
    const { enabled, message } = data?.value || { enabled: true, message: '' }
    return NextResponse.json({ enabled, message: message || '' })
  } catch (error) {
    console.error('[API:TOGGLE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
