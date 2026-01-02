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
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError('')
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
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemove = () => {
    if (confirm('Remove this image?')) {
      onImageChange(null)
    }
  }

  return (
    <div className="space-y-3">
      {currentImageUrl && (
        <div className="relative inline-block">
          <img
            src={currentImageUrl}
            alt="Menu item"
            className="w-48 h-48 object-cover rounded-lg border border-border"
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

      <div>
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
          className={`inline-block px-5 py-2 bg-border text-text font-medium rounded-lg cursor-pointer transition-colors ${
            isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-border/80'
          }`}
        >
          {isUploading ? 'Uploading...' : currentImageUrl ? 'Replace Image' : 'Upload Image'}
        </label>
        <p className="text-xs text-muted mt-2">
          JPEG, PNG, or WebP. Max 5MB.
        </p>
      </div>
    </div>
  )
}
