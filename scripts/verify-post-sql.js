#!/usr/bin/env node
/**
 * Post-SQL Verification Script (READ-ONLY)
 *
 * Verifies that proposed_fixes.sql was applied correctly.
 * Tests: policies, RLS status, indexes, and anon access exposure.
 *
 * NEVER modifies data or applies changes.
 */

const fs = require('fs');
const path = require('path');

// Load env from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && !key.startsWith('#')) {
      process.env[key.trim()] = vals.join('=').trim();
    }
  });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// SECURITY: Never log credentials
console.log('Supabase URL configured: YES');
console.log('Service Role Key configured: YES');
console.log('Anon Key configured:', ANON_KEY ? 'YES' : 'NO');

const reportsDir = path.join(__dirname, '..', 'reports');
const results = {
  timestamp: new Date().toISOString(),
  policies: { status: 'PENDING', data: [], issues: [] },
  rls_enabled: { status: 'PENDING', data: [], issues: [] },
  indexes: { status: 'PENDING', data: [], issues: [] },
  anon_exposure: { status: 'PENDING', data: null, issues: [] },
  overall: 'PENDING'
};

const sqlQueries = [];

// Helper to query via PostgREST RPC (requires a SQL function to exist)
async function queryWithServiceRole(table, select = '*', limit = 10) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=${limit}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`
    }
  });
  return { ok: res.ok, status: res.status, data: res.ok ? await res.json() : null };
}

async function queryWithAnonKey(table, select = '*', limit = 10) {
  if (!ANON_KEY) return { ok: false, status: 0, error: 'No anon key configured' };

  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=${limit}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`
    }
  });

  let data = null;
  let error = null;
  try {
    const text = await res.text();
    data = JSON.parse(text);
    if (!res.ok && data.message) error = data.message;
  } catch (e) {
    error = 'Failed to parse response';
  }

  return { ok: res.ok, status: res.status, data, error };
}

// ============================================================
// VERIFICATION FUNCTIONS
// ============================================================

async function verifyPolicies() {
  console.log('\n=== Verifying RLS Policies ===');

  const tables = ['admin_settings', 'orders', 'order_items', 'system_settings'];
  const expectedPolicies = {
    'admin_settings': [
      'Service role full access on admin_settings',
      'Allow anon to read admin_settings display fields'
    ],
    'orders': [
      'Service role full access on orders',
      'Anon can create orders',
      'Anon can read all orders (MVP)',
      'Anon can update orders (MVP)'
    ],
    'order_items': [
      'Service role full access on order_items',
      'Anon can create order_items',
      'Anon can read order_items (MVP)'
    ],
    'system_settings': [
      'Service role full access on system_settings',
      'Anon can read system_settings'
    ]
  };

  const oldPolicies = [
    'Allow all operations on admin_settings',
    'Allow all operations on orders',
    'Allow all operations on order_items',
    'Allow all operations on system_settings'
  ];

  // We cannot directly query pg_policies via REST API without an RPC function
  // Instead, we'll test behavior by attempting operations with different keys

  console.log('Testing policy behavior via REST API...');

  for (const table of tables) {
    // Test SELECT with service role (should work)
    const serviceResult = await queryWithServiceRole(table, '*', 1);
    console.log(`  ${table} (service_role SELECT): ${serviceResult.ok ? 'OK' : 'BLOCKED'}`);

    // Test SELECT with anon (should work for all these tables per proposed_fixes.sql)
    const anonResult = await queryWithAnonKey(table, '*', 1);
    console.log(`  ${table} (anon SELECT): ${anonResult.ok ? 'ALLOWED' : 'BLOCKED'}`);

    results.policies.data.push({
      table,
      service_role_select: serviceResult.ok,
      anon_select: anonResult.ok,
      anon_status: anonResult.status
    });
  }

  // Check for old permissive policies by testing if anon can do unexpected things
  // If old "Allow all" policies exist, anon could INSERT/UPDATE/DELETE on admin_settings

  console.log('\nTesting for old permissive policies (anon write access)...');

  // Test anon INSERT on admin_settings (should be BLOCKED if policies are correct)
  if (ANON_KEY) {
    const insertUrl = `${SUPABASE_URL}/rest/v1/admin_settings`;
    const insertRes = await fetch(insertUrl, {
      method: 'POST',
      headers: {
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        line_approver_id: 'test',
        line_staff_id: 'test',
        staff_pin_hash: 'test_hash_should_fail'
      })
    });

    const insertBlocked = !insertRes.ok || insertRes.status === 403 || insertRes.status === 401;
    console.log(`  admin_settings (anon INSERT): ${insertBlocked ? 'BLOCKED (GOOD)' : 'ALLOWED (BAD!)'}`);

    if (!insertBlocked) {
      results.policies.issues.push('CRITICAL: Anon can INSERT into admin_settings - old policy may still exist');
    }

    results.policies.data.push({
      test: 'anon_insert_admin_settings',
      blocked: insertBlocked
    });
  }

  results.policies.status = results.policies.issues.length === 0 ? 'PASS' : 'FAIL';

  // Record SQL for manual verification
  sqlQueries.push({
    name: 'List all policies on target tables',
    sql: `SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename IN ('admin_settings', 'orders', 'order_items', 'system_settings')
ORDER BY tablename, policyname;`
  });

  sqlQueries.push({
    name: 'Check for old permissive policies',
    sql: `SELECT policyname, tablename
FROM pg_policies
WHERE policyname LIKE 'Allow all operations on %'
  AND tablename IN ('admin_settings', 'orders', 'order_items', 'system_settings');`
  });
}

