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
  status: 'approved' | 'ready' | 'picked_up' | null
  created_at: string
  items: OrderItem[]
}

type Tab = 'prepare' | 'ready' | 'history'

type OrderRow = {
  [key: string]: unknown
  id: string
}

export default function StaffBoardPage() {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [activeTab, setActiveTab] = useState<Tab>('prepare')
  const [orders, setOrders] = useState<Order[]>([])
  const [historyOrders, setHistoryOrders] = useState<Order[]>([])
  const [updating, setUpdating] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    orderId: string
    newStatus: 'ready' | 'picked_up'
    orderNumber: string
  } | null>(null)
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (!authenticated) return

    fetchOrders()
    fetchHistory()
    const interval = setInterval(() => {
      fetchOrders()
      if (activeTab === 'history') fetchHistory()
    }, 30000)
    return () => clearInterval(interval)
  }, [authenticated, activeTab])

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

  const fetchHistory = async () => {
    try {
      // Calculate Bangkok today (00:00 - 23:59)
      const now = new Date()
      const bangkokOffset = 7 * 60 // UTC+7
      const bangkokNow = new Date(now.getTime() + bangkokOffset * 60 * 1000)

      const startOfDay = new Date(bangkokNow)
      startOfDay.setUTCHours(0, 0, 0, 0)
      const startISO = new Date(startOfDay.getTime() - bangkokOffset * 60 * 1000).toISOString()

      const endOfDay = new Date(bangkokNow)
      endOfDay.setUTCHours(23, 59, 59, 999)
      const endISO = new Date(endOfDay.getTime() - bangkokOffset * 60 * 1000).toISOString()

      const { supabase } = await import('@/lib/supabase')
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'picked_up')
        .gte('created_at', startISO)
        .lte('created_at', endISO)
        .order('created_at', { ascending: false })
        .limit(50)

      const orders = (data ?? []) as OrderRow[]
      if (!error && orders.length > 0) {
        const ordersWithItems = await Promise.all(
          orders.map(async (order) => {
            const { data: items } = await supabase
              .from('order_items')
              .select('*')
              .eq('order_id', order.id)
            return { ...order, items: items || [] }
          })
        )
        setHistoryOrders(ordersWithItems as unknown as Order[])
      }
    } catch (error) {
      console.error('[STAFF] Fetch history error:', error)
    }
  }

  const showFeedback = (message: string, type: 'success' | 'error') => {
    setFeedback({ message, type })
    setTimeout(() => setFeedback(null), 3000)
  }

  const handleStatusChangeRequest = (orderId: string, orderNumber: string, newStatus: 'ready' | 'picked_up') => {
    setConfirmDialog({ orderId, newStatus, orderNumber })
  }

  const handleConfirmStatusChange = async () => {
    if (!confirmDialog) return

    const { orderId, newStatus } = confirmDialog
    setConfirmDialog(null)
    setUpdating(orderId)

    try {
      const response = await fetch('/api/staff/orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, newStatus })
      })

      if (response.ok) {
        showFeedback(`Order updated to ${newStatus}`, 'success')
        await fetchOrders()
        if (newStatus === 'picked_up') await fetchHistory()
      } else {
        const error = await response.json()
        showFeedback(error.error || 'Failed to update order', 'error')
      }
    } catch (error) {
      console.error('[STAFF] Update status error:', error)
      showFeedback('Failed to update order', 'error')
    } finally {
      setUpdating(null)
    }
  }

  const formatPickupTime = (order: Order) => {
    if (order.pickup_type === 'ASAP') return 'ASAP'
    if (!order.pickup_time) return '-'
    const date = new Date(order.pickup_time)
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  const formatItemOptions = (item: OrderItem) => {
    if (!item.selected_options_json) return null
    try {
      const options = item.selected_options_json
      if (!Array.isArray(options) || options.length === 0) return null
      const optionLines = options.map((opt: any) => {
        if (opt.choice_names_th && Array.isArray(opt.choice_names_th)) {
          return opt.choice_names_th.join(', ')
        } else if (opt.name_th) return opt.name_th
        else if (typeof opt === 'string') return opt
        return null
      }).filter(Boolean)
      return optionLines.length > 0 ? optionLines.join(', ') : null
    } catch {
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
              {pinError && <p className="text-sm text-red-500 mb-4 text-center">{pinError}</p>}
              <button type="submit" className="w-full py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors">
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
      {feedback && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
          feedback.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {feedback.message}
        </div>
      )}

      {confirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-5">
          <div className="bg-card border border-border rounded-lg p-6 max-w-sm w-full">
            <h2 className="text-lg font-semibold text-text mb-3">
              Confirm Status Change
            </h2>
            <p className="text-muted mb-1">Order: <span className="text-text font-medium">#{confirmDialog.orderNumber}</span></p>
            <p className="text-muted mb-6">
              Change status to <span className="text-primary font-medium">{confirmDialog.newStatus === 'ready' ? 'READY' : 'PICKED UP'}</span>?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2.5 bg-border text-text font-medium rounded-lg hover:bg-border/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStatusChange}
                className="flex-1 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-5 py-6">
        <header className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-text mb-1">Staff Board</h1>
              <p className="text-sm text-muted">{orders.length} active orders</p>
            </div>
            <button
              onClick={() => {
                fetchOrders()
                if (activeTab === 'history') fetchHistory()
              }}
              className="px-4 py-2 text-sm font-medium text-muted hover:text-text border border-border rounded-lg hover:bg-card transition-colors"
            >
              Refresh
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-border">
            <button
              onClick={() => setActiveTab('prepare')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'prepare'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted hover:text-text'
              }`}
            >
              To Prepare ({approvedOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('ready')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'ready'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted hover:text-text'
              }`}
            >
              Ready ({readyOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'history'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-muted hover:text-text'
              }`}
            >
              History ({historyOrders.length})
            </button>
          </div>
        </header>

        {activeTab === 'prepare' && (
          approvedOrders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted text-lg">No orders to prepare</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {approvedOrders.map(order => (
                <div key={order.id} className="bg-card border border-border rounded-lg p-4">
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
                  <div className="mb-3 pb-3 border-b border-border">
                    <p className="text-sm text-text">{order.customer_name}</p>
                    <p className="text-xs text-muted">{order.customer_phone}</p>
                  </div>
                  <div className="mb-3 space-y-2">
                    {order.items.map(item => (
                      <div key={item.id} className="text-sm">
                        <div className="flex items-start justify-between">
                          <span className="font-medium text-text">{item.qty}x {item.name_th}</span>
                        </div>
                        {formatItemOptions(item) && <p className="text-xs text-muted ml-4 mt-0.5">{formatItemOptions(item)}</p>}
                        {item.note && <p className="text-xs text-muted ml-4 mt-0.5">📝 {item.note}</p>}
                      </div>
                    ))}
                  </div>
                  {order.customer_note && (
                    <div className="mb-3 p-2 bg-bg rounded border border-border">
                      <p className="text-xs text-muted mb-0.5">Customer note:</p>
                      <p className="text-sm text-text">{order.customer_note}</p>
                    </div>
                  )}
                  <div className="mb-3 pb-3 border-b border-border">
                    <p className="text-lg font-bold text-primary">฿{order.total_amount}</p>
                  </div>
                  <button
                    onClick={() => handleStatusChangeRequest(order.id, order.order_number, 'ready')}
                    disabled={updating === order.id}
                    className="w-full py-2.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updating === order.id ? 'Updating...' : 'Mark as Ready'}
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'ready' && (
          readyOrders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted text-lg">No orders ready for pickup</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {readyOrders.map(order => (
                <div key={order.id} className="bg-card border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-xs text-muted mb-1">Order</p>
                      <p className="text-lg font-bold text-text">#{order.order_number}</p>
                    </div>
                    <span className="px-3 py-1 bg-green-500/20 text-green-500 text-xs font-medium rounded-full">READY</span>
                  </div>
                  <div className="mb-3 pb-3 border-b border-border">
                    <p className="text-sm text-text">{order.customer_name}</p>
                    <p className="text-xs text-muted">{order.customer_phone}</p>
                  </div>
                  <div className="mb-3">
                    <p className="text-sm text-muted">{order.items.reduce((sum, item) => sum + item.qty, 0)} items</p>
                  </div>
                  <div className="mb-3 pb-3 border-b border-border">
                    <p className="text-lg font-bold text-primary">฿{order.total_amount}</p>
                  </div>
                  <button
                    onClick={() => handleStatusChangeRequest(order.id, order.order_number, 'picked_up')}
                    disabled={updating === order.id}
                    className="w-full py-2.5 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-500/90 active:bg-green-500/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updating === order.id ? 'Updating...' : 'Mark as Picked Up'}
                  </button>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 'history' && (
          historyOrders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted text-lg">No completed orders today</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-border/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-text">Order</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-text">Customer</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-text">Items</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-text">Total</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-text">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {historyOrders.map(order => (
                    <tr key={order.id} className="hover:bg-border/20">
                      <td className="px-4 py-3 text-sm font-medium text-text">#{order.order_number}</td>
                      <td className="px-4 py-3 text-sm text-text">{order.customer_name}</td>
                      <td className="px-4 py-3 text-sm text-muted">{order.items.reduce((sum, item) => sum + item.qty, 0)} items</td>
                      <td className="px-4 py-3 text-sm font-semibold text-primary">฿{order.total_amount}</td>
                      <td className="px-4 py-3 text-sm text-muted">{new Date(order.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  )
}
