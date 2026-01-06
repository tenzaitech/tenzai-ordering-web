/**
 * Server-Only Image Processing Pipeline
 *
 * =============================================================================
 * FOOD-FIRST PHILOSOPHY
 * =============================================================================
 *
 * This pipeline is optimized for FOOD PHOTOGRAPHY where:
 *
 * 1. CONTEXT MATTERS: Plates, bowls, table settings, and garnishes are part
 *    of the composition. Aggressive cropping removes important visual context.
 *
 * 2. LOW-TEXTURE ≠ EMPTY: Soup surfaces, curry sauces, rice beds, and smooth
 *    ceramics have low gradient energy but are NOT empty space.
 *
 * 3. "NO TRIM" IS SAFER THAN "WRONG TRIM": An incorrectly trimmed image
 *    requires manual correction. A conservatively framed image usually works.
 *
 * 4. CIRCULAR OBJECTS ARE COMMON: Plates, bowls, and round dishes should
 *    never have their edges trimmed - it looks unnatural.
 *
 * Pipeline Order (NEW - conservative):
 *   aspectCrop (loose center) → conditionalSoftTrim → resize
 *
 * This ensures natural framing first, with minimal optional refinement.
 *
 * =============================================================================
 */

import 'server-only'
import sharp from 'sharp'

// Re-export all types and pure helpers from image-types
export * from '../image-types'

// Import types we need locally
import {
  type TrimResult,
  type CropBox,
  type DerivativeOptions,
  type PipelineResult,
  computeAspectCrop
} from '../image-types'

// =============================================================================
// CONSTANTS (tuned for food photography)
// =============================================================================

/** Analysis image width for fast processing */
const ANALYSIS_WIDTH = 256

/**
 * CONSERVATIVE THRESHOLDS
 * These are intentionally high to avoid false positives on food images.
 */

/**
 * Minimum edge width to even consider trimming (% of dimension)
 * Food images rarely have >25% pure empty space on any edge
 */
const MIN_EMPTY_EDGE_PERCENT = 0.25

/**
 * Energy threshold - RAISED significantly from 8 to 3
 * Only truly flat backgrounds (pure white/solid color) qualify
 * Soup surfaces, gradients, subtle textures will NOT be trimmed
 */
const EMPTY_EDGE_ENERGY_THRESHOLD = 3

/**
 * Saturation threshold for "empty" classification
 * Edges with any meaningful color should not be trimmed
 */
const EMPTY_EDGE_SATURATION_THRESHOLD = 15

/**
 * Maximum trim percentage per side (conservative)
 * Never trim more than 12% from any side, even if detected as "empty"
 */
const MAX_TRIM_PERCENT = 0.12

/**
 * Curve detection threshold
 * If edge has continuous curved patterns, don't trim (likely plate/bowl)
 */
const CURVE_CONTINUITY_THRESHOLD = 0.7

/**
 * Low-saturation image threshold (typical for soups, curries)
 * If overall saturation is below this, disable trimming entirely
 */
const LOW_SAT_IMAGE_THRESHOLD = 25

/**
 * Color variance threshold for uniform images
 * Low variance = soup/curry/sauce - disable trimming
 */
const LOW_VARIANCE_THRESHOLD = 20

// =============================================================================
// IMAGE ANALYSIS HELPERS
// =============================================================================

interface ImageStats {
  avgSaturation: number
  colorVariance: number
  hasCircularEdges: boolean
}

/**
 * Analyze image characteristics to determine if trimming is appropriate
 * Returns stats that help decide whether to skip trimming entirely
 */