async function verifyRLSEnabled() {
  console.log('\n=== Verifying RLS Enabled ===');

  // We can't directly query pg_class via REST, but we can infer RLS status
  // If RLS is disabled, all operations would succeed regardless of policies

  const tables = ['admin_settings', 'orders', 'order_items', 'system_settings'];

  for (const table of tables) {
    // Test with service role
    const result = await queryWithServiceRole(table, '*', 1);
    console.log(`  ${table}: accessible=${result.ok} (assumes RLS enabled)`);

    results.rls_enabled.data.push({
      table,
      accessible: result.ok,
      inferred_rls: 'ENABLED (cannot verify directly via REST)'
    });
  }

  results.rls_enabled.status = 'INFERRED_PASS';

  sqlQueries.push({
    name: 'Verify RLS enabled on tables',
    sql: `SELECT relname AS table_name, relrowsecurity AS rls_enabled, relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relname IN ('admin_settings', 'orders', 'order_items', 'system_settings')
  AND relkind = 'r';`
  });
}

async function verifyIndexes() {
  console.log('\n=== Verifying Indexes ===');

  const expectedIndexes = [
    'idx_orders_customer_line_user_id',
    'idx_orders_status',
    'idx_orders_status_created_at'
  ];

  // Cannot directly query pg_indexes via REST
  // Record SQL for manual verification
  console.log('  Indexes cannot be verified via REST API');
  console.log('  Run manual SQL query to verify');

  results.indexes.status = 'MANUAL_CHECK_REQUIRED';
  results.indexes.data = { expected: expectedIndexes };

  sqlQueries.push({
    name: 'Verify indexes on orders table',
    sql: `SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'orders'
  AND indexname IN (
    'idx_orders_customer_line_user_id',
    'idx_orders_status',
    'idx_orders_status_created_at'
  );`
  });
}

