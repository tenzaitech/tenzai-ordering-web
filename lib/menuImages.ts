/**
 * Menu Image URL Helpers
 *
 * Storage convention:
 * - 4:3 (1440x1080): menu/{category}/{slug}__4x3.webp (canonical, stored in DB)
 * - 1:1 (1024x1024): menu/{category}/{slug}__1x1.webp (derived by replacing suffix)
 *
 * Backward compatible: URLs not matching __4x3.webp are returned unchanged.
 */

const SUFFIX_4X3 = '__4x3.webp'
const SUFFIX_1X1 = '__1x1.webp'

/**
 * Convert a 4:3 image URL to its 1:1 (square) derivative.
 * Use this for grid/list thumbnails.
 *
 * @example
 * toSquareUrl('https://.../menu/udon/ten-zaru__4x3.webp')
 * // => 'https://.../menu/udon/ten-zaru__1x1.webp'
 *
 * toSquareUrl('https://.../old-image.jpg')
 * // => 'https://.../old-image.jpg' (unchanged)
 */
export function toSquareUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url

  // Case-insensitive check for __4x3.webp suffix
  const lowerUrl = url.toLowerCase()
  if (lowerUrl.endsWith(SUFFIX_4X3.toLowerCase())) {
    // Replace the suffix while preserving original casing of the rest
    return url.slice(0, -SUFFIX_4X3.length) + SUFFIX_1X1
  }

  // Not a new-format URL - return unchanged for backward compatibility
  return url
}

/**
 * Return the 4:3 (landscape) URL as-is.
 * This is the canonical URL stored in DB.
 * Provided for clarity/symmetry.
 */
export function toLandscapeUrl(url: string | null | undefined): string | null | undefined {
  return url
}
