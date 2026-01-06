'use client'

import { useState, useEffect, useCallback } from 'react'
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
 * Bottom drawer shown when tapping a menu item that's already in cart.
 *
 * EXPLICIT SAVE PATTERN:
 * - Opens with originalState (current quantities from cart)
 * - +/- buttons update draftState only (no persistence)
 * - hasChanges = any draft quantity differs from original
 * - Cancel: discard draft, close
 * - Save: persist all changes, close
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

  // Original state: snapshot of quantities when drawer opens
  const [originalQuantities, setOriginalQuantities] = useState<Record<string, number>>({})

  // Draft state: local edits (not persisted until Save)
  const [draftQuantities, setDraftQuantities] = useState<Record<string, number>>({})

  // Items marked for removal (qty went to 0)
  const [itemsToRemove, setItemsToRemove] = useState<Set<string>>(new Set())

  // Initialize state when drawer opens
  useEffect(() => {
    const initial: Record<string, number> = {}
    cartItems.forEach(item => {
      initial[item.id] = item.quantity
    })
    setOriginalQuantities(initial)
    setDraftQuantities(initial)
    setItemsToRemove(new Set())
  }, [cartItems])

  // Check if there are any unsaved changes
  const hasChanges = useCallback(() => {
    // Check for quantity changes
    for (const itemId of Object.keys(draftQuantities)) {
      if (draftQuantities[itemId] !== originalQuantities[itemId]) {
        return true
      }
    }
    // Check for items to remove
    if (itemsToRemove.size > 0) {
      return true
    }
    return false
  }, [draftQuantities, originalQuantities, itemsToRemove])

  // Handle quantity change (DRAFT ONLY - no persistence)
  const handleDraftQtyChange = (itemId: string, delta: number) => {
    triggerHaptic()
    setDraftQuantities(prev => {
      const currentQty = prev[itemId] || 0
      const newQty = currentQty + delta

      if (newQty <= 0) {
        // Mark for removal, set qty to 0
        setItemsToRemove(items => new Set(items).add(itemId))
        return { ...prev, [itemId]: 0 }
      } else {
        // Unmark from removal if was marked
        setItemsToRemove(items => {
          const newSet = new Set(items)
          newSet.delete(itemId)
          return newSet
        })
        return { ...prev, [itemId]: newQty }
      }
    })
  }

  // Handle Save (persist all changes)
  const handleSave = () => {
    triggerHaptic()

    // Apply all changes
    for (const itemId of Object.keys(draftQuantities)) {
      const draftQty = draftQuantities[itemId]
      const originalQty = originalQuantities[itemId]

      if (draftQty !== originalQty) {
        if (draftQty <= 0) {
          // Remove item
          removeItem(itemId)
        } else {
          // Update quantity
          updateQuantity(itemId, draftQty)
        }
      }
    }

    onClose()
  }

  // Handle close with unsaved changes warning
  const handleClose = useCallback(() => {
    if (hasChanges()) {
      const confirmDiscard = window.confirm(
        language === 'th'
          ? 'คุณมีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก ต้องการยกเลิกหรือไม่?'
          : 'You have unsaved changes. Discard?'
      )
      if (!confirmDiscard) return
    }
    onClose()
  }, [hasChanges, language, onClose])

  const handleAddNewItem = () => {
    // If there are unsaved changes, warn first
    if (hasChanges()) {
      const confirmDiscard = window.confirm(
        language === 'th'
          ? 'คุณมีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก ต้องการยกเลิกหรือไม่?'
          : 'You have unsaved changes. Discard?'
      )
      if (!confirmDiscard) return
    }

    triggerHaptic()
    sessionStorage.setItem('menuScrollPosition', window.scrollY.toString())
    sessionStorage.setItem('navigationDirection', 'forward')
    onClose()
    router.push(`/order/menu/${menuId}`)
  }

  const handleEditItem = (cartItemId: string) => {
    // If there are unsaved changes, warn first
    if (hasChanges()) {
      const confirmDiscard = window.confirm(
        language === 'th'
          ? 'คุณมีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก ต้องการยกเลิกหรือไม่?'
          : 'You have unsaved changes. Discard?'
      )
      if (!confirmDiscard) return
    }

    triggerHaptic()
    sessionStorage.setItem('menuScrollPosition', window.scrollY.toString())
    sessionStorage.setItem('navigationDirection', 'forward')
    onClose()
    router.push(`/order/menu/${menuId}?edit=${cartItemId}`)
  }

  // Calculate totals based on DRAFT state
  const visibleItems = cartItems.filter(item => !itemsToRemove.has(item.id) || draftQuantities[item.id] > 0)
  const totalDraftQty = Object.values(draftQuantities).reduce((sum, qty) => sum + Math.max(0, qty), 0)
  const totalDraftPrice = cartItems.reduce((sum, item) => {
    const qty = draftQuantities[item.id] || 0
    return sum + item.final_price_thb * Math.max(0, qty)
  }, 0)

  const changesExist = hasChanges()

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={handleClose}>
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Bottom Sheet */}
      <div
        className="relative w-full bg-card rounded-t-2xl max-h-[80vh] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-text">{menuName}</h3>
              <p className="text-sm text-muted mt-1">
                {language === 'th' ? `${totalDraftQty} รายการ` : `${totalDraftQty} item(s)`}
                {changesExist && (
                  <span className="text-primary ml-2">
                    ({language === 'th' ? 'มีการแก้ไข' : 'modified'})
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-muted hover:text-text transition-colors p-1"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Cart Items List */}
        <div className="px-5 py-4 space-y-3">
          {cartItems.map((item) => {
            const hasOptions = item.options && item.options.length > 0
            const draftQty = draftQuantities[item.id] ?? item.quantity
            const isMarkedForRemoval = draftQty <= 0
            const itemTotal = item.final_price_thb * Math.max(0, draftQty)

            return (
              <div
                key={item.id}
                className={`bg-bg border rounded-lg p-3 transition-opacity ${
                  isMarkedForRemoval ? 'border-red-500/30 opacity-50' : 'border-border'
                }`}
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

                {isMarkedForRemoval ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-red-500">
                      {language === 'th' ? 'จะถูกลบเมื่อบันทึก' : 'Will be removed on save'}
                    </span>
                    <button
                      onClick={() => handleDraftQtyChange(item.id, 1)}
                      className="text-sm text-primary font-medium hover:underline"
                    >
                      {language === 'th' ? 'ยกเลิก' : 'Undo'}
                    </button>
                  </div>
                ) : (
                  /* Qty controls + price */
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleDraftQtyChange(item.id, -1)}
                        className="w-8 h-8 rounded-full bg-bg border border-border flex items-center justify-center text-text hover:bg-border transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      <span className="text-text font-medium w-6 text-center">{draftQty}</span>
                      <button
                        onClick={() => handleDraftQtyChange(item.id, 1)}
                        className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-primary font-semibold">฿{itemTotal}</span>
                      <button
                        onClick={() => handleEditItem(item.id)}
                        className="text-muted hover:text-text transition-colors"
                        title={language === 'th' ? 'แก้ไขตัวเลือก' : 'Edit options'}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer with Save/Cancel + Add New Item */}
        <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-3 border-t border-border pt-4">
          {/* Total */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-muted">
              {language === 'th' ? 'รวม' : 'Subtotal'}
            </span>
            <span className="text-xl font-semibold text-primary">฿{totalDraftPrice}</span>
          </div>

          {/* Save button - PRIMARY, disabled if no changes */}
          <button
            onClick={handleSave}
            disabled={!changesExist}
            className="w-full py-3.5 bg-primary text-white font-medium rounded-lg disabled:bg-border disabled:text-muted disabled:cursor-not-allowed transition-all active:scale-[0.98] active:bg-primary/90"
          >
            {language === 'th' ? 'บันทึกการเปลี่ยนแปลง' : 'Save Changes'}
          </button>

          {/* Add new item */}
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
