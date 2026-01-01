'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useLanguage } from '@/contexts/LanguageContext'
import { triggerHaptic } from '@/utils/haptic'
import { supabase } from '@/lib/supabase'

export default function OrderConfirmedPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { language, t } = useLanguage()

  const [order, setOrder] = useState<any>(null)
  const [orderItems, setOrderItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    const fetchOrder = async () => {
      const orderId = searchParams.get('id')
      if (!orderId) {
        setFetchError(true)
        setLoading(false)
        return
      }

      try {
        // Fetch order
        const { data: orderData, error: orderError } = await supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single()

        if (orderError || !orderData) {
          console.error('Order error:', orderError)
          setFetchError(true)
          setLoading(false)
          return
        }

        // Fetch order items
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', orderId)

        if (itemsError) {
          console.error('Items error:', itemsError)
        }

        setOrder(orderData)
        setOrderItems(itemsData || [])
        setLoading(false)
      } catch (error) {
        console.error('Unexpected error:', error)
        setFetchError(true)
        setLoading(false)
      }
    }

    fetchOrder()
  }, [searchParams])

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

  if (fetchError || !order) {
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
            {language === 'th' ? 'ไม่สามารถโหลดข้อมูลคำสั่งซื้อได้ กรุณาลองใหม่อีกครั้ง' : 'Could not load order information. Please try again'}
          </p>
          <button
            onClick={() => {
              triggerHaptic()
              router.push('/order/menu')
            }}
            className="px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            {t('backToMenu')}
          </button>
        </div>
      </div>
    )
  }

  // Format pickup time for display (Asia/Bangkok timezone)
  const formatPickupTime = (isoString: string) => {
    // Parse ISO string and convert to Bangkok time
    const date = new Date(isoString)
    const bangkokOffsetMs = 7 * 60 * 60 * 1000
    const bangkokTime = new Date(date.getTime() + bangkokOffsetMs)

    // Extract components
    const hours = String(bangkokTime.getUTCHours()).padStart(2, '0')
    const minutes = String(bangkokTime.getUTCMinutes()).padStart(2, '0')
    const day = String(bangkokTime.getUTCDate()).padStart(2, '0')
    const month = String(bangkokTime.getUTCMonth() + 1).padStart(2, '0')
    const year = bangkokTime.getUTCFullYear()

    // Format as "HH:mm (DD/MM/YYYY)"
    return `${hours}:${minutes} (${day}/${month}/${year})`
  }

  const pickupTimeText = order.pickup_type === 'ASAP'
    ? t('asap')
    : formatPickupTime(order.pickup_time)

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-mobile mx-auto">
        {/* Success Header */}
        <div className="bg-card px-5 py-8 text-center border-b border-border">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-text mb-2">{t('orderConfirmed')}</h1>
          <p className="text-muted mb-4">{t('orderConfirmedDesc')}</p>
          <div className="bg-bg border border-border rounded-lg p-4">
            <p className="text-sm text-muted mb-1">{t('orderNumber')}</p>
            <p className="text-2xl font-bold text-primary">{order.order_number}</p>
          </div>
        </div>

        {/* Order Details */}
        <div className="px-5 py-6 space-y-6">
          {/* Pickup Info */}
          <div>
            <h2 className="text-text text-lg font-semibold mb-3">{t('pickupInfo')}</h2>
            <div className="bg-card border border-border rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted">{t('pickupTime')}</span>
                <span className="text-text font-medium">{pickupTimeText}</span>
              </div>
            </div>
          </div>

          {/* Customer Details */}
          <div>
            <h2 className="text-text text-lg font-semibold mb-3">{t('customerDetails')}</h2>
            <div className="bg-card border border-border rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted">{t('name')}</span>
                <span className="text-text font-medium">{order.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">{t('phone')}</span>
                <span className="text-text font-medium">{order.customer_phone}</span>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div>
            <h2 className="text-text text-lg font-semibold mb-3">{t('orderDetails')}</h2>
            <div className="space-y-3">
              {orderItems.map((item) => {
                const itemName = language === 'th' ? item.name_th : item.name_en
                const options = item.selected_options_json as any[] | null
                return (
                  <div key={item.id} className="bg-card border border-border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="text-text font-medium">{itemName}</p>
                        <p className="text-sm text-muted">x{item.qty}</p>
                      </div>
                      <p className="text-primary font-semibold">฿{item.final_price * item.qty}</p>
                    </div>
                    {options && options.length > 0 && (
                      <div className="text-xs text-muted space-y-1">
                        {options.map((option: any, idx: number) => {
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
          </div>

          {/* Total */}
          <div className="bg-card border border-primary/30 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-text">{t('total')}</span>
              <span className="text-2xl font-bold text-primary">฿{order.total_amount}</span>
            </div>
          </div>
        </div>

        {/* Back to Menu Button */}
        <div className="px-5 pb-8">
          <button
            onClick={() => {
              triggerHaptic()
              router.push('/order/menu')
            }}
            className="w-full py-4 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors"
          >
            {t('backToMenu')}
          </button>
        </div>
      </div>
    </div>
  )
}
