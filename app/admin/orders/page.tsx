'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AdminOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrders()
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
