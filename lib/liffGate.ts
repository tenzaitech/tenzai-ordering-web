import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const FRIEND_CHECK_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

/**
 * Checks if LIFF user has valid session AND fresh friendship check.
 * Returns null if valid, NextResponse error if not.
 */
export async function checkLiffGate(): Promise<null | NextResponse> {
  const cookieStore = await cookies()
  const userIdCookie = cookieStore.get('tenzai_liff_user')
  const friendCheckedAtCookie = cookieStore.get('tenzai_liff_friend_checked_at')

  // No user session
  if (!userIdCookie || !userIdCookie.value) {
    return NextResponse.json(
      {
        error: 'LIFF_RECHECK_REQUIRED',
        error_th: 'กรุณาเข้าสู่ระบบอีกครั้ง',
        message: 'LIFF session required'
      },
      { status: 401 }
    )
  }

  // No friendship timestamp or expired
  if (!friendCheckedAtCookie || !friendCheckedAtCookie.value) {
    return NextResponse.json(
      {
        error: 'LIFF_RECHECK_REQUIRED',
        error_th: 'กรุณายืนยันการเป็นเพื่อนอีกครั้ง',
        message: 'Friendship check required'
      },
      { status: 401 }
    )
  }

  // Check timestamp freshness
  const checkedAt = parseInt(friendCheckedAtCookie.value, 10)
  if (isNaN(checkedAt) || Date.now() - checkedAt > FRIEND_CHECK_TTL_MS) {
    return NextResponse.json(
      {
        error: 'LIFF_RECHECK_REQUIRED',
        error_th: 'กรุณายืนยันการเป็นเพื่อนอีกครั้ง',
        message: 'Friendship check expired'
      },
      { status: 401 }
    )
  }

  // Valid
  return null
}
