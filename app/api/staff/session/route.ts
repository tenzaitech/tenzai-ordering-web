import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { scrypt } from 'crypto'
import { promisify } from 'util'

export const runtime = 'nodejs'

type SettingsRow = {
  staff_pin_hash: string | null
  pin_version: number
}

type PinVersionRow = {
  pin_version: number
}

const scryptAsync = promisify(scrypt)

async function verifyPin(storedHash: string, suppliedPin: string): Promise<boolean> {
  const [hashedPassword, salt] = storedHash.split('.')
  const buf = (await scryptAsync(suppliedPin, salt, 64)) as Buffer
  return buf.toString('hex') === hashedPassword
}

export async function POST(request: NextRequest) {
  try {
    const { pin } = await request.json()

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 400 })
    }

    // Fetch PIN hash from DB
    const { data: settingsData, error: fetchError } = await supabase
      .from('admin_settings')
      .select('staff_pin_hash, pin_version')
      .limit(1)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('[STAFF:SESSION] Settings fetch error:', fetchError.message)
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const settings = settingsData as SettingsRow | null

    // Fallback to env if DB not initialized
    let pinValid = false
    let pinVersion = 1

    if (settings && settings.staff_pin_hash) {
      pinValid = await verifyPin(settings.staff_pin_hash, pin)
      pinVersion = settings.pin_version
    } else {
      // Fallback to env STAFF_PIN (plaintext comparison for backward compat)
      const envPin = process.env.STAFF_PIN
      if (!envPin) {
        console.error('[STAFF:SESSION] No PIN configured (DB or env)')
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
      }
      pinValid = pin === envPin
    }

    if (!pinValid) {
      return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 })
    }

    // Set staff session cookie with pin_version
    const response = NextResponse.json({ success: true })
    response.cookies.set('tenzai_staff', `STAFF_VERIFIED:${pinVersion}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8 // 8 hours
    })

    return response
  } catch (error) {
    console.error('[STAFF:SESSION] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET: Check if staff session exists and is valid
export async function GET(request: NextRequest) {
  const staffCookie = request.cookies.get('tenzai_staff')

  if (!staffCookie || !staffCookie.value.startsWith('STAFF_VERIFIED:')) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  // Extract pin_version from cookie
  const cookieVersion = parseInt(staffCookie.value.split(':')[1] || '1')

  // Fetch current pin_version from DB
  const { data: pinData } = await supabase
    .from('admin_settings')
    .select('pin_version')
    .limit(1)
    .single()

  const pinSettings = pinData as PinVersionRow | null
  const currentVersion = pinSettings?.pin_version || 1

  // If versions don't match, PIN was changed - invalidate session
  if (cookieVersion !== currentVersion) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  return NextResponse.json({ authenticated: true })
}
