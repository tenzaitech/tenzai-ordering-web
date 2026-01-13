import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { checkAdminAuth } from '@/lib/admin-gate'

export const runtime = 'nodejs'

type AdminSettingsRow = {
  line_approver_id: string | null
  line_staff_id: string | null
}

/**
 * GET /api/admin/diagnostics/line
 *
 * Returns LINE Messaging API configuration status (admin-only)
 * Used for troubleshooting notification failures
 *
 * Returns boolean flags only (no secrets):
 * {
 *   hasChannelAccessToken: boolean,
 *   hasApproverId: boolean,
 *   hasStaffId: boolean,
 *   hasLiffId: boolean,
 *   hasAppOrigin: boolean,
 *   dbSettingsConfigured: boolean,
 *   envFallbacksAvailable: boolean
 * }
 */
export async function GET(request: NextRequest) {
  // Auth check
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  try {
    // Check env vars (booleans only, never expose values)
    const hasChannelAccessToken = !!process.env.LINE_CHANNEL_ACCESS_TOKEN
    const hasLiffId = !!process.env.NEXT_PUBLIC_LIFF_ID
    const hasAppOrigin = !!process.env.NEXT_PUBLIC_APP_ORIGIN
    const hasEnvApproverId = !!process.env.LINE_APPROVER_ID
    const hasEnvStaffId = !!process.env.LINE_STAFF_ID

    // Check DB settings
    const supabase = getSupabaseServer()
    const { data: settingsData } = await supabase
      .from('admin_settings')
      .select('line_approver_id, line_staff_id')
      .limit(1)
      .single()

    const settings = settingsData as AdminSettingsRow | null
    const hasDbApproverId = !!settings?.line_approver_id
    const hasDbStaffId = !!settings?.line_staff_id

    // Resolved values (DB takes precedence over env)
    const hasApproverId = hasDbApproverId || hasEnvApproverId
    const hasStaffId = hasDbStaffId || hasEnvStaffId

    return NextResponse.json({
      hasChannelAccessToken,
      hasApproverId,
      hasStaffId,
      hasLiffId,
      hasAppOrigin,
      dbSettingsConfigured: hasDbApproverId && hasDbStaffId,
      envFallbacksAvailable: hasEnvApproverId && hasEnvStaffId,
      // Breakdown for debugging (which source is providing IDs)
      approverIdSource: hasDbApproverId ? 'database' : hasEnvApproverId ? 'env' : 'missing',
      staffIdSource: hasDbStaffId ? 'database' : hasEnvStaffId ? 'env' : 'missing'
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[API:ADMIN:DIAGNOSTICS:LINE] Error:', errorMsg)
    return NextResponse.json({
      error: 'Failed to fetch diagnostics',
      reason: 'UNEXPECTED_ERROR'
    }, { status: 500 })
  }
}
