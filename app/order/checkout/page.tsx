'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/contexts/CartContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCheckout } from '@/contexts/CheckoutContext'
import { triggerHaptic } from '@/utils/haptic'
import { supabase } from '@/lib/supabase'
import { generateOrderNumber, generatePickupTimes, getCartFingerprint } from '@/lib/orderUtils'
import ErrorModal from '@/components/ErrorModal'

type ProcessingState = 'IDLE' | 'CREATING_ORDER' | 'SAVING_ITEMS'

type ErrorState = {
  step: 'ORDER' | 'ITEMS'
  orderNumber?: string
  orderId?: string
} | null

export default function CheckoutPage() {
  const router = useRouter()
  const { items, getTotalPrice, clearCart } = useCart()
  const { language, t } = useLanguage()
  const { draft, updateDraft, clearDraft, activeOrderId, setActiveOrderId, setLastSyncedCartFingerprint } = useCheckout()

  const [pickupType, setPickupType] = useState<'ASAP' | 'SCHEDULED'>(() => draft.pickupType)
  const [pickupTime, setPickupTime] = useState(() => draft.pickupTime)
  const [customerName, setCustomerName] = useState(() => draft.customerName)
  const [customerPhone, setCustomerPhone] = useState(() => draft.customerPhone)
  const [customerNote, setCustomerNote] = useState(() => draft.customerNote)
  const [processingState, setProcessingState] = useState<ProcessingState>('IDLE')
  const [errorState, setErrorState] = useState<ErrorState>(null)
  const [isNavigatingToPayment, setIsNavigatingToPayment] = useState(false)
  const [mounted, setMounted] = useState(false)

  const pickupTimes = generatePickupTimes()

  useEffect(() => {
    setMounted(true)
    // Only redirect to cart if empty AND not currently processing AND not navigating to payment
    if (items.length === 0 && processingState === 'IDLE' && !isNavigatingToPayment) {
      router.push('/order/cart')
    }
  }, [items, router, processingState, isNavigatingToPayment])

  // Wrapper functions to update both local state and draft context
  const handlePickupTypeChange = (type: 'ASAP' | 'SCHEDULED') => {
    setPickupType(type)
    updateDraft({ pickupType: type })
    if (type === 'ASAP') {
      setPickupTime('')
      updateDraft({ pickupTime: '' })
    }
  }

  const handlePickupTimeChange = (time: string) => {
    setPickupTime(time)
    updateDraft({ pickupTime: time })
  }

  const handleCustomerNameChange = (name: string) => {
    setCustomerName(name)
    updateDraft({ customerName: name })
  }

  const handleCustomerPhoneChange = (phone: string) => {
    setCustomerPhone(phone)
    updateDraft({ customerPhone: phone })
  }

  const handleCustomerNoteChange = (note: string) => {
    setCustomerNote(note)
    updateDraft({ customerNote: note })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!customerName.trim() || !customerPhone.trim()) {
      alert(language === 'th' ? 'กรุณากรอกข้อมูลให้ครบถ้วน' : 'Please fill in all required fields')
      return
    }

    if (pickupType === 'SCHEDULED' && !pickupTime) {
      alert(language === 'th' ? 'กรุณาเลือกเวลารับอาหาร' : 'Please select pickup time')
      return
    }

    // If activeOrderId exists, navigate to payment instead of creating duplicate order
    if (activeOrderId) {
      triggerHaptic()
      setIsNavigatingToPayment(true)
      router.replace(`/order/payment?id=${activeOrderId}`)
      return
    }

    // === VALIDATION GUARD: Ensure all cart items have valid menuId ===
    const invalidItems = items.filter(item => !item.menuId || typeof item.menuId !== 'string' || item.menuId.trim() === '')
    if (invalidItems.length > 0) {
      console.error('[CHECKOUT] Invalid cart items detected (missing menuId):', invalidItems)
      alert(language === 'th'
        ? 'พบรายการที่ไม่ถูกต้อง กรุณาลบและเพิ่มรายการใหม่'
        : 'Invalid items detected. Please remove and re-add them.')
      return
    }

    // Check offline before starting
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErrorState({ step: 'ORDER' })
      return
    }

    triggerHaptic()

    try {
      // === STEP 0: Get LINE userId ===
      const userResponse = await fetch('/api/liff/user')
      if (!userResponse.ok) {
        console.error('[ERROR] No LIFF session, redirecting to /liff')
        router.push('/liff')
        return
      }
      const { userId } = await userResponse.json()

      if (!userId) {
        console.error('[ERROR] userId missing, redirecting to /liff')
        router.push('/liff')
        return
      }

      // === STEP A: Create order ===
      setProcessingState('CREATING_ORDER')
      console.log('[PROCESSING] State: CREATING_ORDER')
      await new Promise(resolve => setTimeout(resolve, 500)) // Allow users to read status

      const orderNumber = generateOrderNumber()

      // Convert pickup time string (HH:MM) to timestamptz for Asia/Bangkok (+07:00)
      let pickupTimeISO: string | null = null
      if (pickupType === 'SCHEDULED' && pickupTime) {
        const [selectedHours, selectedMinutes] = pickupTime.split(':').map(Number)

        const nowUTC = new Date()
        const bangkokOffsetMs = 7 * 60 * 60 * 1000
        const nowBangkok = new Date(nowUTC.getTime() + bangkokOffsetMs)

        const currentBangkokHours = nowBangkok.getUTCHours()
        const currentBangkokMinutes = nowBangkok.getUTCMinutes()

        let pickupDate = new Date(nowBangkok)
        const selectedTimeInMinutes = selectedHours * 60 + selectedMinutes
        const currentTimeInMinutes = currentBangkokHours * 60 + currentBangkokMinutes

        if (selectedTimeInMinutes <= currentTimeInMinutes) {
          pickupDate = new Date(pickupDate.getTime() + 24 * 60 * 60 * 1000)
        }

        const year = pickupDate.getUTCFullYear()
        const month = String(pickupDate.getUTCMonth() + 1).padStart(2, '0')
        const day = String(pickupDate.getUTCDate()).padStart(2, '0')
        const hours = String(selectedHours).padStart(2, '0')
        const minutes = String(selectedMinutes).padStart(2, '0')

        pickupTimeISO = `${year}-${month}-${day}T${hours}:${minutes}:00+07:00`
      }

      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          customer_line_user_id: userId,
          pickup_type: pickupType,
          pickup_time: pickupTimeISO,
          total_amount: getTotalPrice(),
          customer_note: customerNote.trim() || null,
          slip_url: null,
        })
        .select()
        .single()

      if (orderError || !orderData) {
        console.error('[ERROR:ORDER]', orderError)
        setErrorState({ step: 'ORDER' })
        setProcessingState('IDLE')
        return
      }

      console.log('[SUCCESS:ORDER] Order created:', orderData.id, orderData.order_number)

      // === STEP B: Insert order items ===
      setProcessingState('SAVING_ITEMS')
      console.log('[PROCESSING] State: SAVING_ITEMS')
      await new Promise(resolve => setTimeout(resolve, 300)) // Allow users to read status

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
          order_id: orderData.id,
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

      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)
        .select()

      if (itemsError) {
        console.error('[ERROR:ITEMS]', itemsError)
        console.error('[ERROR:ITEMS] Failed payload:', orderItems)
        setErrorState({
          step: 'ITEMS',
          orderNumber: orderData.order_number,
          orderId: orderData.id
        })
        setProcessingState('IDLE')
        return
      }

      console.log('[SUCCESS:ITEMS] Order items inserted:', itemsData?.length || 0, 'items')

      // Set navigating flag to prevent cart-empty redirect
      setIsNavigatingToPayment(true)

      // Store active order ID and cart fingerprint
      setActiveOrderId(orderData.id)
      setLastSyncedCartFingerprint(getCartFingerprint(items))

      // Clear cart immediately after successful order creation
      clearCart()
      clearDraft()

      // Navigate to payment page
      router.replace(`/order/payment?id=${orderData.id}`)

      // Reset processing state after navigation starts
      setTimeout(() => {
        setProcessingState('IDLE')
      }, 100)
    } catch (error) {
      console.error('[ERROR:UNEXPECTED]', error)
      setErrorState({ step: 'ORDER' })
      setProcessingState('IDLE')
    }
  }

  const isProcessing = processingState !== 'IDLE'

  if (!mounted || items.length === 0) {
    return null
  }

  return (
    <div className={`min-h-screen bg-bg ${mounted ? 'page-mounted' : ''}`}>
      {/* Error Modal */}
      {errorState && (
        <ErrorModal
          title={errorState.step === 'ORDER' ? t('errorOrderTitle') : t('errorItemsTitle')}
          message={errorState.step === 'ORDER' ? t('errorOrderMessage') : t('errorItemsMessage')}
          helper={errorState.step === 'ORDER' ? t('errorOrderHelper') : t('errorItemsHelper')}
          primaryLabel={errorState.step === 'ORDER' ? t('retryOrder') : t('retrySaveItems')}
          secondaryLabel={errorState.step === 'ORDER' ? t('backToCart') : t('showOrderNumber')}
          onPrimary={() => {
            setErrorState(null)
            if (errorState.step === 'ORDER') {
              handleSubmit(new Event('submit') as any)
            }
          }}
          onSecondary={() => {
            setErrorState(null)
            if (errorState.step === 'ORDER') {
              router.push('/order/cart')
            } else if (errorState.orderId) {
              router.replace(`/order/payment?id=${errorState.orderId}`)
            }
          }}
        />
      )}

      <div className="max-w-mobile mx-auto">
        {/* Header */}
        <header className="sticky top-0 bg-card z-10 px-5 py-4 border-b border-border flex items-center">
          <button
            onClick={() => {
              triggerHaptic()
              router.back()
            }}
            className="text-muted hover:text-text active:text-text transition-colors"
            disabled={isProcessing}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-medium flex-1 text-center mr-6 text-text">{t('checkout')}</h1>
        </header>

        <form onSubmit={handleSubmit} className="pb-32">
          {/* Customer Info Section */}
          <div className="px-5 py-6 border-b border-border">
            <h2 className="text-text text-lg font-semibold mb-4">
              {t('customerInfo')} <span className="text-primary text-sm">{t('required')}</span>
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted mb-2">{t('name')}</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => handleCustomerNameChange(e.target.value)}
                  placeholder={t('namePlaceholder')}
                  disabled={isProcessing}
                  className="w-full bg-card border border-border rounded-lg px-4 py-3 text-text placeholder-muted focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-muted mb-2">{t('phone')}</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => handleCustomerPhoneChange(e.target.value)}
                  placeholder={t('phonePlaceholder')}
                  disabled={isProcessing}
                  className="w-full bg-card border border-border rounded-lg px-4 py-3 text-text placeholder-muted focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                />
              </div>
            </div>
          </div>

          {/* Pickup Time Section */}
          <div className="px-5 py-6 border-b border-border">
            <h2 className="text-text text-lg font-semibold mb-4">{t('pickupTime')}</h2>

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  handlePickupTypeChange('ASAP')
                  triggerHaptic()
                }}
                disabled={isProcessing}
                className={`w-full px-4 py-4 rounded-lg border transition-all ${
                  pickupType === 'ASAP'
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-card border-border text-text hover:bg-border'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{language === 'th' ? 'ให้ร้านทำทันที' : 'Prepare immediately'}</span>
                  {pickupType === 'ASAP' && (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  handlePickupTypeChange('SCHEDULED')
                  triggerHaptic()
                }}
                disabled={isProcessing}
                className={`w-full px-4 py-4 rounded-lg border transition-all ${
                  pickupType === 'SCHEDULED'
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-card border-border text-text hover:bg-border'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t('scheduledPickup')}</span>
                  {pickupType === 'SCHEDULED' && (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>

              {pickupType === 'SCHEDULED' && (
                <select
                  value={pickupTime}
                  onChange={(e) => handlePickupTimeChange(e.target.value)}
                  disabled={isProcessing}
                  className="w-full bg-card border border-border rounded-lg px-4 py-3 text-text focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                >
                  <option value="">{t('selectTime')}</option>
                  {pickupTimes.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Order Summary Section */}
          <div className="px-5 py-6 border-b border-border">
            <h2 className="text-text text-lg font-semibold mb-4">{t('orderSummary')}</h2>

            <div className="space-y-3 mb-6">
              {items.map((item) => {
                const itemName = language === 'th' ? item.name_th : item.name_en
                return (
                  <div key={item.id} className="bg-card border border-border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="text-text font-medium">{itemName}</p>
                        <p className="text-sm text-muted">x{item.quantity}</p>
                      </div>
                      <p className="text-primary font-semibold">฿{item.final_price_thb * item.quantity}</p>
                    </div>
                    {item.options && item.options.length > 0 && (
                      <div className="text-xs text-muted space-y-1">
                        {item.options.map((option: any, idx: number) => {
                          const groupName = language === 'th' ? option.group_name_th : option.group_name_en
                          const choiceNames = language === 'th' ? option.choice_names_th : option.choice_names_en
                          return (
                            <p key={idx}>
                              {groupName}: {choiceNames.join(', ')}
                            </p>
                          )
                        })}
                      </div>
                    )}
                    {item.note && (
                      <p className="text-xs text-muted italic mt-2">{t('note')}: {item.note}</p>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="bg-card border border-primary/30 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-text">{t('total')}</span>
                <span className="text-2xl font-bold text-primary">฿{getTotalPrice()}</span>
              </div>
            </div>
          </div>

          {/* Customer Note Section */}
          <div className="px-5 py-6 border-b border-border">
            <h2 className="text-text text-lg font-semibold mb-2">
              {language === 'th' ? 'หมายเหตุถึงร้าน' : 'Note to Restaurant'}
              <span className="text-muted text-sm font-normal ml-2">
                ({language === 'th' ? 'ไม่บังคับ' : 'Optional'})
              </span>
            </h2>
            <textarea
              value={customerNote}
              onChange={(e) => handleCustomerNoteChange(e.target.value)}
              placeholder={language === 'th' ? 'เช่น ไม่ใส่วาซาบิ / แพ้อาหาร / ฝากบอกพนักงาน…' : 'e.g. No wasabi / Allergies / Special instructions…'}
              disabled={isProcessing}
              className="w-full p-3 bg-card border border-border text-text placeholder:text-muted rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              rows={3}
            />
          </div>
        </form>

        {/* Fixed Bottom CTA */}
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg shadow-black/30">
          <div className="max-w-mobile mx-auto p-5">
            {isProcessing && (
              <div className="mb-3 text-center">
                <p className="text-sm text-muted">
                  {processingState === 'CREATING_ORDER' && t('processingCreatingOrder')}
                  {processingState === 'SAVING_ITEMS' && t('processingSavingItems')}
                </p>
              </div>
            )}
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isProcessing}
              className="w-full py-4 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? t('pleaseWait') : (language === 'th' ? 'ไปหน้าชำระเงิน' : 'Go to Payment')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