async function analyzeImageForFood(inputBuffer: Buffer): Promise<ImageStats> {
  try {
    // Get image in LAB color space for better saturation analysis
    const { data, info } = await sharp(inputBuffer)
      .resize({ width: ANALYSIS_WIDTH, height: ANALYSIS_WIDTH, fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true })

    const { width, height, channels } = info
    const pixelCount = width * height

    if (channels < 3) {
      return { avgSaturation: 0, colorVariance: 0, hasCircularEdges: false }
    }

    // Calculate saturation and color variance
    let totalSat = 0
    const colors: number[] = []

    for (let i = 0; i < data.length; i += channels) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      // Approximate saturation
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const sat = max === 0 ? 0 : ((max - min) / max) * 100
      totalSat += sat

      // Track color for variance
      colors.push((r + g + b) / 3)
    }

    const avgSaturation = totalSat / pixelCount

    // Calculate color variance
    const avgColor = colors.reduce((a, b) => a + b, 0) / colors.length
    const variance = colors.reduce((sum, c) => sum + Math.pow(c - avgColor, 2), 0) / colors.length
    const colorVariance = Math.sqrt(variance)

    // Detect circular edges (simplified heuristic)
    // Check if edge pixels form continuous curves (corners have gaps)
    const hasCircularEdges = detectCircularEdges(data, width, height, channels)

    return { avgSaturation, colorVariance, hasCircularEdges }
  } catch {
    return { avgSaturation: 50, colorVariance: 50, hasCircularEdges: false }
  }
}

/**
 * Detect if image edges contain circular patterns (plates, bowls)
 * Uses edge continuity along borders - circles have smooth gradients
 */
function detectCircularEdges(
  data: Buffer,
  width: number,
  height: number,
  channels: number
): boolean {
  // Sample edge pixels and check for smooth gradient patterns
  // Circular plates typically show gradual brightness changes along edges

  const getPixelBrightness = (x: number, y: number): number => {
    const idx = (y * width + x) * channels
    return (data[idx] + data[idx + 1] + data[idx + 2]) / 3
  }

  // Check top and bottom edges for smooth curves
  let smoothTransitions = 0
  let totalChecks = 0

  // Top edge
  for (let x = 1; x < width - 1; x++) {
    const prev = getPixelBrightness(x - 1, 0)
    const curr = getPixelBrightness(x, 0)
    const next = getPixelBrightness(x + 1, 0)

    // Smooth if gradual change (not abrupt)
    if (Math.abs(curr - prev) < 20 && Math.abs(curr - next) < 20) {
      smoothTransitions++
    }
    totalChecks++
  }

  // Bottom edge
  for (let x = 1; x < width - 1; x++) {
    const prev = getPixelBrightness(x - 1, height - 1)
    const curr = getPixelBrightness(x, height - 1)
    const next = getPixelBrightness(x + 1, height - 1)

    if (Math.abs(curr - prev) < 20 && Math.abs(curr - next) < 20) {
      smoothTransitions++
    }
    totalChecks++
  }

  // If >70% of edge is smooth, likely has circular elements
  return totalChecks > 0 && (smoothTransitions / totalChecks) > CURVE_CONTINUITY_THRESHOLD
}

// =============================================================================
// CONDITIONAL SOFT TRIM (very conservative)
// =============================================================================

interface EdgeAnalysis {
  energy: number
  saturation: number
  isTrulyEmpty: boolean
  suggestedTrim: number  // 0-1 normalized
}

/**
 * Analyze a single edge region for potential trimming
 * Returns detailed analysis including saturation check
 */
