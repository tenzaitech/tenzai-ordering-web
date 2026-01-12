/**
 * Unified Menu Image API
 *
 * This is the SINGLE API for uploading menu images with crop/trim support.
 * Used by both admin/menu and image-import tools.
 *
 * POST: Upload and process a new image for a menu item
 * DELETE: Remove all images for a menu item
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
  type NormalizedCropBox
} from '@/lib/server/image-pipeline'

// Force Node.js runtime (NOT edge) for sharp compatibility
export const runtime = 'nodejs'

const BUCKET_NAME = 'menu-images'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

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

/**
 * POST /api/admin/menu-image
 *
 * Upload and process a menu image with optional crop settings.
 *
 * FormData:
 * - file: Image file (required)
 * - menu_code: Menu code to associate with (required)
 * - manual_crop_4x3: JSON string of NormalizedCropBox (optional)
 * - manual_crop_1x1: JSON string of NormalizedCropBox (optional)
 *
 * If manual_crop_* is provided, uses manual crop mode.
 * Otherwise, uses auto mode (smart trim + center crop).
 *
 * Response:
 * - image_url: Public URL of 4:3 derivative (canonical)
 * - image_url_1x1: Public URL of 1:1 derivative
 * - storage_paths: { orig, d1x1, d4x3 }
 */
