'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { CropOverlay, getInitialCropBox, type NormalizedCropBox } from '@/components/CropOverlay'
import { adminFetch } from '@/lib/admin-fetch'
import { uploadMenuImageToStorage, discardUploadedImage } from '@/lib/storage-upload'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Row status in the import flow:
 * - AUTO: Auto-matched with high confidence
 * - NEED_REVIEW: Auto-matched but needs confirmation
 * - NO_MATCH: No matching menu found
 * - MANUAL: User manually selected a menu
 * - READY: Ready to apply (has valid menu selection)
 * - DISCARDED: User chose to skip this image
 * - APPLIED: Successfully saved
 * - FAILED: Apply failed
 */
type RowStatus = 'AUTO' | 'NEED_REVIEW' | 'NO_MATCH' | 'MANUAL' | 'READY' | 'DISCARDED' | 'APPLIED' | 'FAILED'

/** Aspect ratio for derivatives */
type PreviewAspect = '1x1' | '4x3'

/** Crop mode: auto (smart trim + center crop) or manual (user-drawn crop box) */
type CropMode = 'auto' | 'manual'

/**
 * Processed preview result from the API
 * Shows the EXACT result that will be saved
 */
interface ProcessedPreview {
  image_base64: string
  aspect: PreviewAspect
  trim_applied: boolean
  crop_mode_used: CropMode
  manual_crop_used?: NormalizedCropBox
  original_width: number
  original_height: number
}

interface PreviewResult {
  filename: string
  extracted_name: string
  normalized_name: string
  matched_menu_code: string | null
  matched_menu_name: string | null
  matched_category_code: string | null
  confidence: number
  status: 'AUTO' | 'NEED_REVIEW' | 'NO_MATCH'
  slug_collision?: boolean
  top_candidates?: { menu_code: string; name_en: string; confidence: number }[]
}

interface Candidate {
  menu_code: string
  name_en: string
  category_code: string | null
}

/**
 * Simplified RowState for one-time image import
 *
 * Design principle: "Finish cropping once and never come back"
 * - No focusY sliders (too complex for restaurant owner)
 * - No regenerate concept (just apply again if needed)
 * - Manual crop only when auto isn't good enough
 *
 * NEW: storagePath - Files are uploaded to storage first to bypass 10MB limit
 */
interface RowState {
  filename: string
  file: File
  previewUrl: string
  extractedName: string
  originalStatus: 'AUTO' | 'NEED_REVIEW' | 'NO_MATCH'
  currentStatus: RowStatus
  selectedMenuCode: string | null
  selectedMenuName: string | null
  selectedCategoryCode: string | null
  confidence: number
  slugCollision?: boolean
  topCandidates?: { menu_code: string; name_en: string; confidence: number }[]
  applyResult?: { status: 'updated' | 'failed'; reason?: string; image_url?: string; image_url_1x1?: string }

  // Crop state (simplified: auto by default, manual if user adjusts)
  // When manualCrop is set, it overrides auto-crop for that aspect
  manualCrop1x1?: NormalizedCropBox
  manualCrop4x3?: NormalizedCropBox

  // NEW: Storage path (file is uploaded to storage after menu matching)
  storagePath?: string
  storageUploadError?: string
}

interface ApplyResult {
  filename: string
  menu_code: string
  storage_path_1x1?: string
  storage_path_4x3?: string
  status: 'updated' | 'skipped' | 'failed'
  reason?: string
  image_url?: string       // 4:3 URL (canonical)
  image_url_1x1?: string
  overwritten?: boolean
}

// =============================================================================
// COMPONENT
// =============================================================================

