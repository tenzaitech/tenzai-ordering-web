'use client'

import { useState, useEffect, useCallback } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { triggerHaptic } from '@/utils/haptic'
import type { CartItem } from '@/contexts/CartContext'

interface CartItemEditDrawerProps {
  item: CartItem | null
  isOpen: boolean
  onClose: () => void
  onSave: (itemId: string, newQuantity: number) => void
  onRemove: (itemId: string) => void
}

/**
 * Drawer for editing cart item quantity with explicit Save pattern.
 *
 * UX Flow:
 * 1. Opens with item's current quantity as originalState
 * 2. +/- buttons update local draftQuantity only (no persistence)
 * 3. hasChanges = draftQuantity !== originalQuantity
 * 4. Cancel: close drawer, discard draft
 * 5. Save: persist changes, close drawer
 */
export default function CartItemEditDrawer({
  item,
  isOpen,
  onClose,
  onSave,
  onRemove
}: CartItemEditDrawerProps) {
  const { language } = useLanguage()

  // Original state (from cart)
  const originalQuantity = item?.quantity ?? 1

  // Draft state (local only, not persisted until Save)
  const [draftQuantity, setDraftQuantity] = useState(originalQuantity)

  // Track if there are unsaved changes
  const hasChanges = draftQuantity !== originalQuantity

  // Reset draft when drawer opens with new item
  useEffect(() => {
    if (isOpen && item) {
      setDraftQuantity(item.quantity)
    }
  }, [isOpen, item?.id, item?.quantity])

  // Handle closing with unsaved changes
  const handleClose = useCallback(() => {
    if (hasChanges) {
      // Optional: warn user about unsaved changes
      const confirmClose = window.confirm(
        language === 'th'
          ? 'คุณมีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก ต้องการปิดหรือไม่?'
          : 'You have unsaved changes. Close anyway?'
      )
      if (!confirmClose) return
    }
    onClose()
  }, [hasChanges, language, onClose])

  // Handle quantity change (draft only, NO persistence)
  const handleQuantityChange = (delta: number) => {
    triggerHaptic()
    setDraftQuantity(prev => {
      const newQty = prev + delta
      return newQty < 1 ? 1 : newQty
    })
  }

  // Handle Save (persist changes)
  const handleSave = () => {
    if (!item || !hasChanges) return
    triggerHaptic()
    onSave(item.id, draftQuantity)
    onClose()
  }

  // Handle Remove
  const handleRemove = () => {
    if (!item) return
    const confirmRemove = window.confirm(
      language === 'th'
        ? 'ต้องการลบรายการนี้หรือไม่?'
        : 'Remove this item?'
    )
    if (confirmRemove) {
      triggerHaptic()
      onRemove(item.id)
      onClose()
    }
  }

  if (!isOpen || !item) return null

  const itemName = language === 'th' ? item.name_th : item.name_en
  const unitPrice = item.final_price_thb
  const draftTotal = unitPrice * draftQuantity

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Drawer */}
      <div className="fixed bottom-0 left-0 right-0 bg-card rounded-t-2xl z-50 shadow-xl shadow-black/30 animate-slide-up">
        <div className="max-w-mobile mx-auto">
          {/* Handle bar */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 bg-border rounded-full" />
          </div>

          {/* Header */}
          <div className="px-5 pb-4 border-b border-border">
            <h2 className="text-lg font-medium text-text">{itemName}</h2>
            {item.options && item.options.length > 0 && (
              <p className="text-sm text-muted mt-1">
                {item.options.map(opt =>
                  (language === 'th' ? opt.choice_names_th : opt.choice_names_en).join(', ')
                ).join(' • ')}
              </p>
            )}
            <p className="text-sm text-muted mt-1">
              {language === 'th' ? 'ราคาต่อชิ้น' : 'Unit price'}: ฿{unitPrice}
            </p>
          </div>

          {/* Quantity editor */}
          <div className="px-5 py-6">
            <div className="flex items-center justify-between">
              <span className="text-text font-medium">
                {language === 'th' ? 'จำนวน' : 'Quantity'}
              </span>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleQuantityChange(-1)}
                  disabled={draftQuantity <= 1}
                  className="w-12 h-12 flex items-center justify-center bg-bg border border-border rounded-full text-text text-xl font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:border-primary/50 transition-colors active:bg-border"
                >
                  −
                </button>
                <span className="text-text font-semibold text-2xl w-12 text-center">
                  {draftQuantity}
                </span>
                <button
                  onClick={() => handleQuantityChange(1)}
                  className="w-12 h-12 flex items-center justify-center bg-bg border border-border rounded-full text-text text-xl font-medium hover:border-primary/50 transition-colors active:bg-border"
                >
                  +
                </button>
              </div>
            </div>

            {/* Draft total */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <span className="text-muted">
                {language === 'th' ? 'รวม' : 'Subtotal'}
              </span>
              <span className="text-xl font-semibold text-primary">฿{draftTotal}</span>
            </div>

            {/* Change indicator */}
            {hasChanges && (
              <p className="text-sm text-primary mt-2 text-center">
                {language === 'th'
                  ? `เปลี่ยนจาก ${originalQuantity} เป็น ${draftQuantity}`
                  : `Changed from ${originalQuantity} to ${draftQuantity}`}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] space-y-3">
            {/* Save button - PRIMARY, disabled if no changes */}
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="w-full py-4 bg-primary text-white font-medium rounded-lg disabled:bg-border disabled:text-muted disabled:cursor-not-allowed transition-all active:scale-[0.98] active:bg-primary/90"
            >
              {language === 'th' ? 'บันทึก' : 'Save Changes'}
            </button>

            {/* Secondary actions */}
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 py-3 bg-bg border border-border text-text font-medium rounded-lg hover:bg-border/50 active:bg-border transition-colors"
              >
                {language === 'th' ? 'ยกเลิก' : 'Cancel'}
              </button>
              <button
                onClick={handleRemove}
                className="flex-1 py-3 bg-bg border border-red-500/30 text-red-500 font-medium rounded-lg hover:bg-red-500/10 active:bg-red-500/20 transition-colors"
              >
                {language === 'th' ? 'ลบ' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
