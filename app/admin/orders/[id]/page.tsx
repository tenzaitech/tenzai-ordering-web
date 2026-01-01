'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AdminOrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string

  const [order, setOrder] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)

  useEffect(() => {
    fetchOrderDetails()
  }, [orderId])

  const fetchOrderDetails = async () => {
    try {
      // Fetch order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single()

      if (orderError || !orderData) {
        console.error('[ADMIN:DETAIL] Failed to fetch order:', orderError)
        setLoading(false)
        return
      }

      // Fetch order items
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', orderId)

      if (itemsError) {
        console.error('[ADMIN:DETAIL] Failed to fetch items:', itemsError)
      }

      setOrder(orderData)
      setItems(itemsData || [])
      setLoading(false)
    } catch (error) {
      console.error('[ADMIN:DETAIL] Unexpected error:', error)
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!confirm('อนุมัติคำสั่งซื้อนี้และแจ้งทีมครัว?')) return

    setProcessing(true)
    try {
      const response = await fetch('/api/admin/approve-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      })

      if (!response.ok) {
        throw new Error('Failed to approve order')
      }

      alert('อนุมัติคำสั่งซื้อสำเร็จ')
      fetchOrderDetails()
    } catch (error) {
      console.error('[ADMIN:APPROVE] Error:', error)
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    setProcessing(true)
    try {
      const response = await fetch('/api/admin/reject-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, reason: rejectReason.trim() || null })
      })

      if (!response.ok) {
        throw new Error('Failed to reject order')
      }

      alert('ปฏิเสธคำสั่งซื้อสำเร็จ')
      setShowRejectModal(false)
      fetchOrderDetails()
    } catch (error) {
      console.error('[ADMIN:REJECT] Error:', error)
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setProcessing(false)
    }
  }

  const formatPickupTime = (pickupType: string, pickupTime: string | null) => {
    if (pickupType === 'ASAP') {
      return 'ให้ร้านทำทันที'
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
          <p className="text-muted">Loading order...</p>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-text">Order not found</p>
          <button
            onClick={() => router.push('/admin/orders')}
            className="mt-4 px-6 py-3 bg-primary text-white rounded-lg"
          >
            Back to Orders
          </button>
        </div>
      </div>
    )
  }

  const canApprove = !order.approved_at && !order.rejected_at
  const canReject = !order.approved_at && !order.rejected_at

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-4xl mx-auto px-5 py-8">
        <button
          onClick={() => router.push('/admin/orders')}
          className="mb-6 text-muted hover:text-text transition-colors"
        >
          ← Back to Orders
        </button>

        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-2xl font-bold text-text mb-2">
                Order #{order.order_number}
              </h1>
              <p className="text-sm text-muted">
                Status: <span className="text-primary font-medium">{order.status || 'pending'}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary">฿{order.total_amount}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <p className="text-sm text-muted mb-1">Customer</p>
              <p className="text-text font-medium">{order.customer_name}</p>
              <p className="text-text">{order.customer_phone}</p>
            </div>
            <div>
              <p className="text-sm text-muted mb-1">Pickup Time</p>
              <p className="text-text font-medium">
                {formatPickupTime(order.pickup_type, order.pickup_time)}
              </p>
            </div>
          </div>

          {order.customer_note && (
            <div className="mb-6">
              <p className="text-sm text-muted mb-1">Customer Note</p>
              <p className="text-text bg-bg border border-border rounded p-3">
                {order.customer_note}
              </p>
            </div>
          )}

          <div className="mb-6">
            <p className="text-sm text-muted mb-2">Payment Slip</p>
            {order.slip_url ? (
              <a
                href={order.slip_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                View Slip →
              </a>
            ) : (
              <p className="text-muted">No slip uploaded</p>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold text-text mb-4">Order Items</h2>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="bg-bg border border-border rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-text font-medium">{item.name_th}</p>
                      <p className="text-sm text-muted">Qty: {item.qty}</p>
                      {item.note && (
                        <p className="text-xs text-muted italic mt-1">Note: {item.note}</p>
                      )}
                    </div>
                    <p className="text-primary font-semibold">฿{item.final_price * item.qty}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          {canApprove && (
            <button
              onClick={handleApprove}
              disabled={processing}
              className="flex-1 py-4 bg-green-500 text-white font-medium rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? 'Processing...' : 'Approve Order'}
            </button>
          )}
          {canReject && (
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={processing}
              className="flex-1 py-4 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reject Order
            </button>
          )}
        </div>

        {order.approved_at && (
          <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-green-500 font-medium">✓ Order Approved</p>
            <p className="text-sm text-muted">
              Approved at: {new Date(order.approved_at).toLocaleString('th-TH')}
            </p>
          </div>
        )}

        {order.rejected_at && (
          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-500 font-medium">✗ Order Rejected</p>
            <p className="text-sm text-muted">
              Rejected at: {new Date(order.rejected_at).toLocaleString('th-TH')}
            </p>
            {order.rejected_reason && (
              <p className="text-sm text-text mt-2">Reason: {order.rejected_reason}</p>
            )}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-5">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold text-text mb-4">Reject Order</h2>
            <p className="text-muted text-sm mb-4">
              Optional: Provide a reason for rejection
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Out of stock, Invalid payment, etc."
              className="w-full p-3 bg-bg border border-border text-text rounded-lg resize-none mb-4"
              rows={3}
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false)
                  setRejectReason('')
                }}
                disabled={processing}
                className="flex-1 py-3 bg-card border border-border text-text rounded-lg hover:bg-border transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={processing}
                className="flex-1 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
