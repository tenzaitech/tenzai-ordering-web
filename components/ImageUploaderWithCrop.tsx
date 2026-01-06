'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { adminFetch } from '@/lib/admin-fetch'
import { uploadMenuImageToStorage, discardUploadedImage } from '@/lib/storage-upload'
import { getInitialCropBox, type NormalizedCropBox } from '@/lib/image-types'

interface ImageUploaderWithCropProps {
  /** Menu code to upload image for */
  menuCode: string
  /** Current image URL (if any) */
  currentImageUrl: string | null
  /** Callback when image changes */
  onImageChange: (url: string | null) => void
}

type CropMode = 'auto' | 'manual'

/**
 * Image uploader with crop/trim support.
 * Uses direct-to-storage upload to bypass 10MB API limit.
 *
 * Features:
 * - Drag & drop or click to upload (supports large files up to 50MB)
 * - Auto mode: Smart trim + center crop (default)
 * - Manual mode: Drag to position crop box
 * - Preview before save
 * - Uses same pipeline as image-import for consistency
 *
 * Upload Flow:
 * 1. Upload file directly to Supabase Storage via signed URL
 * 2. Preview uses storage path (no file upload to API)
 * 3. Apply uses JSON-only endpoint with storage path
 */
export default function ImageUploaderWithCrop({
  menuCode,
  currentImageUrl,
  onImageChange
}: ImageUploaderWithCropProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Editing state
  const [editingFile, setEditingFile] = useState<File | null>(null)
  const [editingPreviewUrl, setEditingPreviewUrl] = useState<string | null>(null)
  const [storagePath, setStoragePath] = useState<string | null>(null)
  const [storageUploadProgress, setStorageUploadProgress] = useState<string | null>(null)
  const [cropMode, setCropMode] = useState<CropMode>('auto')
  const [manualCrop, setManualCrop] = useState<NormalizedCropBox | null>(null)
  const [processedPreview, setProcessedPreview] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null)

  // Target aspect ratio (4:3 is canonical)
  const targetAspect = 4 / 3

  // Display URL
  const displayUrl = currentImageUrl ? `${currentImageUrl}?v=${Date.now()}` : null

  // Fetch processed preview using storage path
  const fetchPreview = useCallback(async (path: string, crop?: NormalizedCropBox) => {
    setPreviewLoading(true)
    try {
      const formData = new FormData()
      formData.append('storage_path', path)
      formData.append('aspect', '4x3')
      if (crop) {
        formData.append('manual_crop', JSON.stringify(crop))
      }

      const res = await adminFetch('/api/admin/image-import/preview-processed', {
        method: 'POST',
        body: formData
      })

      if (res.ok) {
        const data = await res.json()
        setProcessedPreview(`data:image/webp;base64,${data.image_base64}`)
      }
    } catch (err) {
      console.error('Preview fetch error:', err)
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  // Debounced preview fetch
  const debouncedFetchPreview = useCallback(
    (() => {
      let timeout: NodeJS.Timeout | null = null
      return (path: string, crop?: NormalizedCropBox) => {
        if (timeout) clearTimeout(timeout)
        timeout = setTimeout(() => fetchPreview(path, crop), 300)
      }
    })(),
    [fetchPreview]
  )

  // Handle file selection - upload to storage first
  const handleFile = useCallback(async (file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      setError('Invalid file type. Only JPEG, PNG, and WebP are allowed')
      return
    }

    // Increased limit to 50MB since we bypass API routes
    if (file.size > 50 * 1024 * 1024) {
      setError('File too large. Maximum size is 50MB')
      return
    }

    setError('')
    setEditingFile(file)
    setEditingPreviewUrl(URL.createObjectURL(file))
    setCropMode('auto')
    setManualCrop(null)
    setProcessedPreview(null)
    setImageDimensions(null)
    setStoragePath(null)

    // Upload to storage first
    setStorageUploadProgress('Uploading to storage...')
    try {
      const result = await uploadMenuImageToStorage(menuCode, file)

      if (!result.success || !result.storage_path) {
        setError(result.error || 'Failed to upload to storage')
        setStorageUploadProgress(null)
        return
      }

      setStoragePath(result.storage_path)
      setStorageUploadProgress(null)

      // Now fetch preview using storage path
      fetchPreview(result.storage_path)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setStorageUploadProgress(null)
    }
  }, [menuCode, fetchPreview])

  // Handle save (apply from storage)
  const handleSave = async () => {
    if (!storagePath || !menuCode) return

    setIsUploading(true)
    setError('')

    try {
      const body: Record<string, unknown> = {
        menu_code: menuCode,
        storage_path: storagePath,
        mode: cropMode
      }

      if (cropMode === 'manual' && manualCrop) {
        body.manual_crop_4x3 = manualCrop
        body.manual_crop_1x1 = manualCrop
      }

      const res = await adminFetch('/api/admin/menu-image/apply-from-storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (res.status === 401) {
        throw new Error('Unauthorized (admin key missing/invalid)')
      }

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Apply failed')
      }

      const data = await res.json()
      onImageChange(data.image_url)

      // Clean up
      if (editingPreviewUrl) {
        URL.revokeObjectURL(editingPreviewUrl)
      }
      setEditingFile(null)
      setEditingPreviewUrl(null)
      setProcessedPreview(null)
      setManualCrop(null)
      setStoragePath(null)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    } finally {
      setIsUploading(false)
    }
  }

  // Handle cancel editing - also cleanup temp upload from storage
  const handleCancel = async () => {
    // Cleanup temp upload from storage (best-effort, don't block UI)
    if (storagePath && menuCode) {
      discardUploadedImage(menuCode, storagePath).catch(err => {
        console.error('[ImageUploaderWithCrop] Failed to cleanup temp upload:', err)
      })
    }

    // Immediately clear UI state (don't wait for cleanup)
    if (editingPreviewUrl) {
      URL.revokeObjectURL(editingPreviewUrl)
    }
    setEditingFile(null)
    setEditingPreviewUrl(null)
    setProcessedPreview(null)
    setManualCrop(null)
    setCropMode('auto')
    setStoragePath(null)
    setStorageUploadProgress(null)
    setError('')
  }

  // Handle remove existing image
  const handleRemove = async () => {
    if (!menuCode) return

    try {
      await adminFetch('/api/admin/menu-image', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu_code: menuCode })
      })
      onImageChange(null)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    }
  }

  // Handle file input change
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  // Handle drag/drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  // Handle image load (for getting dimensions)
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.target as HTMLImageElement
    const dims = { width: img.naturalWidth, height: img.naturalHeight }
    setImageDimensions(dims)

    // Initialize manual crop box
    if (!manualCrop) {
      const initialCrop = getInitialCropBox(dims.width, dims.height, targetAspect)
      setManualCrop(initialCrop)
    }
  }

  // Handle switching to manual mode
  const handleSwitchToManual = () => {
    setCropMode('manual')
    if (imageDimensions && storagePath) {
      const initialCrop = manualCrop || getInitialCropBox(imageDimensions.width, imageDimensions.height, targetAspect)
      setManualCrop(initialCrop)
      debouncedFetchPreview(storagePath, initialCrop)
    }
  }

  // Handle switching to auto mode
  const handleSwitchToAuto = () => {
    setCropMode('auto')
    setManualCrop(null)
    if (storagePath) {
      fetchPreview(storagePath)
    }
  }

  // Render editing mode
  if (editingFile && editingPreviewUrl) {
    return (
      <div className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {storageUploadProgress && (
          <div className="p-3 bg-blue-500/10 border border-blue-500/50 rounded-lg text-blue-400 text-sm flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            {storageUploadProgress}
          </div>
        )}

        {/* Mode selector */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSwitchToAuto}
            disabled={!storagePath}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              cropMode === 'auto'
                ? 'bg-purple-600 text-white'
                : 'bg-bg-elevated text-text-secondary hover:text-text-primary border border-border'
            } disabled:opacity-50`}
          >
            Auto
          </button>
          <button
            type="button"
            onClick={handleSwitchToManual}
            disabled={!storagePath}
            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
              cropMode === 'manual'
                ? 'bg-orange-600 text-white'
                : 'bg-bg-elevated text-text-secondary hover:text-text-primary border border-border'
            } disabled:opacity-50`}
          >
            Manual
          </button>
        </div>

        {/* Preview area */}
        <div className="grid grid-cols-2 gap-4">
          {/* Original */}
          <div>
            <div className="text-xs text-muted mb-1">Original</div>
            <img
              src={editingPreviewUrl}
              alt="Original"
              className="max-h-48 object-contain rounded border border-border"
              onLoad={handleImageLoad}
            />
          </div>

          {/* Processed preview */}
          <div>
            <div className="text-xs text-muted mb-1">Preview (4:3)</div>
            <div className="relative">
              {previewLoading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded">
                  <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              {processedPreview ? (
                <img
                  src={processedPreview}
                  alt="Preview"
                  className="max-h-48 object-contain rounded border-2 border-green-500/50"
                />
              ) : (
                <div className="h-48 flex items-center justify-center bg-bg-elevated rounded border border-border text-muted text-sm">
                  {storagePath ? 'Processing...' : 'Uploading...'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Manual crop controls */}
        {cropMode === 'manual' && imageDimensions && manualCrop && storagePath && (
          <div className="p-3 bg-bg-elevated rounded border border-border">
            <div className="text-xs text-muted mb-2">Drag to adjust crop position</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted">X Position</label>
                <input
                  type="range"
                  min="0"
                  max={Math.max(0, 1 - manualCrop.w)}
                  step="0.01"
                  value={manualCrop.x}
                  onChange={(e) => {
                    const newCrop = { ...manualCrop, x: parseFloat(e.target.value) }
                    setManualCrop(newCrop)
                    debouncedFetchPreview(storagePath, newCrop)
                  }}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs text-muted">Y Position</label>
                <input
                  type="range"
                  min="0"
                  max={Math.max(0, 1 - manualCrop.h)}
                  step="0.01"
                  value={manualCrop.y}
                  onChange={(e) => {
                    const newCrop = { ...manualCrop, y: parseFloat(e.target.value) }
                    setManualCrop(newCrop)
                    debouncedFetchPreview(storagePath, newCrop)
                  }}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isUploading || previewLoading || !storagePath}
            className="flex-1 py-2 bg-green-600 text-white font-medium rounded hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? 'Saving...' : 'Save Image'}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isUploading}
            className="px-4 py-2 bg-border text-text font-medium rounded hover:bg-border/80 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // Render normal mode (existing image or upload)
  return (
    <div className="space-y-3">
      {displayUrl && (
        <div className="relative inline-block">
          <img
            src={displayUrl}
            alt="Menu item"
            className="w-48 h-36 object-cover rounded-lg border border-border"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors flex items-center justify-center"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragging
            ? 'border-primary bg-primary/10'
            : 'border-border hover:border-primary/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
          id="image-upload-with-crop-input"
        />
        <label
          htmlFor="image-upload-with-crop-input"
          className="cursor-pointer block"
        >
          <div className="text-muted mb-2">
            Drag & drop or click to upload
          </div>
          <div className="text-xs text-muted">
            JPEG, PNG, or WebP. Max 50MB. Will be processed with smart crop/trim.
          </div>
        </label>
      </div>
    </div>
  )
}