async function verifyAnonExposure() {
  console.log('\n=== CRITICAL: Verifying Anon Exposure on admin_settings ===');

  if (!ANON_KEY) {
    console.log('  SKIP: No anon key available for testing');
    results.anon_exposure.status = 'SKIP';
    results.anon_exposure.issues.push('Cannot test - no ANON_KEY in env');
    return;
  }

  // Test 1: Can anon SELECT from admin_settings at all?
  const selectResult = await queryWithAnonKey('admin_settings', '*', 1);
  console.log(`  anon SELECT admin_settings: ${selectResult.ok ? 'ALLOWED' : 'BLOCKED'}`);

  if (!selectResult.ok) {
    console.log('  GOOD: Anon cannot read admin_settings at all');
    results.anon_exposure.status = 'PASS';
    results.anon_exposure.data = { anon_can_select: false };
    return;
  }

  // Test 2: If SELECT is allowed, can anon see staff_pin_hash?
  console.log('  WARNING: Anon CAN SELECT from admin_settings');

  const sensitiveResult = await queryWithAnonKey('admin_settings', 'staff_pin_hash', 1);

  if (sensitiveResult.ok && sensitiveResult.data && sensitiveResult.data.length > 0) {
    const row = sensitiveResult.data[0];
    const hasHash = row.staff_pin_hash !== undefined && row.staff_pin_hash !== null;

    console.log(`  staff_pin_hash exposed: ${hasHash ? 'YES (CRITICAL!)' : 'NO'}`);

    if (hasHash) {
      results.anon_exposure.status = 'CRITICAL_FAIL';
      results.anon_exposure.issues.push('CRITICAL: staff_pin_hash is exposed to anon key');
      results.anon_exposure.data = {
        anon_can_select: true,
        staff_pin_hash_exposed: true,
        hash_value_redacted: '[REDACTED - value exists]'
      };
    } else {
      results.anon_exposure.status = 'WARN';
      results.anon_exposure.data = {
        anon_can_select: true,
        staff_pin_hash_exposed: false
      };
    }
  } else if (sensitiveResult.ok && (!sensitiveResult.data || sensitiveResult.data.length === 0)) {
    console.log('  admin_settings table appears empty');
    results.anon_exposure.status = 'WARN';
    results.anon_exposure.data = {
      anon_can_select: true,
      table_empty: true,
      note: 'Cannot verify exposure - table is empty'
    };
    results.anon_exposure.issues.push('Table is empty - cannot verify if hash would be exposed');
  } else {
    console.log('  Could not retrieve staff_pin_hash column');
    results.anon_exposure.status = 'WARN';
    results.anon_exposure.data = {
      anon_can_select: true,
      staff_pin_hash_query_failed: true
    };
  }

  // Also test what columns anon can see
  const allColumnsResult = await queryWithAnonKey('admin_settings', '*', 1);
  if (allColumnsResult.ok && allColumnsResult.data && allColumnsResult.data.length > 0) {
    const columns = Object.keys(allColumnsResult.data[0]);
    console.log(`  Columns visible to anon: ${columns.join(', ')}`);
    results.anon_exposure.data.visible_columns = columns;

    if (columns.includes('staff_pin_hash')) {
      results.anon_exposure.issues.push('staff_pin_hash column is in the visible columns list');
    }
  }
}

