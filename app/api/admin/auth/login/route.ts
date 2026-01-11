import { NextRequest, NextResponse } from 'next/server'
import { scryptSync, timingSafeEqual, randomUUID } from 'crypto'
import { getSupabaseServer } from '@/lib/supabase-server'
import {
  generateAdminSessionToken,
  ADMIN_COOKIE_NAME,
  getAdminCookieOptions
} from '@/lib/adminAuth'
import {
  checkAndIncrementRateLimit,
  clearRateLimit,
  getClientIp,
  adminLoginKey
} from '@/lib/rate-limiter'
import { auditLog, getRequestMeta } from '@/lib/audit-log'

export const runtime = 'nodejs'

// Unmistakable route marker for debugging route-level issues
const ROUTE_MARKER = 'admin-login-route:v1'

// Check if debug mode is enabled (cached at module level for perf)
const isDebugMode = () => process.env.DEBUG_AUTH_ERRORS === 'true'

type AdminSettingsRow = {
  admin_username: string | null
  admin_password_hash: string | null
}

type ErrorResponse = {
  error: {
    code: string
    message_th: string
    error_id?: string
    name?: string
    hint?: string
    route_marker?: string
  }
}

type ErrorHint =
  | 'ENV_MISSING'
  | 'SUPABASE_AUTH'
  | 'SUPABASE_DB'
  | 'DB_SCHEMA'
  | 'DB_PERMISSIONS'
  | 'COOKIE'
  | 'CSRF'
  | 'RATE_LIMIT'
  | 'TOKEN_GEN_FAILED'
  | 'UNKNOWN'

/**
 * Create a 500 error response with route marker header and optional debug fields.
 * Always includes x-route-marker header. Debug fields only when DEBUG_AUTH_ERRORS=true.
 */
function create500Response(hint: ErrorHint, errorName = 'Error'): NextResponse<ErrorResponse> {
  const errorId = randomUUID()
  const debug = isDebugMode()

  // Always log minimal safe info
  console.error('AUTH_ADMIN_LOGIN_ERROR', { error_id: errorId, name: errorName, hint, route_marker: ROUTE_MARKER })

  const baseError = {
    code: 'SERVER_ERROR',
    message_th: 'เกิดข้อผิดพลาดในระบบ'
  }

  const responseError = debug
    ? { ...baseError, error_id: errorId, name: errorName, hint, route_marker: ROUTE_MARKER }
    : baseError

  const response = NextResponse.json<ErrorResponse>(
    { error: responseError },
    { status: 500, headers: { 'x-route-marker': ROUTE_MARKER } }
  )
  return response
}

/**
 * Derive a safe, non-sensitive hint from an error for debugging.
 * Never includes secrets, passwords, hashes, tokens, or env values.
 */
function safeHint(err: unknown): ErrorHint {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase()
  const name = err instanceof Error ? err.name.toLowerCase() : ''

  if (msg.includes('supabase_url') || msg.includes('supabase_service_role_key') || msg.includes('missing')) {
    return 'ENV_MISSING'
  }
  if (msg.includes('invalid api key') || msg.includes('jwt') || msg.includes('apikey')) {
    return 'SUPABASE_AUTH'
  }
  if (msg.includes('permission denied') || msg.includes('rls')) {
    return 'DB_PERMISSIONS'
  }
  if (msg.includes('relation') || msg.includes('does not exist') || msg.includes('column') || msg.includes('schema')) {
    return 'DB_SCHEMA'
  }
  if (name.includes('postgrest') || msg.includes('postgrest')) {
    return 'SUPABASE_DB'
  }
  if (msg.includes('csrf')) {
    return 'CSRF'
  }
  if (msg.includes('cookie') || msg.includes('headers')) {
    return 'COOKIE'
  }
  if (msg.includes('auth_rate_limits') || msg.includes('rate')) {
    return 'RATE_LIMIT'
  }
  return 'UNKNOWN'
}

/**
 * Verify password against stored scrypt hash (sync for Vercel stability)
 */