export default function ImageImportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Core state
  const [files, setFiles] = useState<File[]>([])
  const [rows, setRows] = useState<RowState[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'select' | 'preview' | 'done'>('select')

  // Storage upload progress
  const [storageUploadProgress, setStorageUploadProgress] = useState<{ current: number; total: number; filename: string } | null>(null)

  // Focus/Crop mode state
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  const [showSafetyModal, setShowSafetyModal] = useState(false)

  // Crop editor state
  // Design: Show original image with crop overlay + small preview of result
  const [previewAspect, setPreviewAspect] = useState<PreviewAspect>('4x3')
  const [processedPreview, setProcessedPreview] = useState<ProcessedPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const previewAbortRef = useRef<AbortController | null>(null)
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Current crop being edited (local state, saved to row on Apply)
  const [currentCrop, setCurrentCrop] = useState<NormalizedCropBox | null>(null)
  const [originalImageDimensions, setOriginalImageDimensions] = useState<{ width: number; height: number } | null>(null)
  const [cropMode, setCropMode] = useState<CropMode>('auto')

  // Searchable selector state
  const [selectorOpen, setSelectorOpen] = useState<string | null>(null) // filename or null
  const [searchTerm, setSearchTerm] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  // =============================================================================
  // COMPUTED VALUES
  // =============================================================================

  // Build conflict groups: menu_code -> filenames[]
  const conflictGroups = useMemo(() => {
    const groups = new Map<string, string[]>()
    for (const row of rows) {
      if (row.currentStatus === 'DISCARDED' || row.currentStatus === 'APPLIED') continue
      const code = row.selectedMenuCode
      if (!code) continue
      const existing = groups.get(code) || []
      existing.push(row.filename)
      groups.set(code, existing)
    }
    // Return only groups with more than one file
    const conflicts = new Map<string, string[]>()
    for (const [code, filenames] of groups.entries()) {
      if (filenames.length > 1) {
        conflicts.set(code, filenames)
      }
    }
    return conflicts
  }, [rows])

  // Get conflict group for a row
  const getConflictGroup = useCallback((filename: string): string[] | null => {
    for (const [, filenames] of conflictGroups.entries()) {
      if (filenames.includes(filename)) {
        return filenames
      }
    }
    return null
  }, [conflictGroups])

  // Rows sorted with conflicts grouped together
  const sortedRows = useMemo(() => {
    const sorted = [...rows]
    // Sort by: conflict groups first (adjacent), then by filename
    sorted.sort((a, b) => {
      const aConflict = getConflictGroup(a.filename)
      const bConflict = getConflictGroup(b.filename)
      const aCode = a.selectedMenuCode || ''
      const bCode = b.selectedMenuCode || ''

      // Both in conflict groups
      if (aConflict && bConflict) {
        if (aCode !== bCode) return aCode.localeCompare(bCode)
        return a.filename.localeCompare(b.filename)
      }
      // Only a in conflict
      if (aConflict) return -1
      // Only b in conflict
      if (bConflict) return 1
      // Neither in conflict
      return a.filename.localeCompare(b.filename)
    })
    return sorted
  }, [rows, getConflictGroup])

  // Ready count (can be applied) - must have storage path
  const readyCount = useMemo(() => {
    return rows.filter(r =>
      r.selectedMenuCode &&
      r.storagePath &&
      r.currentStatus !== 'DISCARDED' &&
      r.currentStatus !== 'APPLIED' &&
      r.currentStatus !== 'FAILED'
    ).length
  }, [rows])

  // Unresolved count (needs attention)
  const unresolvedCount = useMemo(() => {
    return rows.filter(r =>
      r.currentStatus !== 'DISCARDED' &&
      r.currentStatus !== 'APPLIED' &&
      (r.currentStatus === 'NO_MATCH' && !r.selectedMenuCode ||
        r.currentStatus === 'NEED_REVIEW' ||
        getConflictGroup(r.filename))
    ).length
  }, [rows, getConflictGroup])

  // Applied count (can be regenerated)
  const appliedCount = useMemo(() => {
    return rows.filter(r => r.currentStatus === 'APPLIED').length
  }, [rows])

  // Pending upload count (matched but not yet uploaded to storage)
  const pendingUploadCount = useMemo(() => {
    return rows.filter(r =>
      r.selectedMenuCode &&
      !r.storagePath &&
      r.currentStatus !== 'DISCARDED' &&
      r.currentStatus !== 'APPLIED'
    ).length
  }, [rows])

  // Filtered candidates for search
  const filteredCandidates = useMemo(() => {
    if (!searchTerm.trim()) return candidates.slice(0, 30)
    const term = searchTerm.toLowerCase()
    return candidates
      .filter(c =>
        c.menu_code.toLowerCase().includes(term) ||
        c.name_en.toLowerCase().includes(term)
      )
      .slice(0, 30)
  }, [candidates, searchTerm])

  // =============================================================================
  // FILE HANDLING
  // =============================================================================

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles) return
    const fileArray = Array.from(selectedFiles)
    setFiles(fileArray)
    setError(null)
    setStep('select')
    setRows([])
    setCandidates([])
  }

  const handlePreview = async () => {
    if (files.length === 0) {
      setError('Please select files first')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const filenames = files.map(f => f.name)

      const res = await fetch('/api/admin/image-import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filenames })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Preview failed')
      }

      const data = await res.json()
      const results: PreviewResult[] = data.results
      setCandidates(data.candidates)

      // Build row states (storage paths will be added after upload)
      const newRows: RowState[] = results.map(r => {
        const file = files.find(f => f.name === r.filename)!
        return {
          filename: r.filename,
          file,
          previewUrl: URL.createObjectURL(file),
          extractedName: r.extracted_name,
          originalStatus: r.status,
          currentStatus: r.status,
          selectedMenuCode: r.matched_menu_code,
          selectedMenuName: r.matched_menu_name,
          selectedCategoryCode: r.matched_category_code,
          confidence: r.confidence,
          slugCollision: r.slug_collision,
          topCandidates: r.top_candidates
          // storagePath: undefined - will be set after upload
        }
      })

      setRows(newRows)
      setStep('preview')

      // Auto-upload files with matched menus to storage
      await uploadMatchedFilesToStorage(newRows)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Upload files with matched menus to storage
   * This runs after preview matching to prepare files for apply
   */
  const uploadMatchedFilesToStorage = async (rowsToUpload: RowState[]) => {
    const matchedRows = rowsToUpload.filter(r => r.selectedMenuCode)

    if (matchedRows.length === 0) return

    for (let i = 0; i < matchedRows.length; i++) {
      const row = matchedRows[i]
      setStorageUploadProgress({
        current: i + 1,
        total: matchedRows.length,
        filename: row.filename
      })

      try {
        const result = await uploadMenuImageToStorage(row.selectedMenuCode!, row.file)

        if (result.success && result.storage_path) {
          setRows(prev => prev.map(r =>
            r.filename === row.filename
              ? { ...r, storagePath: result.storage_path }
              : r
          ))
        } else {
          setRows(prev => prev.map(r =>
            r.filename === row.filename
              ? { ...r, storageUploadError: result.error || 'Upload failed' }
              : r
          ))
        }
      } catch (err) {
        setRows(prev => prev.map(r =>
          r.filename === row.filename
            ? { ...r, storageUploadError: err instanceof Error ? err.message : 'Upload failed' }
            : r
        ))
      }
    }

    setStorageUploadProgress(null)
  }

  // =============================================================================
  // ROW ACTIONS
  // =============================================================================

  const updateRow = (filename: string, updates: Partial<RowState>) => {
    setRows(prev => prev.map(r =>
      r.filename === filename ? { ...r, ...updates } : r
    ))
  }

  const handleSelectMenu = async (filename: string, menuCode: string) => {
    const candidate = candidates.find(c => c.menu_code === menuCode)
    if (!candidate) return

    const row = rows.find(r => r.filename === filename)
    if (!row) return

    updateRow(filename, {
      selectedMenuCode: menuCode,
      selectedMenuName: candidate.name_en,
      selectedCategoryCode: candidate.category_code,
      currentStatus: 'MANUAL'
    })

    // Close selector
    setSelectorOpen(null)
    setSearchTerm('')

    // Upload to storage if not already uploaded (menu changed)
    if (!row.storagePath || row.selectedMenuCode !== menuCode) {
      try {
        const result = await uploadMenuImageToStorage(menuCode, row.file)
        if (result.success && result.storage_path) {
          updateRow(filename, { storagePath: result.storage_path, storageUploadError: undefined })
        } else {
          updateRow(filename, { storageUploadError: result.error || 'Upload failed' })
        }
      } catch (err) {
        updateRow(filename, { storageUploadError: err instanceof Error ? err.message : 'Upload failed' })
      }
    }
  }

  const handleDiscard = (filename: string) => {
    const row = rows.find(r => r.filename === filename)

    // Cleanup temp upload from storage (best-effort, don't block UI)
    if (row?.storagePath && row?.selectedMenuCode) {
      discardUploadedImage(row.selectedMenuCode, row.storagePath).catch(err => {
        console.error('[IMAGE_IMPORT] Failed to cleanup temp upload:', err)
      })
    }

    // Immediately update UI (don't wait for cleanup)
    updateRow(filename, { currentStatus: 'DISCARDED', storagePath: undefined })
  }

  const handleReset = (filename: string) => {
    const row = rows.find(r => r.filename === filename)
    if (!row) return

    // Reset to original state
    updateRow(filename, {
      currentStatus: row.originalStatus,
      selectedMenuCode: row.originalStatus === 'NO_MATCH' ? null : row.selectedMenuCode,
      applyResult: undefined
    })
  }

  const handleUseThisImage = (filename: string) => {
    // In conflict group, selecting this one discards others
    const conflict = getConflictGroup(filename)
    if (conflict) {
      // Cleanup temp uploads for discarded rows (best-effort)
      const discardedRows = rows.filter(r =>
        conflict.includes(r.filename) &&
        r.filename !== filename &&
        r.storagePath &&
        r.selectedMenuCode
      )
      for (const row of discardedRows) {
        discardUploadedImage(row.selectedMenuCode!, row.storagePath!).catch(err => {
          console.error('[IMAGE_IMPORT] Failed to cleanup temp upload for conflict:', err)
        })
      }

      setRows(prev => prev.map(r => {
        if (conflict.includes(r.filename)) {
          if (r.filename === filename) {
            return { ...r, currentStatus: 'READY' as RowStatus }
          } else {
            return { ...r, currentStatus: 'DISCARDED' as RowStatus, storagePath: undefined }
          }
        }
        return r
      }))
    } else {
      updateRow(filename, { currentStatus: 'READY' })
    }
  }

  // =============================================================================
  // APPLY SINGLE ROW (JSON-only, uses storage path)
  // =============================================================================

  /**
   * Apply a single image using JSON-only endpoint
   *
   * Flow:
   * 1. File already uploaded to storage (storagePath set)
   * 2. Call apply-from-storage with storage_path + crop settings
   * 3. Server processes and updates DB
   */
  const handleApplySingle = async (filename: string, shouldAdvance = true) => {
    const row = rows.find(r => r.filename === filename)
    if (!row || !row.selectedMenuCode || !row.storagePath) return

    setLoading(true)

    try {
      const body: Record<string, unknown> = {
        menu_code: row.selectedMenuCode,
        storage_path: row.storagePath,
        mode: row.manualCrop4x3 ? 'manual' : 'auto'
      }

      if (row.manualCrop4x3) {
        body.manual_crop_4x3 = row.manualCrop4x3
      }
      if (row.manualCrop1x1) {
        body.manual_crop_1x1 = row.manualCrop1x1
      }

      const res = await adminFetch('/api/admin/menu-image/apply-from-storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Apply failed')
      }

      updateRow(filename, {
        currentStatus: data.success ? 'APPLIED' : 'FAILED',
        applyResult: {
          status: data.success ? 'updated' : 'failed',
          reason: data.error,
          image_url: data.image_url,
          image_url_1x1: data.image_url_1x1
        }
      })

      // UX: After successful apply, auto-advance or close modal
      if (data.success && shouldAdvance && focusIndex !== null) {
        setTimeout(() => {
          const currentRows = rows
          const hasUnresolved = currentRows.some(r =>
            r.filename !== filename &&
            r.currentStatus !== 'APPLIED' &&
            r.currentStatus !== 'DISCARDED' &&
            r.currentStatus !== 'FAILED' &&
            (r.currentStatus === 'NEED_REVIEW' || r.currentStatus === 'NO_MATCH' || !r.selectedMenuCode)
          )

          if (hasUnresolved) {
            goToNextUnresolved()
          } else {
            setFocusIndex(null)
          }
        }, 100)
      }

    } catch (err) {
      updateRow(filename, {
        currentStatus: 'FAILED',
        applyResult: {
          status: 'failed',
          reason: err instanceof Error ? err.message : 'Unknown error'
        }
      })
    } finally {
      setLoading(false)
    }
  }

  // =============================================================================
  // APPLY ALL (JSON-only, uses storage paths)
  // =============================================================================

  /**
   * Apply all pending images using JSON-only endpoints
   * Processes sequentially to avoid overwhelming the server
   */
  const handleApplyAll = async () => {
    const toApply = rows.filter(r =>
      r.selectedMenuCode &&
      r.storagePath &&
      r.currentStatus !== 'DISCARDED' &&
      r.currentStatus !== 'APPLIED' &&
      r.currentStatus !== 'FAILED'
    )

    if (toApply.length === 0) return

    setShowSafetyModal(false)
    setLoading(true)

    try {
      for (let i = 0; i < toApply.length; i++) {
        const row = toApply[i]

        const body: Record<string, unknown> = {
          menu_code: row.selectedMenuCode,
          storage_path: row.storagePath,
          mode: row.manualCrop4x3 ? 'manual' : 'auto'
        }

        if (row.manualCrop4x3) {
          body.manual_crop_4x3 = row.manualCrop4x3
        }
        if (row.manualCrop1x1) {
          body.manual_crop_1x1 = row.manualCrop1x1
        }

        try {
          const res = await adminFetch('/api/admin/menu-image/apply-from-storage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          })

          const data = await res.json()

          updateRow(row.filename, {
            currentStatus: data.success ? 'APPLIED' : 'FAILED',
            applyResult: {
              status: data.success ? 'updated' : 'failed',
              reason: data.error,
              image_url: data.image_url,
              image_url_1x1: data.image_url_1x1
            }
          })
        } catch (err) {
          updateRow(row.filename, {
            currentStatus: 'FAILED',
            applyResult: {
              status: 'failed',
              reason: err instanceof Error ? err.message : 'Unknown error'
            }
          })
        }
      }

      setStep('done')

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Apply failed')
    } finally {
      setLoading(false)
    }
  }

  // =============================================================================
  // PROCESSED PREVIEW (Real-time Crop Editor)
  // =============================================================================

  /**
   * Fetch a processed preview using storage path
   * This shows the EXACT result that will be saved
   */
  const fetchProcessedPreview = useCallback(async (
    storagePath: string,
    aspect: PreviewAspect,
    manualCrop?: NormalizedCropBox
  ) => {
    // Cancel any pending request
    if (previewAbortRef.current) {
      previewAbortRef.current.abort()
    }

    const abortController = new AbortController()
    previewAbortRef.current = abortController

    setPreviewLoading(true)

    try {
      const formData = new FormData()
      formData.append('storage_path', storagePath)
      formData.append('aspect', aspect)

      if (manualCrop) {
        formData.append('manual_crop', JSON.stringify(manualCrop))
      }

      const res = await adminFetch('/api/admin/image-import/preview-processed', {
        method: 'POST',
        body: formData,
        signal: abortController.signal
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Preview failed')
      }

      const data = await res.json()
      setProcessedPreview({
        image_base64: data.image_base64,
        aspect: data.aspect,
        trim_applied: data.trim_applied,
        crop_mode_used: data.crop_mode_used || 'auto',
        manual_crop_used: data.manual_crop_used,
        original_width: data.original_width,
        original_height: data.original_height
      })

      // Store original dimensions for crop overlay
      if (data.original_width && data.original_height) {
        setOriginalImageDimensions({
          width: data.original_width,
          height: data.original_height
        })
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return
      }
      console.error('[PREVIEW] Failed to fetch processed preview:', err)
      setProcessedPreview(null)
    } finally {
      setPreviewLoading(false)
    }
  }, [])

  /**
   * Debounced preview update - waits 300ms after crop adjustment
   */
  const debouncedFetchPreview = useCallback((
    storagePath: string,
    aspect: PreviewAspect,
    manualCrop?: NormalizedCropBox
  ) => {
    if (previewDebounceRef.current) {
      clearTimeout(previewDebounceRef.current)
    }

    previewDebounceRef.current = setTimeout(() => {
      fetchProcessedPreview(storagePath, aspect, manualCrop)
    }, 300)
  }, [fetchProcessedPreview])

  // Clear preview when crop editor closes
  useEffect(() => {
    if (focusIndex === null) {
      setProcessedPreview(null)
      setPreviewLoading(false)
      setCurrentCrop(null)
      setOriginalImageDimensions(null)
      setCropMode('auto')
      if (previewAbortRef.current) {
        previewAbortRef.current.abort()
      }
      if (previewDebounceRef.current) {
        clearTimeout(previewDebounceRef.current)
      }
    }
  }, [focusIndex])

  // Fetch initial preview when entering crop editor or changing aspect
  useEffect(() => {
    if (focusIndex === null) return
    const currentRows = sortedRows
    const row = currentRows[focusIndex]
    if (!row || !row.storagePath) return

    // Load existing manual crop for this aspect (if any)
    const manualCrop = previewAspect === '1x1' ? row.manualCrop1x1 : row.manualCrop4x3
    setCurrentCrop(manualCrop || null)

    // Set crop mode based on whether manual crop exists
    setCropMode(manualCrop ? 'manual' : 'auto')

    // Fetch preview using storage path
    fetchProcessedPreview(row.storagePath, previewAspect, manualCrop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusIndex, previewAspect, fetchProcessedPreview])

  // =============================================================================
  // FOCUS MODE NAVIGATION
  // =============================================================================

  const focusRow = focusIndex !== null ? sortedRows[focusIndex] : null

  const findNextUnresolved = (currentIndex: number, direction: 1 | -1): number | null => {
    const len = sortedRows.length
    for (let i = 1; i <= len; i++) {
      const idx = (currentIndex + i * direction + len) % len
      const row = sortedRows[idx]
      if (
        row.currentStatus !== 'APPLIED' &&
        row.currentStatus !== 'DISCARDED' &&
        (row.currentStatus === 'NEED_REVIEW' ||
          row.currentStatus === 'NO_MATCH' ||
          getConflictGroup(row.filename))
      ) {
        return idx
      }
    }
    return null
  }

  const goToNextUnresolved = () => {
    const next = findNextUnresolved(focusIndex ?? -1, 1)
    if (next !== null) setFocusIndex(next)
  }

  const goToPrevUnresolved = () => {
    const prev = findNextUnresolved(focusIndex ?? sortedRows.length, -1)
    if (prev !== null) setFocusIndex(prev)
  }

  const cycleInConflict = (direction: 1 | -1) => {
    if (!focusRow) return
    const conflict = getConflictGroup(focusRow.filename)
    if (!conflict) return

    const idxInConflict = conflict.indexOf(focusRow.filename)
    const newIdxInConflict = (idxInConflict + direction + conflict.length) % conflict.length
    const newFilename = conflict[newIdxInConflict]
    const newIdx = sortedRows.findIndex(r => r.filename === newFilename)
    if (newIdx >= 0) setFocusIndex(newIdx)
  }

  // =============================================================================
  // KEYBOARD SHORTCUTS (Focus Mode only)
  // =============================================================================

  useEffect(() => {
    if (focusIndex === null) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          setSelectorOpen(null)
          setSearchTerm('')
        }
        return
      }

      switch (e.key.toLowerCase()) {
        case 'n':
          e.preventDefault()
          goToNextUnresolved()
          break
        case 'p':
          e.preventDefault()
          goToPrevUnresolved()
          break
        case 'enter':
          e.preventDefault()
          if (focusRow) handleUseThisImage(focusRow.filename)
          break
        case 'd':
          e.preventDefault()
          if (focusRow) handleDiscard(focusRow.filename)
          break
        case 'a':
          e.preventDefault()
          if (focusRow && focusRow.selectedMenuCode && focusRow.storagePath) handleApplySingle(focusRow.filename)
          break
        case 'arrowleft':
          e.preventDefault()
          cycleInConflict(-1)
          break
        case 'arrowright':
          e.preventDefault()
          cycleInConflict(1)
          break
        case '/':
          e.preventDefault()
          if (focusRow) {
            setSelectorOpen(focusRow.filename)
            setSearchTerm(focusRow.extractedName)
            setTimeout(() => searchInputRef.current?.focus(), 50)
          }
          break
        case 'escape':
          e.preventDefault()
          setFocusIndex(null)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [focusIndex, focusRow])

  // =============================================================================
  // SELECTOR KEYBOARD
  // =============================================================================

  const handleSelectorKeyDown = (e: React.KeyboardEvent, filename: string) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex(prev => Math.min(prev + 1, filteredCandidates.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filteredCandidates[highlightedIndex]) {
          handleSelectMenu(filename, filteredCandidates[highlightedIndex].menu_code)
        }
        break
      case 'Escape':
        e.preventDefault()
        setSelectorOpen(null)
        setSearchTerm('')
        break
    }
  }

  // =============================================================================
  // RESET
  // =============================================================================

  const handleFullReset = () => {
    // Cleanup all temp uploads from storage (best-effort)
    for (const row of rows) {
      if (row.storagePath && row.selectedMenuCode && row.currentStatus !== 'APPLIED') {
        discardUploadedImage(row.selectedMenuCode, row.storagePath).catch(err => {
          console.error('[IMAGE_IMPORT] Failed to cleanup temp upload on reset:', err)
        })
      }
    }

    // Revoke object URLs
    rows.forEach(r => URL.revokeObjectURL(r.previewUrl))
    setFiles([])
    setRows([])
    setCandidates([])
    setStep('select')
    setError(null)
    setFocusIndex(null)
    setStorageUploadProgress(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Cleanup URLs on unmount
  useEffect(() => {
    return () => {
      rows.forEach(r => URL.revokeObjectURL(r.previewUrl))
    }
  }, [])

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  const getStatusBadge = (status: RowStatus) => {
    const styles: Record<RowStatus, string> = {
      AUTO: 'bg-green-500/20 text-green-400',
      NEED_REVIEW: 'bg-yellow-500/20 text-yellow-400',
      NO_MATCH: 'bg-red-500/20 text-red-400',
      MANUAL: 'bg-blue-500/20 text-blue-400',
      READY: 'bg-green-500/30 text-green-300',
      DISCARDED: 'bg-gray-500/20 text-gray-400 line-through',
      APPLIED: 'bg-green-600/30 text-green-300',
      FAILED: 'bg-red-600/30 text-red-300'
    }
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded ${styles[status]}`}>
        {status}
      </span>
    )
  }

  // =============================================================================
  // RENDER: FILE SELECTION
  // =============================================================================

  if (step === 'select') {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-text-primary mb-6">Menu Image Import</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="p-6 bg-bg-surface border border-border-subtle rounded-lg">
          <h2 className="text-lg font-medium text-text-primary mb-4">Select Images</h2>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="block w-full text-sm text-text-secondary
              file:mr-4 file:py-2 file:px-4
              file:rounded file:border-0
              file:text-sm file:font-medium
              file:bg-accent file:text-white
              hover:file:bg-accent/80
              cursor-pointer"
          />
          {files.length > 0 && (
            <p className="mt-3 text-sm text-text-secondary">
              Selected: {files.length} file(s)
            </p>
          )}
          <button
            onClick={handlePreview}
            disabled={files.length === 0 || loading}
            className="mt-4 px-6 py-2.5 bg-accent text-white font-medium rounded hover:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Analyzing...' : 'Preview & Match'}
          </button>
        </div>

        <div className="mt-6 text-xs text-text-muted p-4 bg-bg-elevated rounded">
          <p className="font-medium mb-2">Instructions:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Select image files (e.g., "P011 Ten Zaru Udon.jpg")</li>
            <li>Preview matches filenames to menu_items.name_en</li>
            <li>Files are uploaded to storage directly (supports up to 50MB)</li>
            <li>Review and confirm mappings before applying</li>
            <li>Smart crop generates two WEBP derivatives:</li>
            <li className="ml-4">• 1:1 (1024×1024): menu/&#123;menu_code&#125;/1x1_v*.webp</li>
            <li className="ml-4">• 4:3 (1440×1080): menu/&#123;menu_code&#125;/4x3_v*.webp</li>
            <li>menu_items.image_url is set to the 4:3 derivative</li>
          </ul>
        </div>
      </div>
    )
  }

  // =============================================================================
  // RENDER: PREVIEW/REVIEW
  // =============================================================================

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-text-primary">Image Import</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-text-secondary">
            Ready: {readyCount} | Applied: {appliedCount} | Unresolved: {unresolvedCount} | Conflicts: {conflictGroups.size}
          </span>
          <button
            onClick={() => setShowSafetyModal(true)}
            disabled={readyCount === 0 || loading}
            className="px-4 py-2 bg-green-600 text-white font-medium rounded hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apply All ({readyCount})
          </button>
          <button
            onClick={handleFullReset}
            disabled={loading}
            className="px-4 py-2 bg-bg-elevated border border-border-subtle text-text-primary rounded hover:bg-bg-elevated/80"
          >
            Reset
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Storage upload progress */}
      {storageUploadProgress && (
        <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded text-blue-400 text-sm flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
          Uploading to storage: {storageUploadProgress.current}/{storageUploadProgress.total} - {storageUploadProgress.filename}
        </div>
      )}

      {/* Conflict Warning */}
      {conflictGroups.size > 0 && (
        <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/30 rounded text-orange-400 text-sm">
          {conflictGroups.size} conflict group(s) detected. Multiple images target the same menu.
          Use "Use this image" to select one per group.
        </div>
      )}

      {/* Main Table */}
      <div className="bg-bg-surface border border-border-subtle rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-220px)] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-bg-surface border-b border-border-subtle">
              <tr>
                <th className="text-left py-2 px-3 text-text-secondary font-medium w-20">Preview</th>
                <th className="text-left py-2 px-3 text-text-secondary font-medium">Filename</th>
                <th className="text-left py-2 px-3 text-text-secondary font-medium">Menu</th>
                <th className="text-left py-2 px-3 text-text-secondary font-medium w-16">Conf.</th>
                <th className="text-left py-2 px-3 text-text-secondary font-medium w-28">Status</th>
                <th className="text-left py-2 px-3 text-text-secondary font-medium w-48">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, idx) => {
                const conflict = getConflictGroup(row.filename)
                const isFirstInConflict = conflict && conflict[0] === row.filename
                const isInConflict = !!conflict

                return (
                  <tr
                    key={row.filename}
                    className={`border-b border-border-subtle/50 hover:bg-bg-elevated/30 ${
                      isInConflict ? 'bg-orange-500/5' : ''
                    } ${row.currentStatus === 'DISCARDED' ? 'opacity-50' : ''}`}
                  >
                    {/* Thumbnail */}
                    <td className="py-2 px-3">
                      <img
                        src={row.previewUrl}
                        alt={row.filename}
                        className="w-16 h-16 object-cover rounded cursor-pointer hover:ring-2 hover:ring-accent"
                        onClick={() => setFocusIndex(idx)}
                      />
                    </td>

                    {/* Filename */}
                    <td className="py-2 px-3">
                      <div className="font-mono text-xs text-text-primary truncate max-w-[200px]" title={row.filename}>
                        {row.filename}
                      </div>
                      <div className="text-xs text-text-muted truncate max-w-[200px]">
                        {row.extractedName}
                      </div>
                      {isFirstInConflict && (
                        <div className="mt-1 text-xs text-orange-400 font-medium">
                          CONFLICT GROUP ({conflict!.length} images)
                        </div>
                      )}
                      {row.storageUploadError && (
                        <div className="mt-1 text-xs text-red-400">
                          Upload: {row.storageUploadError}
                        </div>
                      )}
                    </td>

                    {/* Menu Selector */}
                    <td className="py-2 px-3 relative">
                      {selectorOpen === row.filename ? (
                        <div className="relative">
                          <input
                            ref={searchInputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => {
                              setSearchTerm(e.target.value)
                              setHighlightedIndex(0)
                            }}
                            onKeyDown={(e) => handleSelectorKeyDown(e, row.filename)}
                            placeholder="Search menu..."
                            className="w-full px-2 py-1 text-xs bg-bg-elevated border border-accent rounded text-text-primary"
                            autoFocus
                          />
                          <div className="absolute z-50 mt-1 w-72 max-h-60 overflow-y-auto bg-bg-surface border border-border-subtle rounded shadow-lg">
                            {/* Top candidates */}
                            {row.topCandidates && row.topCandidates.length > 0 && !searchTerm && (
                              <div className="px-2 py-1 bg-bg-elevated text-xs text-text-muted border-b border-border-subtle">
                                Top matches:
                              </div>
                            )}
                            {row.topCandidates && !searchTerm && row.topCandidates.map((c, i) => (
                              <div
                                key={`top-${c.menu_code}`}
                                onClick={() => handleSelectMenu(row.filename, c.menu_code)}
                                className="px-3 py-2 text-xs hover:bg-accent/20 cursor-pointer border-b border-border-subtle/50"
                              >
                                <span className="text-accent">[{i + 1}]</span> {c.menu_code}: {c.name_en}
                                <span className="ml-2 text-text-muted">({c.confidence}%)</span>
                              </div>
                            ))}
                            {row.topCandidates && row.topCandidates.length > 0 && !searchTerm && (
                              <div className="px-2 py-1 bg-bg-elevated text-xs text-text-muted border-b border-border-subtle">
                                All menus:
                              </div>
                            )}
                            {/* Filtered list */}
                            {filteredCandidates.map((c, i) => (
                              <div
                                key={c.menu_code}
                                onClick={() => handleSelectMenu(row.filename, c.menu_code)}
                                className={`px-3 py-2 text-xs cursor-pointer ${
                                  i === highlightedIndex ? 'bg-accent/30' : 'hover:bg-accent/10'
                                }`}
                              >
                                <span className="font-medium">{c.menu_code}</span>: {c.name_en}
                              </div>
                            ))}
                            {filteredCandidates.length === 0 && (
                              <div className="px-3 py-2 text-xs text-text-muted">No matches</div>
                            )}
                          </div>
                          <button
                            onClick={() => { setSelectorOpen(null); setSearchTerm('') }}
                            className="absolute right-1 top-1 text-text-muted hover:text-text-primary"
                          >
                            ×
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => {
                            if (row.currentStatus !== 'APPLIED') {
                              setSelectorOpen(row.filename)
                              setSearchTerm(row.extractedName)
                              setHighlightedIndex(0)
                            }
                          }}
                          className={`px-2 py-1 text-xs border rounded cursor-pointer truncate max-w-[200px] ${
                            row.selectedMenuCode
                              ? 'border-border-subtle bg-bg-elevated text-text-primary'
                              : 'border-red-500/30 bg-red-500/5 text-red-400'
                          } ${row.currentStatus === 'APPLIED' ? 'cursor-default' : 'hover:border-accent'}`}
                        >
                          {row.selectedMenuCode
                            ? `${row.selectedMenuCode}: ${row.selectedMenuName}`
                            : 'Select menu...'}
                        </div>
                      )}
                    </td>

                    {/* Confidence */}
                    <td className="py-2 px-3 text-text-secondary text-xs">
                      {row.confidence}%
                    </td>

                    {/* Status */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1">
                        {getStatusBadge(row.currentStatus)}
                        {row.slugCollision && (
                          <span className="px-1.5 py-0.5 text-xs bg-orange-500/20 text-orange-400 rounded">
                            SLUG
                          </span>
                        )}
                        {row.storagePath && (
                          <span className="px-1.5 py-0.5 text-xs bg-green-500/20 text-green-400 rounded" title="Uploaded to storage">
                            ✓
                          </span>
                        )}
                      </div>
                      {row.applyResult?.status === 'failed' && (
                        <div className="text-xs text-red-400 mt-1 truncate max-w-[150px]" title={row.applyResult.reason}>
                          {row.applyResult.reason}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-1">
                        {row.currentStatus !== 'APPLIED' && row.currentStatus !== 'FAILED' && (
                          <>
                            {row.selectedMenuCode && row.storagePath && row.currentStatus !== 'DISCARDED' && (
                              <button
                                onClick={() => handleApplySingle(row.filename)}
                                disabled={loading}
                                className="px-2 py-1 text-xs bg-green-600/80 text-white rounded hover:bg-green-500 disabled:opacity-50"
                              >
                                Apply
                              </button>
                            )}
                            {row.currentStatus !== 'DISCARDED' && (
                              <button
                                onClick={() => handleDiscard(row.filename)}
                                className="px-2 py-1 text-xs bg-gray-600/50 text-gray-300 rounded hover:bg-gray-500/50"
                              >
                                Discard
                              </button>
                            )}
                            {isInConflict && row.currentStatus !== 'DISCARDED' && row.currentStatus !== 'READY' && (
                              <button
                                onClick={() => handleUseThisImage(row.filename)}
                                className="px-2 py-1 text-xs bg-accent/80 text-white rounded hover:bg-accent"
                              >
                                Use this
                              </button>
                            )}
                          </>
                        )}
                        {(row.currentStatus === 'DISCARDED' || row.currentStatus === 'FAILED') && (
                          <button
                            onClick={() => handleReset(row.filename)}
                            className="px-2 py-1 text-xs bg-blue-600/50 text-blue-300 rounded hover:bg-blue-500/50"
                          >
                            Reset
                          </button>
                        )}
                        {row.currentStatus === 'APPLIED' && row.applyResult?.image_url && (
                          <div className="flex items-center gap-1">
                            <a
                              href={row.applyResult.image_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-1.5 py-0.5 text-xs text-green-400 hover:underline"
                              title="4:3 derivative"
                            >
                              4:3
                            </a>
                            {row.applyResult.image_url_1x1 && (
                              <a
                                href={row.applyResult.image_url_1x1}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-1.5 py-0.5 text-xs text-accent hover:underline"
                                title="1:1 derivative"
                              >
                                1:1
                              </a>
                            )}
                          </div>
                        )}
                        <button
                          onClick={() => setFocusIndex(idx)}
                          className="px-2 py-1 text-xs text-text-muted hover:text-text-primary"
                          title="Focus mode"
                        >
                          ⛶
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Keyboard hints */}
      <div className="mt-4 text-xs text-text-muted">
        Click thumbnail or ⛶ for Focus Mode. Shortcuts: N/P (next/prev unresolved), Enter (use), D (discard), A (apply), ←/→ (cycle conflict), / (search), Esc (close)
      </div>

      {/* =============================================================================
          FOCUS MODE MODAL - Simplified Crop Editor
          Design: "Finish cropping once and never come back"
          - Auto mode: Smart trim + center crop (default)
          - Manual mode: Click-drag crop overlay
          ============================================================================= */}
      {focusIndex !== null && focusRow && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setFocusIndex(null)}>
          <div className="bg-bg-surface rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-muted">
                  {focusIndex + 1} / {sortedRows.length}
                </span>
                {getStatusBadge(focusRow.currentStatus)}
                {getConflictGroup(focusRow.filename) && (
                  <span className="px-2 py-0.5 text-xs bg-orange-500/20 text-orange-400 rounded">
                    CONFLICT ({getConflictGroup(focusRow.filename)!.length})
                  </span>
                )}
                {!focusRow.storagePath && (
                  <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded">
                    Not uploaded
                  </span>
                )}
              </div>
              <button onClick={() => setFocusIndex(null)} className="text-text-muted hover:text-text-primary text-xl">×</button>
            </div>

            {/* Content */}
            <div className="flex">
              {/* Main image area with crop overlay */}
              <div className="flex-1 p-4 flex flex-col items-center justify-center bg-black/20 min-h-[500px]">
                {/* Controls row */}
                <div className="mb-4 flex flex-wrap gap-2 justify-center items-center">
                  {/* Aspect toggle */}
                  <div className="flex rounded overflow-hidden border border-border-subtle">
                    <button
                      onClick={() => setPreviewAspect('1x1')}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                        previewAspect === '1x1'
                          ? 'bg-accent text-white'
                          : 'bg-bg-elevated text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      1:1
                    </button>
                    <button
                      onClick={() => setPreviewAspect('4x3')}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                        previewAspect === '4x3'
                          ? 'bg-green-600 text-white'
                          : 'bg-bg-elevated text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      4:3
                    </button>
                  </div>

                  <div className="w-px h-6 bg-border-subtle mx-1" />

                  {/* Mode toggle */}
                  <div className="flex rounded overflow-hidden border border-border-subtle">
                    <button
                      onClick={() => {
                        setCropMode('auto')
                        // Clear manual crop for this aspect
                        const updates = previewAspect === '1x1'
                          ? { manualCrop1x1: undefined }
                          : { manualCrop4x3: undefined }
                        updateRow(focusRow.filename, updates)
                        setCurrentCrop(null)
                        // Fetch auto preview
                        if (focusRow.storagePath) {
                          fetchProcessedPreview(focusRow.storagePath, previewAspect, undefined)
                        }
                      }}
                      disabled={!focusRow.storagePath}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                        cropMode === 'auto'
                          ? 'bg-purple-600 text-white'
                          : 'bg-bg-elevated text-text-secondary hover:text-text-primary'
                      } disabled:opacity-50`}
                    >
                      Auto
                    </button>
                    <button
                      onClick={() => {
                        setCropMode('manual')
                        // Initialize crop box and IMMEDIATELY save to row state
                        if (originalImageDimensions && focusRow.storagePath) {
                          const aspectRatio = previewAspect === '1x1' ? 1 : 4/3
                          const existingCrop = previewAspect === '1x1'
                            ? focusRow.manualCrop1x1
                            : focusRow.manualCrop4x3
                          const cropToUse = existingCrop || getInitialCropBox(
                            originalImageDimensions.width,
                            originalImageDimensions.height,
                            aspectRatio
                          )
                          setCurrentCrop(cropToUse)
                          if (!existingCrop) {
                            const updates = previewAspect === '1x1'
                              ? { manualCrop1x1: cropToUse }
                              : { manualCrop4x3: cropToUse }
                            updateRow(focusRow.filename, updates)
                          }
                          debouncedFetchPreview(focusRow.storagePath, previewAspect, cropToUse)
                        }
                      }}
                      disabled={!focusRow.storagePath}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                        cropMode === 'manual'
                          ? 'bg-orange-600 text-white'
                          : 'bg-bg-elevated text-text-secondary hover:text-text-primary'
                      } disabled:opacity-50`}
                    >
                      Manual
                    </button>
                  </div>
                </div>

                {/* Image area */}
                <div className="relative flex-1 flex items-center justify-center w-full">
                  {previewLoading && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20 rounded">
                      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}

                  {!focusRow.storagePath ? (
                    /* Not uploaded yet */
                    <div className="text-center text-text-muted">
                      <p className="mb-2">Image not uploaded to storage yet</p>
                      <p className="text-xs">Select a menu to trigger upload</p>
                    </div>
                  ) : cropMode === 'manual' ? (
                    /* Manual Mode: Original image with crop overlay */
                    <div className="relative" style={{ maxHeight: '45vh' }}>
                      <img
                        src={focusRow.previewUrl}
                        alt={focusRow.filename}
                        className="max-h-[45vh] max-w-full object-contain rounded"
                        onLoad={(e) => {
                          const img = e.target as HTMLImageElement
                          setOriginalImageDimensions({
                            width: img.naturalWidth,
                            height: img.naturalHeight
                          })
                          if (!currentCrop && focusRow.storagePath) {
                            const aspectRatio = previewAspect === '1x1' ? 1 : 4/3
                            const existingCrop = previewAspect === '1x1'
                              ? focusRow.manualCrop1x1
                              : focusRow.manualCrop4x3
                            const cropToUse = existingCrop || getInitialCropBox(
                              img.naturalWidth,
                              img.naturalHeight,
                              aspectRatio
                            )
                            setCurrentCrop(cropToUse)
                            if (!existingCrop) {
                              const updates = previewAspect === '1x1'
                                ? { manualCrop1x1: cropToUse }
                                : { manualCrop4x3: cropToUse }
                              updateRow(focusRow.filename, updates)
                              debouncedFetchPreview(focusRow.storagePath, previewAspect, cropToUse)
                            }
                          }
                        }}
                      />
                      {currentCrop && (
                        <CropOverlay
                          aspectRatio={previewAspect === '1x1' ? 1 : 4/3}
                          crop={currentCrop}
                          onChange={setCurrentCrop}
                          onChangeEnd={(newCrop) => {
                            const updates = previewAspect === '1x1'
                              ? { manualCrop1x1: newCrop }
                              : { manualCrop4x3: newCrop }
                            updateRow(focusRow.filename, updates)
                            if (focusRow.storagePath) {
                              debouncedFetchPreview(focusRow.storagePath, previewAspect, newCrop)
                            }
                          }}
                          disabled={previewLoading}
                        />
                      )}
                    </div>
                  ) : (
                    /* Auto Mode: Show processed preview */
                    processedPreview ? (
                      <img
                        src={`data:image/webp;base64,${processedPreview.image_base64}`}
                        alt="Processed preview"
                        className={`max-h-[45vh] max-w-full object-contain rounded border-2 ${
                          previewAspect === '1x1' ? 'border-accent' : 'border-green-500'
                        }`}
                      />
                    ) : (
                      <img
                        src={focusRow.previewUrl}
                        alt={focusRow.filename}
                        className="max-h-[45vh] max-w-full object-contain opacity-50"
                      />
                    )
                  )}
                </div>

                {/* Status badges */}
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
                  <span className={`px-2 py-1 rounded ${
                    previewAspect === '1x1' ? 'bg-accent/20 text-accent' : 'bg-green-500/20 text-green-400'
                  }`}>
                    {previewAspect === '1x1' ? '1024×1024' : '1440×1080'}
                  </span>
                  {cropMode === 'auto' ? (
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded">
                      Auto optimized
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded">
                      Manual crop
                    </span>
                  )}
                  {processedPreview?.trim_applied && cropMode === 'auto' && (
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                      Smart trim applied
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-text-muted text-center">
                  {cropMode === 'manual'
                    ? 'Drag to move. Drag corners to resize. Scroll to zoom.'
                    : 'Auto mode uses smart trim + center crop. Switch to Manual if adjustment needed.'
                  }
                </p>
              </div>

              {/* Right panel */}
              <div className="w-72 p-4 border-l border-border-subtle overflow-y-auto flex flex-col">
                {/* Info */}
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-text-muted">Filename</div>
                    <div className="text-sm text-text-primary font-mono break-all">{focusRow.filename}</div>
                  </div>
                  <div>
                    <div className="text-xs text-text-muted">Extracted Name</div>
                    <div className="text-sm text-text-primary">{focusRow.extractedName}</div>
                  </div>

                  {/* Menu selector */}
                  <div>
                    <div className="text-xs text-text-muted mb-1">Menu</div>
                    {selectorOpen === focusRow.filename ? (
                      <div className="relative">
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={searchTerm}
                          onChange={(e) => { setSearchTerm(e.target.value); setHighlightedIndex(0) }}
                          onKeyDown={(e) => handleSelectorKeyDown(e, focusRow.filename)}
                          placeholder="Type to search..."
                          className="w-full px-2 py-1 text-sm bg-bg-elevated border border-accent rounded text-text-primary"
                          autoFocus
                        />
                        <div className="mt-1 max-h-40 overflow-y-auto bg-bg-elevated border border-border-subtle rounded">
                          {focusRow.topCandidates && !searchTerm && (
                            <>
                              <div className="px-2 py-1 text-xs text-text-muted bg-bg-surface">Top matches:</div>
                              {focusRow.topCandidates.map((c, i) => (
                                <div
                                  key={`top-${c.menu_code}`}
                                  onClick={() => handleSelectMenu(focusRow.filename, c.menu_code)}
                                  className="px-2 py-1.5 text-xs hover:bg-accent/20 cursor-pointer"
                                >
                                  <span className="text-accent">[{i + 1}]</span> {c.menu_code}: {c.name_en}
                                </div>
                              ))}
                              <div className="px-2 py-1 text-xs text-text-muted bg-bg-surface border-t border-border-subtle">All:</div>
                            </>
                          )}
                          {filteredCandidates.map((c, i) => (
                            <div
                              key={c.menu_code}
                              onClick={() => handleSelectMenu(focusRow.filename, c.menu_code)}
                              className={`px-2 py-1.5 text-xs cursor-pointer ${
                                i === highlightedIndex ? 'bg-accent/30' : 'hover:bg-accent/10'
                              }`}
                            >
                              {c.menu_code}: {c.name_en}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          if (focusRow.currentStatus !== 'APPLIED') {
                            setSelectorOpen(focusRow.filename)
                            setSearchTerm(focusRow.extractedName)
                          }
                        }}
                        className={`px-2 py-1.5 text-sm border rounded cursor-pointer ${
                          focusRow.selectedMenuCode
                            ? 'border-border-subtle bg-bg-elevated text-text-primary'
                            : 'border-red-500/30 bg-red-500/5 text-red-400'
                        }`}
                      >
                        {focusRow.selectedMenuCode
                          ? `${focusRow.selectedMenuCode}: ${focusRow.selectedMenuName}`
                          : 'Click to select...'}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs text-text-muted">Match confidence</div>
                    <div className="text-sm text-text-primary">{focusRow.confidence}%</div>
                  </div>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Actions */}
                <div className="mt-4 space-y-2">
                  {focusRow.currentStatus !== 'APPLIED' && focusRow.currentStatus !== 'FAILED' && (
                    <>
                      {getConflictGroup(focusRow.filename) && focusRow.currentStatus !== 'DISCARDED' && (
                        <button
                          onClick={() => handleUseThisImage(focusRow.filename)}
                          className="w-full py-2 text-sm bg-accent text-white rounded hover:bg-accent/80"
                        >
                          Use this image (Enter)
                        </button>
                      )}
                      {focusRow.selectedMenuCode && focusRow.storagePath && focusRow.currentStatus !== 'DISCARDED' && (
                        <button
                          onClick={() => handleApplySingle(focusRow.filename)}
                          disabled={loading}
                          className="w-full py-2.5 text-sm bg-green-600 text-white font-medium rounded hover:bg-green-500 disabled:opacity-50"
                        >
                          Apply (A)
                        </button>
                      )}
                      {focusRow.currentStatus !== 'DISCARDED' && (
                        <button
                          onClick={() => handleDiscard(focusRow.filename)}
                          className="w-full py-2 text-sm bg-gray-600/50 text-gray-300 rounded hover:bg-gray-500/50"
                        >
                          Discard (D)
                        </button>
                      )}
                    </>
                  )}
                  {focusRow.currentStatus === 'APPLIED' && (
                    <div className="p-3 bg-green-500/10 border border-green-500/30 rounded text-center">
                      <div className="text-sm text-green-400 font-medium">Applied</div>
                      {focusRow.applyResult?.image_url && (
                        <div className="mt-2 flex gap-2 justify-center">
                          <a
                            href={focusRow.applyResult.image_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 text-xs bg-green-600/50 text-green-300 rounded hover:bg-green-500/50"
                          >
                            View 4:3
                          </a>
                          {focusRow.applyResult.image_url_1x1 && (
                            <a
                              href={focusRow.applyResult.image_url_1x1}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 text-xs bg-accent/50 text-accent rounded hover:bg-accent/40"
                            >
                              View 1:1
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {(focusRow.currentStatus === 'DISCARDED' || focusRow.currentStatus === 'FAILED') && (
                    <button
                      onClick={() => handleReset(focusRow.filename)}
                      className="w-full py-2 text-sm bg-blue-600/50 text-blue-300 rounded hover:bg-blue-500/50"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* Navigation */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={goToPrevUnresolved}
                    className="flex-1 py-2 text-xs bg-bg-elevated border border-border-subtle rounded hover:bg-bg-elevated/80"
                  >
                    ← Prev (P)
                  </button>
                  <button
                    onClick={goToNextUnresolved}
                    className="flex-1 py-2 text-xs bg-bg-elevated border border-border-subtle rounded hover:bg-bg-elevated/80"
                  >
                    Next (N) →
                  </button>
                </div>
                {getConflictGroup(focusRow.filename) && (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => cycleInConflict(-1)}
                      className="flex-1 py-2 text-xs bg-orange-500/20 text-orange-400 rounded hover:bg-orange-500/30"
                    >
                      ← Conflict
                    </button>
                    <button
                      onClick={() => cycleInConflict(1)}
                      className="flex-1 py-2 text-xs bg-orange-500/20 text-orange-400 rounded hover:bg-orange-500/30"
                    >
                      Conflict →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =============================================================================
          SAFETY GATE MODAL
          ============================================================================= */}
      {showSafetyModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-bg-surface rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-text-primary mb-4">Confirm Apply All</h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Images to upload:</span>
                <span className="text-text-primary font-medium">{readyCount}</span>
              </div>
              {conflictGroups.size > 0 && (
                <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded text-orange-400">
                  {conflictGroups.size} unresolved conflict group(s).
                  Please resolve or discard duplicates first.
                </div>
              )}
              <div className="text-xs text-text-muted">
                This will generate smart-cropped WEBP derivatives (1:1 + 4:3) and update menu_items.image_url for all ready rows.
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowSafetyModal(false)}
                className="flex-1 py-2 bg-bg-elevated border border-border-subtle text-text-primary rounded hover:bg-bg-elevated/80"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyAll}
                disabled={conflictGroups.size > 0 || loading}
                className="flex-1 py-2 bg-green-600 text-white rounded hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Applying...' : 'Apply All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
