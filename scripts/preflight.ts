/**
 * Preflight Check Script
 *
 * Verifies that required environment variables are present before deployment.
 * Does NOT print values (security).
 *
 * Usage: npx tsx scripts/preflight.ts
 *
 * Exit codes:
 *   0 - All required env vars present
 *   1 - Some env vars missing
 */

import * as fs from 'fs'
import * as path from 'path'

/**
 * Simple .env parser (no external dependencies)
 * Parses KEY=VALUE lines, ignores comments and empty lines.
 * Does NOT override existing process.env values.
 */
function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return

  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue

    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue

    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim()

    // Remove surrounding quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }

    // Only set if not already defined (don't override)
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

// Load .env.local first (higher priority), then .env
loadEnvFile(path.join(process.cwd(), '.env.local'))
loadEnvFile(path.join(process.cwd(), '.env'))

// Required environment variables (must fail if missing)
const REQUIRED_ENV_VARS = {
  'Supabase (Core)': [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ],
  Security: ['SESSION_SECRET'],
}

// Phase-based variables (warn only; fail if PREFLIGHT_STRICT=1)
const PHASE_BASED_ENV_VARS = {
  'LINE Integration': [
    'LINE_CHANNEL_ACCESS_TOKEN',
    'LINE_CHANNEL_SECRET',
    'NEXT_PUBLIC_LIFF_ID',
  ],
}

// Optional but recommended
const OPTIONAL_ENV_VARS = {
  'Rate Limiting': ['RATE_LIMIT_WINDOW_MS', 'RATE_LIMIT_MAX_REQUESTS'],
  Storage: ['SUPABASE_STORAGE_BUCKET'],
}

// Strict mode: set PREFLIGHT_STRICT=1 to fail on phase-based vars
const STRICT_MODE = process.env.PREFLIGHT_STRICT === '1'

interface CheckResult {
  name: string
  present: boolean
  hasValue: boolean
}

function checkEnvVar(name: string): CheckResult {
  const value = process.env[name]
  return {
    name,
    present: value !== undefined,
    hasValue: value !== undefined && value.trim() !== '',
  }
}

function main() {
  console.log('='.repeat(60))
  console.log('Preflight Environment Check')
  if (STRICT_MODE) {
    console.log('(STRICT MODE: phase-based vars will cause failure)')
  }
  console.log('='.repeat(60))
  console.log()

  const missingRequired: string[] = []
  const emptyRequired: string[] = []
  const missingPhaseBased: string[] = []

  // Check required vars
  console.log('[REQUIRED]')
  for (const [group, vars] of Object.entries(REQUIRED_ENV_VARS)) {
    console.log(`\n  ${group}:`)
    for (const varName of vars) {
      const result = checkEnvVar(varName)
      if (!result.present) {
        console.log(`    [MISSING] ${varName}`)
        missingRequired.push(varName)
      } else if (!result.hasValue) {
        console.log(`    [EMPTY]   ${varName}`)
        emptyRequired.push(varName)
      } else {
        console.log(`    [OK]      ${varName}`)
      }
    }
  }

  // Check phase-based vars (warn only unless STRICT_MODE)
  console.log()
  console.log('[PHASE-BASED] (set PREFLIGHT_STRICT=1 to enforce)')
  for (const [group, vars] of Object.entries(PHASE_BASED_ENV_VARS)) {
    console.log(`\n  ${group}:`)
    for (const varName of vars) {
      const result = checkEnvVar(varName)
      if (!result.present) {
        console.log(`    [WARN]    ${varName} (not set)`)
        missingPhaseBased.push(varName)
      } else if (!result.hasValue) {
        console.log(`    [WARN]    ${varName} (empty)`)
        missingPhaseBased.push(varName)
      } else {
        console.log(`    [OK]      ${varName}`)
      }
    }
  }

  console.log()
  console.log('[OPTIONAL]')
  for (const [group, vars] of Object.entries(OPTIONAL_ENV_VARS)) {
    console.log(`\n  ${group}:`)
    for (const varName of vars) {
      const result = checkEnvVar(varName)
      if (!result.present) {
        console.log(`    [SKIP]    ${varName} (not set, using defaults)`)
      } else if (!result.hasValue) {
        console.log(`    [EMPTY]   ${varName}`)
      } else {
        console.log(`    [OK]      ${varName}`)
      }
    }
  }

  // Summary
  console.log()
  console.log('='.repeat(60))

  const hasRequiredFailure = missingRequired.length > 0 || emptyRequired.length > 0
  const hasPhaseBasedFailure = STRICT_MODE && missingPhaseBased.length > 0

  if (hasRequiredFailure || hasPhaseBasedFailure) {
    console.log('RESULT: FAIL')
    console.log()
    if (missingRequired.length > 0) {
      console.log('Missing required variables:')
      for (const v of missingRequired) {
        console.log(`  - ${v}`)
      }
    }
    if (emptyRequired.length > 0) {
      console.log('Empty required variables:')
      for (const v of emptyRequired) {
        console.log(`  - ${v}`)
      }
    }
    if (hasPhaseBasedFailure) {
      console.log('Missing phase-based variables (STRICT MODE):')
      for (const v of missingPhaseBased) {
        console.log(`  - ${v}`)
      }
    }
    console.log('='.repeat(60))
    process.exit(1)
  } else {
    if (missingPhaseBased.length > 0) {
      console.log('RESULT: PASS (with warnings)')
      console.log(`  ${missingPhaseBased.length} phase-based var(s) not set`)
    } else {
      console.log('RESULT: PASS - All environment variables present')
    }
    console.log('='.repeat(60))
    process.exit(0)
  }
}

main()
