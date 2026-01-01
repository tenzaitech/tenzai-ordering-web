'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCart } from '@/contexts/CartContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCheckout } from '@/contexts/CheckoutContext'
import { triggerHaptic } from '@/utils/haptic'
import { supabase } from '@/lib/supabase'
import { getCartFingerprint } from '@/lib/orderUtils'
import ErrorModal from '@/components/ErrorModal'

type ProcessingState = 'IDLE' | 'UPLOADING_SLIP' | 'SYNCING_ORDER'

export default function PaymentPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { items, getTotalPrice, clearCart } = useCart()
  const { language, t } = useLanguage()
  const { draft, clearDraft, activeOrderId, lastSyncedCartFingerprint, setLastSyncedCartFingerprint } = useCheckout()

  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [slipPreview, setSlipPreview] = useState<string | null>(null)
  const [processingState, setProcessingState] = useState<ProcessingState>('IDLE')
  const [showError, setShowError] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const orderId = searchParams.get('id')

  useEffect(() => {
    setMounted(true)

    if (!orderId) {
      setLoading(false)
      return
    }

    const fetchOrder = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single()

        if (error || !data) {
          console.error('[ERROR] Failed to fetch order:', error)
          setLoading(false)
          return
        }

        setOrder(data)
        setLoading(false)

        // Check if cart is dirty (changed since order creation) - auto-sync silently
        if (orderId === activeOrderId && lastSyncedCartFingerprint) {
          const currentFingerprint = getCartFingerprint(items)
          if (currentFingerprint !== lastSyncedCartFingerprint) {
            console.log('[SYNC] Cart is dirty, auto-syncing silently')
            handleSyncOrder()
          }
        }
      } catch (error) {
        console.error('[ERROR] Unexpected error fetching order:', error)
        setLoading(false)
      }
    }

    fetchOrder()
  }, [orderId, activeOrderId, lastSyncedCartFingerprint, items])

  const handleSyncOrder = async () => {
    if (!orderId) return

    try {
      setProcessingState('SYNCING_ORDER')
      console.log('[PROCESSING] State: SYNCING_ORDER')

      // Update order total and note
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          total_amount: getTotalPrice(),
          customer_note: draft.customerNote.trim() || null,
        })
        .eq('id', orderId)

      if (updateError) {
        console.error('[ERROR:SYNC] Failed to update order:', updateError)
        setShowError(true)
        setProcessingState('IDLE')
        return
      }

      // Delete existing order items
      const { error: deleteError } = await supabase
        .from('order_items')
        .delete()
        .eq('order_id', orderId)

      if (deleteError) {
        console.error('[ERROR:SYNC] Failed to delete order items:', deleteError)
        setShowError(true)
        setProcessingState('IDLE')
        return
      }

      // Insert new order items
      const orderItems = items.map((item) => {
        const basePrice = item.base_price_thb
        const finalPrice = item.final_price_thb

        if (basePrice == null || typeof basePrice !== 'number' || isNaN(basePrice)) {
          throw new Error(`[VALIDATION] Invalid base_price for menu item ${item.menuId} (${item.name_en}): ${basePrice}`)
        }
        if (finalPrice == null || typeof finalPrice !== 'number' || isNaN(finalPrice)) {
          throw new Error(`[VALIDATION] Invalid final_price for menu item ${item.menuId} (${item.name_en}): ${finalPrice}`)
        }

        return {
          order_id: orderId,
          menu_item_id: item.menuId,
          name_th: item.name_th,
          name_en: item.name_en,
          qty: item.quantity,
          base_price: basePrice,
          final_price: finalPrice,
          note: item.note || null,
          selected_options_json: item.options || null,
        }
      })

      const { error: insertError } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (insertError) {
        console.error('[ERROR:SYNC] Failed to insert order items:', insertError)
        setShowError(true)
        setProcessingState('IDLE')
        return
      }

      console.log('[SUCCESS:SYNC] Order synced')

      // Update fingerprint
      setLastSyncedCartFingerprint(getCartFingerprint(items))

      // Refetch order to update display
      const { data: refreshedOrder } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()

      if (refreshedOrder) {
        setOrder(refreshedOrder)
      }

      setProcessingState('IDLE')
    } catch (error) {
      console.error('[ERROR:SYNC]', error)
      setShowError(true)
      setProcessingState('IDLE')
    }
  }

  const handleSlipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSlipFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setSlipPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!slipFile) {
      alert(language === 'th' ? 'กรุณาแนบสลิปการชำระเงิน' : 'Please attach payment slip')
      return
    }

    if (!orderId) {
      return
    }

    triggerHaptic()

    try {
      // Upload slip to Supabase Storage
      setProcessingState('UPLOADING_SLIP')
      console.log('[PROCESSING] State: UPLOADING_SLIP')

      const fileExt = slipFile.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('slips')
        .upload(fileName, slipFile)

      if (uploadError) {
        console.error('[ERROR:SLIP]', uploadError)
        setShowError(true)
        setProcessingState('IDLE')
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('slips')
        .getPublicUrl(fileName)

      // Update order with slip URL
      const { error: updateError } = await supabase
        .from('orders')
        .update({ slip_url: publicUrl })
        .eq('id', orderId)

      if (updateError) {
        console.error('[ERROR:SLIP] Failed to update order:', updateError)
        setShowError(true)
        setProcessingState('IDLE')
        return
      }

      console.log('[SUCCESS:SLIP] Slip uploaded and order updated')

      // Fire-and-forget LINE notification
      fetch('/api/line/notify-slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      }).catch(err => console.error('[LINE:NOTIFY] Failed to trigger:', err))

      // Navigate to confirmation page
      router.replace(`/order/confirmed?id=${orderId}`)

      // Clear cart, checkout draft, and reset processing state after navigation starts
      setTimeout(() => {
        clearCart()
        clearDraft()
        setProcessingState('IDLE')
      }, 100)
    } catch (error) {
      console.error('[ERROR:UNEXPECTED]', error)
      setShowError(true)
      setProcessingState('IDLE')
    }
  }

  const isProcessing = processingState !== 'IDLE'

  if (!mounted) {
    return null
  }

  // Invalid or missing order ID
  if (!orderId || (!loading && !order)) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-5">
        <div className="max-w-sm text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-text mb-2">
            {language === 'th' ? 'ไม่พบคำสั่งซื้อ' : 'Order Not Found'}
          </h2>
          <p className="text-muted mb-6">
            {language === 'th' ? 'กรุณากลับไปหน้าชำระเงินและลองใหม่อีกครั้ง' : 'Please go back to checkout and try again'}
          </p>
          <button
            onClick={() => {
              triggerHaptic()
              router.push('/order/checkout')
            }}
            className="px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            {language === 'th' ? 'กลับไปหน้าชำระเงิน' : 'Back to Checkout'}
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted">{t('pleaseWait')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Error Modal */}
      {showError && (
        <ErrorModal
          title={t('errorSlipTitle')}
          message={t('errorSlipMessage')}
          helper={t('errorSlipHelper')}
          primaryLabel={t('retryUploadSlip')}
          secondaryLabel={t('backToEdit')}
          onPrimary={() => {
            setShowError(false)
            handleSubmit(new Event('submit') as any)
          }}
          onSecondary={() => {
            setShowError(false)
          }}
        />
      )}

      <div className="max-w-mobile mx-auto">
        {/* Header */}
        <header className="sticky top-0 bg-card z-10 px-5 py-4 border-b border-border flex items-center">
          <button
            onClick={() => {
              triggerHaptic()
              router.push('/order/checkout')
            }}
            className="text-muted hover:text-text active:text-text transition-colors"
            disabled={isProcessing}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-medium flex-1 text-center mr-6 text-text">{t('payment')}</h1>
        </header>

        {/* Edit Items Button */}
        <div className="px-5 py-3 border-b border-border flex justify-center">
          <button
            type="button"
            onClick={() => {
              triggerHaptic()
              router.push('/order/cart')
            }}
            disabled={isProcessing}
            className="px-4 py-2 text-sm text-muted hover:text-text active:text-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {language === 'th' ? 'แก้ไขรายการ' : 'Edit Items'}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pb-32">
          {/* Order Summary */}
          <div className="px-5 py-6 border-b border-border">
            <h2 className="text-text text-lg font-semibold mb-4">{t('orderSummary')}</h2>

            <div className="bg-card border border-border rounded-lg p-4 mb-4">
              {/* Item List (collapsible) */}
              <div className="space-y-3 mb-3">
                {items.slice(0, isExpanded ? items.length : 3).map((item) => {
                  const itemName = language === 'th' ? item.name_th : item.name_en
                  return (
                    <div key={item.id} className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-text text-sm font-medium">{itemName}</p>
                        <p className="text-xs text-muted">x{item.quantity}</p>
                        {item.note && (
                          <p className="text-xs text-muted italic mt-1">{t('note')}: {item.note}</p>
                        )}
                      </div>
                      <p className="text-text text-sm font-semibold ml-3">฿{item.final_price_thb * item.quantity}</p>
                    </div>
                  )
                })}
              </div>

              {/* Expand/Collapse Control */}
              {items.length > 3 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsExpanded(!isExpanded)
                    triggerHaptic()
                  }}
                  className="w-full py-2 flex items-center justify-center text-primary text-sm hover:text-primary/80 transition-colors"
                >
                  <span>{isExpanded ? (language === 'th' ? 'ย่อ' : 'Collapse') : (language === 'th' ? `แสดงทั้งหมด (${items.length} รายการ)` : `Show all (${items.length} items)`)}</span>
                  <svg
                    className={`w-4 h-4 ml-1 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}

              {/* Customer Note (read-only) */}
              {draft.customerNote && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted mb-1">
                    {language === 'th' ? 'หมายเหตุถึงร้าน' : 'Note to Restaurant'}
                  </p>
                  <p className="text-sm text-text">{draft.customerNote}</p>
                </div>
              )}
            </div>

            {/* Total */}
            <div className="bg-card border border-primary/30 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-text">{t('total')}</span>
                <span className="text-2xl font-bold text-primary">฿{getTotalPrice()}</span>
              </div>
              {processingState === 'SYNCING_ORDER' && (
                <p className="text-xs text-muted mt-2 text-center">
                  {language === 'th' ? 'กำลังอัปเดตยอดรวม…' : 'Updating total…'}
                </p>
              )}
            </div>
          </div>

          {/* PromptPay Instructions */}
          <div className="px-5 py-6 border-b border-border">
            <h2 className="text-text text-lg font-semibold mb-4">{t('payment')}</h2>

            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted mb-2">{t('promptPayInstructions')}</p>
              <p className="text-text font-medium mb-1">{t('promptPayNumber')}</p>
              <p className="text-2xl font-semibold text-primary">0812345678</p>
            </div>
          </div>

          {/* Slip Upload */}
          <div className="px-5 py-6">
            <h2 className="text-text text-lg font-semibold mb-4">
              {t('uploadSlip')} <span className="text-primary text-sm">{t('required')}</span>
            </h2>
            <p className="text-xs text-muted mb-4">{t('uploadSlipDesc')}</p>

            {!slipPreview ? (
              <label className={`block w-full border-2 border-dashed border-border rounded-lg p-8 text-center transition-colors ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50'}`}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleSlipChange}
                  disabled={isProcessing}
                  className="hidden"
                  required
                />
                <svg className="w-12 h-12 mx-auto mb-3 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm text-text">{t('uploadSlip')}</p>
              </label>
            ) : (
              <div className="relative">
                <img
                  src={slipPreview}
                  alt="Payment slip"
                  className="w-full rounded-lg border border-border"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSlipFile(null)
                    setSlipPreview(null)
                    triggerHaptic()
                  }}
                  disabled={isProcessing}
                  className="mt-3 w-full py-3 bg-card border border-border text-text rounded-lg hover:bg-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('changeSlip')}
                </button>
              </div>
            )}
          </div>
        </form>

        {/* Fixed Bottom CTA */}
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg shadow-black/30">
          <div className="max-w-mobile mx-auto p-5">
            {isProcessing && (
              <div className="mb-3 text-center">
                <p className="text-sm text-muted">
                  {processingState === 'SYNCING_ORDER' && (language === 'th' ? 'กำลังอัปเดตยอดรวม…' : 'Updating total…')}
                  {processingState === 'UPLOADING_SLIP' && t('processingUploadingSlip')}
                </p>
              </div>
            )}
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isProcessing}
              className="w-full py-4 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? t('pleaseWait') : t('confirmOrder')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
