'use client'

import { useState } from 'react'
import Image from 'next/image'

// Default focus for 1:1 crops (food plating typically lower in frame)
const DEFAULT_FOCUS_Y_1X1 = 80

interface MenuThumbProps {
  src: string | null | undefined
  alt: string
  /** Image sizes hint for Next/Image optimization */
  sizes?: string
  /** Additional className for the container */
  className?: string
  /** Vertical focus point 0-100 (default 80 for 1:1 thumbnails) */
  focusY?: number
}

/**
 * Premium menu thumbnail with:
 * - Blurred background layer for depth
 * - Gradient scrim overlay (theme-aware)
 * - Border/shadow that adapts to theme
 * - Skeleton placeholder with fade-in on load
 */
export default function MenuThumb({ src, alt, sizes = '112px', className = '', focusY }: MenuThumbProps) {
  const [loaded, setLoaded] = useState(false)

  // Clamp focusY to 0-100, use default if undefined
  const effectiveFocusY = focusY !== undefined ? Math.max(0, Math.min(100, focusY)) : DEFAULT_FOCUS_Y_1X1
  const objectPosition = `50% ${effectiveFocusY}%`

  // Handle null/empty src
  if (!src) {
    return (
      <div className={`relative w-full h-full rounded-lg overflow-hidden ${className}`}>
        {/* Empty state placeholder */}
        <div className="absolute inset-0 bg-neutral-100 dark:bg-bg-elevated" />
      </div>
    )
  }

  return (
    <div
      className={`
        relative w-full h-full rounded-lg overflow-hidden
        border border-black/10 dark:border-white/10
        shadow-sm dark:shadow-none
        bg-neutral-100 dark:bg-bg-elevated
        ${className}
      `}
    >
      {/* Skeleton placeholder - visible until loaded */}
      <div
        className={`
          absolute inset-0 z-0
          bg-gradient-to-br from-neutral-200 via-neutral-100 to-neutral-200
          dark:from-bg-surface dark:via-bg-elevated dark:to-bg-surface
          animate-pulse
          transition-opacity duration-200
          ${loaded ? 'opacity-0' : 'opacity-100'}
        `}
      />

      {/* Blurred background layer for depth */}
      <div className="absolute inset-0 z-[1] overflow-hidden">
        <Image
          src={src}
          alt=""
          fill
          className={`
            object-cover scale-110 blur-xl
            transition-opacity duration-200
            ${loaded ? 'opacity-[0.12] dark:opacity-[0.28]' : 'opacity-0'}
          `}
          style={{ objectPosition }}
          sizes={sizes}
          aria-hidden="true"
        />
      </div>

      {/* Main sharp image */}
      <Image
        src={src}
        alt={alt}
        fill
        className={`
          relative z-[2]
          object-cover
          transition-opacity duration-200
          ${loaded ? 'opacity-100' : 'opacity-0'}
        `}
        style={{ objectPosition }}
        sizes={sizes}
        onLoadingComplete={() => setLoaded(true)}
      />

      {/* Gradient scrim overlay - theme-aware */}
      <div
        className={`
          absolute inset-0 z-[3] pointer-events-none
          bg-gradient-to-t from-black/8 via-transparent to-transparent
          dark:from-black/30 dark:via-black/5 dark:to-transparent
          transition-opacity duration-200
          ${loaded ? 'opacity-100' : 'opacity-0'}
        `}
      />
    </div>
  )
}
