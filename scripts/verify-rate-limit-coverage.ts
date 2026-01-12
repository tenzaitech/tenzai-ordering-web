/**
 * Rate Limit Coverage Verification Script
 *
 * Scans public/unauthenticated API routes and verifies that rate limiting
 * is applied to prevent abuse.
 *
 * Usage: npx tsx scripts/verify-rate-limit-coverage.ts
 *
 * Exit codes:
 *   0 - All target routes have rate limiting
 *   1 - Some routes missing rate limiting
 */

import * as fs from 'fs'
import * as path from 'path'

const API_DIR = path.join(process.cwd(), 'app', 'api')

// Routes that MUST have rate limiting (public/unauthenticated endpoints)
const REQUIRED_RATE_LIMIT_ROUTES = [
  { path: '/api/order/validate-cart', reason: 'Public cart validation' },
  { path: '/api/public/promptpay', reason: 'Public payment info' },
  { path: '/api/liff/session', reason: 'Session creation endpoint' },
]

// Routes that already have rate limiting (auth endpoints)
const ALREADY_PROTECTED_ROUTES = [
  { path: '/api/admin/auth/login', reason: 'Admin login auth' },
  { path: '/api/staff/auth/pin', reason: 'Staff PIN auth' },
]

interface RouteCheck {
  path: string
  reason: string
  filePath: string | null
  hasRateLimit: boolean
  exists: boolean
}

function findRouteFile(apiPath: string): string | null {
  // Convert /api/order/validate-cart -> app/api/order/validate-cart/route.ts
  const relativePath = apiPath.replace(/^\//, '').replace(/\//g, path.sep)
  const tsPath = path.join(process.cwd(), 'app', relativePath, 'route.ts')
  const jsPath = path.join(process.cwd(), 'app', relativePath, 'route.js')

  if (fs.existsSync(tsPath)) return tsPath
  if (fs.existsSync(jsPath)) return jsPath
  return null
}

function hasRateLimitCheck(content: string): boolean {
  // Check for various rate limiting patterns
  return (
    content.includes('checkAndIncrementRateLimit') ||
    content.includes('rateLimit') ||
    content.includes('rate-limiter') ||
    content.includes('rateLimitKey') ||
    content.includes('RateLimit')
  )
}

function checkRoute(route: { path: string; reason: string }): RouteCheck {
  const filePath = findRouteFile(route.path)

  if (!filePath) {
    return {
      ...route,
      filePath: null,
      hasRateLimit: false,
      exists: false,
    }
  }

  const content = fs.readFileSync(filePath, 'utf-8')
  const hasRateLimit = hasRateLimitCheck(content)

  return {
    ...route,
    filePath,
    hasRateLimit,
    exists: true,
  }
}

function main() {
  console.log('='.repeat(60))
  console.log('Rate Limit Coverage Verification')
  console.log('='.repeat(60))
  console.log()

  // Check required routes
  const results = REQUIRED_RATE_LIMIT_ROUTES.map(checkRoute)

  // Also verify already protected routes still have protection
  const alreadyProtectedResults = ALREADY_PROTECTED_ROUTES.map((route) => {
    const check = checkRoute(route)
    return { ...check, wasAlreadyProtected: true }
  })

  // Summary for already protected
  console.log('[EXISTING] Auth routes with rate limiting:')
  for (const result of alreadyProtectedResults) {
    const status = result.hasRateLimit ? 'OK' : 'MISSING'
    console.log(`  [${status}] ${result.path}`)
  }
  console.log()

  // Check required routes
  const missing = results.filter((r) => !r.hasRateLimit && r.exists)
  const notFound = results.filter((r) => !r.exists)
  const protected_ = results.filter((r) => r.hasRateLimit)

  console.log('[TARGET] Routes requiring rate limiting:')
  console.log()

  if (protected_.length > 0) {
    console.log(`  [OK] Protected: ${protected_.length}`)
    for (const route of protected_) {
      console.log(`       ${route.path}`)
    }
    console.log()
  }

  if (missing.length > 0) {
    console.log(`  [MISSING] Unprotected: ${missing.length}`)
    for (const route of missing) {
      console.log(`       ${route.path} - ${route.reason}`)
    }
    console.log()
  }

  if (notFound.length > 0) {
    console.log(`  [NOT FOUND] Route files not found: ${notFound.length}`)
    for (const route of notFound) {
      console.log(`       ${route.path}`)
    }
    console.log()
  }

  // Final result
  console.log('='.repeat(60))
  if (missing.length > 0) {
    console.log('RESULT: FAIL - Some routes missing rate limiting')
    console.log()
    console.log('To fix, add rate limiting to:')
    for (const route of missing) {
      console.log(`  - ${route.path}`)
    }
    console.log('='.repeat(60))
    process.exit(1)
  } else if (notFound.length > 0) {
    console.log('RESULT: WARNING - Some route files not found')
    console.log('='.repeat(60))
    process.exit(0) // Don't fail if routes don't exist yet
  } else {
    console.log('RESULT: PASS - All target routes have rate limiting')
    console.log('='.repeat(60))
    process.exit(0)
  }
}

main()
