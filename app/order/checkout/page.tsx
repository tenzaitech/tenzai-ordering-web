'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/contexts/CartContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCheckout } from '@/contexts/CheckoutContext'
import { triggerHaptic } from '@/utils/haptic'
import { supabase } from '@/lib/supabase'
import { generateOrderNumber, generatePickupTimes, generatePickupDates, getCartFingerprint } from '@/lib/orderUtils'
import { saveCheckoutDraft, loadCheckoutDraft, clearCheckoutDraft } from '@/lib/checkoutDraft'
import ErrorModal from '@/components/ErrorModal'
import UnifiedOrderHeader from '@/components/order/UnifiedOrderHeader'

type ProcessingState = 'IDLE' | 'CREATING_ORDER' | 'SAVING_ITEMS'

type ErrorState = {
  step: 'ORDER' | 'ITEMS'
  orderNumber?: string
  orderId?: string
} | null

type OrderInsertResult = {
  id: string
  order_number: string
}

// VAT Constants (calculated at checkout only)
const VAT_RATE = 7 // 7%

export default function CheckoutPage() {
  const router = useRouter()
  const { items, getTotalPrice, clearCart } = useCart()
  const { language, t } = useLanguage()
  const { draft, updateDraft, clearDraft, activeOrderId, setActiveOrderId, setLastSyncedCartFingerprint } = useCheckout()

  const [pickupType, setPickupType] = useState<'ASAP' | 'SCHEDULED'>(() => draft.pickupType)
  const [pickupDate, setPickupDate] = useState(() => draft.pickupDate)
  const [pickupTime, setPickupTime] = useState(() => draft.pickupTime)
  const [customerName, setCustomerName] = useState(() => draft.customerName)
  const [customerPhone, setCustomerPhone] = useState(() => draft.customerPhone)
  const [customerNote, setCustomerNote] = useState(() => draft.customerNote)
  const [processingState, setProcessingState] = useState<ProcessingState>('IDLE')
  const [errorState, setErrorState] = useState<ErrorState>(null)
  const [isNavigatingToPayment, setIsNavigatingToPayment] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Invoice request state (initialized from draft if available)
  const [invoiceRequested, setInvoiceRequested] = useState(() => {
    if (typeof window === 'undefined') return false
    const draft = loadCheckoutDraft()
    return draft?.invoiceRequested ?? false
  })
  const [invoiceCompanyName, setInvoiceCompanyName] = useState(() => {
    if (typeof window === 'undefined') return ''
    const draft = loadCheckoutDraft()
    return draft?.invoiceCompanyName ?? ''
  })
  const [invoiceTaxId, setInvoiceTaxId] = useState(() => {
    if (typeof window === 'undefined') return ''
    const draft = loadCheckoutDraft()
    return draft?.invoiceTaxId ?? ''
  })
  const [invoiceAddress, setInvoiceAddress] = useState(() => {
    if (typeof window === 'undefined') return ''
    const draft = loadCheckoutDraft()
    return draft?.invoiceAddress ?? ''
  })
  const [invoiceBuyerPhone, setInvoiceBuyerPhone] = useState('')

  // VAT Calculation (order-level only, menu prices are NET)
  // All values are exact decimals - NO ROUNDING
  const subtotalAmount = getTotalPrice() // NET (before VAT) - exact decimal
  const vatAmount = subtotalAmount * VAT_RATE / 100 // Exact VAT (e.g., 125 * 7 / 100 = 8.75)
  const totalAmount = subtotalAmount + vatAmount // GROSS - exact decimal

  // Helper: Format amount with 2 decimals (DISPLAY ONLY)
  const formatAmount = (amount: number): string => {
    return amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const pickupTimes = generatePickupTimes()
  const pickupDates = generatePickupDates()

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
      setPickupDate('')
      setPickupTime('')
      updateDraft({ pickupDate: '', pickupTime: '' })
    }
  }

  const handlePickupDateChange = (date: string) => {
    setPickupDate(date)
    updateDraft({ pickupDate: date })
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

    if (pickupType === 'SCHEDULED' && (!pickupDate || !pickupTime)) {
      alert(language === 'th' ? 'กรุณาเลือกวันและเวลารับอาหาร' : 'Please select pickup date and time')
      return
    }

    // Validate invoice fields if requested
    if (invoiceRequested) {
      if (!invoiceCompanyName.trim() || !invoiceTaxId.trim() || !invoiceAddress.trim()) {
        alert(language === 'th' ? 'กรุณากรอกข้อมูลใบกำกับภาษีให้ครบถ้วน' : 'Please fill in all invoice fields')
        return
      }
    }

    // If activeOrderId exists, navigate to payment instead of creating duplicate order
    if (activeOrderId) {
      triggerHaptic()
      setIsNavigatingToPayment(true)
      // Save draft for Back navigation restoration
      saveCheckoutDraft({
        cartItems: items,
        customerName,
        customerPhone,
        pickupType,
        pickupDate,
        pickupTime,
        customerNote,
        invoiceRequested,
        invoiceCompanyName,
        invoiceTaxId,
        invoiceAddress,
        activeOrderId
      })
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
      // === STEP 0a: Validate cart against category schedules ===
      const validateRes = await fetch('/api/order/validate-cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.map(item => ({ menuId: item.menuId })) })
      })

      if (!validateRes.ok) {
        const validateData = await validateRes.json()
        const errorMsg = language === 'th'
          ? (validateData.error_th || 'บางรายการไม่อยู่ในช่วงเวลาที่เปิดให้บริการ')
          : (validateData.error || 'Some items are outside their category schedule')
        const details = validateData.details?.join('\n') || ''
        alert(`${errorMsg}\n\n${details}`)
        return
      }

      // === STEP 0b: Get LINE userId ===
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
      await new Promise(resolve => setTimeout(resolve, 500)) // Allow users to read status

      const orderNumber = generateOrderNumber()

      // Convert pickup date + time to timestamptz for Asia/Bangkok (+07:00)
      let pickupTimeISO: string | null = null
      if (pickupType === 'SCHEDULED' && pickupDate && pickupTime) {
        // pickupDate is YYYY-MM-DD, pickupTime is HH:MM
        const [selectedHours, selectedMinutes] = pickupTime.split(':').map(Number)
        const hours = String(selectedHours).padStart(2, '0')
        const minutes = String(selectedMinutes).padStart(2, '0')

        pickupTimeISO = `${pickupDate}T${hours}:${minutes}:00+07:00`
      }

      const { data: orderInsertData, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          customer_line_user_id: userId,
          pickup_type: pickupType,
          pickup_time: pickupTimeISO,
          // VAT fields - DECIMAL SOURCE OF TRUTH (never rounded)
          subtotal_amount_dec: Number(subtotalAmount),
          vat_rate: VAT_RATE,
          vat_amount_dec: Number(vatAmount),
          total_amount_dec: Number(totalAmount),
          // Invoice fields (immutable after creation)
          invoice_requested: invoiceRequested,
          invoice_company_name: invoiceRequested ? invoiceCompanyName.trim() : null,
          invoice_tax_id: invoiceRequested ? invoiceTaxId.trim() : null,
          invoice_address: invoiceRequested ? invoiceAddress.trim() : null,
          invoice_buyer_phone: invoiceRequested && invoiceBuyerPhone.trim() ? invoiceBuyerPhone.trim() : null,
          customer_note: customerNote.trim() || null,
          slip_url: null,
        } as never)
        .select()
        .single()

      const orderData = orderInsertData as OrderInsertResult | null

      if (orderError || !orderData) {
        console.error('[ERROR:ORDER]', orderError)
        setErrorState({ step: 'ORDER' })
        setProcessingState('IDLE')
        return
      }

      // === STEP B: Insert order items ===
      setProcessingState('SAVING_ITEMS')
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
        .insert(orderItems as never)
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

      // Set navigating flag to prevent cart-empty redirect
      setIsNavigatingToPayment(true)

      // Store active order ID and cart fingerprint
      setActiveOrderId(orderData.id)
      setLastSyncedCartFingerprint(getCartFingerprint(items))

      // Save draft for Back navigation restoration (before clearing cart)
      saveCheckoutDraft({
        cartItems: items,
        customerName,
        customerPhone,
        pickupType,
        pickupDate,
        pickupTime,
        customerNote,
        invoiceRequested,
        invoiceCompanyName,
        invoiceTaxId,
        invoiceAddress,
        activeOrderId: orderData.id
      })

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

      {/* Unified Header */}
      <UnifiedOrderHeader title={t('checkout')} backHref="/order/cart" />

      <div className="max-w-mobile mx-auto pt-14">
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
                <div className="space-y-3">
                  {/* Date Picker */}
                  <select
                    value={pickupDate}
                    onChange={(e) => handlePickupDateChange(e.target.value)}
                    disabled={isProcessing}
                    className="w-full bg-card border border-border rounded-lg px-4 py-3 text-text focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    required
                  >
                    <option value="">{language === 'th' ? 'เลือกวัน' : 'Select date'}</option>
                    {pickupDates.map((date) => (
                      <option key={date.value} value={date.value}>
                        {language === 'th' ? date.label_th : date.label_en}
                      </option>
                    ))}
                  </select>
                  {/* Time Picker */}
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
                </div>
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
                      <p className="text-primary font-semibold">฿{formatAmount(item.final_price_thb * item.quantity)}</p>
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

            {/* VAT Breakdown - shown only at checkout */}
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center text-text">
                <span>{language === 'th' ? 'ยอดรวมสินค้า (ก่อน VAT)' : 'Subtotal (before VAT)'}</span>
                <span>฿{formatAmount(subtotalAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-text">
                <span>{language === 'th' ? 'VAT 7%' : 'VAT 7%'}</span>
                <span>฿{formatAmount(vatAmount)}</span>
              </div>
              <div className="border-t border-border pt-3 flex justify-between items-center">
                <span className="text-lg font-semibold text-text">{t('total')}</span>
                <span className="text-2xl font-bold text-primary">฿{formatAmount(totalAmount)}</span>
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

          {/* VAT Invoice Request Section */}
          <div className="px-5 py-6 border-b border-border">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={invoiceRequested}
                onChange={(e) => setInvoiceRequested(e.target.checked)}
                disabled={isProcessing}
                className="w-5 h-5 rounded border-border text-primary focus:ring-primary focus:ring-offset-0 bg-card disabled:opacity-50"
              />
              <span className="text-text font-medium">
                {language === 'th' ? 'ต้องการใบกำกับภาษี' : 'Request VAT Invoice'}
              </span>
            </label>

            {invoiceRequested && (
              <div className="mt-4 space-y-4 pl-8">
                <div>
                  <label className="block text-sm text-muted mb-2">
                    {language === 'th' ? 'ชื่อบริษัท / ชื่อผู้เสียภาษี' : 'Company Name'} <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    value={invoiceCompanyName}
                    onChange={(e) => setInvoiceCompanyName(e.target.value)}
                    placeholder={language === 'th' ? 'บริษัท ABC จำกัด' : 'ABC Company Ltd.'}
                    disabled={isProcessing}
                    className="w-full bg-card border border-border rounded-lg px-4 py-3 text-text placeholder-muted focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-2">
                    {language === 'th' ? 'เลขประจำตัวผู้เสียภาษี' : 'Tax ID'} <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    value={invoiceTaxId}
                    onChange={(e) => setInvoiceTaxId(e.target.value)}
                    placeholder="0123456789012"
                    disabled={isProcessing}
                    className="w-full bg-card border border-border rounded-lg px-4 py-3 text-text placeholder-muted focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-2">
                    {language === 'th' ? 'ที่อยู่สำหรับใบกำกับภาษี' : 'Invoice Address'} <span className="text-primary">*</span>
                  </label>
                  <textarea
                    value={invoiceAddress}
                    onChange={(e) => setInvoiceAddress(e.target.value)}
                    placeholder={language === 'th' ? '123 ถนนสุขุมวิท แขวงคลองตัน เขตวัฒนา กรุงเทพฯ 10110' : '123 Sukhumvit Road, Bangkok 10110'}
                    disabled={isProcessing}
                    className="w-full bg-card border border-border rounded-lg px-4 py-3 text-text placeholder-muted focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed resize-none"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-2">
                    {language === 'th' ? 'เบอร์โทรผู้ซื้อ' : 'Buyer Phone'}
                    <span className="text-muted/60 ml-1">({language === 'th' ? 'ไม่บังคับ' : 'Optional'})</span>
                  </label>
                  <input
                    type="tel"
                    value={invoiceBuyerPhone}
                    onChange={(e) => setInvoiceBuyerPhone(e.target.value)}
                    placeholder={language === 'th' ? '02-XXX-XXXX' : '02-XXX-XXXX'}
                    disabled={isProcessing}
                    className="w-full bg-card border border-border rounded-lg px-4 py-3 text-text placeholder-muted focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
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
