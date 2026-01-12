/**
 * Apply Image from Storage API
 *
 * JSON-only endpoint that processes images already uploaded to Storage.
 * This replaces FormData-based uploads to bypass the 10MB API limit.
 *
 * Flow:
 * 1. Client uploads image directly to Storage via signed URL
 * 2. Client calls this endpoint with storage path + crop settings
 * 3. Server downloads from Storage, processes with sharp, uploads derivatives
 * 4. Server updates DB and cleans up old/temp files
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAdminAuth } from '@/lib/admin-gate'
import { validateCsrf, csrfError } from '@/lib/csrf'
import {
  sharp,
  DERIVATIVES,
  generateDerivative,
  getStoragePaths,
  getMenuImageFolder,
  isDerivativeFile,
  formatImageOpLog,
  type NormalizedCropBox,
  type TrimResult
} from '@/lib/server/image-pipeline'

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

interface ApplyFromStorageRequest {
  /** Menu code to apply image for */
  menu_code: string
  /** Path to uploaded image in Storage */
  storage_path: string
  /** Crop mode: 'auto' or 'manual' */
  mode?: 'auto' | 'manual'
  /** Manual crop for 4:3 (optional) */
  manual_crop_4x3?: NormalizedCropBox
  /** Manual crop for 1:1 (optional) */
  manual_crop_1x1?: NormalizedCropBox
}

interface ApplyFromStorageResponse {
  success: boolean
  menu_code: string
  image_url?: string
  image_url_1x1?: string
  storage_paths?: {
    orig: string
    d1x1: string
    d4x3: string
  }
  trim_applied?: TrimResult
  deleted_files?: string[]
  error?: string
}

/**
 * POST /api/admin/menu-image/apply-from-storage
 *
 * Process an image that was uploaded directly to Storage.
 *
 * Input JSON:
 * - menu_code: string (required)
 * - storage_path: string (required) - path to uploaded file in bucket
 * - mode: 'auto' | 'manual' (optional, default: 'auto')
 * - manual_crop_4x3: NormalizedCropBox (optional)
 * - manual_crop_1x1: NormalizedCropBox (optional)
 *
 * Output JSON:
 * - success: boolean
 * - menu_code: string
 * - image_url: string (4:3 derivative public URL)
 * - image_url_1x1: string (1:1 derivative public URL)
 * - storage_paths: { orig, d1x1, d4x3 }
 * - trim_applied: TrimResult (if trim occurred)
 * - deleted_files: string[] (old derivatives deleted)
 */
