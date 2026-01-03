'use client'

import { ReactNode } from 'react'

interface BottomCTABarProps {
  children: ReactNode
  className?: string
}

/**
 * Reusable sticky bottom CTA bar with safe-area padding
 * Used on menu, item detail, cart, payment, edit pages
 */
export default function BottomCTABar({ children, className = '' }: BottomCTABarProps) {
  return (
    <div className={`fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg shadow-black/30 z-40 ${className}`}>
      <div className="max-w-mobile mx-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  )
}

interface CTAButtonProps {
  children: ReactNode
  onClick?: () => void
  href?: string
  variant?: 'primary' | 'secondary'
  disabled?: boolean
  className?: string
}

export function CTAButton({ children, onClick, variant = 'primary', disabled = false, className = '' }: CTAButtonProps) {
  const baseClasses = 'flex-1 py-3.5 font-medium rounded-lg transition-colors text-center'
  const variantClasses = variant === 'primary'
    ? 'bg-primary text-white hover:bg-primary/90 active:bg-primary/80 disabled:bg-border disabled:text-muted'
    : 'bg-bg border border-border text-text hover:bg-border active:bg-border/80'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses} ${className}`}
    >
      {children}
    </button>
  )
}
