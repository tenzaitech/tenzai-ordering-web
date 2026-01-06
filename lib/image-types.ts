/**
 * Image Pipeline Types and Pure Helpers
 *
 * This file contains ONLY types and pure functions that can be safely
 * imported on both client and server. NO sharp import here.
 *
 * For server-side image processing (sharp), use lib/server/image-pipeline.ts
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/** Derivative output specs */
export const DERIVATIVES = {
  '1x1': { width: 1024, height: 1024, aspect: 1.0 },
  '4x3': { width: 1440, height: 1080, aspect: 4 / 3 }
} as const

// =============================================================================
// TYPES
// =============================================================================

export interface TrimResult {
  /** Pixels to trim from top */
  trimTop: number
  /** Pixels to trim from bottom */
  trimBottom: number
  /** Pixels to trim from left */
  trimLeft: number
  /** Pixels to trim from right */
  trimRight: number
  /** Whether any trimming occurred */
  didTrim: boolean
  /** Debug info: energy values per edge */
  edgeEnergies?: { top: number; bottom: number; left: number; right: number }
}

export interface CropBox {
  left: number
  top: number
  width: number
  height: number
}

export interface DerivativeOptions {
  /** Target width */
  width: number
  /** Target height */
  height: number
  /** Target aspect ratio */
  aspect: number
  /** Crop mode: 'auto' = smart trim + center crop, 'manual' = use manualCrop */
  cropMode?: 'auto' | 'manual'
  /** Manual crop box (normalized 0-1 coordinates) - required if cropMode='manual' */
  manualCrop?: NormalizedCropBox
}

/** Normalized crop box (0-1 coordinates relative to image) */
export interface NormalizedCropBox {
  /** X position (0-1), left edge */
  x: number
  /** Y position (0-1), top edge */
  y: number
  /** Width (0-1) */
  w: number
  /** Height (0-1) */
  h: number
}

export interface PipelineResult {
  buffer: Buffer
  trim: TrimResult
  /** The crop mode that was used */
  cropModeUsed: 'auto' | 'manual'
  /** The manual crop box that was used (if manual mode) */
  manualCropUsed?: NormalizedCropBox
}

// =============================================================================
// STORAGE PATH HELPERS (menu_code-based, Unicode-safe)
// =============================================================================

/**
 * Storage path convention (menu_code-based):
 *
 * menu/{menu_code}/orig.webp           - Original (rotated, high-quality)
 * menu/{menu_code}/1x1_v{ts}.webp      - 1:1 derivative (versioned)
 * menu/{menu_code}/4x3_v{ts}.webp      - 4:3 derivative (versioned)
 */
export interface StoragePaths {
  folder: string      // menu/{menu_code}
  orig: string        // menu/{menu_code}/orig.webp
  d1x1: string        // menu/{menu_code}/1x1_v{timestamp}.webp
  d4x3: string        // menu/{menu_code}/4x3_v{timestamp}.webp
}

/**
 * Generate storage paths for a menu item
 * Uses menu_code as the stable identifier (no Thai/Unicode issues)
 */
export function getStoragePaths(menuCode: string, version?: number): StoragePaths {
  const v = version || Date.now()
  const folder = `menu/${menuCode}`
  return {
    folder,
    orig: `${folder}/orig.webp`,
    d1x1: `${folder}/1x1_v${v}.webp`,
    d4x3: `${folder}/4x3_v${v}.webp`
  }
}

/**
 * Get the folder prefix for a menu's images
 * Used for listing/deleting all files for a menu
 */
export function getMenuImageFolder(menuCode: string): string {
  return `menu/${menuCode}`
}

/**
 * Extract menu_code from a storage path
 * Returns null if path doesn't match expected format
 */
export function extractMenuCodeFromPath(path: string): string | null {
  const match = path.match(/^menu\/([^/]+)\//)
  return match ? match[1] : null
}

/**
 * Check if a filename is a derivative (versioned file)
 * Derivatives: 1x1_v{timestamp}.webp, 4x3_v{timestamp}.webp
 */
export function isDerivativeFile(filename: string): boolean {
  return /^(1x1|4x3)_v\d+\.webp$/.test(filename)
}

// =============================================================================
// PURE CROP HELPERS (no sharp needed)
// =============================================================================

/**
 * Compute crop rectangle for target aspect ratio
 * Always uses center crop - no focus shifting.
 */
export function computeAspectCrop(
  srcWidth: number,
  srcHeight: number,
  targetAspect: number
): CropBox {
  const srcAspect = srcWidth / srcHeight

  let cropW: number
  let cropH: number
  let left: number
  let top: number

  if (srcAspect >= targetAspect) {
    // Source is wider than target: crop width, full height
    cropH = srcHeight
    cropW = Math.round(srcHeight * targetAspect)
    left = Math.round((srcWidth - cropW) / 2)
    top = 0
  } else {
    // Source is taller than target: crop height, full width
    cropW = srcWidth
    cropH = Math.round(srcWidth / targetAspect)
    left = 0
    top = Math.round((srcHeight - cropH) / 2)
  }

  return { left, top, width: cropW, height: cropH }
}

/**
 * Calculate initial centered crop box for a given aspect ratio
 * Returns normalized coordinates (0-1)
 */
export function getInitialCropBox(
  imageWidth: number,
  imageHeight: number,
  targetAspect: number
): NormalizedCropBox {
  const imageAspect = imageWidth / imageHeight

  let w: number, h: number

  if (imageAspect >= targetAspect) {
    // Image is wider than target - fit to height
    h = 1
    w = targetAspect / imageAspect
  } else {
    // Image is taller than target - fit to width
    w = 1
    h = imageAspect / targetAspect
  }

  // Center the crop
  const x = (1 - w) / 2
  const y = (1 - h) / 2

  return { x, y, w, h }
}

/**
 * Normalize name to slug format
 * NOTE: This is ONLY for display/debugging purposes.
 * Storage paths should use menu_code directly (see getStoragePaths).
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[()[\]{}.,'":;!?@#$%^&*+=<>~`|\\\/]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s/g, '-')
}

// =============================================================================
// LOGGING
// =============================================================================

/** Structured log for image operations */
export interface ImageOpLog {
  operation: 'apply' | 'upload' | 'regenerate' | 'delete'
  menu_code: string
  old_url?: string | null
  new_url?: string
  deleted_count?: number
  mode?: 'auto' | 'manual'
  success: boolean
  error?: string
}

/**
 * Format a structured log entry for image operations
 */
export function formatImageOpLog(log: ImageOpLog): string {
  return `[IMAGE_OP] ${JSON.stringify(log)}`
}
