/**
 * Audit logging for security-sensitive actions
 *
 * Logs are immutable and stored in Supabase audit_logs table
 * Uses service role for writes - never exposed to client
 */

import { getSupabaseServer } from './supabase-server'

export type AuditActorType = 'admin' | 'staff' | 'system'

export type AuditActionCode =
  // Auth events
  | 'ADMIN_LOGIN_OK'
  | 'ADMIN_LOGIN_FAIL'
  | 'ADMIN_LOGOUT'
  | 'STAFF_PIN_OK'
  | 'STAFF_PIN_FAIL'
  | 'STAFF_LOGOUT'
  // Credential changes
  | 'ADMIN_PASSWORD_CHANGED'
  | 'STAFF_PIN_CHANGED'
  | 'ADMIN_SESSIONS_REVOKED'
  | 'STAFF_SESSIONS_REVOKED'
  // Admin actions
  | 'ORDER_APPROVED'
  | 'ORDER_REJECTED'
  | 'ORDER_ADJUSTED'

type AuditLogEntry = {
  actor_type: AuditActorType
  actor_identifier?: string
  ip?: string
  user_agent?: string
  action_code: AuditActionCode
  metadata?: Record<string, unknown>
}

/**
 * Write an audit log entry
 * Fire-and-forget: errors are logged but don't fail the operation
 */
export async function auditLog(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = getSupabaseServer()

    // Sanitize metadata - remove any sensitive fields
    const safeMetadata = entry.metadata
      ? sanitizeMetadata(entry.metadata)
      : {}

    // Use type assertion for table not in generated types
    await (supabase as ReturnType<typeof getSupabaseServer>)
      .from('audit_logs' as never)
      .insert({
        actor_type: entry.actor_type,
        actor_identifier: entry.actor_identifier || null,
        ip: entry.ip || null,
        user_agent: truncate(entry.user_agent, 500) || null,
        action_code: entry.action_code,
        metadata: safeMetadata
      } as never)

  } catch (error) {
    // Log error but don't throw - audit failures shouldn't break operations
    console.error('[AUDIT] Failed to write log:', error)
  }
}

/**
 * Helper to get request metadata for audit logs
 */
export function getRequestMeta(request: Request): { ip: string; userAgent: string } {
  const xff = request.headers.get('x-forwarded-for')
  const ip = xff
    ? xff.split(',')[0].trim()
    : request.headers.get('x-real-ip') || 'unknown'

  const userAgent = request.headers.get('user-agent') || 'unknown'

  return { ip, userAgent }
}

/**
 * Remove sensitive fields from metadata
 */
function sanitizeMetadata(meta: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = ['password', 'pin', 'hash', 'token', 'secret', 'key', 'credential']
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(meta)) {
    const lowerKey = key.toLowerCase()
    const isSensitive = sensitiveKeys.some(s => lowerKey.includes(s))

    if (isSensitive) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMetadata(value as Record<string, unknown>)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

/**
 * Truncate string to max length
 */
function truncate(str: string | null | undefined, maxLen: number): string | null {
  if (!str) return null
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str
}
