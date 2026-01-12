/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['next/core-web-vitals'],
  ignorePatterns: ['.next/', 'out/', 'node_modules/', '*.config.js', '*.config.cjs'],
}
