'use client'

import { useRouter } from 'next/navigation'
import { useCart, CartItem } from '@/contexts/CartContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { triggerHaptic } from '@/utils/haptic'

interface MenuItemDrawerProps {
  menuId: string
  menuName_th: string
  menuName_en: string
  basePrice: number
  cartItems: CartItem[]
  onClose: () => void
}

/**
 * Bottom drawer shown when tapping a menu item that's already in cart
 * Shows qty controls for existing variants + "Add new item" button
 */
export default function MenuItemDrawer({
  menuId,
  menuName_th,
  menuName_en,
  basePrice,
  cartItems,
  onClose
}: MenuItemDrawerProps) {
  const router = useRouter()
  const { language, t } = useLanguage()
  const { updateQuantity, removeItem } = useCart()

  const menuName = language === 'th' ? menuName_th : menuName_en

  const handleQtyChange = (itemId: string, delta: number, currentQty: number) => {
    triggerHaptic()
    const newQty = currentQty + delta
    if (newQty <= 0) {
      removeItem(itemId)
      if (cartItems.length === 1) {
        onClose()
      }
    } else {
      updateQuantity(itemId, newQty)
    }
  }

  const handleAddNewItem = () => {
    triggerHaptic()
    sessionStorage.setItem('menuScrollPosition', window.scrollY.toString())
    sessionStorage.setItem('navigationDirection', 'forward')
    onClose()
    router.push(`/order/menu/${menuId}`)
  }

  const handleEditItem = (cartItemId: string) => {
    triggerHaptic()
    sessionStorage.setItem('menuScrollPosition', window.scrollY.toString())
    sessionStorage.setItem('navigationDirection', 'forward')
    onClose()
    router.push(`/order/menu/${menuId}?edit=${cartItemId}`)
  }

  const totalQty = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const totalPrice = cartItems.reduce((sum, item) => sum + item.final_price_thb * item.quantity, 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Bottom Sheet */}
      <div
        className="relative w-full bg-card rounded-t-2xl max-h-[70vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pb-4 border-b border-border">
          <h3 className="text-lg font-semibold text-text">{menuName}</h3>
          <p className="text-sm text-muted mt-1">
            {language === 'th' ? `${totalQty} รายการในตะกร้า` : `${totalQty} item(s) in cart`}
          </p>
        </div>

        {/* Cart Items List */}
        <div className="px-5 py-4 space-y-3">
          {cartItems.map((item) => {
            const hasOptions = item.options && item.options.length > 0
            return (
              <div
                key={item.id}
                className="bg-bg border border-border rounded-lg p-3"
              >
                {/* Options summary */}
                {hasOptions && (
                  <div className="text-xs text-muted mb-2">
                    {item.options!.map((opt, idx) => {
                      const names = language === 'th' ? opt.choice_names_th : opt.choice_names_en
                      return (
                        <span key={idx}>
                          {names.join(', ')}
                          {idx < item.options!.length - 1 && ' • '}
                        </span>
                      )
                    })}
                  </div>
                )}
                {item.note && (
                  <p className="text-xs text-muted italic mb-2">"{item.note}"</p>
                )}

                {/* Qty controls + price */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleQtyChange(item.id, -1, item.quantity)}
                      className="w-8 h-8 rounded-full bg-bg border border-border flex items-center justify-center text-text hover:bg-border transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    <span className="text-text font-medium w-6 text-center">{item.quantity}</span>
                    <button
                      onClick={() => handleQtyChange(item.id, 1, item.quantity)}
                      className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-primary font-semibold">฿{item.final_price_thb * item.quantity}</span>
                    <button
                      onClick={() => handleEditItem(item.id)}
                      className="text-muted hover:text-text transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer with Add New Item */}
        <div className="px-5 py-4 border-t border-border">
          <button
            onClick={handleAddNewItem}
            className="w-full py-3 bg-bg border border-border text-text font-medium rounded-lg hover:bg-border transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {language === 'th' ? 'เพิ่มรายการใหม่' : 'Add new item'}
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.2s ease-out;
        }
      `}</style>
    </div>
  )
}
