'use client'

import { useState, useEffect } from 'react'

type OrderItem = {
  id: string
  order_id: string
  menu_code: string
  name_th: string
  name_en: string
  qty: number
  price: number
  selected_options_json: any
  note: string | null
}

type Order = {
  id: string
  order_number: string
  customer_name: string
  customer_phone: string
  pickup_type: string
  pickup_time: string | null
  total_amount: number
  customer_note: string | null
  status: 'approved' | 'ready' | null
  created_at: string
  items: OrderItem[]
}

export default function StaffBoardPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [updating, setUpdating] = useState<string | null>(null)

  // Check auth on mount
  useEffect(() => {
    checkAuth()
  }, [])

  // Auto-refresh orders every 30s if authenticated
  useEffect(() => {
    if (!authenticated) return

    fetchOrders()
    const interval = setInterval(fetchOrders, 30000)
    return () => clearInterval(interval)
  }, [authenticated])

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/staff/session')
      if (response.ok) {
        setAuthenticated(true)
      }
    } catch (error) {
      console.error('[STAFF] Auth check error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setPinError('')

    if (!pin) {
      setPinError('Please enter PIN')
      return
    }

    try {
      const response = await fetch('/api/staff/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      })

      if (response.ok) {
        setAuthenticated(true)
        setPin('')
      } else {
        setPinError('Incorrect PIN')
      }
    } catch (error) {
      console.error('[STAFF] Login error:', error)
      setPinError('Login failed')
    }
  }

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/staff/orders')
      if (response.ok) {
        const data = await response.json()
        setOrders(data.orders || [])
      }
    } catch (error) {
      console.error('[STAFF] Fetch orders error:', error)
    }
  }

  const handleUpdateStatus = async (orderId: string, newStatus: 'ready' | 'picked_up') => {
    setUpdating(orderId)

    try {
      const response = await fetch('/api/staff/orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, newStatus })
      })

      if (response.ok) {
        // Refresh orders
        await fetchOrders()
      } else {
        alert('Failed to update order status')
      }
    } catch (error) {
      console.error('[STAFF] Update status error:', error)
      alert('Failed to update order status')
    } finally {
      setUpdating(null)
    }
  }

  const formatPickupTime = (order: Order) => {
    if (order.pickup_type === 'ASAP') {
      return 'ASAP'
    }
    if (order.pickup_time) {
      const date = new Date(order.pickup_time)
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${hours}:${minutes}`
    }
    return '-'
  }

  const formatItemOptions = (item: OrderItem) => {
    if (!item.selected_options_json) return null

    try {
      const options = item.selected_options_json
      if (!Array.isArray(options) || options.length === 0) return null

      const optionLines = options.map((opt: any) => {
        if (opt.choice_names_th && Array.isArray(opt.choice_names_th)) {
          return opt.choice_names_th.join(', ')
        } else if (opt.name_th) {
          return opt.name_th
        } else if (typeof opt === 'string') {
          return opt
        }
        return null
      }).filter(Boolean)

      return optionLines.length > 0 ? optionLines.join(', ') : null
    } catch (e) {
      return null
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-5">
        <div className="w-full max-w-sm">
          <div className="bg-card border border-border rounded-lg p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white font-bold text-2xl">T</span>
              </div>
              <h1 className="text-2xl font-bold text-text mb-2">Staff Board</h1>
              <p className="text-sm text-muted">Enter PIN to continue</p>
            </div>

            <form onSubmit={handleLogin}>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN"
                className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-text text-center text-xl tracking-widest mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              {pinError && (
                <p className="text-sm text-red-500 mb-4 text-center">{pinError}</p>
              )}
              <button
                type="submit"
                className="w-full py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors"
              >
                Login
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  const approvedOrders = orders.filter(o => o.status === 'approved')
  const readyOrders = orders.filter(o => o.status === 'ready')

  return (
    <div className="min-h-screen bg-bg pb-20">
      <div className="max-w-6xl mx-auto px-5 py-6">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-text mb-1">Staff Board</h1>
              <p className="text-sm text-muted">
                {orders.length} {orders.length === 1 ? 'order' : 'orders'} in progress
              </p>
            </div>
            <button
              onClick={fetchOrders}
              className="px-4 py-2 text-sm font-medium text-muted hover:text-text border border-border rounded-lg hover:bg-card transition-colors"
            >
              Refresh
            </button>
          </div>
        </header>

        {/* Orders Grid */}
        {orders.length === 0 ? (
          <div className="text-center py-12">
            <div className="mb-4">
              <svg className="w-16 h-16 mx-auto text-muted opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-muted text-lg">No active orders</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Approved Orders (Need to prepare) */}
            {approvedOrders.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-text mb-3">
                  To Prepare ({approvedOrders.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {approvedOrders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-card border border-border rounded-lg p-4"
                    >
                      {/* Order Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-xs text-muted mb-1">Order</p>
                          <p className="text-lg font-bold text-text">#{order.order_number}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted mb-1">Pickup</p>
                          <p className="text-sm font-semibold text-primary">{formatPickupTime(order)}</p>
                        </div>
                      </div>

                      {/* Customer Info */}
                      <div className="mb-3 pb-3 border-b border-border">
                        <p className="text-sm text-text">{order.customer_name}</p>
                        <p className="text-xs text-muted">{order.customer_phone}</p>
                      </div>

                      {/* Items */}
                      <div className="mb-3 space-y-2">
                        {order.items.map((item) => (
                          <div key={item.id} className="text-sm">
                            <div className="flex items-start justify-between">
                              <span className="font-medium text-text">
                                {item.qty}x {item.name_th}
                              </span>
                            </div>
                            {formatItemOptions(item) && (
                              <p className="text-xs text-muted ml-4 mt-0.5">
                                {formatItemOptions(item)}
                              </p>
                            )}
                            {item.note && (
                              <p className="text-xs text-muted ml-4 mt-0.5">
                                📝 {item.note}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Customer Note */}
                      {order.customer_note && (
                        <div className="mb-3 p-2 bg-bg rounded border border-border">
                          <p className="text-xs text-muted mb-0.5">Customer note:</p>
                          <p className="text-sm text-text">{order.customer_note}</p>
                        </div>
                      )}

                      {/* Total */}
                      <div className="mb-3 pb-3 border-b border-border">
                        <p className="text-lg font-bold text-primary">฿{order.total_amount}</p>
                      </div>

                      {/* Action */}
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'ready')}
                        disabled={updating === order.id}
                        className="w-full py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updating === order.id ? 'Updating...' : 'Mark as Ready'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ready Orders (Ready for pickup) */}
            {readyOrders.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-text mb-3">
                  Ready for Pickup ({readyOrders.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {readyOrders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-card border border-green-500/30 rounded-lg p-4"
                    >
                      {/* Order Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="text-xs text-muted mb-1">Order</p>
                          <p className="text-lg font-bold text-text">#{order.order_number}</p>
                        </div>
                        <span className="px-3 py-1 bg-green-500/20 text-green-500 text-xs font-medium rounded-full">
                          READY
                        </span>
                      </div>

                      {/* Customer Info */}
                      <div className="mb-3 pb-3 border-b border-border">
                        <p className="text-sm text-text">{order.customer_name}</p>
                        <p className="text-xs text-muted">{order.customer_phone}</p>
                      </div>

                      {/* Items Summary */}
                      <div className="mb-3">
                        <p className="text-sm text-muted">
                          {order.items.reduce((sum, item) => sum + item.qty, 0)} items
                        </p>
                      </div>

                      {/* Total */}
                      <div className="mb-3 pb-3 border-b border-border">
                        <p className="text-lg font-bold text-primary">฿{order.total_amount}</p>
                      </div>

                      {/* Action */}
                      <button
                        onClick={() => handleUpdateStatus(order.id, 'picked_up')}
                        disabled={updating === order.id}
                        className="w-full py-2.5 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-500/90 active:bg-green-500/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updating === order.id ? 'Updating...' : 'Mark as Picked Up'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
