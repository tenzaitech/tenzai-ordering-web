'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/contexts/CartContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { triggerHaptic } from '@/utils/haptic'
import UnifiedOrderHeader from '@/components/order/UnifiedOrderHeader'

export default function CartPage() {
  const router = useRouter()
  const { items, updateQuantity, removeItem, getTotalPrice } = useCart()
  const { language, t } = useLanguage()
  const [mounted, setMounted] = useState(false)
  const [navDirection, setNavDirection] = useState<'forward' | 'backward'>('forward')

  // Restore scroll position on mount
  useEffect(() => {
    const savedScrollPosition = sessionStorage.getItem('cartScrollPosition')
    if (savedScrollPosition) {
      window.scrollTo(0, parseInt(savedScrollPosition, 10))
      sessionStorage.removeItem('cartScrollPosition')
    }
    const direction = sessionStorage.getItem('navigationDirection') as 'forward' | 'backward' || 'forward'
    sessionStorage.removeItem('navigationDirection')
    setNavDirection(direction)
    setMounted(true)
  }, [])

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-bg">
        {/* Unified header outside transform */}
        <UnifiedOrderHeader title={t('cart')} showCart={false} />

        {/* Content with transition (no fixed elements inside) */}
        <div className={`pt-14 ${navDirection === 'forward' ? 'page-transition-forward' : 'page-transition-backward'} ${mounted ? 'page-mounted' : ''}`}>
          <div className="max-w-mobile mx-auto">
            <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-5">
              <div className="text-center max-w-sm">
                <div className="flex justify-center mb-6">
                  <svg className="w-20 h-20 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>

                <h2 className="text-xl font-medium text-text mb-3">
                  {t('cartEmpty')}
                </h2>

                <p className="text-sm text-muted mb-8 leading-relaxed">
                  {t('cartEmptyDesc')}
                </p>

                <button
                  onClick={() => {
                    triggerHaptic()
                    sessionStorage.setItem('navigationDirection', 'forward')
                    setTimeout(() => {
                      router.push('/order/menu')
                    }, 120)
                  }}
                  className="w-full py-4 bg-primary text-white font-medium rounded-lg active:scale-[0.98] active:bg-primary/90 transition-all"
                >
                  {t('viewMenu')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Unified header outside transform */}
      <UnifiedOrderHeader title={t('cart')} showCart={false} />

      {/* Content with transition (scrollable area only) */}
      <div className={`pt-14 pb-36 ${navDirection === 'forward' ? 'page-transition-forward' : 'page-transition-backward'} ${mounted ? 'page-mounted' : ''}`}>
        <div className="max-w-mobile mx-auto px-5 py-6 space-y-4">
            {items.map((item) => {
              const itemName = language === 'th' ? item.name_th : item.name_en

              return (
                <div key={item.id} className="bg-card border border-border rounded-lg p-4 shadow-lg shadow-black/20">
                  <div
                    onClick={() => {
                      sessionStorage.setItem('cartScrollPosition', window.scrollY.toString())
                      if (typeof window !== 'undefined') {
                        sessionStorage.setItem('navigationDirection', 'forward')
                      }
                      triggerHaptic()
                      setTimeout(() => {
                        router.push(`/order/menu/${item.menuId}?edit=${item.id}`)
                      }, 120)
                    }}
                    className="block hover:bg-border/50 active:bg-border/80 transition-colors -m-4 p-4 rounded-lg mb-3 cursor-pointer"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-text">{itemName}</h3>
                        {item.options && item.options.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {item.options.map((option, idx) => {
                              const groupName = language === 'th' ? option.group_name_th : option.group_name_en
                              const choiceNames = language === 'th' ? option.choice_names_th : option.choice_names_en

                              return (
                                <p key={idx} className="text-sm text-muted">
                                  {groupName}: {choiceNames.join(', ')}
                                  {option.price_delta_thb > 0 && (
                                    <span className="text-primary ml-1">+฿{option.price_delta_thb}</span>
                                  )}
                                </p>
                              )
                            })}
                          </div>
                        )}
                        {item.note && (
                          <p className="text-sm text-muted mt-2 italic">
                            {t('note')}: {item.note}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            triggerHaptic()
                            removeItem(item.id)
                          }}
                          className="text-muted hover:text-primary transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => {
                          triggerHaptic()
                          updateQuantity(item.id, item.quantity - 1)
                        }}
                        className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:border-primary transition-colors text-text"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      <span className="font-medium w-8 text-center text-text">{item.quantity}</span>
                      <button
                        onClick={() => {
                          triggerHaptic()
                          updateQuantity(item.id, item.quantity + 1)
                        }}
                        className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:border-primary transition-colors text-text"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-lg font-medium text-primary">฿{item.final_price_thb * item.quantity}</p>
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      {/* Bottom bar outside transform - truly fixed */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg shadow-black/30 z-40">
        <div className="max-w-mobile mx-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex justify-between items-center mb-3">
            <span className="text-lg font-medium text-text">{t('total')}</span>
            <span className="text-2xl font-semibold text-primary">฿{getTotalPrice()}</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                triggerHaptic()
                setTimeout(() => {
                  sessionStorage.setItem('navigationDirection', 'forward')
                  router.push('/order/menu')
                }, 120)
              }}
              className="flex-1 py-3.5 bg-bg border border-border text-text font-medium text-center rounded-lg hover:bg-border active:bg-border/80 transition-colors"
            >
              {language === 'th' ? 'สั่งเพิ่ม' : 'Add more'}
            </button>
            <button
              onClick={() => {
                triggerHaptic()
                setTimeout(() => {
                  router.push('/order/checkout')
                }, 120)
              }}
              className="flex-1 py-3.5 bg-primary text-white font-medium text-center rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors"
            >
              {t('continueToCheckout')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}