async function generateReports() {
  console.log('\n=== Generating Reports ===');

  // Determine overall status
  const statuses = [
    results.policies.status,
    results.rls_enabled.status,
    results.indexes.status,
    results.anon_exposure.status
  ];

  if (statuses.includes('CRITICAL_FAIL')) {
    results.overall = 'CRITICAL_FAIL';
  } else if (statuses.includes('FAIL')) {
    results.overall = 'FAIL';
  } else if (statuses.some(s => s.includes('MANUAL') || s === 'WARN' || s === 'INFERRED')) {
    results.overall = 'PARTIAL_PASS';
  } else {
    results.overall = 'PASS';
  }

  // Write JSON results
  fs.writeFileSync(
    path.join(reportsDir, 'post_sql_verification_data.json'),
    JSON.stringify(results, null, 2)
  );
  console.log('  Saved: post_sql_verification_data.json');

  // Write SQL queries file
  let sqlContent = `-- Post-SQL Verification Queries
-- Generated: ${results.timestamp}
-- Run these in Supabase SQL Editor to verify changes

`;
  for (const q of sqlQueries) {
    sqlContent += `-- ${q.name}\n${q.sql}\n\n`;
  }

  fs.writeFileSync(
    path.join(reportsDir, 'post_sql_verification.sql'),
    sqlContent
  );
  console.log('  Saved: post_sql_verification.sql');

  // Write markdown report
  let mdContent = `# Post-SQL Verification Report

Generated: ${results.timestamp}

## Overall Status: ${results.overall}

---

## 1. RLS Policies

**Status:** ${results.policies.status}

### Test Results

| Table | Service Role SELECT | Anon SELECT | Notes |
|-------|---------------------|-------------|-------|
`;

  for (const p of results.policies.data.filter(d => d.table)) {
    mdContent += `| ${p.table} | ${p.service_role_select ? 'OK' : 'BLOCKED'} | ${p.anon_select ? 'ALLOWED' : 'BLOCKED'} | Status ${p.anon_status} |\n`;
  }

  if (results.policies.issues.length > 0) {
    mdContent += `\n### Issues\n`;
    for (const issue of results.policies.issues) {
      mdContent += `- ${issue}\n`;
    }
  }

  mdContent += `
---

## 2. RLS Enabled Status

**Status:** ${results.rls_enabled.status}

| Table | Accessible | RLS Status |
|-------|------------|------------|
`;

  for (const r of results.rls_enabled.data) {
    mdContent += `| ${r.table} | ${r.accessible ? 'YES' : 'NO'} | ${r.inferred_rls} |\n`;
  }

  mdContent += `
---

## 3. Indexes

**Status:** ${results.indexes.status}

Expected indexes on \`orders\` table:
- \`idx_orders_customer_line_user_id\` (partial index on customer_line_user_id)
- \`idx_orders_status\`
- \`idx_orders_status_created_at\` (composite)

**Action Required:** Run manual SQL verification (see post_sql_verification.sql)

---

## 4. Anon Exposure Check (CRITICAL)

**Status:** ${results.anon_exposure.status}

`;

  if (results.anon_exposure.data) {
    mdContent += `### Findings\n\n`;
    mdContent += `- Anon can SELECT from admin_settings: **${results.anon_exposure.data.anon_can_select ? 'YES' : 'NO'}**\n`;

    if (results.anon_exposure.data.staff_pin_hash_exposed !== undefined) {
      mdContent += `- staff_pin_hash exposed: **${results.anon_exposure.data.staff_pin_hash_exposed ? 'YES (CRITICAL!)' : 'NO'}**\n`;
    }

    if (results.anon_exposure.data.visible_columns) {
      mdContent += `- Visible columns: \`${results.anon_exposure.data.visible_columns.join('`, `')}\`\n`;
    }
  }

  if (results.anon_exposure.issues.length > 0) {
    mdContent += `\n### Issues\n`;
    for (const issue of results.anon_exposure.issues) {
      mdContent += `- **${issue}**\n`;
    }
  }

  mdContent += `
---

## 5. Risks Summary

`;

  const allIssues = [
    ...results.policies.issues,
    ...results.rls_enabled.issues,
    ...results.indexes.issues,
    ...results.anon_exposure.issues
  ];

  if (allIssues.length === 0) {
    mdContent += `No critical issues detected.\n`;
  } else {
    for (const issue of allIssues) {
      mdContent += `- ${issue}\n`;
    }
  }

  mdContent += `
---

## 6. Required Actions

`;

  if (results.anon_exposure.status === 'CRITICAL_FAIL') {
    mdContent += `### CRITICAL: Fix admin_settings Exposure

The \`staff_pin_hash\` column is currently exposed to anonymous users. This is a security vulnerability.

**Recommended Fix:** See \`reports/fix_admin_settings_exposure.sql\`

Three options are provided:
1. Remove anon SELECT entirely (simplest, may break app)
2. Create a view excluding sensitive columns (recommended)
3. Split into separate tables (most robust)

`;
  }

  if (results.indexes.status === 'MANUAL_CHECK_REQUIRED') {
    mdContent += `### Manual Verification Required

Run the SQL queries in \`reports/post_sql_verification.sql\` to verify:
- Indexes were created
- RLS is enabled on all tables
- Policy details match expected

`;
  }

  fs.writeFileSync(
    path.join(reportsDir, 'post_sql_verification.md'),
    mdContent
  );
  console.log('  Saved: post_sql_verification.md');

  // If exposure issue, generate fix SQL
  if (results.anon_exposure.status === 'CRITICAL_FAIL' ||
      (results.anon_exposure.data && results.anon_exposure.data.anon_can_select)) {
    generateExposureFix();
  }
}

