import { NextRequest, NextResponse } from 'next/server'

export function checkAdminAuth(request: NextRequest): NextResponse | null {
  const adminKey = process.env.ADMIN_API_KEY

  if (!adminKey) {
    return NextResponse.json(
      { error: 'Server misconfiguration: ADMIN_API_KEY not set' },
      { status: 500 }
    )
  }

  const providedKey = request.headers.get('x-admin-key')

  if (!providedKey || providedKey !== adminKey) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  return null
}
