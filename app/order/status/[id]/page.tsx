'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { triggerHaptic } from '@/utils/haptic'

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
  status: 'pending' | 'approved' | 'rejected' | null
  created_at: string
}

type Language = 'th' | 'en'

const translations = {
  th: {
    orderDetails: 'รายละเอียดออเดอร์',
    loading: 'กำลังโหลด...',
    order: 'ออเดอร์',
    status: 'สถานะ',
    total: 'ยอดรวม',
    pending: 'รอตรวจสอบ',
    approved: 'อนุมัติแล้ว',
    rejected: 'ปฏิเสธ',
    items: 'รายการสั่งซื้อ',
    note: 'หมายเหตุ',
    noteToRestaurant: 'หมายเหตุถึงร้าน',
    back: 'กลับ',
    notFound: 'ไม่พบออเดอร์',
    notFoundDesc: 'ออเดอร์นี้ไม่พบหรือคุณไม่มีสิทธิ์เข้าถึง',
    goBack: 'กลับไปหน้าออเดอร์',
    errorTitle: 'เกิดข้อผิดพลาด',
    errorMessage: 'ไม่สามารถโหลดข้อมูลได้',
    retry: 'ลองใหม่',
    orderedAt: 'สั่งเมื่อ',
    pickupType: 'รูปแบบรับ',
    asap: 'ให้ร้านทำทันที',
    scheduled: 'นัดเวลารับ'
  },
  en: {
    orderDetails: 'Order Details',
    loading: 'Loading...',
    order: 'Order',
    status: 'Status',
    total: 'Total',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    items: 'Order Items',
    note: 'Note',
    noteToRestaurant: 'Note to Restaurant',
    back: 'Back',
    notFound: 'Order Not Found',
    notFoundDesc: 'This order was not found or you do not have access.',
    goBack: 'Go Back',
    errorTitle: 'Error',
    errorMessage: 'Unable to load data',
    retry: 'Retry',
    orderedAt: 'Ordered at',
    pickupType: 'Pickup Type',
    asap: 'ASAP',
    scheduled: 'Scheduled'
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
    // LIFF not available
  }
  return 'th'
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.id as string

  const [language, setLanguage] = useState<Language>('th')
  const [order, setOrder] = useState<Order | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [notFound, setNotFound] = useState(false)
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

  const fetchOrderDetails = async () => {
    setLoading(true)
    setError(false)
    setNotFound(false)

    try {
      // Fetch via server-side API (userId verified server-side, slip_url excluded)
      const response = await fetch(`/api/order/status/${orderId}`)

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

  const formatPickupTime = (pickupType: string, pickupTime: string | null) => {
    if (pickupType === 'ASAP') {
      return t.asap
    }
    if (pickupTime) {
      const date = new Date(pickupTime)
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${hours}:${minutes}`
    }
    return '-'
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

  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen bg-bg pb-20">
      <div className="max-w-mobile mx-auto">
        {/* Header */}
        <header className="sticky top-0 bg-card z-10 px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  triggerHaptic()
                  router.push('/order/status')
                }}
                className="text-muted hover:text-text active:text-text transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h1 className="text-xl font-semibold text-text">{t.orderDetails}</h1>
            </div>

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
                onClick={fetchOrderDetails}
                className="px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors"
              >
                {t.retry}
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
              <h2 className="text-xl font-semibold text-text mb-2">{t.notFound}</h2>
              <p className="text-sm text-muted mb-6">{t.notFoundDesc}</p>
              <button
                onClick={() => {
                  triggerHaptic()
                  router.push('/order/status')
                }}
                className="px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors"
              >
                {t.goBack}
              </button>
            </div>
          )}

          {!loading && !error && !notFound && order && (
            <div className="space-y-4">
              {/* Order Header Card */}
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs text-muted mb-1">{t.order}</p>
                    <p className="text-2xl font-bold text-text">#{order.order_number}</p>
                  </div>
                  <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}>
                    {getStatusLabel(order.status)}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted">{t.orderedAt}</span>
                    <span className="text-text">{formatDate(order.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">{t.pickupType}</span>
                    <span className="text-text">{formatPickupTime(order.pickup_type, order.pickup_time)}</span>
                  </div>
                </div>

                {/* Total */}
                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                  <span className="text-lg font-semibold text-text">{t.total}</span>
                  <span className="text-2xl font-bold text-primary">฿{order.total_amount}</span>
                </div>
              </div>

              {/* Order Items */}
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="font-semibold text-text">{t.items}</h3>
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
                                {t.note}: {item.note}
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

              {/* Customer Note */}
              {order.customer_note && (
                <div className="bg-card border border-border rounded-lg p-4">
                  <h3 className="font-semibold text-text mb-2">{t.noteToRestaurant}</h3>
                  <p className="text-sm text-muted">{order.customer_note}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
