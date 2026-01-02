export async function adminFetch(url: string, init?: RequestInit): Promise<Response> {
  const adminKey = process.env.NEXT_PUBLIC_ADMIN_API_KEY

  if (!adminKey) {
    throw new Error('NEXT_PUBLIC_ADMIN_API_KEY is not configured')
  }

  const headers = new Headers(init?.headers || {})
  headers.set('x-admin-key', adminKey)

  return fetch(url, {
    ...init,
    headers
  })
}