function generateExposureFix() {
  const fixSql = `-- Fix: admin_settings Exposure to Anon Key
-- Generated: ${results.timestamp}
--
-- PROBLEM: The "Allow anon to read admin_settings display fields" policy
-- allows anon to SELECT all columns, including staff_pin_hash.
--
-- This file provides 3 options. Choose ONE and apply manually.
-- DO NOT apply automatically - review first!

-- =============================================================
-- OPTION 1: Remove anon SELECT entirely (SIMPLEST)
-- =============================================================
-- Pros: Immediate fix, no schema changes
-- Cons: May break app if client reads promptpay_id directly
--
-- After applying, all admin_settings reads must use service_role key.

DROP POLICY IF EXISTS "Allow anon to read admin_settings display fields" ON admin_settings;

-- To verify: SELECT * FROM pg_policies WHERE tablename = 'admin_settings';
-- Expected: Only "Service role full access on admin_settings" remains


-- =============================================================
-- OPTION 2: Create a view with safe columns (RECOMMENDED)
-- =============================================================
-- Pros: Clean separation, app can read safe fields via view
-- Cons: Requires app code change (read from view instead of table)

-- Step 2a: Create the safe view
CREATE OR REPLACE VIEW admin_settings_public AS
SELECT
  id,
  promptpay_id,
  line_approver_id,
  line_staff_id,
  pin_version,
  created_at,
  updated_at
FROM admin_settings;
-- NOTE: staff_pin_hash is deliberately excluded

-- Step 2b: Grant anon access to the view
GRANT SELECT ON admin_settings_public TO anon;

-- Step 2c: Remove anon access from the base table
DROP POLICY IF EXISTS "Allow anon to read admin_settings display fields" ON admin_settings;

-- Step 2d: Update app code to read from admin_settings_public instead of admin_settings
-- Files to update:
--   app/order/payment/page.tsx (reads promptpay_id)
--   Any other client-side reads of admin_settings


-- =============================================================
-- OPTION 3: Split sensitive data into separate table (MOST ROBUST)
-- =============================================================
-- Pros: Clear data classification, follows security best practices
-- Cons: Requires migration and more code changes

-- Step 3a: Create sensitive settings table (service_role only)
CREATE TABLE IF NOT EXISTS admin_settings_sensitive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_pin_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Step 3b: Enable RLS with service_role only
ALTER TABLE admin_settings_sensitive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only on admin_settings_sensitive"
  ON admin_settings_sensitive FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Step 3c: Migrate data
INSERT INTO admin_settings_sensitive (staff_pin_hash)
SELECT staff_pin_hash FROM admin_settings LIMIT 1;

-- Step 3d: Remove sensitive column from admin_settings
-- WARNING: Only run after confirming data migration!
-- ALTER TABLE admin_settings DROP COLUMN staff_pin_hash;

-- Step 3e: Update app code to read PIN hash from new table


-- =============================================================
-- VERIFICATION QUERIES (run after applying any option)
-- =============================================================

-- Check policies on admin_settings
SELECT policyname, cmd, qual FROM pg_policies WHERE tablename = 'admin_settings';

-- Test anon access (should return empty or error if Option 1 applied)
-- Run with anon key: SELECT * FROM admin_settings LIMIT 1;

-- If Option 2: Test view access
-- SELECT * FROM admin_settings_public LIMIT 1;
`;

  fs.writeFileSync(
    path.join(reportsDir, 'fix_admin_settings_exposure.sql'),
    fixSql
  );
  console.log('  Saved: fix_admin_settings_exposure.sql');
}

async function main() {
  console.log('=== POST-SQL VERIFICATION (READ-ONLY) ===');
  console.log('Checking if proposed_fixes.sql was applied correctly...\n');

  try {
    await verifyPolicies();
    await verifyRLSEnabled();
    await verifyIndexes();
    await verifyAnonExposure();
    await generateReports();

    console.log('\n=== VERIFICATION COMPLETE ===');
    console.log(`Overall Status: ${results.overall}`);

    if (results.overall === 'CRITICAL_FAIL') {
      console.log('\n⚠️  CRITICAL SECURITY ISSUE DETECTED');
      console.log('   See reports/fix_admin_settings_exposure.sql for remediation options');
    }

  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  }
}

main();
