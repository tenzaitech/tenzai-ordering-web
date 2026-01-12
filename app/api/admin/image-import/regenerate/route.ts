import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAdminAuth } from '@/lib/admin-gate'
import { validateCsrf, csrfError } from '@/lib/csrf'
import {
  DERIVATIVES,
  generateDerivative,
  getStoragePaths,
  getMenuImageFolder,
  isDerivativeFile,
  formatImageOpLog,
  type TrimResult
} from '@/lib/server/image-pipeline'

// Force Node.js runtime (NOT edge) for sharp compatibility
export const runtime = 'nodejs'

const BUCKET_NAME = 'menu-images'

interface RegenerateResult {
  menu_code: string
  storage_path_1x1?: string
  storage_path_4x3?: string
  status: 'regenerated' | 'failed'
  reason?: string
  image_url?: string
  image_url_1x1?: string
  trim_applied?: TrimResult
  deleted_files?: string[]
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
    const body = await request.json()

    // Accept both { menu_codes: [...] } and { menu_code: "..." }
    let menuCodes: string[] = []
    if (Array.isArray(body.menu_codes)) {
      menuCodes = body.menu_codes.filter((c: unknown) => typeof c === 'string' && c.trim())
    } else if (typeof body.menu_code === 'string' && body.menu_code.trim()) {
      menuCodes = [body.menu_code.trim()]
    }

    if (menuCodes.length === 0) {
      return NextResponse.json(
        { error: 'menu_codes array or menu_code string required' },
        { status: 400 }
      )
    }

    const results: RegenerateResult[] = []

    for (const menuCode of menuCodes) {
      let oldImageUrl: string | null = null

      try {
        // Fetch menu data (we only need menu_code and image_url for logging)
        const { data: menuData, error: menuError } = await supabase
          .from('menu_items')
          .select('menu_code, image_url')
          .eq('menu_code', menuCode)
          .single()

        if (menuError || !menuData) {
          results.push({
            menu_code: menuCode,
            status: 'failed',
            reason: `Menu not found: ${menuCode}`
          })
          continue
        }

        oldImageUrl = menuData.image_url

        // =======================================================================
        // MENU_CODE-BASED STORAGE PATHS (Unicode-safe)
        // =======================================================================
        const folder = getMenuImageFolder(menuCode)
        const origPath = `${folder}/orig.webp`

        // Download original from storage
        const { data: origData, error: downloadError } = await supabase.storage
          .from(BUCKET_NAME)
          .download(origPath)

        if (downloadError || !origData) {
          results.push({
            menu_code: menuCode,
            status: 'failed',
            reason: `Original image missing (${origPath}); re-apply image to create it`
          })
          continue
        }

        // Convert Blob to Buffer
        const origBuffer = Buffer.from(await origData.arrayBuffer())

        // Generate derivatives using the simplified pipeline (auto mode only)
        let buffer1x1: Buffer
        let buffer4x3: Buffer
        let trim1x1: TrimResult

        try {
          const result1x1 = await generateDerivative(origBuffer, {
            width: DERIVATIVES['1x1'].width,
            height: DERIVATIVES['1x1'].height,
            aspect: DERIVATIVES['1x1'].aspect
          })
          buffer1x1 = result1x1.buffer
          trim1x1 = result1x1.trim

          const result4x3 = await generateDerivative(origBuffer, {
            width: DERIVATIVES['4x3'].width,
            height: DERIVATIVES['4x3'].height,
            aspect: DERIVATIVES['4x3'].aspect
          })
          buffer4x3 = result4x3.buffer
        } catch (sharpErr) {
          console.error('[REGENERATE] Sharp processing error:', sharpErr)
          results.push({
            menu_code: menuCode,
            status: 'failed',
            reason: `Derivative processing failed: ${sharpErr instanceof Error ? sharpErr.message : 'Unknown error'}`
          })
          continue
        }

        // New versioned paths
        const version = Date.now()
        const paths = getStoragePaths(menuCode, version)

        // Upload 1:1 derivative
        const { error: upload1x1Error } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(paths.d1x1, buffer1x1, {
            contentType: 'image/webp',
            upsert: true
          })

        if (upload1x1Error) {
          console.error('[REGENERATE] Upload 1x1 error:', upload1x1Error)
          results.push({
            menu_code: menuCode,
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
          console.error('[REGENERATE] Upload 4x3 error:', upload4x3Error)
          results.push({
            menu_code: menuCode,
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

        // Update menu_items
        const { error: updateError } = await supabase
          .from('menu_items')
          .update({
            image_url: publicUrl4x3
          })
          .eq('menu_code', menuCode)

        if (updateError) {
          console.error('[REGENERATE] DB update error:', updateError)
          results.push({
            menu_code: menuCode,
            storage_path_1x1: paths.d1x1,
            storage_path_4x3: paths.d4x3,
            status: 'failed',
            reason: `DB update failed: ${updateError.message}`
          })
          continue
        }

        // Delete old derivative files (after successful upload + DB update)
        let deletedFiles: string[] = []
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

        // Structured log
        console.log(formatImageOpLog({
          operation: 'regenerate',
          menu_code: menuCode,
          old_url: oldImageUrl,
          new_url: publicUrl4x3,
          deleted_count: deletedFiles.length,
          mode: 'auto',
          success: true
        }))

        results.push({
          menu_code: menuCode,
          storage_path_1x1: paths.d1x1,
          storage_path_4x3: paths.d4x3,
          status: 'regenerated',
          image_url: publicUrl4x3,
          image_url_1x1: publicUrl1x1,
          trim_applied: trim1x1.didTrim ? trim1x1 : undefined,
          deleted_files: deletedFiles.length > 0 ? deletedFiles : undefined
        })

      } catch (err) {
        console.error('[REGENERATE] Processing error:', err)
        console.log(formatImageOpLog({
          operation: 'regenerate',
          menu_code: menuCode,
          old_url: oldImageUrl,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error'
        }))
        results.push({
          menu_code: menuCode,
          status: 'failed',
          reason: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    }

    // Summary
    const regenerated = results.filter(r => r.status === 'regenerated').length
    const failed = results.filter(r => r.status === 'failed').length
    const filesDeleted = results.reduce((sum, r) => sum + (r.deleted_files?.length || 0), 0)

    return NextResponse.json({
      summary: { regenerated, failed, files_deleted: filesDeleted },
      results
    })

  } catch (error) {
    console.error('[REGENERATE] Unexpected error:', error)
    const message = error instanceof Error ? error.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
