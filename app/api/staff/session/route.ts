import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { pin } = await request.json()

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 400 })
    }

    const correctPin = process.env.STAFF_PIN

    if (!correctPin) {
      console.error('[STAFF:SESSION] STAFF_PIN not configured')
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    if (pin !== correctPin) {
      return NextResponse.json({ error: 'Incorrect PIN' }, { status: 401 })
    }

    // Set staff session cookie
    const response = NextResponse.json({ success: true })
    response.cookies.set('tenzai_staff', 'STAFF_VERIFIED', {
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

// GET: Check if staff session exists
export async function GET(request: NextRequest) {
  const staffCookie = request.cookies.get('tenzai_staff')

  if (staffCookie?.value === 'STAFF_VERIFIED') {
    return NextResponse.json({ authenticated: true })
  }

  return NextResponse.json({ authenticated: false }, { status: 401 })
}
