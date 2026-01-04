'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { triggerHaptic } from '@/utils/haptic'
import { useLanguage } from '@/contexts/LanguageContext'
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

// Safe fields only - no slip_url, no customer PII beyond what's needed
type Order = {
  id: string
  order_number: string
  pickup_type: string
  pickup_time: string | null
  total_amount: number
  customer_note: string | null
  slip_notified_at: string | null
  status: 'pending' | 'approved' | 'rejected' | 'ready' | 'picked_up' | null
  created_at: string
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string
  const { language, setLanguage, t } = useLanguage()

  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const fetchOrderDetails = async () => {
    setLoading(true)
    setError(false)
    setNotFound(false)

    try {
      // Fetch via server-side API (userId verified server-side, slip_url excluded)
      const response = await fetch(`/api/order/status/${orderId}`, { cache: 'no-store' })

      if (response.status === 404) {
        setNotFound(true)
        setLoading(false)
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch order')
      }

      const data = await response.json()
      setOrder(data.order)
      setItems(data.items || [])
    } catch (err) {
      console.error('[ORDER_DETAIL] Failed to fetch:', String(err))
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails()
    }
  }, [orderId])

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'pending': return 'bg-primary/20 text-primary'
      case 'approved': return 'bg-green-500/20 text-green-500'
      case 'rejected': return 'bg-red-500/20 text-red-500'
      case 'ready': return 'bg-blue-500/20 text-blue-500'
      case 'picked_up': return 'bg-gray-500/20 text-gray-400'
      default: return 'bg-muted/20 text-muted'
    }
  }

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'pending': return t('statusPending')
      case 'approved': return t('statusApproved')
      case 'rejected': return t('statusRejected')
      case 'ready': return t('statusReady')
      case 'picked_up': return t('statusPickedUp')
      default: return t('statusPending')
    }
  }

  const getStatusHint = (status: string | null) => {
    switch (status) {
      case 'pending': return t('statusHintPending')
      case 'approved': return t('statusHintApproved')
      case 'rejected': return t('statusHintRejected')
      case 'ready': return t('statusHintReady')
      case 'picked_up': return t('statusHintPickedUp')
      default: return t('statusHintPending')
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${day}/${month}/${year} ${hours}:${minutes}`
  }

  const formatPickupTime = (pickupType: string, pickupTime: string | null) => {
    if (pickupType === 'ASAP') {
      return t('asap')
    }
    if (pickupTime) {
      const date = new Date(pickupTime)
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${hours}:${minutes}`
    }
    return '-'
  }

  const getPickupBadge = (pickupType: string, pickupTime: string | null) => {
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

  return (
    <div className="min-h-screen bg-bg pb-20">
      {/* Unified Header */}
      <UnifiedOrderHeader title={t('orderDetails')} backHref="/order/status" />

      <div className="max-w-mobile mx-auto pt-14">
        {/* Content */}
        <div className="p-5">
          {loading && (
            <div className="text-center py-12">
              <div className="w-12 h-12 mx-auto mb-4 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-muted">{t('loading')}</p>
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="w-16 h-16 mx-auto text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-text mb-2">{t('errorGeneric')}</h2>
              <p className="text-sm text-muted mb-6">{t('unableToLoadData')}</p>
              <button
                onClick={fetchOrderDetails}
                className="px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors"
              >
                {t('retry')}
              </button>
            </div>
          )}

          {notFound && !loading && (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="w-16 h-16 mx-auto text-muted opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-text mb-2">{t('orderNotFound')}</h2>
              <p className="text-sm text-muted mb-6">{t('orderNotFoundDetail')}</p>
              <button
                onClick={() => {
                  triggerHaptic()
                  router.push('/order/status')
                }}
                className="px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors"
              >
                {t('goBack')}
              </button>
            </div>
          )}

          {!loading && !error && !notFound && order && (
            <div className="space-y-4">
              {/* Section 1: Order Summary - Hero */}
              <div className="bg-card border border-border rounded-lg p-5">
                {/* Order Number - Primary Focus */}
                <div className="text-center mb-4">
                  <p className="text-xs text-muted uppercase tracking-wide mb-1">{t('order')}</p>
                  <p className="text-3xl font-bold text-text">#{order.order_number}</p>
                </div>

                {/* Status Badge + Hint - Centered */}
                <div className="text-center mb-5">
                  <span className={`inline-block px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(order.status)}`}>
                    {getStatusLabel(order.status)}
                  </span>
                  <p className="text-xs text-muted mt-2">{getStatusHint(order.status)}</p>
                </div>

                {/* Secondary Info Row */}
                <div className="flex justify-between items-center text-sm py-3 border-t border-border">
                  <div className="text-center flex-1">
                    <p className="text-xs text-muted mb-0.5">{t('orderedAt')}</p>
                    <p className="text-text font-medium">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="w-px h-8 bg-border"></div>
                  <div className="text-center flex-1">
                    <p className="text-xs text-muted mb-0.5">{t('pickupTime')}</p>
                    {(() => {
                      const badge = getPickupBadge(order.pickup_type, order.pickup_time)
                      return badge ? (
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
                          {badge.label}
                        </span>
                      ) : (
                        <p className="text-text font-medium">-</p>
                      )
                    })()}
                  </div>
                </div>

                {/* Total - Bottom */}
                <div className="flex items-center justify-between pt-4 mt-3 border-t border-border">
                  <span className="text-base font-medium text-muted">{t('total')}</span>
                  <span className="text-2xl font-bold text-primary">฿{order.total_amount}</span>
                </div>
              </div>

              {/* Section 2: Order Items */}
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="text-sm font-semibold text-text">{t('orderItems')}</h3>
                </div>
                <div className="divide-y divide-border">
                  {items.map((item) => {
                    const itemName = language === 'th' ? item.name_th : item.name_en
                    const options = formatOptions(item.selected_options_json)

                    return (
                      <div key={item.id} className="px-4 py-3">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="text-text font-medium">{itemName}</p>
                            <p className="text-xs text-muted mt-0.5">x{item.qty}</p>

                            {/* Selected Options */}
                            {options && options.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {options.map((opt, idx) => (
                                  <p key={idx} className="text-xs text-muted">• {opt}</p>
                                ))}
                              </div>
                            )}

                            {/* Item Note */}
                            {item.note && (
                              <p className="text-xs text-muted italic mt-2">
                                {t('note')}: {item.note}
                              </p>
                            )}
                          </div>
                          <p className="text-text font-semibold ml-3">฿{item.final_price * item.qty}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Section 3: Customer Note (if exists) */}
              {order.customer_note && (
                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-text mb-2">{t('noteToRestaurant')}</h3>
                  <p className="text-sm text-muted">{order.customer_note}</p>
                </div>
              )}

              {/* Contextual Actions - Only show if user has actionable items */}
              {(() => {
                const needsSlipUpload = !order.slip_notified_at && order.status !== 'approved' && order.status !== 'rejected'

                // Only render if there are real actions available
                if (!needsSlipUpload) return null

                return (
                  <div className="space-y-2">
                    {/* Primary Action: Pay / Upload Slip */}
                    <button
                      onClick={() => {
                        triggerHaptic()
                        router.push(`/order/payment?id=${order.id}&from=status`)
                      }}
                      className="w-full py-3.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors"
                    >
                      {t('payUploadSlip')}
                    </button>

                    {/* Secondary Action: Edit Order */}
                    <button
                      onClick={() => {
                        triggerHaptic()
                        router.push(`/order/payment?id=${order.id}&from=status&edit=true`)
                      }}
                      className="w-full py-3 bg-transparent border border-border text-muted font-medium rounded-lg hover:bg-border/30 active:bg-border/50 transition-colors"
                    >
                      {t('editOrder')}
                    </button>
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