export async function POST(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  if (!validateCsrf(request)) {
    return csrfError()
  }

  try {
    const body: ApplyFromStorageRequest = await request.json()

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
    const mode = body.mode || 'auto'
    const manualCrop4x3 = body.manual_crop_4x3
    const manualCrop1x1 = body.manual_crop_1x1

    const supabase = getSupabaseServerClient()

    // Verify menu exists
    const { data: menuData, error: menuError } = await supabase
      .from('menu_items')
      .select('menu_code, image_url')
      .eq('menu_code', menuCode)
      .single()

    if (menuError || !menuData) {
      return NextResponse.json(
        { error: `Menu not found: ${menuCode}` },
        { status: 404 }
      )
    }

    const oldImageUrl = menuData.image_url

    // Download uploaded image from Storage
    const { data: uploadedData, error: downloadError } = await supabase.storage
      .from(BUCKET_NAME)
      .download(storagePath)

    if (downloadError || !uploadedData) {
      console.error('[APPLY_FROM_STORAGE] Download error:', downloadError)
      return NextResponse.json(
        { error: `Failed to download uploaded image: ${downloadError?.message || 'File not found'}` },
        { status: 404 }
      )
    }

    // Convert Blob to Buffer
    const inputBuffer = Buffer.from(await uploadedData.arrayBuffer())

    // Create original webp (rotated, high quality)
    let origBuffer: Buffer
    try {
      origBuffer = await sharp(inputBuffer)
        .rotate()
        .webp({ quality: 90 })
        .toBuffer()
    } catch (sharpErr) {
      console.error('[APPLY_FROM_STORAGE] Sharp orig processing error:', sharpErr)
      return NextResponse.json({
        error: `Image processing failed: ${sharpErr instanceof Error ? sharpErr.message : 'Unknown error'}`
      }, { status: 500 })
    }

    // Determine crop modes
    const cropMode1x1: 'auto' | 'manual' = manualCrop1x1 ? 'manual' : 'auto'
    const cropMode4x3: 'auto' | 'manual' = manualCrop4x3 ? 'manual' : 'auto'

    // Generate derivatives
    let buffer1x1: Buffer
    let buffer4x3: Buffer
    let trim1x1: TrimResult
    let trim4x3: TrimResult

    try {
      const result1x1 = await generateDerivative(origBuffer, {
        width: DERIVATIVES['1x1'].width,
        height: DERIVATIVES['1x1'].height,
        aspect: DERIVATIVES['1x1'].aspect,
        cropMode: cropMode1x1,
        manualCrop: manualCrop1x1
      })
      buffer1x1 = result1x1.buffer
      trim1x1 = result1x1.trim

      const result4x3 = await generateDerivative(origBuffer, {
        width: DERIVATIVES['4x3'].width,
        height: DERIVATIVES['4x3'].height,
        aspect: DERIVATIVES['4x3'].aspect,
        cropMode: cropMode4x3,
        manualCrop: manualCrop4x3
      })
      buffer4x3 = result4x3.buffer
      trim4x3 = result4x3.trim
    } catch (sharpErr) {
      console.error('[APPLY_FROM_STORAGE] Sharp derivative processing error:', sharpErr)
      return NextResponse.json({
        error: `Derivative processing failed: ${sharpErr instanceof Error ? sharpErr.message : 'Unknown error'}`
      }, { status: 500 })
    }

    // Generate storage paths
    const version = Date.now()
    const paths = getStoragePaths(menuCode, version)

    // Upload original (upsert)
    const { error: uploadOrigError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(paths.orig, origBuffer, {
        contentType: 'image/webp',
        upsert: true
      })

    if (uploadOrigError) {
      console.error('[APPLY_FROM_STORAGE] Upload orig error:', uploadOrigError)
      return NextResponse.json(
        { error: `Upload original failed: ${uploadOrigError.message}` },
        { status: 500 }
      )
    }

    // Upload 1:1 derivative
    const { error: upload1x1Error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(paths.d1x1, buffer1x1, {
        contentType: 'image/webp',
        upsert: true
      })

    if (upload1x1Error) {
      console.error('[APPLY_FROM_STORAGE] Upload 1x1 error:', upload1x1Error)
      return NextResponse.json(
        { error: `Upload 1x1 failed: ${upload1x1Error.message}` },
        { status: 500 }
      )
    }

    // Upload 4:3 derivative
    const { error: upload4x3Error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(paths.d4x3, buffer4x3, {
        contentType: 'image/webp',
        upsert: true
      })

    if (upload4x3Error) {
      console.error('[APPLY_FROM_STORAGE] Upload 4x3 error:', upload4x3Error)
      return NextResponse.json(
        { error: `Upload 4x3 failed: ${upload4x3Error.message}` },
        { status: 500 }
      )
    }

    // Get public URLs
    const { data: publicUrl1x1Data } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(paths.d1x1)

    const { data: publicUrl4x3Data } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(paths.d4x3)

    const publicUrl1x1 = publicUrl1x1Data.publicUrl
    const publicUrl4x3 = publicUrl4x3Data.publicUrl

    // Update menu_items
    const { error: updateError } = await supabase
      .from('menu_items')
      .update({ image_url: publicUrl4x3 })
      .eq('menu_code', menuCode)

    if (updateError) {
      console.error('[APPLY_FROM_STORAGE] DB update error:', updateError)
      return NextResponse.json(
        { error: `DB update failed: ${updateError.message}` },
        { status: 500 }
      )
    }

    // Safe deletion: delete old derivatives and temp upload AFTER success
    let deletedFiles: string[] = []
    const folder = getMenuImageFolder(menuCode)
    const { data: existingFiles } = await supabase.storage
      .from(BUCKET_NAME)
      .list(folder)

    if (existingFiles && existingFiles.length > 0) {
      const newFilenames = [
        paths.d1x1.split('/').pop(),
        paths.d4x3.split('/').pop()
      ]
      const oldDerivatives = existingFiles
        .filter(f => isDerivativeFile(f.name) && !newFilenames.includes(f.name))
        .map(f => `${folder}/${f.name}`)

      if (oldDerivatives.length > 0) {
        const { error: deleteError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove(oldDerivatives)

        if (!deleteError) {
          deletedFiles = oldDerivatives
        }
      }
    }

    // Delete temp upload file (if different from orig.webp)
    if (storagePath !== paths.orig && !storagePath.endsWith('/orig.webp')) {
      const { error: deleteTempError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([storagePath])

      if (!deleteTempError) {
        deletedFiles.push(storagePath)
      }
    }

    // Structured log
    console.log(formatImageOpLog({
      operation: 'upload',
      menu_code: menuCode,
      old_url: oldImageUrl,
      new_url: publicUrl4x3,
      deleted_count: deletedFiles.length,
      mode: cropMode4x3,
      success: true
    }))

    const response: ApplyFromStorageResponse = {
      success: true,
      menu_code: menuCode,
      image_url: publicUrl4x3,
      image_url_1x1: publicUrl1x1,
      storage_paths: paths,
      trim_applied: trim1x1.didTrim || trim4x3.didTrim ? trim1x1 : undefined,
      deleted_files: deletedFiles.length > 0 ? deletedFiles : undefined
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('[APPLY_FROM_STORAGE] Unexpected error:', error)
    const message = error instanceof Error ? error.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
