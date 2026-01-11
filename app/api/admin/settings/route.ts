import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/admin-gate'
import { validateCsrf, csrfError } from '@/lib/csrf'
import { auditLog, getRequestMeta } from '@/lib/audit-log'
import { revokeAllStaffSessions } from '@/lib/staffAuth'
import { scrypt, randomBytes } from 'crypto'
import { promisify } from 'util'

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

const scryptAsync = promisify(scrypt)

async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16).toString('hex')
  const buf = (await scryptAsync(pin, salt, 64)) as Buffer
  return `${buf.toString('hex')}.${salt}`
}

async function verifyPin(storedHash: string, suppliedPin: string): Promise<boolean> {
  const [hashedPassword, salt] = storedHash.split('.')
  const buf = (await scryptAsync(suppliedPin, salt, 64)) as Buffer
  return buf.toString('hex') === hashedPassword
}

// GET: Fetch current settings
export async function GET(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  try {
    const { data: rawData, error } = await supabase
      .from('admin_settings')
      .select('id, promptpay_id, line_approver_id, line_staff_id, pin_version')
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('[ADMIN:SETTINGS] Fetch error:', error.message)
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }

    const data = rawData as SettingsRow | null

    // If no row exists, return defaults
    if (!data) {
      return NextResponse.json({
        promptpay_id: '',
        line_approver_id: process.env.LINE_APPROVER_ID || '',
        line_staff_id: process.env.LINE_STAFF_ID || '',
        pin_version: 1
      })
    }

    return NextResponse.json({
      promptpay_id: data.promptpay_id || '',
      line_approver_id: data.line_approver_id || '',
      line_staff_id: data.line_staff_id || '',
      pin_version: data.pin_version
    })
  } catch (error) {
    console.error('[ADMIN:SETTINGS] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Update settings (PATCH-style: only update fields present in body)
export async function POST(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  // CSRF check
  if (!validateCsrf(request)) {
    return csrfError()
  }

  const { ip, userAgent } = getRequestMeta(request)

  try {
    const body = await request.json()
    const { promptpay_id, line_approver_id, line_staff_id, new_staff_pin } = body

    // Validate only provided fields
    if (new_staff_pin !== undefined && new_staff_pin !== '') {
      if (!/^\d{4}$/.test(new_staff_pin)) {
        return NextResponse.json({ error: 'PIN must be exactly 4 digits' }, { status: 400 })
      }
    }

    // Check if at least one field is provided
    const hasAnyField = promptpay_id !== undefined || line_approver_id !== undefined ||
                        line_staff_id !== undefined || (new_staff_pin && new_staff_pin.length > 0)
    if (!hasAnyField) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // Fetch existing settings
    const { data: existingData, error: fetchError } = await supabase
      .from('admin_settings')
      .select('*')
      .limit(1)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[ADMIN:SETTINGS] Fetch error:', fetchError.message)
      return NextResponse.json({ error: 'Failed to fetch existing settings' }, { status: 500 })
    }

    const existing = existingData as SettingsRow | null

    // Prepare update data (only include fields that were provided)
    const updateData: Record<string, any> = {
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
      const hashedPin = await hashPin(new_staff_pin)
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
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
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
        return NextResponse.json({ error: 'PIN required for initial setup' }, { status: 400 })
      }
      const hashedPin = await hashPin(new_staff_pin)
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
        return NextResponse.json({ error: 'Failed to create settings' }, { status: 500 })
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
