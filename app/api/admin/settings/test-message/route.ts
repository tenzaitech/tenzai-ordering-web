import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { checkAdminAuth } from '@/lib/admin-gate'
import { validateCsrf, csrfError } from '@/lib/csrf'

type SettingsRow = {
  line_approver_id: string | null
  line_staff_id: string | null
}

/**
 * POST: Send test message to LINE recipient
 *
 * READS FROM: admin_settings table (canonical source)
 * FALLBACK (bootstrap only): Environment variables
 * SECURITY: Requires admin auth + CSRF token
 */
export async function POST(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  if (!validateCsrf(request)) {
    return csrfError()
  }

  const supabase = getSupabaseServer()

  try {
    const { target } = await request.json()

    if (target !== 'approver' && target !== 'staff') {
      return NextResponse.json({
        error: { code: 'BAD_REQUEST', message_th: 'เป้าหมายไม่ถูกต้อง' }
      }, { status: 400 })
    }

    // Fetch LINE IDs from canonical source (admin_settings)
    const { data: settingsData, error: settingsError } = await supabase
      .from('admin_settings')
      .select('line_approver_id, line_staff_id')
      .limit(1)
      .single()

    if (settingsError && settingsError.code !== 'PGRST116') {
      console.error('[ADMIN:TEST] Settings fetch error:', settingsError.message)
      return NextResponse.json({
        error: { code: 'DB_ERROR', message_th: 'ไม่สามารถโหลดการตั้งค่าได้' }
      }, { status: 500 })
    }

    const settings = settingsData as SettingsRow | null

    // Canonical: DB first, env fallback for bootstrap only
    let recipientId: string
    if (target === 'approver') {
      recipientId = settings?.line_approver_id || process.env.LINE_APPROVER_ID || ''
    } else {
      recipientId = settings?.line_staff_id || process.env.LINE_STAFF_ID || ''
    }

    if (!recipientId) {
      return NextResponse.json({
        error: {
          code: 'BAD_REQUEST',
          message_th: `ยังไม่ได้ตั้งค่า ${target === 'approver' ? 'LINE Approver ID' : 'LINE Staff ID'}`
        }
      }, { status: 400 })
    }

    // Prepare test message
    const message = target === 'approver'
      ? 'TEST: TENZAI settings check (approver).'
      : 'TEST: TENZAI settings check (staff).'

    // Send via LINE API
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      return NextResponse.json({
        error: { code: 'SERVER_ERROR', message_th: 'LINE Channel Token ยังไม่ได้ตั้งค่า' }
      }, { status: 500 })
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
      return NextResponse.json({
        error: { code: 'SERVER_ERROR', message_th: 'ส่งข้อความไม่สำเร็จ' }
      }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ADMIN:TEST] Error:', error)
    return NextResponse.json({
      error: { code: 'SERVER_ERROR', message_th: 'เกิดข้อผิดพลาดในระบบ' }
    }, { status: 500 })
  }
}
