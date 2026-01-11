import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

/**
 * Server-side Supabase client using service role key
 * ONLY use this in API routes - never expose to client
 */
function getServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables for server client')
  }

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Singleton instance for reuse
let serverSupabase: ReturnType<typeof createClient<Database>> | null = null

export function getSupabaseServer() {
  if (!serverSupabase) {
    serverSupabase = getServerSupabase()
  }
  return serverSupabase
}