function verifyPassword(storedHash: string, suppliedPassword: string): boolean {
  try {
    const [hashedPassword, salt] = storedHash.split('.')
    if (!hashedPassword || !salt) return false
    const buf = scryptSync(suppliedPassword, salt, 64)
    const storedBuf = Buffer.from(hashedPassword, 'hex')
    if (buf.length !== storedBuf.length) return false
    return timingSafeEqual(buf, storedBuf)
  } catch (err) {
    console.error('[ADMIN:AUTH:LOGIN] verifyPassword error:', err instanceof Error ? err.message : 'unknown')
    return false
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Route entry marker - log only when debug enabled (no secrets)
  if (isDebugMode()) {
    console.log({ route_marker: ROUTE_MARKER, stage: 'entered' })
  }

  const clientIp = getClientIp(request)
  const rateLimitKey = adminLoginKey(clientIp)
  const { ip, userAgent } = getRequestMeta(request)

  // Check rate limit (persistent, cloud-safe)
  const rateLimit = await checkAndIncrementRateLimit(rateLimitKey)
  if (!rateLimit.allowed) {
    const retryAfterSeconds = rateLimit.retryAfterSeconds || 900
    return NextResponse.json<ErrorResponse>(
      {
        error: {
          code: 'RATE_LIMITED',
          message_th: `เข้าสู่ระบบล้มเหลวหลายครั้ง กรุณารอ ${Math.ceil(retryAfterSeconds / 60)} นาที`
        }
      },
      {
        status: 429,
        headers: { 'Retry-After': String(retryAfterSeconds), 'x-route-marker': ROUTE_MARKER }
      }
    )
  }

  try {
    const body = await request.json()
    const { username, password } = body

    // Validate input
    if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
      return NextResponse.json<ErrorResponse>(
        {
          error: {
            code: 'INVALID_INPUT',
            message_th: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'
          }
        },
        { status: 400, headers: { 'x-route-marker': ROUTE_MARKER } }
      )
    }

    // Fetch admin credentials from DB (using server-side client)
    const supabase = getSupabaseServer()
    const { data: settingsData, error: fetchError } = await supabase
      .from('admin_settings')
      .select('admin_username, admin_password_hash')
      .limit(1)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      return create500Response('SUPABASE_DB', fetchError.name || 'PostgrestError')
    }

    const settings = settingsData as AdminSettingsRow | null

    // Check if admin credentials are configured
    if (!settings?.admin_username || !settings?.admin_password_hash) {
      // ADMIN_API_KEY fallback ONLY in dev with explicit flag
      if (
        process.env.NODE_ENV === 'development' &&
        process.env.ALLOW_ADMIN_API_KEY_FALLBACK === 'true'
      ) {
        const adminApiKey = process.env.ADMIN_API_KEY
        if (adminApiKey && username === 'admin' && password === adminApiKey) {
          await clearRateLimit(rateLimitKey)
          const token = await generateAdminSessionToken()
          if (!token) {
            return create500Response('TOKEN_GEN_FAILED', 'TokenGenerationError')
          }

          // Audit log - dev fallback login
          await auditLog({
            actor_type: 'admin',
            actor_identifier: username,
            ip,
            user_agent: userAgent,
            action_code: 'ADMIN_LOGIN_OK',
            metadata: { method: 'api_key_fallback', env: 'development' }
          })

          const response = NextResponse.json(
            { ok: true },
            { headers: { 'x-route-marker': ROUTE_MARKER } }
          )
          response.cookies.set(ADMIN_COOKIE_NAME, token, getAdminCookieOptions())
          return response
        }
      }

      // No credentials configured and fallback not allowed/matched
      await auditLog({
        actor_type: 'admin',
        actor_identifier: username,
        ip,
        user_agent: userAgent,
        action_code: 'ADMIN_LOGIN_FAIL',
        metadata: { reason: 'no_credentials_configured' }
      })

      return NextResponse.json<ErrorResponse>(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message_th: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
          }
        },
        { status: 401, headers: { 'x-route-marker': ROUTE_MARKER } }
      )
    }

    // Verify username (case-insensitive)
    if (username.toLowerCase() !== settings.admin_username.toLowerCase()) {
      await auditLog({
        actor_type: 'admin',
        actor_identifier: username,
        ip,
        user_agent: userAgent,
        action_code: 'ADMIN_LOGIN_FAIL',
        metadata: { reason: 'invalid_username' }
      })

      return NextResponse.json<ErrorResponse>(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message_th: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
          }
        },
        { status: 401, headers: { 'x-route-marker': ROUTE_MARKER } }
      )
    }

    // Verify password
    const passwordValid = verifyPassword(settings.admin_password_hash, password)
    if (!passwordValid) {
      await auditLog({
        actor_type: 'admin',
        actor_identifier: username,
        ip,
        user_agent: userAgent,
        action_code: 'ADMIN_LOGIN_FAIL',
        metadata: { reason: 'invalid_password' }
      })

      return NextResponse.json<ErrorResponse>(
        {
          error: {
            code: 'INVALID_CREDENTIALS',
            message_th: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง'
          }
        },
        { status: 401, headers: { 'x-route-marker': ROUTE_MARKER } }
      )
    }

    // Success - clear rate limit and issue session
    await clearRateLimit(rateLimitKey)
    const token = await generateAdminSessionToken()
    if (!token) {
      // TOKEN_GEN_FAILED: Most likely cause is missing ADMIN_API_KEY env var
      return create500Response('TOKEN_GEN_FAILED', 'TokenGenerationError')
    }

    // Audit log - successful login
    await auditLog({
      actor_type: 'admin',
      actor_identifier: username,
      ip,
      user_agent: userAgent,
      action_code: 'ADMIN_LOGIN_OK',
      metadata: { method: 'password' }
    })

    const response = NextResponse.json(
      { ok: true },
      { headers: { 'x-route-marker': ROUTE_MARKER } }
    )
    response.cookies.set(ADMIN_COOKIE_NAME, token, getAdminCookieOptions())
    return response
  } catch (error) {
    // Use helper for consistent error handling with route marker
    const errorName = error instanceof Error ? error.name : 'Error'
    const hint = safeHint(error)
    return create500Response(hint, errorName)
  }
}
