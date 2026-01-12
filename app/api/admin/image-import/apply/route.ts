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
  type TrimResult,
  type NormalizedCropBox
} from '@/lib/server/image-pipeline'

// Force Node.js runtime (NOT edge) for sharp compatibility
export const runtime = 'nodejs'

const BUCKET_NAME = 'menu-images'

interface ApplyResult {
  filename: string
  menu_code: string
  raw_menu_code?: string
  storage_path_orig?: string
  storage_path_1x1?: string
  storage_path_4x3?: string
  status: 'updated' | 'skipped' | 'failed'
  reason?: string
  image_url?: string       // Always the 4:3 URL (canonical)
  image_url_1x1?: string
  trim_applied?: TrimResult
  /** Files deleted from storage (old versions) */
  deleted_files?: string[]
}

/**
 * CRITICAL: Sanitize menu_code from client
 */
function sanitizeMenuCode(rawMenuCode: string): string | null {
  if (!rawMenuCode || typeof rawMenuCode !== 'string') {
    return null
  }
  const firstSegment = rawMenuCode.split(':')[0]
  const sanitized = firstSegment.trim()
  if (!sanitized) {
    return null
  }
  return sanitized
}

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

export async function POST(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  if (!validateCsrf(request)) {
    return csrfError()
  }

  try {
    const supabase = getSupabaseServerClient()
    const formData = await request.formData()

    // Parse confirmed mappings: JSON string of { [filename]: menu_code }
    const mappingsRaw = formData.get('mappings')
    if (!mappingsRaw || typeof mappingsRaw !== 'string') {
      return NextResponse.json(
        { error: 'mappings field is required (JSON string)' },
        { status: 400 }
      )
    }

    let mappings: Record<string, string>
    try {
      mappings = JSON.parse(mappingsRaw)
    } catch {
      return NextResponse.json(
        { error: 'Invalid mappings JSON' },
        { status: 400 }
      )
    }

    // Parse crop settings: JSON string of { [filename]: { manualCrop1x1?, manualCrop4x3? } }
    // If manualCrop is undefined/null, use auto mode (smart trim + center crop)
    // If manualCrop is set, use that exact crop region
    const cropSettingsRaw = formData.get('crop_settings')
    let cropSettings: Record<string, {
      manualCrop1x1?: NormalizedCropBox
      manualCrop4x3?: NormalizedCropBox
    }> = {}
    if (cropSettingsRaw && typeof cropSettingsRaw === 'string') {
      try {
        cropSettings = JSON.parse(cropSettingsRaw)
      } catch {
        console.warn('[IMAGE_IMPORT_APPLY] Invalid crop_settings JSON, will use auto')
      }
    }

    // Get all file entries
    const files: File[] = []
    for (const [key, value] of Array.from(formData.entries())) {
      if (key.startsWith('file_') && value instanceof File) {
        files.push(value)
      }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    const results: ApplyResult[] = []

    for (const file of files) {
      const filename = file.name
      const rawMenuCode = mappings[filename]

      // Skip if no mapping for this file
      if (!rawMenuCode) {
        results.push({
          filename,
          menu_code: '',
          status: 'skipped',
          reason: 'No mapping provided for this file'
        })
        continue
      }

      // CRITICAL: Sanitize menu_code
      const menuCode = sanitizeMenuCode(rawMenuCode)

      if (!menuCode) {
        results.push({
          filename,
          menu_code: '',
          raw_menu_code: rawMenuCode,
          status: 'failed',
          reason: `Invalid menu_code after sanitization: "${rawMenuCode}"`
        })
        continue
      }

      // Track old URL for structured logging
      let oldImageUrl: string | null = null

      try {
        // HARD VALIDATION: Verify menu_code exists BEFORE any upload
        const { data: menuData, error: menuError } = await supabase
          .from('menu_items')
          .select('menu_code, image_url')
          .eq('menu_code', menuCode)
          .single()

        if (menuError || !menuData) {
          results.push({
            filename,
            menu_code: menuCode,
            raw_menu_code: rawMenuCode !== menuCode ? rawMenuCode : undefined,
            status: 'failed',
            reason: `Menu not found: ${menuCode}`
          })
          continue
        }

        oldImageUrl = menuData.image_url

        // =======================================================================
        // MENU_CODE-BASED STORAGE PATHS (Unicode-safe)
        // Format: menu/{menu_code}/orig.webp, menu/{menu_code}/4x3_v{timestamp}.webp
        // This avoids Thai/Unicode issues - menu_code is guaranteed ASCII
        // =======================================================================
        const version = Date.now()
        const paths = getStoragePaths(menuCode, version)

        // Read file content
        const arrayBuffer = await file.arrayBuffer()
        const inputBuffer = Buffer.from(arrayBuffer)

        // 1) Create original webp (rotated, high quality, no resize)
        let origBuffer: Buffer
        try {
          origBuffer = await sharp(inputBuffer)
            .rotate()
            .webp({ quality: 90 })
            .toBuffer()
        } catch (sharpErr) {
          console.error('[IMAGE_IMPORT_APPLY] Sharp orig processing error:', sharpErr)
          results.push({
            filename,
            menu_code: menuCode,
            status: 'failed',
            reason: `Original processing failed: ${sharpErr instanceof Error ? sharpErr.message : 'Unknown error'}`
          })
          continue
        }

        // 2) Determine crop settings for each aspect
        const fileCrop = cropSettings[filename] || {}
        const manualCrop1x1 = fileCrop.manualCrop1x1
        const manualCrop4x3 = fileCrop.manualCrop4x3
        const cropMode1x1: 'auto' | 'manual' = manualCrop1x1 ? 'manual' : 'auto'
        const cropMode4x3: 'auto' | 'manual' = manualCrop4x3 ? 'manual' : 'auto'

        // 3) Generate derivatives using the pipeline
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
          console.error('[IMAGE_IMPORT_APPLY] Sharp derivative processing error:', sharpErr)
          results.push({
            filename,
            menu_code: menuCode,
            status: 'failed',
            reason: `Derivative processing failed: ${sharpErr instanceof Error ? sharpErr.message : 'Unknown error'}`
          })
          continue
        }

        // =======================================================================
        // UPLOAD NEW FILES FIRST (safe deletion pattern)
        // We upload all new files before deleting old ones.
        // If upload fails, the old image_url remains valid.
        // =======================================================================

        // Upload original (upsert - single orig.webp per menu)
        const { error: uploadOrigError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(paths.orig, origBuffer, {
            contentType: 'image/webp',
            upsert: true
          })

        if (uploadOrigError) {
          console.error('[IMAGE_IMPORT_APPLY] Upload orig error:', uploadOrigError)
          results.push({
            filename,
            menu_code: menuCode,
            storage_path_orig: paths.orig,
            status: 'failed',
            reason: `Upload original failed: ${uploadOrigError.message}`
          })
          continue
        }

        // Upload 1:1 derivative
        const { error: upload1x1Error } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(paths.d1x1, buffer1x1, {
            contentType: 'image/webp',
            upsert: true
          })

        if (upload1x1Error) {
          console.error('[IMAGE_IMPORT_APPLY] Upload 1x1 error:', upload1x1Error)
          results.push({
            filename,
            menu_code: menuCode,
            storage_path_orig: paths.orig,
            storage_path_1x1: paths.d1x1,
            status: 'failed',
            reason: `Upload 1x1 failed: ${upload1x1Error.message}`
          })
          continue
        }

        // Upload 4:3 derivative
        const { error: upload4x3Error } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(paths.d4x3, buffer4x3, {
            contentType: 'image/webp',
            upsert: true
          })

        if (upload4x3Error) {
          console.error('[IMAGE_IMPORT_APPLY] Upload 4x3 error:', upload4x3Error)
          results.push({
            filename,
            menu_code: menuCode,
            storage_path_orig: paths.orig,
            storage_path_1x1: paths.d1x1,
            storage_path_4x3: paths.d4x3,
            status: 'failed',
            reason: `Upload 4x3 failed: ${upload4x3Error.message}`
          })
          continue
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

        // Update menu_items: set the image_url to 4:3 derivative
        const { error: updateError } = await supabase
          .from('menu_items')
          .update({
            image_url: publicUrl4x3
          })
          .eq('menu_code', menuCode)

        if (updateError) {
          console.error('[IMAGE_IMPORT_APPLY] DB update error:', updateError)
          results.push({
            filename,
            menu_code: menuCode,
            storage_path_orig: paths.orig,
            storage_path_1x1: paths.d1x1,
            storage_path_4x3: paths.d4x3,
            status: 'failed',
            reason: `DB update failed: ${updateError.message}`
          })
          continue
        }

        // =======================================================================
        // DELETE OLD DERIVATIVE FILES (after successful upload + DB update)
        // Only delete old versioned derivatives, keep the new ones
        // Safe: we only delete within this menu's folder
        // =======================================================================
        let deletedFiles: string[] = []
        const folder = getMenuImageFolder(menuCode)
        const { data: existingFiles } = await supabase.storage
          .from(BUCKET_NAME)
          .list(folder)

        if (existingFiles && existingFiles.length > 0) {
          // Find old derivative files (versioned files that aren't the ones we just uploaded)
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

            if (deleteError) {
              console.warn('[IMAGE_IMPORT_APPLY] Failed to delete old derivatives:', deleteError)
            } else {
              deletedFiles = oldDerivatives
            }
          }
        }

        // Structured log
        console.log(formatImageOpLog({
          operation: 'apply',
          menu_code: menuCode,
          old_url: oldImageUrl,
          new_url: publicUrl4x3,
          deleted_count: deletedFiles.length,
          mode: cropMode4x3,
          success: true
        }))

        results.push({
          filename,
          menu_code: menuCode,
          storage_path_orig: paths.orig,
          storage_path_1x1: paths.d1x1,
          storage_path_4x3: paths.d4x3,
          status: 'updated',
          image_url: publicUrl4x3,
          image_url_1x1: publicUrl1x1,
          trim_applied: trim1x1.didTrim || trim4x3.didTrim ? trim1x1 : undefined,
          deleted_files: deletedFiles.length > 0 ? deletedFiles : undefined
        })

      } catch (err) {
        console.error('[IMAGE_IMPORT_APPLY] File processing error:', err)
        console.log(formatImageOpLog({
          operation: 'apply',
          menu_code: menuCode,
          old_url: oldImageUrl,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        }))
        results.push({
          filename,
          menu_code: menuCode,
          raw_menu_code: rawMenuCode !== menuCode ? rawMenuCode : undefined,
          status: 'failed',
          reason: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    }

    // Summary
    const updated = results.filter(r => r.status === 'updated').length
    const skipped = results.filter(r => r.status === 'skipped').length
    const failed = results.filter(r => r.status === 'failed').length
    const filesDeleted = results.reduce((sum, r) => sum + (r.deleted_files?.length || 0), 0)

    return NextResponse.json({
      summary: { updated, skipped, failed, files_deleted: filesDeleted },
      results
    })

  } catch (error) {
    console.error('[IMAGE_IMPORT_APPLY] Unexpected error:', error)
    const message = error instanceof Error ? error.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