async function analyzeEdge(
  inputBuffer: Buffer,
  edge: 'top' | 'bottom' | 'left' | 'right',
  origWidth: number,
  origHeight: number
): Promise<EdgeAnalysis> {
  try {
    // Extract edge region (25% of that side)
    const edgePercent = MIN_EMPTY_EDGE_PERCENT
    let extractBox: { left: number; top: number; width: number; height: number }

    switch (edge) {
      case 'top':
        extractBox = { left: 0, top: 0, width: origWidth, height: Math.floor(origHeight * edgePercent) }
        break
      case 'bottom':
        extractBox = { left: 0, top: Math.floor(origHeight * (1 - edgePercent)), width: origWidth, height: Math.floor(origHeight * edgePercent) }
        break
      case 'left':
        extractBox = { left: 0, top: 0, width: Math.floor(origWidth * edgePercent), height: origHeight }
        break
      case 'right':
        extractBox = { left: Math.floor(origWidth * (1 - edgePercent)), top: 0, width: Math.floor(origWidth * edgePercent), height: origHeight }
        break
    }

    // Ensure valid dimensions
    if (extractBox.width < 1 || extractBox.height < 1) {
      return { energy: 100, saturation: 100, isTrulyEmpty: false, suggestedTrim: 0 }
    }

    // Get edge region data
    const { data, info } = await sharp(inputBuffer)
      .extract(extractBox)
      .resize({ width: 64, height: 64, fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true })

    const { width, height, channels } = info
    const pixelCount = width * height

    if (channels < 3) {
      return { energy: 100, saturation: 100, isTrulyEmpty: false, suggestedTrim: 0 }
    }

    // Calculate energy (gradient) and saturation
    let totalEnergy = 0
    let totalSat = 0
    let energyCount = 0

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * channels
        const r = data[idx]
        const g = data[idx + 1]
        const b = data[idx + 2]

        // Saturation
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        totalSat += max === 0 ? 0 : ((max - min) / max) * 100

        // Energy (gradient to neighbors)
        if (x > 0) {
          const prevIdx = (y * width + x - 1) * channels
          totalEnergy += Math.abs(r - data[prevIdx]) + Math.abs(g - data[prevIdx + 1]) + Math.abs(b - data[prevIdx + 2])
          energyCount++
        }
        if (y > 0) {
          const prevIdx = ((y - 1) * width + x) * channels
          totalEnergy += Math.abs(r - data[prevIdx]) + Math.abs(g - data[prevIdx + 1]) + Math.abs(b - data[prevIdx + 2])
          energyCount++
        }
      }
    }

    const avgEnergy = energyCount > 0 ? totalEnergy / energyCount / 3 : 100
    const avgSaturation = totalSat / pixelCount

    // Edge is "truly empty" only if BOTH low energy AND low saturation
    const isTrulyEmpty = avgEnergy < EMPTY_EDGE_ENERGY_THRESHOLD &&
                         avgSaturation < EMPTY_EDGE_SATURATION_THRESHOLD

    // Suggested trim is conservative - max 12%
    const suggestedTrim = isTrulyEmpty ? Math.min(edgePercent * 0.5, MAX_TRIM_PERCENT) : 0

    return { energy: avgEnergy, saturation: avgSaturation, isTrulyEmpty, suggestedTrim }
  } catch {
    return { energy: 100, saturation: 100, isTrulyEmpty: false, suggestedTrim: 0 }
  }
}

/**
 * Compute CONDITIONAL soft trim for food images
 *
 * ONLY trims if ALL conditions are met:
 * 1. Edge region is consistently low-gradient AND low-saturation
 * 2. Image doesn't appear to have circular edges (plates/bowls)
 * 3. Image isn't a low-saturation dish (soup/curry)
 * 4. Trim amount is within conservative limits
 *
 * Otherwise: NO TRIMMING (returns all zeros)
 */
