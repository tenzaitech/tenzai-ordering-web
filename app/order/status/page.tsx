'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

type Order = {
  id: string
  order_number: string
  customer_name: string
  customer_phone: string
  customer_line_user_id: string
  pickup_type: string
  pickup_time: string | null
  total_amount: number
  customer_note: string | null
  slip_url: string | null
  status: 'pending' | 'approved' | 'rejected' | null
  created_at: string
}

type Language = 'th' | 'en'

const translations = {
  th: {
    myOrders: 'ออเดอร์ของฉัน',
    loading: 'กำลังโหลด...',
    noOrders: 'ยังไม่มีออเดอร์',
    noOrdersDesc: 'เมื่อคุณสั่งอาหาร ออเดอร์จะแสดงที่นี่',
    errorTitle: 'เกิดข้อผิดพลาด',
    errorMessage: 'ไม่สามารถโหลดออเดอร์ได้',
    retry: 'ลองใหม่',
    order: 'ออเดอร์',
    status: 'สถานะ',
    total: 'ยอดรวม',
    pending: 'รอตรวจสอบ',
    approved: 'อนุมัติแล้ว',
    rejected: 'ปฏิเสธ'
  },
  en: {
    myOrders: 'My Orders',
    loading: 'Loading...',
    noOrders: 'No orders yet',
    noOrdersDesc: 'When you place an order, it will appear here',
    errorTitle: 'Error',
    errorMessage: 'Unable to load orders',
    retry: 'Retry',
    order: 'Order',
    status: 'Status',
    total: 'Total',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected'
  }
}

const getStoredLanguage = (): Language | null => {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem('tenzai_lang')
  if (stored === 'en' || stored === 'th') return stored
  return null
}

const getLiffLanguage = async (): Promise<Language> => {
  try {
    const liff = (await import('@line/liff')).default
    if (liff.isInClient() && liff.isLoggedIn()) {
      const lang = liff.getLanguage()
      if (lang === 'en') return 'en'
    }
  } catch (error) {
    // LIFF not available or not initialized
  }
  return 'th'
}

export default function OrderStatusPage() {
  const [language, setLanguage] = useState<Language>('th')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [mounted, setMounted] = useState(false)

  const t = translations[language]

  useEffect(() => {
    const initLanguage = async () => {
      const stored = getStoredLanguage()
      setMounted(true)
      const liffLang = await getLiffLanguage()
      const initialLang = stored ?? liffLang
      setLanguage(initialLang)
    }
    initLanguage()
  }, [])

  const fetchOrders = async () => {
    setLoading(true)
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

      // Query orders for this user
      const { data, error: queryError } = await supabase
        .from('orders')
        .select('*')
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
  }, [])

  const handleLanguageToggle = (lang: Language) => {
    setLanguage(lang)
    localStorage.setItem('tenzai_lang', lang)
  }

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
      case 'pending': return t.pending
      case 'approved': return t.approved
      case 'rejected': return t.rejected
      default: return t.pending
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

  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen bg-bg pb-20">
      <div className="max-w-mobile mx-auto">
        {/* Header */}
        <header className="sticky top-0 bg-card z-10 px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-text">{t.myOrders}</h1>

            {/* Language Toggle */}
            <div className="flex gap-1 bg-bg border border-border rounded-lg p-1">
              <button
                onClick={() => handleLanguageToggle('th')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  language === 'th'
                    ? 'bg-primary text-white'
                    : 'text-muted hover:text-text'
                }`}
              >
                TH
              </button>
              <button
                onClick={() => handleLanguageToggle('en')}
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
              <p className="text-muted">{t.loading}</p>
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="w-16 h-16 mx-auto text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-text mb-2">{t.errorTitle}</h2>
              <p className="text-sm text-muted mb-6">{t.errorMessage}</p>
              <button
                onClick={fetchOrders}
                className="px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors"
              >
                {t.retry}
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
              <h2 className="text-xl font-semibold text-text mb-2">{t.noOrders}</h2>
              <p className="text-sm text-muted">{t.noOrdersDesc}</p>
            </div>
          )}

          {!loading && !error && orders.length > 0 && (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-card border border-border rounded-lg p-4"
                >
                  {/* Order Number & Status */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs text-muted mb-1">{t.order}</p>
                      <p className="text-lg font-semibold text-text">#{order.order_number}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {getStatusLabel(order.status)}
                    </span>
                  </div>

                  {/* Date */}
                  <div className="mb-3 pb-3 border-b border-border">
                    <p className="text-sm text-muted">{formatDate(order.created_at)}</p>
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted">{t.total}</span>
                    <span className="text-xl font-bold text-primary">฿{order.total_amount}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
