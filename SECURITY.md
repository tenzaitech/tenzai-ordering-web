# Security Notes

## Known Vulnerabilities

### xlsx (SheetJS) - Accepted Risk

**Status:** No fix available from maintainer
**Severity:** High
**Advisories:**
- GHSA-4r6h-8v6p-xvw6 (Prototype Pollution)
- GHSA-5pgg-2g8v-p4x9 (ReDoS)

**Usage Context:**
- Admin-only functionality (`/admin/menu-data`)
- Only authenticated administrators can upload files
- Used for menu data import/export from Excel files

**Risk Assessment:**
- **Likelihood:** Low - requires malicious file upload by trusted admin
- **Impact:** Medium - potential prototype pollution or DoS
- **Decision:** Accepted risk for admin-only context

**Mitigation:**
- Restrict admin access to trusted personnel only
- Monitor for upstream fix from SheetJS maintainers
- Consider replacing with `exceljs` if vulnerability is exploited in the wild

**Last Reviewed:** 2026-01-11
