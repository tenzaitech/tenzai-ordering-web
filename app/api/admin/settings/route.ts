import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { checkAdminAuth } from '@/lib/admin-gate'
import { validateCsrf, csrfError } from '@/lib/csrf'
import { auditLog, getRequestMeta } from '@/lib/audit-log'
import { revokeAllStaffSessions } from '@/lib/staffAuth'
import { scryptSync, randomBytes } from 'crypto'

export const runtime = 'nodejs'

// Dev-only diagnostics flag
const isDebugMode = () => process.env.DEBUG_ADMIN_SETTINGS === 'true'

type SettingsRow = {
  id: string
  promptpay_id: string | null
  line_approver_id: string | null
  line_staff_id: string | null
  pin_version: number
  staff_pin_hash?: string
}

type SettingsInsert = {
  promptpay_id: string
  line_approver_id: string
  line_staff_id: string
  staff_pin_hash: string
  pin_version: number
  updated_at: string
}

type ErrorCode = 'DB_ERROR' | 'FORBIDDEN' | 'BAD_REQUEST' | 'SERVER_ERROR'

type ErrorResponse = {
  error: {
    code: ErrorCode
    message_th: string
    debug?: {
      table: string
      operation: string
      supabaseErrorCode: string | null
      supabaseErrorMessage: string | null
      client: 'service'
    }
  }
}

function createErrorResponse(
  code: ErrorCode,
  message_th: string,
  status: number,
  debugInfo?: {
    table: string
    operation: string
    supabaseError?: { code: string; message: string } | null
  }
): NextResponse<ErrorResponse> {
  const body: ErrorResponse = {
    error: {
      code,
      message_th
    }
  }

  // Include debug info only in dev mode
  if (isDebugMode() && debugInfo) {
    body.error.debug = {
      table: debugInfo.table,
      operation: debugInfo.operation,
      supabaseErrorCode: debugInfo.supabaseError?.code || null,
      supabaseErrorMessage: debugInfo.supabaseError?.message?.slice(0, 120) || null,
      client: 'service'
    }
  }

  return NextResponse.json(body, { status })
}

function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex')
  const buf = scryptSync(pin, salt, 64)
  return `${buf.toString('hex')}.${salt}`
}

/**
 * GET: Fetch current admin settings
 *
 * CANONICAL SOURCE: admin_settings table (service-role access)
 * BOOTSTRAP FALLBACK: Environment variables (LINE_APPROVER_ID, LINE_STAFF_ID)
 *
 * When no admin_settings row exists (fresh install), returns env var defaults.
 * Once admin saves settings via POST, DB becomes the canonical source.
 */
export async function GET(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  const supabase = getSupabaseServer()

  try {
    const { data: rawData, error } = await supabase
      .from('admin_settings')
      .select('id, promptpay_id, line_approver_id, line_staff_id, pin_version')
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('[ADMIN:SETTINGS] Fetch error:', error.message)
      return createErrorResponse('DB_ERROR', 'ไม่สามารถโหลดการตั้งค่าได้', 500, {
        table: 'admin_settings',
        operation: 'select',
        supabaseError: error
      })
    }

    const data = rawData as SettingsRow | null

    // Bootstrap: No row exists yet, return env defaults for initial setup UI
    if (!data) {
      return NextResponse.json({
        promptpay_id: '',
        line_approver_id: process.env.LINE_APPROVER_ID || '',
        line_staff_id: process.env.LINE_STAFF_ID || '',
        pin_version: 1
      })
    }

    // Canonical: Return DB values
    return NextResponse.json({
      promptpay_id: data.promptpay_id || '',
      line_approver_id: data.line_approver_id || '',
      line_staff_id: data.line_staff_id || '',
      pin_version: data.pin_version
    })
  } catch (error) {
    console.error('[ADMIN:SETTINGS] Error:', error)
    return createErrorResponse('SERVER_ERROR', 'เกิดข้อผิดพลาดในระบบ', 500)
  }
}

/**
 * POST: Update admin settings (PATCH-style: only update fields present in body)
 *
 * WRITES TO: admin_settings table (canonical source)
 * SECURITY: Requires admin auth + CSRF token
 *
 * This endpoint establishes admin_settings as the canonical source.
 * After first successful POST, env var fallbacks are no longer used.
 */
