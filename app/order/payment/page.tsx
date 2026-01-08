'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCart } from '@/contexts/CartContext'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCheckout } from '@/contexts/CheckoutContext'
import { triggerHaptic } from '@/utils/haptic'
import { supabase } from '@/lib/supabase'
import { generatePromptPayPayload } from '@/lib/promptpay'
import { clearCheckoutDraft } from '@/lib/checkoutDraft'
import ErrorModal from '@/components/ErrorModal'
import UnifiedOrderHeader from '@/components/order/UnifiedOrderHeader'

// Fallback PromptPay ID (used only if DB has no promptpay_id configured)
const FALLBACK_PROMPTPAY_ID = '0988799990'

type ProcessingState = 'IDLE' | 'UPLOADING_SLIP'

type AdminSettingsRow = {
  promptpay_id: string | null
}

type OrderRow = {
  [key: string]: unknown
  id: string
  subtotal_amount_dec: number
  vat_amount_dec: number
  total_amount_dec: number
  vat_rate: number
}

// Helper: Format amount with 2 decimals
function formatAmount(amount: number): string {
  return amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function PaymentPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { clearCart } = useCart()
  const { language, t } = useLanguage()
  const { clearDraft } = useCheckout()

  const [order, setOrder] = useState<any>(null)
  const [orderItems, setOrderItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [moneyDataMissing, setMoneyDataMissing] = useState(false)
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [slipPreview, setSlipPreview] = useState<string | null>(null)
  const [processingState, setProcessingState] = useState<ProcessingState>('IDLE')
  const [showError, setShowError] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [promptPayId, setPromptPayId] = useState<string>(FALLBACK_PROMPTPAY_ID)
  const [savingQR, setSavingQR] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const qrImageRef = useRef<HTMLImageElement>(null)

  const orderId = searchParams.get('id')
  const fromPage = searchParams.get('from')

  // Get pickup badge for display
  const getPickupBadge = (pickupType: string | undefined, pickupTime: string | null | undefined) => {
    if (pickupType === 'ASAP') {
      return {
        label: language === 'th' ? 'รับทันที' : 'ASAP',
        className: 'bg-orange-500/20 text-orange-500'
      }
    } else if (pickupTime) {
      const date = new Date(pickupTime)
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return {
        label: language === 'th' ? `นัดรับ ${hours}:${minutes}` : `Scheduled ${hours}:${minutes}`,
        className: 'bg-blue-500/20 text-blue-400'
      }
    }
    return null
  }

  // Format options for display (same pattern as Order Detail)
  const formatOptions = (optionsJson: any) => {
    if (!optionsJson || !Array.isArray(optionsJson)) return null

    const optionStrings: string[] = []
    optionsJson.forEach((opt: any) => {
      if (opt.choice_names_th && Array.isArray(opt.choice_names_th) && language === 'th') {
        optionStrings.push(...opt.choice_names_th)
      } else if (opt.choice_names_en && Array.isArray(opt.choice_names_en) && language === 'en') {
        optionStrings.push(...opt.choice_names_en)
      } else if (opt.name_th && language === 'th') {
        optionStrings.push(opt.name_th)
      } else if (opt.name_en && language === 'en') {
        optionStrings.push(opt.name_en)
      }
    })

    return optionStrings.length > 0 ? optionStrings : null
  }

  useEffect(() => {
    setMounted(true)

    if (!orderId) {
      setLoading(false)
      return
    }

    const fetchOrder = async () => {
      try {
        // Fetch PromptPay ID from admin_settings
        const { data: settingsData } = await supabase
          .from('admin_settings')
          .select('promptpay_id')
          .limit(1)
          .single()

        const settings = settingsData as AdminSettingsRow | null
        const dbPromptPayId = settings?.promptpay_id || FALLBACK_PROMPTPAY_ID
        setPromptPayId(dbPromptPayId)

        // Fetch order
        const { data: orderData, error } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single()

        const data = orderData as OrderRow | null
        if (error || !data) {
          console.error('[ERROR] Failed to fetch order:', error)
          setLoading(false)
          return
        }

        setOrder(data)

        // Check if required money fields are present
        if (data.subtotal_amount_dec == null || data.vat_amount_dec == null || data.total_amount_dec == null) {
          console.error('[PAYMENT] Missing *_dec money fields:', {
            subtotal: data.subtotal_amount_dec,
            vat: data.vat_amount_dec,
            total: data.total_amount_dec
          })
          setMoneyDataMissing(true)
          setLoading(false)
          return
        }

        // Fetch order items from DB for summary display
        const { data: itemsData } = await supabase
          .from('order_items')
          .select('id, name_th, name_en, qty, base_price, final_price, note, selected_options_json')
          .eq('order_id', orderId)
          .order('id', { ascending: true })

        setOrderItems(itemsData || [])
        setLoading(false)

        // Generate PromptPay QR code with locked amount using DB promptpay_id
        const qrAmount = data.total_amount_dec
        if (qrAmount > 0) {
          const payload = generatePromptPayPayload(dbPromptPayId, qrAmount)
          const encodedPayload = encodeURIComponent(payload)
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedPayload}&format=png&margin=10`
          setQrCodeUrl(qrUrl)
        }
      } catch (error) {
        console.error('[ERROR] Unexpected error fetching order:', error)
        setLoading(false)
      }
    }

    fetchOrder()
  }, [orderId])

  const handleSaveQR = async () => {
    if (!qrImageRef.current) return
    triggerHaptic()
    setSavingQR(true)

    try {
      const img = qrImageRef.current
      const fileName = `tenzai-promptpay-${order?.order_number || 'qr'}.png`

      // Step 1: Create canvas and draw the image
      const canvas = document.createElement('canvas')
      const padding = 20
      canvas.width = img.naturalWidth + padding * 2
      canvas.height = img.naturalHeight + padding * 2

      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas not supported')

      // White background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw image centered with padding
      ctx.drawImage(img, padding, padding, img.naturalWidth, img.naturalHeight)

      // Step 2: Convert canvas to Blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b)
          else reject(new Error('Failed to create blob'))
        }, 'image/png')
      })

      // Step 3: Try Web Share API first (best for mobile)
      if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
        const file = new File([blob], fileName, { type: 'image/png' })
        const shareData = { files: [file], title: 'PromptPay QR' }

        if (navigator.canShare(shareData)) {
          try {
            await navigator.share(shareData)
            setSavingQR(false)
            return
          } catch (shareErr) {
            // User cancelled or share failed, continue to fallback
            if ((shareErr as Error).name === 'AbortError') {
              setSavingQR(false)
              return
            }
            console.log('[QR] Share API failed, trying download fallback')
          }
        }
      }

      // Step 4: Fallback - try download via <a download> (desktop + some Android)
      const dataUrl = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = fileName

      // Check if we're on iOS (download attribute doesn't work on iOS Safari)
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)

      if (!isIOS && 'download' in link) {
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        setSavingQR(false)
        return
      }

      // Step 5: Final fallback - show modal with press-and-hold instructions
      setQrDataUrl(dataUrl)
      setShowQRModal(true)
      setSavingQR(false)
    } catch (err) {
      console.error('[QR] Failed to save QR:', err)
      setSavingQR(false)

      // Show error to user
      alert(language === 'th'
        ? 'ไม่สามารถบันทึก QR ได้ กรุณาลองกดค้างที่รูป QR เพื่อบันทึก'
        : 'Could not save QR. Please try long-pressing the QR image to save.')
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
        .update({ slip_url: publicUrl } as never)
        .eq('id', orderId)

      if (updateError) {
        console.error('[ERROR:SLIP] Failed to update order:', updateError)
        setShowError(true)
        setProcessingState('IDLE')
        return
      }

      // Fire-and-forget LINE notification
      fetch('/api/line/notify-slip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      }).catch(err => console.error('[LINE:NOTIFY] Failed to trigger:', err))

      // Navigate to confirmation page
      router.replace(`/order/confirmed?id=${orderId}`)

      // Clear cart, checkout draft, localStorage draft, and reset processing state after navigation starts
      setTimeout(() => {
        clearCart()
        clearDraft()
        clearCheckoutDraft() // Clear localStorage draft - order is complete
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

  // Money data missing error state
  if (moneyDataMissing) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-5">
        <div className="max-w-sm text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-text mb-2">
            {language === 'th' ? 'ไม่พบข้อมูลยอดเงินของออเดอร์' : 'Order Amount Data Missing'}
          </h2>
          <p className="text-muted mb-6">
            {language === 'th' ? 'กรุณาลองใหม่อีกครั้ง หรือติดต่อร้านค้า' : 'Please try again or contact the store'}
          </p>
          <button
            onClick={() => {
              triggerHaptic()
              router.push('/order/status')
            }}
            className="px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            {language === 'th' ? 'กลับหน้าสถานะออเดอร์' : 'Back to Order Status'}
          </button>
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

      {/* Unified Header */}
      <UnifiedOrderHeader
        title={t('payment')}
        backHref={fromPage === 'status' ? '/order/status' : '/order/checkout'}
      />

      <div className="max-w-mobile mx-auto pt-14">
        {/* Edit Actions (for unpaid orders) */}
        {(() => {
          const isEditable = order && !order.slip_notified_at && order.status !== 'approved' && order.status !== 'rejected'
          if (!isEditable) {
            return (
              <div className="px-5 py-3 border-b border-border flex justify-center">
                <span className="px-4 py-2 text-sm text-muted/50">
                  {language === 'th' ? 'ล็อคแล้ว (อัปสลิปแล้ว)' : 'Locked (slip uploaded)'}
                </span>
              </div>
            )
          }
          return (
            <div className="px-5 py-3 border-b border-border flex justify-center gap-4">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic()
                  router.push(`/order/edit/${orderId}`)
                }}
                disabled={isProcessing}
                className="px-4 py-2 text-sm text-muted hover:text-text active:text-text transition-colors disabled:opacity-50"
              >
                {language === 'th' ? 'แก้ไขรายการ' : 'Edit Items'}
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic()
                  router.push(`/order/menu?editOrderId=${orderId}&mode=add`)
                }}
                disabled={isProcessing}
                className="px-4 py-2 text-sm text-primary hover:text-primary/80 active:text-primary/70 transition-colors disabled:opacity-50 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {language === 'th' ? 'สั่งเพิ่ม' : 'Add more'}
              </button>
            </div>
          )
        })()}

        <form onSubmit={handleSubmit} className="pb-32">
          {/* Order Summary */}
          <div className="px-5 py-6 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-text text-lg font-semibold">{t('orderSummary')}</h2>
              {(() => {
                const badge = getPickupBadge(order?.pickup_type, order?.pickup_time)
                return badge ? (
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                ) : null
              })()}
            </div>

            <div className="bg-card border border-border rounded-lg p-4 mb-4">
              {/* Item List (collapsible) */}
              <div className="space-y-3 mb-3">
                {orderItems.slice(0, isExpanded ? orderItems.length : 3).map((item) => {
                  const itemName = language === 'th' ? item.name_th : item.name_en
                  const options = formatOptions(item.selected_options_json)
                  return (
                    <div key={item.id} className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-text text-sm font-medium">{itemName}</p>
                        <p className="text-xs text-muted">x{item.qty}</p>
                        {/* Selected Options */}
                        {options && options.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {options.map((opt, idx) => (
                              <p key={idx} className="text-xs text-muted">• {opt}</p>
                            ))}
                          </div>
                        )}
                        {item.note && (
                          <p className="text-xs text-muted italic mt-1">{t('note')}: {item.note}</p>
                        )}
                      </div>
                      <p className="text-text text-sm font-semibold ml-3">฿{formatAmount(item.final_price * item.qty)}</p>
                    </div>
                  )
                })}
              </div>

              {/* Expand/Collapse Control */}
              {orderItems.length > 3 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsExpanded(!isExpanded)
                    triggerHaptic()
                  }}
                  className="w-full py-2 flex items-center justify-center text-primary text-sm hover:text-primary/80 transition-colors"
                >
                  <span>{isExpanded ? (language === 'th' ? 'ย่อ' : 'Collapse') : (language === 'th' ? `แสดงทั้งหมด (${orderItems.length} รายการ)` : `Show all (${orderItems.length} items)`)}</span>
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
              {order?.customer_note && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-xs text-muted mb-1">
                    {language === 'th' ? 'หมายเหตุถึงร้าน' : 'Note to Restaurant'}
                  </p>
                  <p className="text-sm text-text">{order.customer_note}</p>
                </div>
              )}
            </div>

            {/* VAT Breakdown + Total */}
            <div className="bg-card border border-primary/30 rounded-lg p-4">
              {/* Subtotal */}
              <div className="flex justify-between items-center text-sm mb-2">
                <span className="text-muted">{language === 'th' ? 'ราคาสินค้า (ก่อน VAT)' : 'Subtotal (before VAT)'}</span>
                <span className="text-text">฿{formatAmount(order.subtotal_amount_dec)}</span>
              </div>
              {/* VAT */}
              <div className="flex justify-between items-center text-sm mb-3">
                <span className="text-muted">
                  {language === 'th' ? `VAT ${order.vat_rate}%` : `VAT ${order.vat_rate}%`}
                </span>
                <span className="text-text">฿{formatAmount(order.vat_amount_dec)}</span>
              </div>
              {/* Divider */}
              <div className="border-t border-border pt-3">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-text">{t('total')}</span>
                  <span className="text-2xl font-bold text-primary">฿{formatAmount(order.total_amount_dec)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* PromptPay QR Code */}
          <div className="px-5 py-6 border-b border-border">
            <h2 className="text-text text-lg font-semibold mb-4">{t('payment')}</h2>

            <div className="bg-card border border-border rounded-lg p-4">
              <p className="text-sm text-muted mb-3 text-center">{t('promptPayInstructions')}</p>

              {/* QR Code Display */}
              {qrCodeUrl && (
                <div className="flex flex-col items-center">
                  <div className="bg-white p-3 rounded-lg mb-3">
                    <img
                      ref={qrImageRef}
                      src={qrCodeUrl}
                      alt="PromptPay QR Code"
                      className="w-48 h-48"
                      crossOrigin="anonymous"
                    />
                  </div>

                  {/* Amount Display */}
                  <div className="text-center mb-3">
                    <p className="text-xs text-muted mb-1">{language === 'th' ? 'ยอดชำระ' : 'Amount'}</p>
                    <p className="text-2xl font-bold text-primary">฿{formatAmount(order.total_amount_dec)}</p>
                  </div>

                  {/* Recipient Info */}
                  <div className="text-center mb-4">
                    <p className="text-xs text-muted">{language === 'th' ? 'พร้อมเพย์' : 'PromptPay'}</p>
                    <p className="text-sm text-text font-medium">{promptPayId}</p>
                  </div>

                  {/* Save QR Button */}
                  <button
                    type="button"
                    onClick={handleSaveQR}
                    disabled={isProcessing || savingQR}
                    className="flex items-center gap-2 px-4 py-2 bg-bg-surface border border-border rounded-lg text-sm text-text hover:bg-border transition-colors disabled:opacity-50"
                  >
                    {savingQR ? (
                      <>
                        <div className="w-4 h-4 border-2 border-text border-t-transparent rounded-full animate-spin"></div>
                        {language === 'th' ? 'กำลังบันทึก...' : 'Saving...'}
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        {language === 'th' ? 'บันทึก QR' : 'Save QR'}
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Fallback if QR not loaded */}
              {!qrCodeUrl && (
                <div className="text-center py-4">
                  <div className="w-8 h-8 mx-auto mb-2 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm text-muted">{language === 'th' ? 'กำลังสร้าง QR...' : 'Generating QR...'}</p>
                </div>
              )}
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

      {/* QR Save Modal (fallback for WebViews that don't support download) */}
      {showQRModal && qrDataUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-5">
          <div className="bg-card border border-border rounded-lg p-6 max-w-sm w-full text-center">
            <h3 className="text-lg font-semibold text-text mb-2">
              {language === 'th' ? 'บันทึก QR Code' : 'Save QR Code'}
            </h3>
            <p className="text-sm text-muted mb-4">
              {language === 'th'
                ? 'กดค้างที่รูปแล้วเลือก "บันทึกรูปภาพ"'
                : 'Press and hold the image, then select "Save Image"'}
            </p>
            <div className="bg-white p-4 rounded-lg mb-4 inline-block">
              <img
                src={qrDataUrl}
                alt="PromptPay QR Code"
                className="w-48 h-48 mx-auto"
              />
            </div>
            <div className="space-y-3">
              <button
                onClick={async () => {
                  // Try to open in external browser for easier saving
                  try {
                    const liff = (await import('@line/liff')).default
                    if (liff.isInClient()) {
                      liff.openWindow({ url: qrDataUrl, external: true })
                    } else {
                      window.open(qrDataUrl, '_blank')
                    }
                  } catch {
                    window.open(qrDataUrl, '_blank')
                  }
                }}
                className="w-full py-3 bg-bg-surface border border-border text-text font-medium rounded-lg hover:bg-border transition-colors"
              >
                {language === 'th' ? 'เปิดรูปภาพ' : 'Open Image'}
              </button>
              <button
                onClick={() => setShowQRModal(false)}
                className="w-full py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                {language === 'th' ? 'ปิด' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PaymentLoadingFallback() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted">Loading...</p>
      </div>
    </div>
  )
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<PaymentLoadingFallback />}>
      <PaymentPageContent />
    </Suspense>
  )
}
