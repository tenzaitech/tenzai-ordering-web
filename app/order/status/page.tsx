'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { triggerHaptic } from '@/utils/haptic'
import { useLanguage } from '@/contexts/LanguageContext'

type Order = {
  id: string
  order_number: string
  pickup_type: string
  pickup_time: string | null
  total_amount: number
  customer_note: string | null
  slip_notified_at: string | null
  status: 'pending' | 'approved' | 'rejected' | null
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
      // Get LINE userId from existing session
      const userResponse = await fetch('/api/liff/user')
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
      default: return 'bg-muted/20 text-muted'
    }
  }

  const getStatusLabel = (status: string | null) => {
    switch (status) {
      case 'pending': return t('statusPending')
      case 'approved': return t('statusApproved')
      case 'rejected': return t('statusRejected')
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

  return (
    <div className="min-h-screen bg-bg pb-20">
      <div className="max-w-mobile mx-auto">
        {/* Header */}
        <header className="sticky top-0 bg-card z-10 px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-text">{t('myOrders')}</h1>

            {/* Language Toggle */}
            <div className="flex gap-1 bg-bg border border-border rounded-lg p-1">
              <button
                onClick={() => setLanguage('th')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  language === 'th'
                    ? 'bg-primary text-white'
                    : 'text-muted hover:text-text'
                }`}
              >
                TH
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  language === 'en'
                    ? 'bg-primary text-white'
                    : 'text-muted hover:text-text'
                }`}
              >
                EN
              </button>
            </div>
          </div>
        </header>

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

                    {/* Date */}
                    <div className="mb-3 pb-3 border-b border-border">
                      <p className="text-sm text-muted">{formatDate(order.created_at)}</p>
                    </div>

                    {/* Total + Chevron */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted">{t('total')}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-primary">฿{order.total_amount}</span>
                        <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>

                    {/* Upload Slip CTA */}
                    {needsSlipUpload && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          triggerHaptic()
                          router.push(`/order/payment?id=${order.id}&from=status`)
                        }}
                        className="mt-3 w-full py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors"
                      >
                        {t('uploadSlip')}
                      </button>
                    )}
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