export async function POST(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  // CSRF check - required for all mutations
  if (!validateCsrf(request)) {
    return csrfError()
  }

  const { ip, userAgent } = getRequestMeta(request)
  const supabase = getSupabaseServer()

  try {
    const body = await request.json()
    const { promptpay_id, line_approver_id, line_staff_id, new_staff_pin } = body

    // Validate only provided fields
    if (new_staff_pin !== undefined && new_staff_pin !== '') {
      if (!/^\d{4}$/.test(new_staff_pin)) {
        return createErrorResponse('BAD_REQUEST', 'PIN ต้องเป็นตัวเลข 4 หลัก', 400)
      }
    }

    // Check if at least one field is provided
    const hasAnyField = promptpay_id !== undefined || line_approver_id !== undefined ||
                        line_staff_id !== undefined || (new_staff_pin && new_staff_pin.length > 0)
    if (!hasAnyField) {
      return createErrorResponse('BAD_REQUEST', 'ไม่มีข้อมูลที่จะอัพเดท', 400)
    }

    // Fetch existing settings
    const { data: existingData, error: fetchError } = await supabase
      .from('admin_settings')
      .select('*')
      .limit(1)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[ADMIN:SETTINGS] Fetch error:', fetchError.message)
      return createErrorResponse('DB_ERROR', 'ไม่สามารถโหลดการตั้งค่าได้', 500, {
        table: 'admin_settings',
        operation: 'select',
        supabaseError: fetchError
      })
    }

    const existing = existingData as SettingsRow | null

    // Prepare update data (only include fields that were provided)
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    if (promptpay_id !== undefined) {
      updateData.promptpay_id = promptpay_id
    }
    if (line_approver_id !== undefined) {
      updateData.line_approver_id = line_approver_id
    }
    if (line_staff_id !== undefined) {
      updateData.line_staff_id = line_staff_id
    }

    // If new PIN provided, hash it and increment version
    const pinChanged = new_staff_pin && new_staff_pin.length > 0
    if (pinChanged) {
      const hashedPin = hashPin(new_staff_pin)
      updateData.staff_pin_hash = hashedPin
      updateData.pin_version = (existing?.pin_version || 1) + 1
      updateData.staff_session_version = (existing?.pin_version || 1) + 1 // Also update session version
    }

    // Upsert (update or insert)
    if (existing) {
      const { error: updateError } = await supabase
        .from('admin_settings')
        .update(updateData as never)
        .eq('id', existing.id)

      if (updateError) {
        console.error('[ADMIN:SETTINGS] Update error:', updateError.message)
        return createErrorResponse('DB_ERROR', 'ไม่สามารถบันทึกการตั้งค่าได้', 500, {
          table: 'admin_settings',
          operation: 'update',
          supabaseError: updateError
        })
      }

      // If PIN changed, revoke all staff sessions and audit log
      if (pinChanged) {
        await revokeAllStaffSessions()
        await auditLog({
          actor_type: 'admin',
          ip,
          user_agent: userAgent,
          action_code: 'STAFF_PIN_CHANGED',
          metadata: { revoked_sessions: true }
        })
      }
    } else {
      // First time setup - need to include staff_pin_hash
      if (!new_staff_pin) {
        return createErrorResponse('BAD_REQUEST', 'ต้องกำหนด PIN สำหรับการตั้งค่าครั้งแรก', 400)
      }
      const hashedPin = hashPin(new_staff_pin)
      const insertPayload: SettingsInsert = {
        promptpay_id: promptpay_id || '',
        line_approver_id: line_approver_id || '',
        line_staff_id: line_staff_id || '',
        staff_pin_hash: hashedPin,
        pin_version: 1,
        updated_at: new Date().toISOString()
      }
      const { error: insertError } = await supabase
        .from('admin_settings')
        .insert(insertPayload as never)

      if (insertError) {
        console.error('[ADMIN:SETTINGS] Insert error:', insertError.message)
        return createErrorResponse('DB_ERROR', 'ไม่สามารถสร้างการตั้งค่าได้', 500, {
          table: 'admin_settings',
          operation: 'insert',
          supabaseError: insertError
        })
      }

      // Audit log for initial PIN setup
      await auditLog({
        actor_type: 'admin',
        ip,
        user_agent: userAgent,
        action_code: 'STAFF_PIN_CHANGED',
        metadata: { initial_setup: true }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ADMIN:SETTINGS] Error:', error)
    return createErrorResponse('SERVER_ERROR', 'เกิดข้อผิดพลาดในระบบ', 500)
  }
}