export async function POST(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  if (!validateCsrf(request)) {
    return csrfError()
  }

  try {
    const supabase = getSupabaseServerClient()
    const formData = await request.formData()

    // Get required fields
    const file = formData.get('file') as File | null
    const menuCode = formData.get('menu_code') as string | null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }

    if (!menuCode || !menuCode.trim()) {
      return NextResponse.json({ error: 'menu_code is required' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })
    }

    // Parse optional crop settings
    let manualCrop4x3: NormalizedCropBox | undefined
    let manualCrop1x1: NormalizedCropBox | undefined

    const crop4x3Raw = formData.get('manual_crop_4x3') as string | null
    const crop1x1Raw = formData.get('manual_crop_1x1') as string | null

    if (crop4x3Raw) {
      try {
        manualCrop4x3 = JSON.parse(crop4x3Raw)
      } catch {
        return NextResponse.json({ error: 'Invalid manual_crop_4x3 JSON' }, { status: 400 })
      }
    }

    if (crop1x1Raw) {
      try {
        manualCrop1x1 = JSON.parse(crop1x1Raw)
      } catch {
        return NextResponse.json({ error: 'Invalid manual_crop_1x1 JSON' }, { status: 400 })
      }
    }

    // Verify menu exists
    const { data: menuData, error: menuError } = await supabase
      .from('menu_items')
      .select('menu_code, image_url')
      .eq('menu_code', menuCode.trim())
      .single()

    if (menuError || !menuData) {
      return NextResponse.json({ error: `Menu not found: ${menuCode}` }, { status: 404 })
    }

    const oldImageUrl = menuData.image_url

    // Generate storage paths
    const version = Date.now()
    const paths = getStoragePaths(menuCode.trim(), version)

    // Read file content
    const arrayBuffer = await file.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    // Create original webp (rotated, high quality)
    let origBuffer: Buffer
    try {
      origBuffer = await sharp(inputBuffer)
        .rotate()
        .webp({ quality: 90 })
        .toBuffer()
    } catch (sharpErr) {
      console.error('[MENU_IMAGE] Sharp orig processing error:', sharpErr)
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

    try {
      const result1x1 = await generateDerivative(origBuffer, {
        width: DERIVATIVES['1x1'].width,
        height: DERIVATIVES['1x1'].height,
        aspect: DERIVATIVES['1x1'].aspect,
        cropMode: cropMode1x1,
        manualCrop: manualCrop1x1
      })
      buffer1x1 = result1x1.buffer

      const result4x3 = await generateDerivative(origBuffer, {
        width: DERIVATIVES['4x3'].width,
        height: DERIVATIVES['4x3'].height,
        aspect: DERIVATIVES['4x3'].aspect,
        cropMode: cropMode4x3,
        manualCrop: manualCrop4x3
      })
      buffer4x3 = result4x3.buffer
    } catch (sharpErr) {
      console.error('[MENU_IMAGE] Sharp derivative processing error:', sharpErr)
      return NextResponse.json({
        error: `Derivative processing failed: ${sharpErr instanceof Error ? sharpErr.message : 'Unknown error'}`
      }, { status: 500 })
    }

    // Upload all files (orig + derivatives)
    const { error: uploadOrigError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(paths.orig, origBuffer, {
        contentType: 'image/webp',
        upsert: true
      })

    if (uploadOrigError) {
      console.error('[MENU_IMAGE] Upload orig error:', uploadOrigError)
      return NextResponse.json({ error: `Upload failed: ${uploadOrigError.message}` }, { status: 500 })
    }

    const { error: upload1x1Error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(paths.d1x1, buffer1x1, {
        contentType: 'image/webp',
        upsert: true
      })

    if (upload1x1Error) {
      console.error('[MENU_IMAGE] Upload 1x1 error:', upload1x1Error)
      return NextResponse.json({ error: `Upload 1x1 failed: ${upload1x1Error.message}` }, { status: 500 })
    }

    const { error: upload4x3Error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(paths.d4x3, buffer4x3, {
        contentType: 'image/webp',
        upsert: true
      })

    if (upload4x3Error) {
      console.error('[MENU_IMAGE] Upload 4x3 error:', upload4x3Error)
      return NextResponse.json({ error: `Upload 4x3 failed: ${upload4x3Error.message}` }, { status: 500 })
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
      .eq('menu_code', menuCode.trim())

    if (updateError) {
      console.error('[MENU_IMAGE] DB update error:', updateError)
      return NextResponse.json({ error: `DB update failed: ${updateError.message}` }, { status: 500 })
    }

    // Delete old derivative files (safe deletion after success)
    let deletedCount = 0
    const folder = getMenuImageFolder(menuCode.trim())
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
          deletedCount = oldDerivatives.length
        }
      }
    }

    // Structured log
    console.log(formatImageOpLog({
      operation: 'upload',
      menu_code: menuCode.trim(),
      old_url: oldImageUrl,
      new_url: publicUrl4x3,
      deleted_count: deletedCount,
      mode: cropMode4x3,
      success: true
    }))

    return NextResponse.json({
      success: true,
      image_url: publicUrl4x3,
      image_url_1x1: publicUrl1x1,
      storage_paths: paths
    })

  } catch (error) {
    console.error('[MENU_IMAGE] Unexpected error:', error)
    const message = error instanceof Error ? error.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/menu-image
 *
 * Remove all images for a menu item.
 *
 * Body:
 * - menu_code: Menu code to remove images for (required)
 */
export async function DELETE(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  if (!validateCsrf(request)) {
    return csrfError()
  }

  try {
    const supabase = getSupabaseServerClient()
    const body = await request.json()

    const menuCode = body.menu_code as string | null

    if (!menuCode || !menuCode.trim()) {
      return NextResponse.json({ error: 'menu_code is required' }, { status: 400 })
    }

    // Get current image URL
    const { data: menuData } = await supabase
      .from('menu_items')
      .select('image_url')
      .eq('menu_code', menuCode.trim())
      .single()

    const oldImageUrl = menuData?.image_url

    // List and delete all files in the menu's folder
    const folder = getMenuImageFolder(menuCode.trim())
    const { data: existingFiles } = await supabase.storage
      .from(BUCKET_NAME)
      .list(folder)

    let deletedCount = 0
    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map(f => `${folder}/${f.name}`)
      const { error: deleteError } = await supabase.storage
        .from(BUCKET_NAME)
        .remove(filesToDelete)

      if (!deleteError) {
        deletedCount = filesToDelete.length
      }
    }

    // Update menu_items to clear image_url
    await supabase
      .from('menu_items')
      .update({ image_url: null })
      .eq('menu_code', menuCode.trim())

    // Structured log
    console.log(formatImageOpLog({
      operation: 'delete',
      menu_code: menuCode.trim(),
      old_url: oldImageUrl,
      deleted_count: deletedCount,
      success: true
    }))

    return NextResponse.json({
      success: true,
      deleted_count: deletedCount
    })

  } catch (error) {
    console.error('[MENU_IMAGE] Delete error:', error)
    const message = error instanceof Error ? error.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
