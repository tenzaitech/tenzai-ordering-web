/**
 * Signed Upload URL API
 *
 * Generates a signed URL for direct upload to Supabase Storage.
 * This bypasses Next.js API routes entirely, avoiding the 10MB limit.
 *
 * Flow:
 * 1. Client requests signed URL with menu_code
 * 2. Server validates admin auth, generates signed URL
 * 3. Client uploads directly to Supabase Storage
 * 4. Client calls apply-from-storage with the storage path
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAdminAuth } from '@/lib/admin-gate'
import { validateCsrf, csrfError } from '@/lib/csrf'

export const runtime = 'nodejs'

const BUCKET_NAME = 'menu-images'
const MAX_MENU_IMAGE_SIZE_MB = 10
const ALLOWED_EXTENSIONS = ['webp', 'jpg', 'jpeg', 'png']

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
  }
  if (!supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

interface UploadUrlRequest {
  menu_code: string
  /** Optional: file extension (default: webp) */
  extension?: string
}

interface UploadUrlResponse {
  signed_url: string
  storage_path: string
  /** Expiry time in seconds */
  expires_in: number
}

/**
 * POST /api/admin/storage-upload-url
 *
 * Request a signed upload URL for direct-to-storage upload.
 *
 * Input JSON:
 * - menu_code: string (required)
 * - extension: string (optional, default: 'webp')
 *
 * Output JSON:
 * - signed_url: URL for PUT upload
 * - storage_path: Path in bucket
 * - expires_in: Seconds until URL expires
 */
export async function POST(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  if (!validateCsrf(request)) {
    return csrfError()
  }

  try {
    const body: UploadUrlRequest = await request.json()

    if (!body.menu_code || typeof body.menu_code !== 'string') {
      return NextResponse.json(
        { error: 'menu_code is required' },
        { status: 400 }
      )
    }

    const menuCode = body.menu_code.trim()
    const extension = (body.extension || 'webp').toLowerCase()

    // Validate extension
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}` },
        { status: 400 }
      )
    }

    // Generate unique upload path
    // Format: menu/{menu_code}/uploads/{upload_id}.{ext}
    const uploadId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    const storagePath = `menu/${menuCode}/uploads/${uploadId}.${extension}`

    const supabase = getSupabaseServerClient()

    // Generate signed URL for upload (valid for 10 minutes)
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(storagePath)

    if (error || !data) {
      console.error('[STORAGE_UPLOAD_URL] Failed to create signed URL:', error)
      return NextResponse.json(
        { error: `Failed to create upload URL: ${error?.message || 'Unknown error'}` },
        { status: 500 }
      )
    }

    const response: UploadUrlResponse = {
      signed_url: data.signedUrl,
      storage_path: storagePath,
      expires_in: 600 // 10 minutes
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('[STORAGE_UPLOAD_URL] Unexpected error:', error)
    const message = error instanceof Error ? error.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
