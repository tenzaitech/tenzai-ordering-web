import { NextRequest, NextResponse } from 'next/server'
import { isStaffAuthorized } from '@/lib/staffAuth'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authorized = isStaffAuthorized(request)

  if (!authorized) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  return NextResponse.json({
    ok: true,
    role: 'staff'
  })
}