async function computeConditionalSoftTrim(
  inputBuffer: Buffer,
  origWidth: number,
  origHeight: number
): Promise<TrimResult> {
  // First, analyze image characteristics
  const stats = await analyzeImageForFood(inputBuffer)

  // RULE 1: If image has circular edges (plates/bowls), don't trim
  if (stats.hasCircularEdges) {
    return {
      trimTop: 0, trimBottom: 0, trimLeft: 0, trimRight: 0,
      didTrim: false,
      edgeEnergies: { top: 0, bottom: 0, left: 0, right: 0 }
    }
  }

  // RULE 2: If image is low-saturation (soup, curry), don't trim
  if (stats.avgSaturation < LOW_SAT_IMAGE_THRESHOLD) {
    return {
      trimTop: 0, trimBottom: 0, trimLeft: 0, trimRight: 0,
      didTrim: false,
      edgeEnergies: { top: 0, bottom: 0, left: 0, right: 0 }
    }
  }

  // RULE 3: If image has low color variance (uniform dish), don't trim
  if (stats.colorVariance < LOW_VARIANCE_THRESHOLD) {
    return {
      trimTop: 0, trimBottom: 0, trimLeft: 0, trimRight: 0,
      didTrim: false,
      edgeEnergies: { top: 0, bottom: 0, left: 0, right: 0 }
    }
  }

  // Analyze each edge
  const [topAnalysis, bottomAnalysis, leftAnalysis, rightAnalysis] = await Promise.all([
    analyzeEdge(inputBuffer, 'top', origWidth, origHeight),
    analyzeEdge(inputBuffer, 'bottom', origWidth, origHeight),
    analyzeEdge(inputBuffer, 'left', origWidth, origHeight),
    analyzeEdge(inputBuffer, 'right', origWidth, origHeight)
  ])

  // Only trim edges that are TRULY empty
  const trimTop = topAnalysis.isTrulyEmpty ? Math.round(origHeight * topAnalysis.suggestedTrim) : 0
  const trimBottom = bottomAnalysis.isTrulyEmpty ? Math.round(origHeight * bottomAnalysis.suggestedTrim) : 0
  const trimLeft = leftAnalysis.isTrulyEmpty ? Math.round(origWidth * leftAnalysis.suggestedTrim) : 0
  const trimRight = rightAnalysis.isTrulyEmpty ? Math.round(origWidth * rightAnalysis.suggestedTrim) : 0

  // Safety: ensure we're not trimming too much total
  const totalHorizontalTrim = (trimLeft + trimRight) / origWidth
  const totalVerticalTrim = (trimTop + trimBottom) / origHeight

  // If total trim exceeds 20% in any direction, cancel all trim
  if (totalHorizontalTrim > 0.20 || totalVerticalTrim > 0.20) {
    return {
      trimTop: 0, trimBottom: 0, trimLeft: 0, trimRight: 0,
      didTrim: false,
      edgeEnergies: {
        top: topAnalysis.energy,
        bottom: bottomAnalysis.energy,
        left: leftAnalysis.energy,
        right: rightAnalysis.energy
      }
    }
  }

  const didTrim = trimTop > 0 || trimBottom > 0 || trimLeft > 0 || trimRight > 0

  return {
    trimTop,
    trimBottom,
    trimLeft,
    trimRight,
    didTrim,
    edgeEnergies: {
      top: topAnalysis.energy,
      bottom: bottomAnalysis.energy,
      left: leftAnalysis.energy,
      right: rightAnalysis.energy
    }
  }
}

// =============================================================================
// LEGACY EXPORT (for backward compatibility)
// =============================================================================

/**
 * @deprecated Use generateDerivative with auto mode instead
 * Kept for any external references
 */
export async function computeSmartTrim(inputBuffer: Buffer): Promise<TrimResult> {
  const metadata = await sharp(inputBuffer).metadata()
  return computeConditionalSoftTrim(inputBuffer, metadata.width || 1, metadata.height || 1)
}

// =============================================================================
// MAIN PIPELINE: Aspect Crop (center) → Conditional Soft Trim → Resize
// =============================================================================

/**
 * Generate a derivative image using the FOOD-FIRST pipeline:
 *
 * MANUAL MODE (cropMode === 'manual'):
 * - Use the provided manualCrop box directly
 * - No trimming applied
 * - Extract → Resize → WebP
 *
 * AUTO MODE (default - CONSERVATIVE):
 * 1. ASPECT CROP FIRST: Center-crop to target aspect ratio
 *    - Uses ORIGINAL image bounds for natural framing
 *    - Preserves context (plates, bowls, table)
 *
 * 2. CONDITIONAL SOFT TRIM: Only if ALL conditions met:
 *    - Edge is truly empty (low gradient AND low saturation)
 *    - No circular edges detected (plates/bowls)
 *    - Image isn't low-saturation (soup/curry)
 *    - Trim stays within 12% per side
 *    Otherwise: NO TRIMMING
 *
 * 3. RESIZE: Scale to final dimensions
 *
 * ASPECT-SPECIFIC RULES:
 * - 4:3 is the PRIMARY format (gold standard)
 * - 1:1 is derived from the SAME crop logic (no re-trimming)
 *   This ensures both derivatives have consistent framing
 *
 * WHY THIS ORDER:
 * - Framing first ensures natural composition
 * - Trimming is optional refinement, not the default
 * - "No trim" is always safe; "wrong trim" requires manual fix
 */
