'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCustomerTheme } from '@/hooks/useTheme'

// Routes that should NOT show TopBar (use their own headers)
const HIDDEN_TOPBAR_ROUTES = [
  '/order/cart',
  '/order/checkout',
  '/order/payment',
  '/order/status',
  '/order/edit',
  '/order/confirmed',
  '/order/menu',  // Menu page uses UnifiedOrderHeader + category bar
]

export default function TopBar() {
  const router = useRouter()
  const pathname = usePathname()
  const { language, setLanguage } = useLanguage()
  const { theme, toggleTheme, mounted } = useCustomerTheme()

  // Skip rendering on pages with custom headers
  const shouldHide = HIDDEN_TOPBAR_ROUTES.some(route => pathname?.startsWith(route))
  if (shouldHide) {
    return null
  }

  return (
    <header className="sticky top-0 bg-bg-surface z-10 px-5 py-4 border-b border-border-subtle">
      <div className="max-w-mobile mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Brand */}
          <div className="w-9 h-9 bg-accent rounded flex items-center justify-center">
            <span className="text-white font-bold text-base">T</span>
          </div>
          {/* My Orders - Clear entry point */}
          <button
            onClick={() => router.push('/order/status')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-bg-elevated border border-border-subtle text-sm font-medium text-text-primary hover:bg-bg-surface active:bg-bg-elevated transition-colors"
          >
            <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {language === 'th' ? 'ออเดอร์ของฉัน' : 'My Orders'}
          </button>
        </div>

        <div className="flex items-center gap-3">
          {mounted && (
            <button
              onClick={toggleTheme}
              className="p-1.5 text-text-secondary hover:text-text-primary"
              aria-label="Toggle theme"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {theme === 'dark' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                )}
              </svg>
            </button>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLanguage('th')}
              className={`px-2.5 py-1 text-sm font-medium ${
                language === 'th' ? 'text-accent' : 'text-text-secondary'
              }`}
            >
              TH
            </button>
            <span className="text-border-subtle">|</span>
            <button
              onClick={() => setLanguage('en')}
              className={`px-2.5 py-1 text-sm font-medium ${
                language === 'en' ? 'text-accent' : 'text-text-secondary'
              }`}
            >
              EN
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
