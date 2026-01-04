import { NextRequest, NextResponse } from 'next/server'
import { isAdminAuthorized, unauthorized } from './adminAuth'

export async function checkAdminAuth(request: NextRequest): Promise<NextResponse | null> {
  const adminKey = process.env.ADMIN_API_KEY

  if (!adminKey) {
    return NextResponse.json(
      { error: 'Server misconfiguration: ADMIN_API_KEY not set' },
      { status: 500 }
    )
  }

  // Check both x-admin-key header AND httpOnly session cookie
  if (!(await isAdminAuthorized(request))) {
    return unauthorized()
  }

  return null
}
