'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

// =============================================================================
// TYPES
// =============================================================================

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

interface CropOverlayProps {
  /** Target aspect ratio (width/height) */
  aspectRatio: number
  /** Current crop box (normalized 0-1) */
  crop: NormalizedCropBox
  /** Callback when crop changes */
  onChange: (crop: NormalizedCropBox) => void
  /** Callback when drag/resize ends (for debounced preview) */
  onChangeEnd?: (crop: NormalizedCropBox) => void
  /** Whether the overlay is interactive */
  disabled?: boolean
}

type DragMode = 'none' | 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w'

// =============================================================================
// HELPERS
// =============================================================================

/** Clamp value to [min, max] */
function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

/** Get cursor style for drag mode */
function getCursor(mode: DragMode): string {
  switch (mode) {
    case 'move': return 'move'
    case 'nw': case 'se': return 'nwse-resize'
    case 'ne': case 'sw': return 'nesw-resize'
    case 'n': case 's': return 'ns-resize'
    case 'e': case 'w': return 'ew-resize'
    default: return 'default'
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export function CropOverlay({
  aspectRatio,
  crop,
  onChange,
  onChangeEnd,
  disabled = false
}: CropOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragMode, setDragMode] = useState<DragMode>('none')
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [cropStart, setCropStart] = useState<NormalizedCropBox>(crop)

  // Handle size constants
  const HANDLE_SIZE = 12
  const EDGE_HANDLE_SIZE = 8

  // Convert normalized to percentage for CSS
  const cropStyle = {
    left: `${crop.x * 100}%`,
    top: `${crop.y * 100}%`,
    width: `${crop.w * 100}%`,
    height: `${crop.h * 100}%`
  }

  // Get normalized mouse position relative to container
  const getNormalizedPosition = useCallback((e: MouseEvent | React.MouseEvent): { x: number; y: number } => {
    if (!containerRef.current) return { x: 0, y: 0 }
    const rect = containerRef.current.getBoundingClientRect()
    return {
      x: clamp((e.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((e.clientY - rect.top) / rect.height, 0, 1)
    }
  }, [])

  // Handle mouse down on different parts
  const handleMouseDown = useCallback((e: React.MouseEvent, mode: DragMode) => {
    if (disabled) return
    e.preventDefault()
    e.stopPropagation()
    setDragMode(mode)
    setDragStart(getNormalizedPosition(e))
    setCropStart(crop)
  }, [disabled, getNormalizedPosition, crop])

  // Handle mouse move
  useEffect(() => {
    if (dragMode === 'none') return

    const handleMouseMove = (e: MouseEvent) => {
      const pos = getNormalizedPosition(e)
      const dx = pos.x - dragStart.x
      const dy = pos.y - dragStart.y

      let newCrop: NormalizedCropBox

      if (dragMode === 'move') {
        // Move the crop box
        const newX = clamp(cropStart.x + dx, 0, 1 - cropStart.w)
        const newY = clamp(cropStart.y + dy, 0, 1 - cropStart.h)
        newCrop = { ...cropStart, x: newX, y: newY }
      } else {
        // Resize with aspect ratio lock
        newCrop = resizeWithAspect(cropStart, dragMode, dx, dy, aspectRatio)
      }

      onChange(newCrop)
    }

    const handleMouseUp = () => {
      // Effect only runs when dragMode !== 'none', so we can always call onChangeEnd
      onChangeEnd?.(crop)
      setDragMode('none')
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragMode, dragStart, cropStart, aspectRatio, onChange, onChangeEnd, getNormalizedPosition, crop])

  // Resize with aspect ratio constraint
  function resizeWithAspect(
    start: NormalizedCropBox,
    mode: DragMode,
    dx: number,
    dy: number,
    aspect: number
  ): NormalizedCropBox {
    let { x, y, w, h } = start
    const minSize = 0.1 // Minimum 10% of image

    // Calculate new dimensions based on resize handle
    switch (mode) {
      case 'se': {
        // Resize from bottom-right corner
        const newW = clamp(w + dx, minSize, 1 - x)
        const newH = newW / aspect
        if (y + newH <= 1) {
          w = newW
          h = newH
        } else {
          h = clamp(1 - y, minSize, 1)
          w = h * aspect
        }
        break
      }
      case 'sw': {
        // Resize from bottom-left corner
        const deltaW = -dx
        const newW = clamp(w + deltaW, minSize, x + w)
        const newH = newW / aspect
        if (y + newH <= 1) {
          x = x + w - newW
          w = newW
          h = newH
        }
        break
      }
      case 'ne': {
        // Resize from top-right corner
        const newW = clamp(w + dx, minSize, 1 - x)
        const newH = newW / aspect
        if (newH <= y + h) {
          const deltaH = newH - h
          y = clamp(y - deltaH, 0, 1 - minSize)
          w = newW
          h = newH
        }
        break
      }
      case 'nw': {
        // Resize from top-left corner
        const deltaW = -dx
        const newW = clamp(w + deltaW, minSize, x + w)
        const newH = newW / aspect
        if (newH <= y + h && newW <= x + w) {
          x = x + w - newW
          y = y + h - newH
          w = newW
          h = newH
        }
        break
      }
      case 'n': {
        // Resize from top edge - adjust height, recalculate width
        const deltaH = -dy
        const newH = clamp(h + deltaH, minSize, y + h)
        const newW = newH * aspect
        if (newW <= 1) {
          y = y + h - newH
          h = newH
          w = newW
          // Center horizontally
          x = clamp(x + (start.w - newW) / 2, 0, 1 - newW)
        }
        break
      }
      case 's': {
        // Resize from bottom edge
        const newH = clamp(h + dy, minSize, 1 - y)
        const newW = newH * aspect
        if (newW <= 1) {
          h = newH
          w = newW
          x = clamp(x + (start.w - newW) / 2, 0, 1 - newW)
        }
        break
      }
      case 'e': {
        // Resize from right edge
        const newW = clamp(w + dx, minSize, 1 - x)
        const newH = newW / aspect
        if (newH <= 1) {
          w = newW
          h = newH
          y = clamp(y + (start.h - newH) / 2, 0, 1 - newH)
        }
        break
      }
      case 'w': {
        // Resize from left edge
        const deltaW = -dx
        const newW = clamp(w + deltaW, minSize, x + w)
        const newH = newW / aspect
        if (newH <= 1) {
          x = x + w - newW
          w = newW
          h = newH
          y = clamp(y + (start.h - newH) / 2, 0, 1 - newH)
        }
        break
      }
    }

    // Final bounds check
    x = clamp(x, 0, 1 - w)
    y = clamp(y, 0, 1 - h)
    w = clamp(w, minSize, 1 - x)
    h = clamp(h, minSize, 1 - y)

    return { x, y, w, h }
  }

  // Handle wheel for zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (disabled) return
    e.preventDefault()

    const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05
    const newW = clamp(crop.w * zoomFactor, 0.1, 1)
    const newH = newW / aspectRatio

    if (newH > 1) return // Can't fit

    // Keep centered
    const newX = clamp(crop.x + (crop.w - newW) / 2, 0, 1 - newW)
    const newY = clamp(crop.y + (crop.h - newH) / 2, 0, 1 - newH)

    const newCrop = { x: newX, y: newY, w: newW, h: newH }
    onChange(newCrop)
    onChangeEnd?.(newCrop)
  }, [disabled, crop, aspectRatio, onChange, onChangeEnd])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ cursor: dragMode !== 'none' ? getCursor(dragMode) : 'default' }}
      onWheel={handleWheel}
    >
      {/* Darkened overlay outside crop area */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Top */}
        <div
          className="absolute left-0 right-0 top-0 bg-black/60"
          style={{ height: `${crop.y * 100}%` }}
        />
        {/* Bottom */}
        <div
          className="absolute left-0 right-0 bottom-0 bg-black/60"
          style={{ height: `${(1 - crop.y - crop.h) * 100}%` }}
        />
        {/* Left */}
        <div
          className="absolute left-0 bg-black/60"
          style={{
            top: `${crop.y * 100}%`,
            height: `${crop.h * 100}%`,
            width: `${crop.x * 100}%`
          }}
        />
        {/* Right */}
        <div
          className="absolute right-0 bg-black/60"
          style={{
            top: `${crop.y * 100}%`,
            height: `${crop.h * 100}%`,
            width: `${(1 - crop.x - crop.w) * 100}%`
          }}
        />
      </div>

      {/* Crop rectangle */}
      <div
        className={`absolute border-2 ${disabled ? 'border-gray-500' : 'border-white'} shadow-lg`}
        style={{
          ...cropStyle,
          cursor: disabled ? 'default' : 'move'
        }}
        onMouseDown={(e) => handleMouseDown(e, 'move')}
      >
        {/* Rule of thirds grid */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
          <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
          <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
          <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
        </div>

        {/* Corner handles */}
        {!disabled && (
          <>
            {/* NW */}
            <div
              className="absolute bg-white border border-gray-800 rounded-sm shadow"
              style={{
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                left: -HANDLE_SIZE / 2,
                top: -HANDLE_SIZE / 2,
                cursor: 'nwse-resize'
              }}
              onMouseDown={(e) => handleMouseDown(e, 'nw')}
            />
            {/* NE */}
            <div
              className="absolute bg-white border border-gray-800 rounded-sm shadow"
              style={{
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                right: -HANDLE_SIZE / 2,
                top: -HANDLE_SIZE / 2,
                cursor: 'nesw-resize'
              }}
              onMouseDown={(e) => handleMouseDown(e, 'ne')}
            />
            {/* SW */}
            <div
              className="absolute bg-white border border-gray-800 rounded-sm shadow"
              style={{
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                left: -HANDLE_SIZE / 2,
                bottom: -HANDLE_SIZE / 2,
                cursor: 'nesw-resize'
              }}
              onMouseDown={(e) => handleMouseDown(e, 'sw')}
            />
            {/* SE */}
            <div
              className="absolute bg-white border border-gray-800 rounded-sm shadow"
              style={{
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                right: -HANDLE_SIZE / 2,
                bottom: -HANDLE_SIZE / 2,
                cursor: 'nwse-resize'
              }}
              onMouseDown={(e) => handleMouseDown(e, 'se')}
            />

            {/* Edge handles */}
            {/* N */}
            <div
              className="absolute bg-white border border-gray-800 rounded-sm shadow"
              style={{
                width: EDGE_HANDLE_SIZE * 3,
                height: EDGE_HANDLE_SIZE,
                left: '50%',
                transform: 'translateX(-50%)',
                top: -EDGE_HANDLE_SIZE / 2,
                cursor: 'ns-resize'
              }}
              onMouseDown={(e) => handleMouseDown(e, 'n')}
            />
            {/* S */}
            <div
              className="absolute bg-white border border-gray-800 rounded-sm shadow"
              style={{
                width: EDGE_HANDLE_SIZE * 3,
                height: EDGE_HANDLE_SIZE,
                left: '50%',
                transform: 'translateX(-50%)',
                bottom: -EDGE_HANDLE_SIZE / 2,
                cursor: 'ns-resize'
              }}
              onMouseDown={(e) => handleMouseDown(e, 's')}
            />
            {/* W */}
            <div
              className="absolute bg-white border border-gray-800 rounded-sm shadow"
              style={{
                width: EDGE_HANDLE_SIZE,
                height: EDGE_HANDLE_SIZE * 3,
                top: '50%',
                transform: 'translateY(-50%)',
                left: -EDGE_HANDLE_SIZE / 2,
                cursor: 'ew-resize'
              }}
              onMouseDown={(e) => handleMouseDown(e, 'w')}
            />
            {/* E */}
            <div
              className="absolute bg-white border border-gray-800 rounded-sm shadow"
              style={{
                width: EDGE_HANDLE_SIZE,
                height: EDGE_HANDLE_SIZE * 3,
                top: '50%',
                transform: 'translateY(-50%)',
                right: -EDGE_HANDLE_SIZE / 2,
                cursor: 'ew-resize'
              }}
              onMouseDown={(e) => handleMouseDown(e, 'e')}
            />
          </>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Calculate initial centered crop box for a given aspect ratio
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
    w = (targetAspect / imageAspect)
  } else {
    // Image is taller than target - fit to width
    w = 1
    h = (imageAspect / targetAspect)
  }

  // Center the crop
  const x = (1 - w) / 2
  const y = (1 - h) / 2

  return { x, y, w, h }
}

/**
 * Convert normalized crop box to pixel coordinates
 */
export function normalizedToPixels(
  crop: NormalizedCropBox,
  imageWidth: number,
  imageHeight: number
): { left: number; top: number; width: number; height: number } {
  return {
    left: Math.round(crop.x * imageWidth),
    top: Math.round(crop.y * imageHeight),
    width: Math.round(crop.w * imageWidth),
    height: Math.round(crop.h * imageHeight)
  }
}
