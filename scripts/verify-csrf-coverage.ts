/**
 * CSRF Coverage Verification Script
 *
 * Scans all admin API routes and verifies that POST/PATCH/DELETE handlers
 * include validateCsrf protection.
 *
 * Usage: npx tsx scripts/verify-csrf-coverage.ts
 *
 * Exit codes:
 *   0 - All routes have CSRF protection
 *   1 - Some routes missing CSRF protection
 */

import * as fs from 'fs'
import * as path from 'path'

const ADMIN_API_DIR = path.join(process.cwd(), 'app', 'api', 'admin')

// Routes that are exempt from CSRF (auth routes that happen before session exists)
const EXEMPT_ROUTES = [
  '/api/admin/auth/login',
  '/api/admin/auth/logout',
  '/api/admin/auth/check',
]

// Methods that require CSRF protection
const MUTATION_METHODS = ['POST', 'PATCH', 'DELETE', 'PUT']

interface RouteInfo {
  path: string
  filePath: string
  methods: string[]
  hasCsrf: boolean
  exempt: boolean
}

function findRouteFiles(dir: string): string[] {
  const files: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...findRouteFiles(fullPath))
    } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
      files.push(fullPath)
    }
  }

  return files
}

function getApiPath(filePath: string): string {
  const relativePath = path.relative(process.cwd(), filePath)
  // Convert app/api/admin/menu/route.ts -> /api/admin/menu
  const apiPath = relativePath
    .replace(/^app[\\/]/, '/')
    .replace(/[\\/]route\.(ts|js)$/, '')
    .replace(/\\/g, '/')
  return apiPath
}

function extractExportedMethods(content: string): string[] {
  const methods: string[] = []
  // Match export async function GET/POST/etc or export const GET/POST/etc
  const patterns = [
    /export\s+(?:async\s+)?function\s+(GET|POST|PATCH|DELETE|PUT)/g,
    /export\s+const\s+(GET|POST|PATCH|DELETE|PUT)\s*=/g,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(content)) !== null) {
      if (!methods.includes(match[1])) {
        methods.push(match[1])
      }
    }
  }

  return methods
}

function hasCsrfValidation(content: string): boolean {
  // Check for validateCsrf call or withCsrf wrapper
  return (
    content.includes('validateCsrf') ||
    content.includes('withCsrf') ||
    content.includes('csrfError')
  )
}

function analyzeRoute(filePath: string): RouteInfo {
  const content = fs.readFileSync(filePath, 'utf-8')
  const apiPath = getApiPath(filePath)
  const methods = extractExportedMethods(content)
  const hasCsrf = hasCsrfValidation(content)
  const exempt = EXEMPT_ROUTES.some((r) => apiPath.startsWith(r))

  return {
    path: apiPath,
    filePath,
    methods,
    hasCsrf,
    exempt,
  }
}

function main() {
  console.log('='.repeat(60))
  console.log('CSRF Coverage Verification')
  console.log('='.repeat(60))
  console.log()

  if (!fs.existsSync(ADMIN_API_DIR)) {
    console.error(`Admin API directory not found: ${ADMIN_API_DIR}`)
    process.exit(1)
  }

  const routeFiles = findRouteFiles(ADMIN_API_DIR)
  const routes = routeFiles.map(analyzeRoute)

  // Filter to routes with mutation methods
  const mutationRoutes = routes.filter((r) =>
    r.methods.some((m) => MUTATION_METHODS.includes(m))
  )

  // Separate protected, unprotected, and exempt
  const protectedRoutes = mutationRoutes.filter((r) => r.hasCsrf && !r.exempt)
  const exemptRoutes = mutationRoutes.filter((r) => r.exempt)
  const unprotectedRoutes = mutationRoutes.filter(
    (r) => !r.hasCsrf && !r.exempt
  )

  // Summary
  console.log(`Total admin routes scanned: ${routes.length}`)
  console.log(`Routes with mutation methods: ${mutationRoutes.length}`)
  console.log()

  // Protected routes
  console.log(`[OK] CSRF Protected: ${protectedRoutes.length}`)
  for (const route of protectedRoutes) {
    console.log(`     ${route.path} [${route.methods.join(', ')}]`)
  }
  console.log()

  // Exempt routes
  console.log(`[EXEMPT] Auth routes (pre-session): ${exemptRoutes.length}`)
  for (const route of exemptRoutes) {
    console.log(`     ${route.path} [${route.methods.join(', ')}]`)
  }
  console.log()

  // Unprotected routes
  if (unprotectedRoutes.length > 0) {
    console.log(
      `[MISSING] Routes needing CSRF protection: ${unprotectedRoutes.length}`
    )
    for (const route of unprotectedRoutes) {
      console.log(`     ${route.path} [${route.methods.join(', ')}]`)
    }
    console.log()
    console.log('='.repeat(60))
    console.log('RESULT: FAIL - Some routes missing CSRF protection')
    console.log('='.repeat(60))
    process.exit(1)
  } else {
    console.log()
    console.log('='.repeat(60))
    console.log('RESULT: PASS - All mutation routes have CSRF protection')
    console.log('='.repeat(60))
    process.exit(0)
  }
}

main()
