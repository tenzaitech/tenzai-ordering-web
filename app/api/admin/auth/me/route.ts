import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthorized } from '@/lib/adminAuth'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authorized = await isAdminAuthorized(request)

  if (!authorized) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  return NextResponse.json({
    ok: true,
    role: 'admin'
  })
}
