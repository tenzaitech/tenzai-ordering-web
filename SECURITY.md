# Security Notes

## Known Vulnerabilities

### xlsx (SheetJS) v0.18.5 - Accepted Risk with Mitigations

**Status:** No fix available from maintainer
**Severity:** High
**Advisories:**
- GHSA-4r6h-8v6p-xvw6 (Prototype Pollution)
- GHSA-5pgg-2g8v-p4x9 (ReDoS)

**Usage Context:**
- Admin-only functionality (`/admin/menu-data`)
- Only authenticated administrators can upload files
- Used for menu data import/export from Excel files

**Current Exposure:**
- Server-side only (Node.js runtime)
- NOT bundled in client JavaScript
- Isolated to two API routes: `/api/admin/parse-xlsx`, `/api/admin/export-menu`

**Risk Assessment:**
- **Likelihood:** Low - requires malicious file upload by trusted admin
- **Impact:** Medium - potential prototype pollution or DoS on server
- **Decision:** Accepted risk for admin-only, server-isolated context

**Implemented Mitigations:**
1. **Server-side isolation:** xlsx parsing moved from client to server-only routes
   - Eliminates client-side attack surface
   - Vulnerabilities contained to Node.js runtime (easier to monitor/restart)
2. **Admin auth required:** All xlsx endpoints protected by `checkAdminAuth()`
3. **File size limit:** 5MB max on upload (`/api/admin/parse-xlsx`)
4. **MIME type validation:** Only accepts xlsx MIME types
5. **No client bundle exposure:** xlsx is NOT in client JavaScript bundle

**Acceptance Rationale:**
- No fix available from SheetJS maintainer
- Alternative libraries (exceljs) have similar or other issues
- Server-side isolation significantly reduces attack surface
- Admin-only access limits exposure to trusted personnel

**Last Reviewed:** 2026-01-11
