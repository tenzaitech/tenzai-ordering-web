/**
 * Simple in-memory cache for menu data with TTL and inflight deduplication.
 *
 * CACHE KEY: menu:v1:default
 * - Single-purpose cache for /order/menu page data
 * - Bump version (v1 → v2) if cache schema changes
 *
 * TTL = 60 seconds
 * - Menu data rarely changes (admin updates are infrequent)
 * - 60s is short enough to pick up changes within a minute
 * - Long enough to handle burst traffic without hammering DB
 * - Safe for multi-user: menu is public data, not per-user
 *
 * INVALIDATION STRATEGY: TTL-only
 * - No admin-triggered invalidation yet (future enhancement)
 * - Cache auto-expires after TTL_MS
 * - Failures do NOT poison cache (only successful fetches are cached)
 */

// Cache key for identification and versioning
export const MENU_CACHE_KEY = 'menu:v1:default'

type CacheEntry<T> = {
  key: string
  data: T
  cachedAt: number
}

// Cache state (module-level singleton) - uses generic type via any internally
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cache: CacheEntry<any> | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let inflightPromise: Promise<any> | null = null

// TTL: 60 seconds - see module docstring for rationale
const TTL_MS = 60_000

const DEBUG = process.env.MENU_CACHE_DEBUG === '1'

function log(msg: string, data?: Record<string, unknown>) {
  if (DEBUG) {
    console.log(`[MENU_CACHE] ${msg}`, data ? JSON.stringify(data) : '')
  }
}

/**
 * Get menu data with caching and inflight deduplication.
 *
 * @param fetchFn - Async function that fetches fresh menu data
 * @returns Cached or fresh menu data (preserves type from fetchFn)
 */
export async function getMenuDataCached<T>(
  fetchFn: () => Promise<T>
): Promise<T> {
  const now = Date.now()

  // Check cache validity (must match key and be within TTL)
  if (cache && cache.key === MENU_CACHE_KEY && (now - cache.cachedAt) < TTL_MS) {
    log('cache_hit', { key: MENU_CACHE_KEY, age_ms: now - cache.cachedAt })
    return cache.data
  }

  // If there's already an inflight request, wait for it (prevents stampede)
  if (inflightPromise) {
    log('inflight_join')
    return inflightPromise
  }

  // Start fresh fetch
  const t0 = now
  inflightPromise = fetchFn()
    .then((data) => {
      // Only cache on success
      cache = { key: MENU_CACHE_KEY, data, cachedAt: Date.now() }
      log('cache_miss', { key: MENU_CACHE_KEY, fetch_ms: Date.now() - t0 })
      return data
    })
    .catch((error) => {
      // Don't poison cache on failure
      log('fetch_error', { error: String(error) })
      throw error
    })
    .finally(() => {
      // Clear inflight regardless of success/failure
      inflightPromise = null
    })

  return inflightPromise
}

/**
 * Manually invalidate cache (for future admin use).
 * Not currently called, but available for future cache-busting.
 */
export function invalidateMenuCache(): void {
  cache = null
  log('cache_invalidated')
}
