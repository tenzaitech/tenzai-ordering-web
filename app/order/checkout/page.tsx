'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCart } from '@/contexts/CartContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCheckout } from '@/contexts/CheckoutContext'
import { triggerHaptic } from '@/utils/haptic'
import { supabase } from '@/lib/supabase'
import { generateOrderNumber, generatePickupTimes } from '@/lib/orderUtils'

export default function CheckoutPage() {
  const router = useRouter()
  const { items, getTotalPrice, clearCart } = useCart()
  const { language, t } = useLanguage()
  const { draft, updateDraft, clearDraft } = useCheckout()

  const [pickupType, setPickupType] = useState<'ASAP' | 'SCHEDULED'>(() => draft.pickupType)
  const [pickupTime, setPickupTime] = useState(() => draft.pickupTime)
  const [customerName, setCustomerName] = useState(() => draft.customerName)
  const [customerPhone, setCustomerPhone] = useState(() => draft.customerPhone)
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [slipPreview, setSlipPreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mounted, setMounted] = useState(false)

  const pickupTimes = generatePickupTimes()

  useEffect(() => {
    setMounted(true)
    if (items.length === 0) {
      router.push('/order/cart')
    }
  }, [items, router])

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

    console.log('[DEBUG] Cart items at checkout:', items)

    if (!customerName.trim() || !customerPhone.trim() || !slipFile) {
      alert(language === 'th' ? 'กรุณากรอกข้อมูลให้ครบถ้วน' : 'Please fill in all required fields')
      return
    }

    if (pickupType === 'SCHEDULED' && !pickupTime) {
      alert(language === 'th' ? 'กรุณาเลือกเวลารับอาหาร' : 'Please select pickup time')
      return
    }

    setIsSubmitting(true)
    triggerHaptic()

    try {
      // Upload slip to Supabase Storage
      const fileExt = slipFile.name.split('.').pop()
      const fileName = `${Date.now()}.${fileExt}`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('slips')
        .upload(fileName, slipFile)

      if (uploadError) {
        console.error('Upload error:', uploadError)
        alert(language === 'th' ? 'ไม่สามารถอัปโหลดสลิปได้' : 'Failed to upload slip')
        setIsSubmitting(false)
        return
      }

      const { data: { publicUrl } } = supabase.storage
        .from('slips')
        .getPublicUrl(fileName)

      // Generate order number
      const orderNumber = generateOrderNumber()

      // Convert pickup time string (HH:MM) to ISO timestamp for today
      let pickupTimeISO: string | null = null
      if (pickupType === 'SCHEDULED' && pickupTime) {
        const today = new Date()
        const [hours, minutes] = pickupTime.split(':').map(Number)
        today.setHours(hours, minutes, 0, 0)
        pickupTimeISO = today.toISOString()
      }

      console.log('[DEBUG] Pickup details:', {
        pickup_type: pickupType,
        pickup_time_raw: pickupTime,
        pickup_time_iso: pickupTimeISO
      })

      // Create order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
          pickup_type: pickupType,
          pickup_time: pickupTimeISO,
          total_amount: getTotalPrice(),
          slip_url: publicUrl,
        })
        .select()
        .single()

      console.log('[DEBUG] Orders insert result:', { orderData, orderError })

      if (orderError) {
        console.error('[ERROR] Order insert failed:', orderError)
        alert(language === 'th' ? 'ไม่สามารถสร้างคำสั่งซื้อได้' : 'Failed to create order')
        setIsSubmitting(false)
        return
      }

      if (!orderData) {
        console.error('[ERROR] Order insert succeeded but no data returned')
        alert(language === 'th' ? 'ไม่สามารถสร้างคำสั่งซื้อได้' : 'Failed to create order')
        setIsSubmitting(false)
        return
      }

      console.log('[DEBUG] Order created successfully. Order ID:', orderData.id)

      // Create order items with validation
      const orderItems = items.map((item) => {
        // @ts-ignore - handle both old (price_thb) and new (base_price_thb) cart item structures
        const basePrice = item.base_price_thb ?? item.price_thb
        const finalPrice = item.final_price_thb

        // Strict validation
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

      console.log('[DEBUG] Order items to insert (count:', orderItems.length, '):', orderItems)

      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems)
        .select()

      console.log('[DEBUG] Order items insert result:', { itemsData, itemsError })

      if (itemsError) {
        console.error('[ERROR] Order items insert failed:', itemsError)
        console.error('[ERROR] Failed payload was:', orderItems)
        alert(language === 'th' ? 'ไม่สามารถสร้างรายการสั่งซื้อได้' : 'Failed to create order items')
        setIsSubmitting(false)
        throw new Error(`Order items insert failed: ${itemsError.message}`)
      }

      console.log('[SUCCESS] Order items inserted:', itemsData?.length || 0, 'items')

      // Clear cart and checkout draft
      clearCart()
      clearDraft()

      // Redirect to confirmation
      router.push(`/order/confirmed?id=${orderData.id}`)
    } catch (error) {
      console.error('Unexpected error:', error)
      alert(language === 'th' ? 'เกิดข้อผิดพลาด' : 'An error occurred')
      setIsSubmitting(false)
    }
  }

  if (!mounted || items.length === 0) {
    return null
  }

  return (
    <div className={`min-h-screen bg-bg ${mounted ? 'page-mounted' : ''}`}>
      <div className="max-w-mobile mx-auto">
        {/* Header */}
        <header className="sticky top-0 bg-card z-10 px-5 py-4 border-b border-border flex items-center">
          <button
            onClick={() => {
              triggerHaptic()
              router.back()
            }}
            className="text-muted hover:text-text active:text-text transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-medium flex-1 text-center mr-6 text-text">{t('checkout')}</h1>
        </header>

        <form onSubmit={handleSubmit} className="pb-32">
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
                className={`w-full px-4 py-4 rounded-lg border transition-all ${
                  pickupType === 'ASAP'
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-card border-border text-text hover:bg-border'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{t('asap')}</span>
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
                className={`w-full px-4 py-4 rounded-lg border transition-all ${
                  pickupType === 'SCHEDULED'
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-card border-border text-text hover:bg-border'
                }`}
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
                  className="w-full bg-card border border-border rounded-lg px-4 py-3 text-text focus:outline-none focus:border-primary/50 transition-colors"
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
                  className="w-full bg-card border border-border rounded-lg px-4 py-3 text-text placeholder-muted focus:outline-none focus:border-primary/50 transition-colors"
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
                  className="w-full bg-card border border-border rounded-lg px-4 py-3 text-text placeholder-muted focus:outline-none focus:border-primary/50 transition-colors"
                  required
                />
              </div>
            </div>
          </div>

          {/* Payment Section */}
          <div className="px-5 py-6 border-b border-border">
            <h2 className="text-text text-lg font-semibold mb-4">
              {t('payment')} <span className="text-primary text-sm">{t('required')}</span>
            </h2>

            <div className="bg-card border border-border rounded-lg p-4 mb-4">
              <p className="text-sm text-muted mb-2">{t('promptPayInstructions')}</p>
              <p className="text-text font-medium mb-1">{t('promptPayNumber')}</p>
              <p className="text-2xl font-semibold text-primary">0812345678</p>
            </div>

            <div>
              <label className="block text-sm text-muted mb-2">
                {t('uploadSlip')} <span className="text-primary">*</span>
              </label>
              <p className="text-xs text-muted mb-3">{t('uploadSlipDesc')}</p>

              {!slipPreview ? (
                <label className="block w-full border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSlipChange}
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
                    className="mt-3 w-full py-3 bg-card border border-border text-text rounded-lg hover:bg-border transition-colors"
                  >
                    {t('changeSlip')}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Order Summary Section */}
          <div className="px-5 py-6">
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
        </form>

        {/* Fixed Bottom CTA */}
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg shadow-black/30">
          <div className="max-w-mobile mx-auto p-5">
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full py-4 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t('pleaseWait') : t('confirmOrder')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
