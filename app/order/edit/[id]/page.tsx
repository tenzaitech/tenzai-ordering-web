'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useLanguage } from '@/contexts/LanguageContext'
import { triggerHaptic } from '@/utils/haptic'
import UnifiedOrderHeader from '@/components/order/UnifiedOrderHeader'

type OrderItem = {
  id: string
  menu_item_id: string
  name_th: string
  name_en: string
  qty: number
  base_price: number
  final_price: number
  note: string | null
  selected_options_json: any
}

type Order = {
  id: string
  order_number: string
  status: string | null
  pickup_type: string
  pickup_time: string | null
  total_amount_dec: number
  customer_note: string | null
  slip_notified_at: string | null
}

type ProcessingState = 'IDLE' | 'LOADING' | 'SAVING'

export default function OrderEditPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string
  const { language, t } = useLanguage()

  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [customerNote, setCustomerNote] = useState('')
  const [processingState, setProcessingState] = useState<ProcessingState>('LOADING')
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  // Fetch order data on mount
  useEffect(() => {
    setMounted(true)
    fetchOrder()
  }, [orderId])

  const fetchOrder = async () => {
    setProcessingState('LOADING')
    setError(null)

    try {
      const response = await fetch(`/api/order/edit/${orderId}`)

      if (response.status === 403) {
        setError(language === 'th' ? 'ออเดอร์นี้ถูกล็อคแล้ว' : 'This order is locked')
        setProcessingState('IDLE')
        return
      }

      if (!response.ok) {
        setError(language === 'th' ? 'ไม่พบออเดอร์' : 'Order not found')
        setProcessingState('IDLE')
        return
      }

      const data = await response.json()
      setOrder(data.order)
      setItems(data.items || [])
      setCustomerNote(data.order?.customer_note || '')
      setProcessingState('IDLE')
    } catch (err) {
      console.error('[ORDER_EDIT] Fetch error:', err)
      setError(language === 'th' ? 'เกิดข้อผิดพลาด' : 'An error occurred')
      setProcessingState('IDLE')
    }
  }

  const handleQtyChange = (itemId: string, delta: number) => {
    triggerHaptic()
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQty = Math.max(0, item.qty + delta)
        return { ...item, qty: newQty }
      }
      return item
    }).filter(item => item.qty > 0))
  }

  const handleRemoveItem = (itemId: string) => {
    triggerHaptic()
    setItems(prev => prev.filter(item => item.id !== itemId))
  }

  const handleItemNoteChange = (itemId: string, note: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, note: note || null }
      }
      return item
    }))
  }

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.final_price * item.qty), 0)
  }

  const handleSave = async () => {
    if (items.length === 0) {
      alert(language === 'th' ? 'กรุณาเพิ่มรายการอย่างน้อย 1 รายการ' : 'Please add at least 1 item')
      return
    }

    triggerHaptic()
    setProcessingState('SAVING')

    try {
      const response = await fetch(`/api/order/edit/${orderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(item => ({
            id: item.id,
            menu_item_id: item.menu_item_id,
            name_th: item.name_th,
            name_en: item.name_en,
            qty: item.qty,
            base_price: item.base_price,
            final_price: item.final_price,
            note: item.note,
            selected_options_json: item.selected_options_json,
          })),
          customer_note: customerNote.trim() || null,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save')
      }

      // Navigate back to payment page
      router.replace(`/order/payment?id=${orderId}`)
    } catch (err) {
      console.error('[ORDER_EDIT] Save error:', err)
      alert(language === 'th' ? 'บันทึกไม่สำเร็จ กรุณาลองใหม่' : 'Failed to save. Please try again.')
      setProcessingState('IDLE')
    }
  }

  const handleCancel = () => {
    triggerHaptic()
    router.back()
  }

  if (!mounted) {
    return null
  }

  // Loading state
  if (processingState === 'LOADING') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted">{language === 'th' ? 'กำลังโหลด...' : 'Loading...'}</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-5">
        <div className="max-w-sm text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-text mb-2">{error}</h2>
          <button
            onClick={() => router.push('/order/status')}
            className="mt-4 px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            {language === 'th' ? 'กลับไปหน้าออเดอร์' : 'Back to Orders'}
          </button>
        </div>
      </div>
    )
  }

  // Empty items state
  if (items.length === 0 && order) {
    return (
      <div className="min-h-screen bg-bg">
        {/* Unified Header */}
        <UnifiedOrderHeader
          title={language === 'th' ? 'แก้ไขออเดอร์' : 'Edit Order'}
          backHref="/order/status"
        />

        <div className="max-w-mobile mx-auto pt-14">
          <div className="flex flex-col items-center justify-center py-20 px-5">
            <svg className="w-16 h-16 text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-text font-medium mb-2">
              {language === 'th' ? 'ไม่มีรายการในออเดอร์' : 'No items in order'}
            </p>
            <p className="text-muted text-sm text-center mb-6">
              {language === 'th' ? 'กรุณาเพิ่มรายการอาหารก่อนบันทึก' : 'Please add items before saving'}
            </p>
            <button
              onClick={handleCancel}
              className="px-6 py-3 bg-card border border-border text-text font-medium rounded-lg hover:bg-border transition-colors"
            >
              {language === 'th' ? 'ยกเลิก' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg pb-32">
      {/* Unified Header */}
      <UnifiedOrderHeader
        title={`${language === 'th' ? 'แก้ไขออเดอร์' : 'Edit Order'} #${order?.order_number}`}
        backHref="/order/status"
      />

      <div className="max-w-mobile mx-auto pt-14">
        {/* Add More Items Button */}
        <div className="px-5 py-3 border-b border-border flex justify-center">
          <button
            type="button"
            onClick={() => {
              triggerHaptic()
              router.push(`/order/menu?editOrderId=${orderId}&mode=add`)
            }}
            disabled={processingState === 'SAVING'}
            className="px-4 py-2 text-sm text-primary hover:text-primary/80 active:text-primary/70 transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {language === 'th' ? 'สั่งเพิ่ม' : 'Add more items'}
          </button>
        </div>

        {/* Items List */}
        <div className="px-5 py-4">
          <h2 className="text-text font-semibold mb-3">
            {language === 'th' ? 'รายการ' : 'Items'} ({items.length})
          </h2>

          <div className="space-y-3">
            {items.map((item) => {
              const itemName = language === 'th' ? item.name_th : item.name_en
              const options = item.selected_options_json

              return (
                <div key={item.id} className="bg-card border border-border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <p className="text-text font-medium">{itemName}</p>
                      {options && Array.isArray(options) && options.length > 0 && (
                        <div className="text-xs text-muted mt-1 space-y-0.5">
                          {options.map((opt: any, idx: number) => {
                            const groupName = language === 'th' ? opt.group_name_th : opt.group_name_en
                            const choiceNames = language === 'th' ? opt.choice_names_th : opt.choice_names_en
                            return (
                              <p key={idx}>{groupName}: {choiceNames?.join(', ')}</p>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-red-500 hover:text-red-400 p-1"
                      disabled={processingState === 'SAVING'}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleQtyChange(item.id, -1)}
                        disabled={processingState === 'SAVING'}
                        className="w-8 h-8 rounded-full bg-bg border border-border flex items-center justify-center text-text hover:bg-border transition-colors disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      <span className="text-text font-medium w-8 text-center">{item.qty}</span>
                      <button
                        onClick={() => handleQtyChange(item.id, 1)}
                        disabled={processingState === 'SAVING'}
                        className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-primary font-semibold">฿{item.final_price * item.qty}</p>
                  </div>

                  {/* Item Note */}
                  <div className="mt-3 pt-3 border-t border-border">
                    <input
                      type="text"
                      value={item.note || ''}
                      onChange={(e) => handleItemNoteChange(item.id, e.target.value)}
                      placeholder={language === 'th' ? 'หมายเหตุรายการ...' : 'Item note...'}
                      disabled={processingState === 'SAVING'}
                      className="w-full bg-bg border border-border rounded px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-primary/50 disabled:opacity-50"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Customer Note */}
        <div className="px-5 py-4 border-t border-border">
          <h2 className="text-text font-semibold mb-3">
            {language === 'th' ? 'หมายเหตุถึงร้าน' : 'Note to Restaurant'}
          </h2>
          <textarea
            value={customerNote}
            onChange={(e) => setCustomerNote(e.target.value)}
            placeholder={language === 'th' ? 'เช่น ไม่ใส่วาซาบิ / แพ้อาหาร...' : 'e.g. No wasabi / Allergies...'}
            disabled={processingState === 'SAVING'}
            className="w-full p-3 bg-card border border-border text-text placeholder:text-muted rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:opacity-50"
            rows={2}
          />
        </div>

        {/* Total */}
        <div className="px-5 py-4">
          <div className="bg-card border border-primary/30 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-text">{t('total')}</span>
              <span className="text-2xl font-bold text-primary">฿{calculateTotal()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg shadow-black/30">
        <div className="max-w-mobile mx-auto p-5 flex gap-3">
          <button
            onClick={handleCancel}
            disabled={processingState === 'SAVING'}
            className="flex-1 py-4 bg-bg border border-border text-text font-medium rounded-lg hover:bg-border transition-colors disabled:opacity-50"
          >
            {language === 'th' ? 'ยกเลิก' : 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={processingState === 'SAVING' || items.length === 0}
            className="flex-1 py-4 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {processingState === 'SAVING'
              ? (language === 'th' ? 'กำลังบันทึก...' : 'Saving...')
              : (language === 'th' ? 'บันทึกการแก้ไข' : 'Save Changes')
            }
          </button>
        </div>
      </div>
    </div>
  )
}
