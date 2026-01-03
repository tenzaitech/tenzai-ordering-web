import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/admin-gate'

export async function POST(request: NextRequest) {
  const authError = checkAdminAuth(request)
  if (authError) return authError

  try {
    const { target } = await request.json()

    if (target !== 'approver' && target !== 'staff') {
      return NextResponse.json({ error: 'Invalid target' }, { status: 400 })
    }

    // Fetch LINE IDs from DB settings
    const { data: settings, error: settingsError } = await supabase
      .from('admin_settings')
      .select('line_approver_id, line_staff_id')
      .limit(1)
      .single()

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error('[ADMIN:TEST] Settings fetch error:', settingsError.message)
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }

    // Determine recipient (DB first, env fallback)
    let recipientId: string
    if (target === 'approver') {
      recipientId = settings?.line_approver_id || process.env.LINE_APPROVER_ID || ''
    } else {
      recipientId = settings?.line_staff_id || process.env.LINE_STAFF_ID || ''
    }

    if (!recipientId) {
      return NextResponse.json({
        error: `${target === 'approver' ? 'Approver' : 'Staff'} ID not configured`
      }, { status: 400 })
    }

    // Prepare test message
    const message = target === 'approver'
      ? 'TEST: TENZAI settings check (approver).'
      : 'TEST: TENZAI settings check (staff).'

    // Send via LINE API
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      return NextResponse.json({ error: 'LINE channel token not configured' }, { status: 500 })
    }

    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: recipientId,
        messages: [{ type: 'text', text: message }]
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[ADMIN:TEST] LINE API error:', errorText)
      return NextResponse.json({ error: 'Failed to send test message' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ADMIN:TEST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
