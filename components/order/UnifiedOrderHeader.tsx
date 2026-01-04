'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCustomerTheme } from '@/hooks/useTheme'
import { useTextScale } from '@/hooks/useTextScale'
import { triggerHaptic } from '@/utils/haptic'

// Exported constant for consistent positioning of elements below the header
export const UNIFIED_HEADER_HEIGHT = 56 // px (matches py-3 + content height)

interface UnifiedOrderHeaderProps {
  title: string
  showBack?: boolean
  backHref?: string
  showMenu?: boolean
  showMyOrders?: boolean
  showCart?: boolean
}

export default function UnifiedOrderHeader({
  title,
  showBack = true,
  backHref = '/order/menu',
  showMenu = true,
  showMyOrders = true,
  showCart = true,
}: UnifiedOrderHeaderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const { language, setLanguage } = useLanguage()
  const { theme, toggleTheme, mounted } = useCustomerTheme()
  const { scaleLabel, increment, decrement, canIncrement, canDecrement, mounted: scaleMounted } = useTextScale()

  // Settings panel state
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

  // Enable customer text scaling on body
  useEffect(() => {
    document.body.setAttribute('data-customer-scale', 'true')
    return () => {
      document.body.removeAttribute('data-customer-scale')
    }
  }, [])

  // Close settings on route change
  useEffect(() => {
    setSettingsOpen(false)
  }, [pathname])

  // Close settings on outside click
  useEffect(() => {
    if (!settingsOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [settingsOpen])

  const handleBack = () => {
    triggerHaptic()
    // Try router.back(), fallback to backHref
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push(backHref)
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 bg-bg-surface z-50 border-b border-border-subtle">
      <div className="max-w-mobile mx-auto px-4 py-3 flex items-center justify-between">
        {/* Left: Back + Title */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {showBack && (
            <button
              onClick={handleBack}
              className="p-1.5 -ml-1.5 text-text-secondary hover:text-text-primary active:text-text-primary transition-colors"
              aria-label={language === 'th' ? 'กลับ' : 'Back'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h1 className="text-lg font-semibold text-text-primary truncate">{title}</h1>
        </div>

        {/* Right: Quick actions + Language */}
        <div className="flex items-center gap-1">
          {/* My Orders */}
          {showMyOrders && (
            <button
              onClick={() => {
                triggerHaptic()
                router.push('/order/status')
              }}
              className="p-2 text-text-secondary hover:text-text-primary active:text-text-primary transition-colors"
              aria-label={language === 'th' ? 'ออเดอร์ของฉัน' : 'My Orders'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </button>
          )}

          {/* Menu */}
          {showMenu && (
            <button
              onClick={() => {
                triggerHaptic()
                router.push('/order/menu')
              }}
              className="p-2 text-text-secondary hover:text-text-primary active:text-text-primary transition-colors"
              aria-label={language === 'th' ? 'เมนู' : 'Menu'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}

          {/* Cart */}
          {showCart && (
            <button
              onClick={() => {
                triggerHaptic()
                router.push('/order/cart')
              }}
              className="p-2 text-text-secondary hover:text-text-primary active:text-text-primary transition-colors"
              aria-label={language === 'th' ? 'ตะกร้า' : 'Cart'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </button>
          )}

          {/* Settings Button + Panel */}
          <div className="relative ml-1" ref={settingsRef}>
            <button
              onClick={() => {
                triggerHaptic()
                setSettingsOpen(!settingsOpen)
              }}
              className="p-2 text-text-secondary hover:text-text-primary active:text-accent transition-colors"
              aria-label={language === 'th' ? 'ตั้งค่า' : 'Settings'}
              aria-expanded={settingsOpen}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>

            {/* Settings Panel */}
            {settingsOpen && (mounted || scaleMounted) && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-bg-elevated border border-border-subtle rounded-lg shadow-lg overflow-hidden z-50">
                {/* Language */}
                <div className="p-3 border-b border-border-subtle">
                  <label className="text-xs text-text-muted mb-2 block">
                    {language === 'th' ? 'ภาษา' : 'Language'}
                  </label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        triggerHaptic()
                        setLanguage('th')
                      }}
                      className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                        language === 'th'
                          ? 'bg-accent text-white'
                          : 'bg-bg-surface text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      ไทย
                    </button>
                    <button
                      onClick={() => {
                        triggerHaptic()
                        setLanguage('en')
                      }}
                      className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                        language === 'en'
                          ? 'bg-accent text-white'
                          : 'bg-bg-surface text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      English
                    </button>
                  </div>
                </div>

                {/* Text Size */}
                {scaleMounted && (
                  <div className="p-3 border-b border-border-subtle">
                    <label className="text-xs text-text-muted mb-2 block">
                      {language === 'th' ? 'ขนาดตัวอักษร' : 'Text Size'}
                    </label>
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          triggerHaptic()
                          decrement()
                        }}
                        disabled={!canDecrement}
                        className="w-10 h-10 flex items-center justify-center rounded-md bg-bg-surface text-text-primary hover:bg-bg-root active:bg-accent active:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label={language === 'th' ? 'ลดขนาด' : 'Decrease'}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      <span className="text-base font-semibold text-text-primary min-w-[60px] text-center">
                        {scaleLabel}
                      </span>
                      <button
                        onClick={() => {
                          triggerHaptic()
                          increment()
                        }}
                        disabled={!canIncrement}
                        className="w-10 h-10 flex items-center justify-center rounded-md bg-bg-surface text-text-primary hover:bg-bg-root active:bg-accent active:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-label={language === 'th' ? 'เพิ่มขนาด' : 'Increase'}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* Theme */}
                {mounted && (
                  <div className="p-3">
                    <label className="text-xs text-text-muted mb-2 block">
                      {language === 'th' ? 'ธีม' : 'Theme'}
                    </label>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          triggerHaptic()
                          if (theme !== 'dark') toggleTheme()
                        }}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                          theme === 'dark'
                            ? 'bg-accent text-white'
                            : 'bg-bg-surface text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                        {language === 'th' ? 'มืด' : 'Dark'}
                      </button>
                      <button
                        onClick={() => {
                          triggerHaptic()
                          if (theme !== 'light') toggleTheme()
                        }}
                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-1.5 ${
                          theme === 'light'
                            ? 'bg-accent text-white'
                            : 'bg-bg-surface text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        {language === 'th' ? 'สว่าง' : 'Light'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
