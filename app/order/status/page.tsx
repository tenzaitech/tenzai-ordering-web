'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { triggerHaptic } from '@/utils/haptic'
import { useLanguage } from '@/contexts/LanguageContext'
import UnifiedOrderHeader from '@/components/order/UnifiedOrderHeader'

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

export default function OrderStatusPage() {
  const router = useRouter()
  const { language, setLanguage, t } = useLanguage()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const fetchOrders = async () => {
    // Only show loading on initial fetch, not on auto-refresh
    if (orders.length === 0) {
      setLoading(true)
    }
    setError(false)

    try {
      // Get LINE userId from existing session (no-store to ensure fresh data)
      const userResponse = await fetch('/api/liff/user', { cache: 'no-store' })
      if (!userResponse.ok) {
        throw new Error('No LIFF session')
      }
      const { userId } = await userResponse.json()

      if (!userId) {
        throw new Error('userId missing')
      }

      // Query orders for this user (explicit select, slip_url excluded for privacy)
      const { data, error: queryError } = await supabase
        .from('orders')
        .select('id, order_number, status, pickup_type, pickup_time, total_amount, customer_note, created_at, slip_notified_at')
        .eq('customer_line_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5)

      if (queryError) {
        throw queryError
      }

      setOrders(data || [])
    } catch (err) {
      console.error('[ORDER_STATUS] Failed to fetch orders:', String(err))
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()

    // Auto-refresh every 25 seconds
    const interval = setInterval(() => {
      fetchOrders()
    }, 25000)

    return () => clearInterval(interval)
  }, [])

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${day}/${month}/${year} ${hours}:${minutes}`
  }

  const getPickupLabel = (pickupType: string, pickupTime: string | null) => {
    if (pickupType === 'ASAP') {
      return language === 'th' ? 'รับทันที' : 'ASAP'
    } else if (pickupTime) {
      const date = new Date(pickupTime)
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return language === 'th' ? `นัดรับ ${hours}:${minutes}` : `Scheduled ${hours}:${minutes}`
    }
    return ''
  }

  return (
    <div className="min-h-screen bg-bg pb-20">
      {/* Unified Header */}
      <UnifiedOrderHeader title={t('myOrders')} showMyOrders={false} />

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
              <p className="text-sm text-muted mb-6">{t('unableToLoadOrders')}</p>
              <button
                onClick={fetchOrders}
                className="px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors"
              >
                {t('retry')}
              </button>
            </div>
          )}

          {!loading && !error && orders.length === 0 && (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="w-16 h-16 mx-auto text-muted opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-text mb-2">{t('noOrders')}</h2>
              <p className="text-sm text-muted">{t('noOrdersDesc')}</p>
            </div>
          )}

          {!loading && !error && orders.length > 0 && (
            <div className="space-y-4">
              {orders.map((order) => {
                // Determine if slip is missing (use slip_notified_at as safe signal)
                const needsSlipUpload = !order.slip_notified_at && order.status !== 'approved' && order.status !== 'rejected'

                return (
                  <div
                    key={order.id}
                    onClick={() => {
                      triggerHaptic()
                      router.push(`/order/status/${order.id}`)
                    }}
                    className="bg-card border border-border rounded-lg p-4 cursor-pointer active:bg-border/50 transition-colors"
                  >
                    {/* Order Number & Status */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-xs text-muted mb-1">{t('order')}</p>
                        <p className="text-lg font-semibold text-text">#{order.order_number}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                        {/* Slip not uploaded badge */}
                        {needsSlipUpload && (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-500">
                            {t('slipNotUploaded')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Date + Pickup Type */}
                    <div className="mb-3 pb-3 border-b border-border flex items-center justify-between">
                      <p className="text-sm text-muted">{formatDate(order.created_at)}</p>
                      {getPickupLabel(order.pickup_type, order.pickup_time) && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          order.pickup_type === 'ASAP'
                            ? 'bg-orange-500/20 text-orange-500'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {getPickupLabel(order.pickup_type, order.pickup_time)}
                        </span>
                      )}
                    </div>

                    {/* Total */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-muted">{t('total')}</span>
                      <span className="text-xl font-bold text-primary">฿{order.total_amount}</span>
                    </div>

                    {/* View Details indicator */}
                    <div className="flex items-center justify-center gap-1 text-muted text-sm">
                      <span>{t('viewDetails')}</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-3 flex gap-2">
                      {/* Upload Slip CTA - only if not uploaded */}
                      {needsSlipUpload && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            triggerHaptic()
                            router.push(`/order/payment?id=${order.id}&from=status`)
                          }}
                          className="flex-1 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors"
                        >
                          {t('payUploadSlip')}
                        </button>
                      )}
                      {/* Edit Order - only if not locked (slip not uploaded) */}
                      {needsSlipUpload && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            triggerHaptic()
                            router.push(`/order/payment?id=${order.id}&from=status&edit=true`)
                          }}
                          className="flex-1 py-2.5 bg-card border border-border text-text text-sm font-medium rounded-lg hover:bg-border/50 active:bg-border transition-colors"
                        >
                          {t('editOrder')}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
