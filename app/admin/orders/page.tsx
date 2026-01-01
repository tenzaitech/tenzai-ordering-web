'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AdminOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [orderAccepting, setOrderAccepting] = useState<{ enabled: boolean; message: string }>({ enabled: true, message: '' })
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    fetchOrders()
    fetchOrderAccepting()
  }, [])

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.error('[ADMIN:ORDERS] Failed to fetch orders:', error)
        return
      }

      setOrders(data || [])
      setLoading(false)
    } catch (error) {
      console.error('[ADMIN:ORDERS] Unexpected error:', error)
      setLoading(false)
    }
  }

  const fetchOrderAccepting = async () => {
    try {
      const response = await fetch('/api/admin/toggle-accepting')
      if (response.ok) {
        const data = await response.json()
        setOrderAccepting({ enabled: data.enabled, message: data.message || '' })
      }
    } catch (error) {
      console.error('[ADMIN:TOGGLE] Failed to fetch setting:', error)
    }
  }

  const handleToggle = async () => {
    const newState = !orderAccepting.enabled
    const confirmMsg = newState
      ? 'เปิดรับออเดอร์อีกครั้ง?'
      : 'ปิดรับออเดอร์ชั่วคราว?'

    if (!confirm(confirmMsg)) return

    setToggling(true)
    try {
      const response = await fetch('/api/admin/toggle-accepting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newState, message: orderAccepting.message })
      })

      if (!response.ok) {
        throw new Error('Failed to toggle')
      }

      const data = await response.json()
      setOrderAccepting({ enabled: data.enabled, message: data.message })
      alert(newState ? 'เปิดรับออเดอร์แล้ว' : 'ปิดรับออเดอร์แล้ว')
    } catch (error) {
      console.error('[ADMIN:TOGGLE] Error:', error)
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setToggling(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-primary/20 text-primary'
      case 'approved': return 'bg-green-500/20 text-green-500'
      case 'rejected': return 'bg-red-500/20 text-red-500'
      default: return 'bg-muted/20 text-muted'
    }
  }

  const formatPickupTime = (pickupType: string, pickupTime: string | null) => {
    if (pickupType === 'ASAP') {
      return 'ทันที'
    }
    if (!pickupTime) return '-'

    const date = new Date(pickupTime)
    const bangkokOffsetMs = 7 * 60 * 60 * 1000
    const bangkokTime = new Date(date.getTime() + bangkokOffsetMs)
    const hours = String(bangkokTime.getUTCHours()).padStart(2, '0')
    const minutes = String(bangkokTime.getUTCMinutes()).padStart(2, '0')
    const day = String(bangkokTime.getUTCDate()).padStart(2, '0')
    const month = String(bangkokTime.getUTCMonth() + 1).padStart(2, '0')
    return `${hours}:${minutes} (${day}/${month})`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted">Loading orders...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-7xl mx-auto px-5 py-8">
        <h1 className="text-3xl font-bold text-text mb-8">Admin - Orders</h1>

        {/* Order Accepting Control */}
        <div className="mb-8 bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-lg font-semibold text-text">Order Accepting</h2>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  orderAccepting.enabled
                    ? 'bg-green-500/20 text-green-500'
                    : 'bg-red-500/20 text-red-500'
                }`}>
                  {orderAccepting.enabled ? 'OPEN' : 'CLOSED'}
                </span>
              </div>
              <p className="text-sm text-muted">
                {orderAccepting.enabled
                  ? 'Customers can place orders'
                  : 'Customers are blocked from ordering'}
              </p>
            </div>
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                orderAccepting.enabled
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              {toggling ? 'Processing...' : (orderAccepting.enabled ? 'Close Shop' : 'Open Shop')}
            </button>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Order #</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Customer</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Pickup</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Total</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => router.push(`/admin/orders/${order.id}`)}
                  className="border-b border-border hover:bg-border/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-4 text-text font-medium">{order.order_number}</td>
                  <td className="px-4 py-4 text-text">{order.customer_name}</td>
                  <td className="px-4 py-4 text-text">
                    {formatPickupTime(order.pickup_type, order.pickup_time)}
                  </td>
                  <td className="px-4 py-4 text-primary font-semibold">฿{order.total_amount}</td>
                  <td className="px-4 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {order.status || 'pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {orders.length === 0 && (
            <div className="px-4 py-12 text-center">
              <p className="text-muted">No orders found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
