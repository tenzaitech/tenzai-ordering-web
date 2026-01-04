'use client'

import { useRouter } from 'next/navigation'
import { useLanguage } from '@/contexts/LanguageContext'
import { triggerHaptic } from '@/utils/haptic'

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
  const { language, setLanguage } = useLanguage()

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

          {/* Language Toggle */}
          <div className="flex items-center ml-1 border-l border-border-subtle pl-2">
            <button
              onClick={() => setLanguage('th')}
              className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                language === 'th'
                  ? 'text-accent'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              TH
            </button>
            <span className="text-border-subtle text-xs mx-0.5">|</span>
            <button
              onClick={() => setLanguage('en')}
              className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                language === 'en'
                  ? 'text-accent'
                  : 'text-text-secondary hover:text-text-primary'
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