export async function generateDerivative(
  inputBuffer: Buffer,
  options: DerivativeOptions
): Promise<PipelineResult> {
  const { width: targetWidth, height: targetHeight, aspect: targetAspect } = options

  // Get original dimensions
  const metadata = await sharp(inputBuffer).metadata()
  const origWidth = metadata.width || 1
  const origHeight = metadata.height || 1

  // ==========================================================================
  // MANUAL CROP MODE: Skip all auto logic, use provided crop box directly
  // ==========================================================================
  if (options.cropMode === 'manual' && options.manualCrop) {
    const mc = options.manualCrop

    // Convert normalized coordinates to pixels
    const extractBox: CropBox = {
      left: Math.round(mc.x * origWidth),
      top: Math.round(mc.y * origHeight),
      width: Math.round(mc.w * origWidth),
      height: Math.round(mc.h * origHeight)
    }

    // Clamp to image bounds
    extractBox.left = Math.max(0, Math.min(extractBox.left, origWidth - 1))
    extractBox.top = Math.max(0, Math.min(extractBox.top, origHeight - 1))
    extractBox.width = Math.max(1, Math.min(extractBox.width, origWidth - extractBox.left))
    extractBox.height = Math.max(1, Math.min(extractBox.height, origHeight - extractBox.top))

    // Extract and resize
    const buffer = await sharp(inputBuffer)
      .extract(extractBox)
      .resize(targetWidth, targetHeight)
      .webp({ quality: 80 })
      .toBuffer()

    return {
      buffer,
      trim: { trimTop: 0, trimBottom: 0, trimLeft: 0, trimRight: 0, didTrim: false },
      cropModeUsed: 'manual',
      manualCropUsed: mc
    }
  }

  // ==========================================================================
  // AUTO MODE: Aspect Crop (center) → Conditional Soft Trim → Resize
  // ==========================================================================

  // STEP 1: Compute center crop for target aspect ratio
  // This uses the ORIGINAL image dimensions (no pre-trimming)
  const aspectCrop = computeAspectCrop(origWidth, origHeight, targetAspect)

  // STEP 2: Compute conditional soft trim on the aspect-cropped region
  // Extract the aspect-cropped portion first for analysis
  const croppedBuffer = await sharp(inputBuffer)
    .extract(aspectCrop)
    .toBuffer()

  const croppedMeta = await sharp(croppedBuffer).metadata()
  const croppedWidth = croppedMeta.width || aspectCrop.width
  const croppedHeight = croppedMeta.height || aspectCrop.height

  // Analyze for soft trim (very conservative)
  const trim = await computeConditionalSoftTrim(croppedBuffer, croppedWidth, croppedHeight)

  // STEP 3: Apply final crop (original aspect crop + any soft trim)
  const finalCrop: CropBox = {
    left: aspectCrop.left + trim.trimLeft,
    top: aspectCrop.top + trim.trimTop,
    width: aspectCrop.width - trim.trimLeft - trim.trimRight,
    height: aspectCrop.height - trim.trimTop - trim.trimBottom
  }

  // Safety check
  if (finalCrop.width < 100 || finalCrop.height < 100) {
    // Fall back to aspect crop only (no trim)
    const buffer = await sharp(inputBuffer)
      .extract(aspectCrop)
      .resize(targetWidth, targetHeight)
      .webp({ quality: 80 })
      .toBuffer()

    return {
      buffer,
      trim: { trimTop: 0, trimBottom: 0, trimLeft: 0, trimRight: 0, didTrim: false },
      cropModeUsed: 'auto'
    }
  }

  // STEP 4: Extract and resize to final dimensions
  const buffer = await sharp(inputBuffer)
    .extract(finalCrop)
    .resize(targetWidth, targetHeight)
    .webp({ quality: 80 })
    .toBuffer()

  return { buffer, trim, cropModeUsed: 'auto' }
}

// Re-export sharp for routes that need direct access
export { sharp }
