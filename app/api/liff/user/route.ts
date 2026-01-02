import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const userIdCookie = cookieStore.get('tenzai_liff_user')

    if (!userIdCookie) {
      return NextResponse.json(
        { error: 'No LIFF session' },
        { status: 401 }
      )
    }

    return NextResponse.json({ userId: userIdCookie.value })
  } catch (error) {
    console.error('[LIFF_USER] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get user' },
      { status: 500 }
    )
  }
}
