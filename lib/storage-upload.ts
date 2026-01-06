/**
 * Client-side Storage Upload Helper
 *
 * Uploads files directly to Supabase Storage via signed URLs,
 * bypassing Next.js API routes entirely to avoid the 10MB limit.
 *
 * Flow:
 * 1. Request signed URL from server (with admin auth)
 * 2. Upload file directly to Storage via signed URL
 * 3. Return the storage path for use in apply-from-storage
 */

import { adminFetch } from './admin-fetch'

interface SignedUrlResponse {
  signed_url: string
  storage_path: string
  expires_in: number
}

interface UploadResult {
  success: boolean
  storage_path?: string
  error?: string
}

/**
 * Request a signed upload URL from the server
 */
async function requestSignedUploadUrl(
  menuCode: string,
  extension: string = 'webp'
): Promise<SignedUrlResponse> {
  const res = await adminFetch('/api/admin/storage-upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ menu_code: menuCode, extension })
  })

  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Failed to get upload URL')
  }

  return res.json()
}

/**
 * Upload a file directly to Supabase Storage via signed URL
 */
async function uploadToSignedUrl(
  signedUrl: string,
  file: File | Blob
): Promise<void> {
  // Supabase signed upload URLs expect a PUT request
  const res = await fetch(signedUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type || 'application/octet-stream'
    }
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Upload failed (${res.status}): ${text}`)
  }
}

/**
 * Upload an image file to Supabase Storage for a menu item
 *
 * This function:
 * 1. Requests a signed upload URL from the server
 * 2. Uploads the file directly to Storage
 * 3. Returns the storage path for use in subsequent API calls
 *
 * @param menuCode - The menu code to upload for
 * @param file - The image file to upload
 * @returns Upload result with storage path
 */
export async function uploadMenuImageToStorage(
  menuCode: string,
  file: File
): Promise<UploadResult> {
  try {
    // Determine extension from file type
    let extension = 'webp'
    if (file.type === 'image/jpeg') extension = 'jpg'
    else if (file.type === 'image/png') extension = 'png'
    else if (file.type === 'image/webp') extension = 'webp'

    // Step 1: Get signed URL
    const { signed_url, storage_path } = await requestSignedUploadUrl(menuCode, extension)

    // Step 2: Upload directly to Storage
    await uploadToSignedUrl(signed_url, file)

    return {
      success: true,
      storage_path
    }

  } catch (error) {
    console.error('[STORAGE_UPLOAD] Upload failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed'
    }
  }
}

/**
 * Upload multiple image files for batch import
 *
 * @param files - Array of { menuCode, file } pairs
 * @param onProgress - Optional progress callback (index, total, currentFile)
 * @returns Array of upload results
 */
export async function uploadMenuImagesInBatch(
  files: Array<{ menuCode: string; file: File; filename: string }>,
  onProgress?: (index: number, total: number, filename: string) => void
): Promise<Array<{ filename: string; result: UploadResult }>> {
  const results: Array<{ filename: string; result: UploadResult }> = []

  for (let i = 0; i < files.length; i++) {
    const { menuCode, file, filename } = files[i]

    if (onProgress) {
      onProgress(i, files.length, filename)
    }

    const result = await uploadMenuImageToStorage(menuCode, file)
    results.push({ filename, result })
  }

  return results
}

/**
 * Delete a temporary upload from Storage
 *
 * Called when user discards an image before applying.
 * Safe to call multiple times (idempotent).
 *
 * @param menuCode - The menu code the upload belongs to
 * @param storagePath - The full storage path to delete
 * @returns true if cleanup succeeded or file didn't exist
 */
export async function discardUploadedImage(
  menuCode: string,
  storagePath: string
): Promise<boolean> {
  // Only attempt cleanup if path looks like a temp upload
  const expectedPrefix = `menu/${menuCode}/uploads/`
  if (!storagePath.startsWith(expectedPrefix)) {
    console.warn('[STORAGE_UPLOAD] Skipping cleanup: not a temp upload path', storagePath)
    return true // Not an error, just nothing to clean
  }

  try {
    const res = await adminFetch('/api/admin/menu-image/discard-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menu_code: menuCode, storage_path: storagePath })
    })

    if (!res.ok) {
      const data = await res.json()
      console.error('[STORAGE_UPLOAD] Discard failed:', data.error)
      return false
    }

    return true
  } catch (error) {
    console.error('[STORAGE_UPLOAD] Discard error:', error)
    return false
  }
}
