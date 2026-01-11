import { CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from './csrf'

/**
 * Get CSRF token from cookie
 */
function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(^| )${CSRF_COOKIE_NAME}=([^;]+)`))
  return match ? match[2] : null
}

/**
 * Fetch wrapper for admin API calls
 * - Uses httpOnly session cookies for auth (automatic)
 * - Includes CSRF token header for mutating requests
 */
export async function adminFetch(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers || {})

  // Include CSRF token for mutating requests
  const method = (init?.method || 'GET').toUpperCase()
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrfToken = getCsrfToken()
    if (csrfToken) {
      headers.set(CSRF_HEADER_NAME, csrfToken)
    }
  }

  return fetch(url, {
    ...init,
    headers,
    credentials: 'include' // Include cookies
  })
}
