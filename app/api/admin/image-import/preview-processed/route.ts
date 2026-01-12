import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAdminAuth } from '@/lib/admin-gate'
import { validateCsrf, csrfError } from '@/lib/csrf'
import {
  sharp,
  DERIVATIVES,
  generateDerivative,
  type TrimResult,
  type NormalizedCropBox
} from '@/lib/server/image-pipeline'

// Force Node.js runtime (NOT edge) for sharp compatibility
export const runtime = 'nodejs'

const BUCKET_NAME = 'menu-images'

interface PreviewResponse {
  /** Base64 encoded webp image */
  image_base64: string
  /** Width of result */
  width: number
  /** Height of result */
  height: number
  /** Aspect ratio used */
  aspect: '1x1' | '4x3'
  /** Whether smart trim was applied */
  trim_applied: boolean
  /** Trim details (for debug) */
  trim_info?: TrimResult
  /** Crop mode that was used */
  crop_mode_used: 'auto' | 'manual'
  /** Manual crop box that was used (if manual mode) */
  manual_crop_used?: NormalizedCropBox
  /** Original image dimensions (for crop overlay positioning) */
  original_width?: number
  original_height?: number
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

/**
 * POST /api/admin/image-import/preview-processed
 *
 * Generate a preview of the processed image using the SAME pipeline as Apply.
 * Does NOT write to storage or DB.
 *
 * Simplified API:
 * - If manual_crop is provided, use manual crop mode
 * - Otherwise, use auto mode (smart trim + center crop)
 *
 * Input (FormData):
 * - file: Image file (either this OR storage_path required)
 * - storage_path: Path to existing image in storage (either this OR file required)
 * - aspect: '1x1' | '4x3' (required)
 * - manual_crop: JSON string of { x, y, w, h } normalized coordinates (optional)
 *
 * Output:
 * - image_base64: Base64 encoded webp image
 * - width, height: dimensions
 * - aspect: which aspect was used
 * - trim_applied: whether smart trim ran
 * - crop_mode_used: 'auto' | 'manual'
 * - manual_crop_used: the manual crop box if used
 * - original_width, original_height: dimensions of the input image (for crop overlay)
 */
export async function POST(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  if (!validateCsrf(request)) {
    return csrfError()
  }

  try {
    const formData = await request.formData()

    // Get aspect (required)
    const aspectParam = formData.get('aspect')
    if (!aspectParam || (aspectParam !== '1x1' && aspectParam !== '4x3')) {
      return NextResponse.json(
        { error: 'aspect is required (1x1 or 4x3)' },
        { status: 400 }
      )
    }
    const aspect = aspectParam as '1x1' | '4x3'

    // Get manual crop (if provided, use manual mode; otherwise auto)
    let manualCrop: NormalizedCropBox | undefined
    const manualCropParam = formData.get('manual_crop') as string | null
    if (manualCropParam) {
      try {
        manualCrop = JSON.parse(manualCropParam)
        // Validate the crop box
        if (typeof manualCrop?.x !== 'number' ||
            typeof manualCrop?.y !== 'number' ||
            typeof manualCrop?.w !== 'number' ||
            typeof manualCrop?.h !== 'number') {
          return NextResponse.json(
            { error: 'manual_crop must have x, y, w, h as numbers' },
            { status: 400 }
          )
        }
      } catch {
        return NextResponse.json(
          { error: 'Invalid manual_crop JSON' },
          { status: 400 }
        )
      }
    }

    // Determine crop mode based on whether manual crop is provided
    const cropMode: 'auto' | 'manual' = manualCrop ? 'manual' : 'auto'

    // Get image source: either file upload or storage path
    const file = formData.get('file') as File | null
    const storagePath = formData.get('storage_path') as string | null

    let inputBuffer: Buffer

    if (file && file.size > 0) {
      // Option 1: Direct file upload
      const arrayBuffer = await file.arrayBuffer()
      inputBuffer = Buffer.from(arrayBuffer)
    } else if (storagePath) {
      // Option 2: Fetch from storage
      const supabase = getSupabaseServerClient()
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(BUCKET_NAME)
        .download(storagePath)

      if (downloadError || !fileData) {
        return NextResponse.json(
          { error: `Failed to download from storage: ${storagePath}` },
          { status: 404 }
        )
      }

      inputBuffer = Buffer.from(await fileData.arrayBuffer())
    } else {
      return NextResponse.json(
        { error: 'Either file or storage_path is required' },
        { status: 400 }
      )
    }

    // Rotate and normalize input (match Apply pipeline)
    const normalizedBuffer = await sharp(inputBuffer)
      .rotate()
      .webp({ quality: 90 })
      .toBuffer()

    // Get original dimensions (after rotation/normalization) for crop overlay
    const origMetadata = await sharp(normalizedBuffer).metadata()
    const originalWidth = origMetadata.width || 1
    const originalHeight = origMetadata.height || 1

    // Run the EXACT same pipeline as Apply
    const derivativeSpec = DERIVATIVES[aspect]
    const result = await generateDerivative(normalizedBuffer, {
      width: derivativeSpec.width,
      height: derivativeSpec.height,
      aspect: derivativeSpec.aspect,
      cropMode,
      manualCrop
    })

    // Get dimensions of result
    const metadata = await sharp(result.buffer).metadata()

    // Convert to base64
    const base64 = result.buffer.toString('base64')

    const response: PreviewResponse = {
      image_base64: base64,
      width: metadata.width || derivativeSpec.width,
      height: metadata.height || derivativeSpec.height,
      aspect,
      trim_applied: result.trim.didTrim,
      trim_info: result.trim.didTrim ? result.trim : undefined,
      crop_mode_used: result.cropModeUsed,
      manual_crop_used: result.manualCropUsed,
      original_width: originalWidth,
      original_height: originalHeight
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('[PREVIEW_PROCESSED] Error:', error)
    const message = error instanceof Error ? error.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
