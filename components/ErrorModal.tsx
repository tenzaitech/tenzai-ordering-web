'use client'

import { useEffect } from 'react'
import { triggerHaptic } from '@/utils/haptic'

interface ErrorModalProps {
  title: string
  message: string
  helper: string
  primaryLabel: string
  secondaryLabel: string
  onPrimary: () => void
  onSecondary: () => void
}

export default function ErrorModal({
  title,
  message,
  helper,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
}: ErrorModalProps) {
  useEffect(() => {
    // Lock scroll
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-sm mx-4 bg-card border border-primary/30 rounded-lg p-6 shadow-xl">
        <h3 className="text-primary font-semibold text-lg mb-2">{title}</h3>
        <p className="text-text mb-1">{message}</p>
        <p className="text-sm text-muted mb-6">{helper}</p>

        <div className="flex gap-3">
          <button
            onClick={() => {
              triggerHaptic()
              onPrimary()
            }}
            className="flex-1 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors"
          >
            {primaryLabel}
          </button>
          <button
            onClick={() => {
              triggerHaptic()
              onSecondary()
            }}
            className="flex-1 py-3 bg-card border border-border text-text font-medium rounded-lg hover:bg-border active:bg-border/80 transition-colors"
          >
            {secondaryLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
