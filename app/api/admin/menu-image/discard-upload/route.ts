/**
 * Discard Upload API
 *
 * Deletes a temporary upload file from Storage.
 * Called when user discards an image before applying.
 *
 * Safety:
 * - Only allows deletion within menu/{menu_code}/uploads/
 * - Never touches orig.webp or derivatives
 * - Idempotent: returns success even if file doesn't exist
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAdminAuth } from '@/lib/admin-gate'
import { formatImageOpLog } from '@/lib/image-types'

export const runtime = 'nodejs'

const BUCKET_NAME = 'menu-images'

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

interface DiscardUploadRequest {
  menu_code: string
  storage_path: string
}

/**
 * POST /api/admin/menu-image/discard-upload
 *
 * Delete a temporary upload file from Storage.
 *
 * Input JSON:
 * - menu_code: string (required)
 * - storage_path: string (required) - must be inside menu/{menu_code}/uploads/
 *
 * Output JSON:
 * - success: boolean
 * - deleted: boolean (true if file existed and was deleted)
 */
export async function POST(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  try {
    const body: DiscardUploadRequest = await request.json()

    // Validate required fields
    if (!body.menu_code || typeof body.menu_code !== 'string') {
      return NextResponse.json(
        { error: 'menu_code is required' },
        { status: 400 }
      )
    }

    if (!body.storage_path || typeof body.storage_path !== 'string') {
      return NextResponse.json(
        { error: 'storage_path is required' },
        { status: 400 }
      )
    }

    const menuCode = body.menu_code.trim()
    const storagePath = body.storage_path

    // SAFETY: Validate storage_path is inside menu/{menu_code}/uploads/
    const expectedPrefix = `menu/${menuCode}/uploads/`
    if (!storagePath.startsWith(expectedPrefix)) {
      console.warn(`[DISCARD_UPLOAD] Rejected: path "${storagePath}" not inside "${expectedPrefix}"`)
      return NextResponse.json(
        { error: 'Invalid storage_path: must be inside uploads/ folder' },
        { status: 400 }
      )
    }

    // Additional safety: prevent directory traversal
    if (storagePath.includes('..') || storagePath.includes('//')) {
      console.warn(`[DISCARD_UPLOAD] Rejected: suspicious path "${storagePath}"`)
      return NextResponse.json(
        { error: 'Invalid storage_path: contains invalid characters' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseServerClient()

    // Attempt to delete the file
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath])

    // Supabase doesn't error if file doesn't exist, so we consider it success
    const deleted = !deleteError

    // Structured log
    console.log(formatImageOpLog({
      operation: 'delete',
      menu_code: menuCode,
      old_url: storagePath,
      deleted_count: deleted ? 1 : 0,
      success: true
    }))

    // Also log the specific discard action
    console.log(`[IMAGE_OP] ${JSON.stringify({
      action: 'discard_cleanup',
      menu_code: menuCode,
      storage_path: storagePath,
      deleted
    })}`)

    return NextResponse.json({
      success: true,
      deleted
    })

  } catch (error) {
    console.error('[DISCARD_UPLOAD] Unexpected error:', error)
    const message = error instanceof Error ? error.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
