'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCart, CartItem } from '@/contexts/CartContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCheckout } from '@/contexts/CheckoutContext'
import { triggerHaptic } from '@/utils/haptic'
import { loadCheckoutDraft, clearCheckoutDraft } from '@/lib/checkoutDraft'
import UnifiedOrderHeader from '@/components/order/UnifiedOrderHeader'

export default function CartPage() {
  const router = useRouter()
  const { items, updateQuantity, removeItem, getTotalPrice, setItems } = useCart()
  const { language, t } = useLanguage()
  const { updateDraft, setActiveOrderId } = useCheckout()
  const [mounted, setMounted] = useState(false)
  const [navDirection, setNavDirection] = useState<'forward' | 'backward'>('forward')
  const [draftRestored, setDraftRestored] = useState(false)

  // Inline quantity change handler - updates immediately by item.id
  const handleInlineQuantityChange = (itemId: string, currentQty: number, delta: number) => {
    triggerHaptic()
    const newQty = currentQty + delta
    if (newQty <= 0) {
      // Confirm removal when decrementing to 0
      const confirmRemove = window.confirm(
        language === 'th'
          ? 'ต้องการลบรายการนี้หรือไม่?'
          : 'Remove this item?'
      )
      if (confirmRemove) {
        removeItem(itemId)
      }
    } else {
      updateQuantity(itemId, newQty)
    }
  }

  // Restore scroll position on mount + restore from draft if cart empty
  useEffect(() => {
    const savedScrollPosition = sessionStorage.getItem('cartScrollPosition')
    if (savedScrollPosition) {
      window.scrollTo(0, parseInt(savedScrollPosition, 10))
      sessionStorage.removeItem('cartScrollPosition')
    }
    const direction = sessionStorage.getItem('navigationDirection') as 'forward' | 'backward' || 'forward'
    sessionStorage.removeItem('navigationDirection')
    setNavDirection(direction)

    // Restore from draft if cart is empty (e.g., Back from payment)
    if (items.length === 0 && !draftRestored) {
      const draft = loadCheckoutDraft()
      if (draft && draft.cartItems.length > 0) {
        // Restore cart items
        setItems(draft.cartItems)
        // Restore checkout context
        updateDraft({
          customerName: draft.customerName,
          customerPhone: draft.customerPhone,
          pickupType: draft.pickupType,
          pickupDate: draft.pickupDate || '',
          pickupTime: draft.pickupTime,
          customerNote: draft.customerNote
        })
        if (draft.activeOrderId) {
          setActiveOrderId(draft.activeOrderId)
        }
        setDraftRestored(true)
        console.log('[CART] Restored from checkout draft')
      }
    }

    setMounted(true)
  }, [items.length, draftRestored, setItems, updateDraft, setActiveOrderId])

  // Wait for mount before showing empty state (to allow draft restoration)
  if (!mounted) {
    return null
  }

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

              // Build concise options summary (one line)
              const optionsSummary = item.options && item.options.length > 0
                ? item.options.map(opt => {
                    const choices = language === 'th' ? opt.choice_names_th : opt.choice_names_en
                    return choices.join(', ')
                  }).join(' • ')
                : null

              return (
                <div key={item.id} className="bg-card border border-border rounded-lg shadow-lg shadow-black/20 overflow-hidden">
                  {/* Top section - tap to edit options/notes */}
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
                    className="flex justify-between items-start p-4 hover:bg-border/30 active:bg-border/50 transition-colors cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-medium text-text">{itemName}</h3>
                      {/* Options summary - one line, concise */}
                      {optionsSummary && (
                        <p className="text-sm text-muted mt-1 truncate">
                          {optionsSummary}
                        </p>
                      )}
                      {/* Note - one line, muted italic */}
                      {item.note && (
                        <p className="text-sm text-muted/70 mt-1 truncate italic">
                          "{item.note}"
                        </p>
                      )}
                    </div>
                    {/* Edit chevron */}
                    <div className="flex items-center ml-3 text-muted">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>

                  {/* Bottom section - inline quantity controls */}
                  <div className="flex items-center justify-between px-4 py-3 bg-bg/50 border-t border-border">
                    {/* Inline +/- controls */}
                    <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleInlineQuantityChange(item.id, item.quantity, -1)
                        }}
                        className="w-9 h-9 flex items-center justify-center bg-card border border-border rounded-full text-text text-lg font-medium hover:border-primary/50 active:bg-border transition-colors"
                        aria-label={language === 'th' ? 'ลดจำนวน' : 'Decrease quantity'}
                      >
                        −
                      </button>
                      <span className="text-text font-semibold text-lg w-8 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleInlineQuantityChange(item.id, item.quantity, 1)
                        }}
                        className="w-9 h-9 flex items-center justify-center bg-card border border-border rounded-full text-text text-lg font-medium hover:border-primary/50 active:bg-border transition-colors"
                        aria-label={language === 'th' ? 'เพิ่มจำนวน' : 'Increase quantity'}
                      >
                        +
                      </button>
                    </div>
                    {/* Subtotal */}
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