#!/usr/bin/env node
/**
 * CI guard: Ensure xlsx is never imported in client-facing code.
 * xlsx has known vulnerabilities and must remain server-only.
 */
const fs = require('fs');
const path = require('path');

// Patterns that indicate xlsx import
const XLSX_PATTERNS = [
  /from\s+['"]xlsx['"]/,
  /require\s*\(\s*['"]xlsx['"]\s*\)/,
  /import\s*\(\s*['"]xlsx['"]\s*\)/
];

// Walk directory recursively
function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    const filePath = path.join(dir, f);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      // Skip node_modules and .next
      if (f !== 'node_modules' && f !== '.next') {
        walkDir(filePath, callback);
      }
    } else {
      callback(filePath);
    }
  });
}

// Check if file is client-facing (pages, layouts, components - not API routes)
function isClientFile(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  // Must be .tsx or .ts file
  if (!normalized.endsWith('.tsx') && !normalized.endsWith('.ts')) return false;
  // Exclude API routes (server-side)
  if (normalized.includes('/api/')) return false;
  // Include app pages, layouts, components
  if (normalized.includes('/app/') && (normalized.includes('page.') || normalized.includes('layout.'))) return true;
  if (normalized.includes('/components/')) return true;
  return false;
}

let found = false;
const violations = [];

walkDir('app', (filePath) => {
  if (!isClientFile(filePath)) return;
  
  const content = fs.readFileSync(filePath, 'utf8');
  for (const pattern of XLSX_PATTERNS) {
    if (pattern.test(content)) {
      violations.push(filePath);
      found = true;
      break;
    }
  }
});

walkDir('components', (filePath) => {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  
  const content = fs.readFileSync(filePath, 'utf8');
  for (const pattern of XLSX_PATTERNS) {
    if (pattern.test(content)) {
      violations.push(filePath);
      found = true;
      break;
    }
  }
});

if (found) {
  console.error('ERROR: xlsx import found in client code:');
  violations.forEach(v => console.error('  ' + v));
  console.error('\nxlsx must remain server-only. Move usage to API routes.');
  process.exit(1);
} else {
  console.log('check:no-xlsx-client OK - no xlsx imports in client code');
  process.exit(0);
}
