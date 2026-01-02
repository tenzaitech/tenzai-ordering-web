'use client'

import { useState, useRef } from 'react'
import { adminFetch } from '@/lib/admin-fetch'

interface ImageUploaderProps {
  currentImageUrl: string | null
  onImageChange: (url: string | null) => void
}

export default function ImageUploader({ currentImageUrl, onImageChange }: ImageUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const displayUrl = previewUrl || (currentImageUrl ? `${currentImageUrl}?v=${Date.now()}` : null)

  const handleFile = async (file: File) => {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      setError('Invalid file type. Only JPEG, PNG, and WebP are allowed')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Maximum size is 5MB')
      return
    }

    setError('')

    const localPreview = URL.createObjectURL(file)
    setPreviewUrl(localPreview)
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await adminFetch('/api/admin/upload-image', {
        method: 'POST',
        body: formData
      })

      if (res.status === 401) {
        throw new Error('Unauthorized (admin key missing/invalid)')
      }

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const data = await res.json()
      onImageChange(data.url)
      setPreviewUrl(null)
      URL.revokeObjectURL(localPreview)
    } catch (err: any) {
      setError(err.message)
      setPreviewUrl(null)
      URL.revokeObjectURL(localPreview)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleRemove = () => {
    onImageChange(null)
    setPreviewUrl(null)
  }

  return (
    <div className="space-y-3">
      {displayUrl && (
        <div className="relative inline-block">
          <img
            src={displayUrl}
            alt="Menu item"
            className="w-48 h-48 object-cover rounded-lg border border-border"
          />
          {isUploading && (
            <div className="absolute inset-0 bg-black/60 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm">Uploading...</span>
            </div>
          )}
          {!isUploading && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors flex items-center justify-center"
            >
              ×
            </button>
          )}
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
        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          disabled={isUploading}
          className="hidden"
          id="image-upload-input"
        />
        <label
          htmlFor="image-upload-input"
          className="cursor-pointer block"
        >
          <div className="text-muted mb-2">
            {isUploading ? 'Uploading...' : 'Drag & drop or click to upload'}
          </div>
          <div className="text-xs text-muted">
            JPEG, PNG, or WebP. Max 5MB.
          </div>
        </label>
      </div>
    </div>
  )
}
