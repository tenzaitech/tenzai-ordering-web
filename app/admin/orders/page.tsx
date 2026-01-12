'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'

export default function AdminOrdersPage() {
  const { t } = useLanguage()
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [orderAccepting, setOrderAccepting] = useState<{ enabled: boolean; message: string }>({ enabled: true, message: '' })
  const [toggling, setToggling] = useState(false)

  // Drawer state
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [orderItems, setOrderItems] = useState<any[]>([])
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<'all' | 'today'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 50

  useEffect(() => {
    fetchOrders()
    fetchOrderAccepting()
  }, [statusFilter, dateFilter, currentPage])

  const fetchOrders = async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (dateFilter === 'today') params.set('date', 'today')
      params.set('page', String(currentPage))

      const response = await fetch(`/api/admin/orders?${params.toString()}`)
      if (!response.ok) {
        console.error('[ADMIN:ORDERS] Failed to fetch orders')
        setLoading(false)
        return
      }

      const data = await response.json()
      setOrders(data.orders || [])
      setTotalCount(data.count || 0)
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
    const confirmMsg = newState ? t('confirmOpenShop') : t('confirmCloseShop')
    if (!confirm(confirmMsg)) return

    setToggling(true)
    try {
      const response = await fetch('/api/admin/toggle-accepting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newState, message: orderAccepting.message })
      })

      if (!response.ok) throw new Error('Failed to toggle')

      const data = await response.json()
      setOrderAccepting({ enabled: data.enabled, message: data.message })
      alert(newState ? t('shopOpened') : t('shopClosed'))
    } catch (error) {
      console.error('[ADMIN:TOGGLE] Error:', error)
      alert(t('errorGenericMessage'))
    } finally {
      setToggling(false)
    }
  }

  const openDrawer = async (order: any) => {
    setSelectedOrder(order)
    setDrawerLoading(true)

    try {
      const response = await fetch(`/api/admin/orders/${order.id}`)
      if (response.ok) {
        const data = await response.json()
        setOrderItems(data.items || [])
      }
    } catch (error) {
      console.error('[ADMIN:DRAWER] Error fetching items:', error)
    } finally {
      setDrawerLoading(false)
    }
  }

  const closeDrawer = () => {
    setSelectedOrder(null)
    setOrderItems([])
    setShowRejectModal(false)
    setRejectReason('')
  }

  const showFeedbackMessage = (message: string, type: 'success' | 'error') => {
    setFeedback({ message, type })
    setTimeout(() => setFeedback(null), 3000)
  }

  const handleApprove = async () => {
    if (!selectedOrder || !confirm(t('confirmApprove'))) return

    setProcessing(true)
    try {
      const response = await fetch('/api/admin/approve-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: selectedOrder.id })
      })

      if (!response.ok) throw new Error('Failed to approve')

      showFeedbackMessage(t('orderApprovedSuccess'), 'success')
      setSelectedOrder({ ...selectedOrder, status: 'approved', approved_at: new Date().toISOString() })
      fetchOrders()
    } catch (error) {
      console.error('[ADMIN:APPROVE] Error:', error)
      showFeedbackMessage(t('orderApprovedError'), 'error')
    } finally {
      setProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!selectedOrder) return

    setProcessing(true)
    try {
      const response = await fetch('/api/admin/reject-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: selectedOrder.id, reason: rejectReason.trim() || null })
      })

      if (!response.ok) throw new Error('Failed to reject')

      showFeedbackMessage(t('orderRejectedSuccess'), 'success')
      setSelectedOrder({ ...selectedOrder, status: 'rejected', rejected_at: new Date().toISOString() })
      setShowRejectModal(false)
      setRejectReason('')
      fetchOrders()
    } catch (error) {
      console.error('[ADMIN:REJECT] Error:', error)
      showFeedbackMessage(t('orderRejectedError'), 'error')
    } finally {
      setProcessing(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showFeedbackMessage(t('copiedToClipboard'), 'success')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-primary/20 text-primary'
      case 'approved': return 'bg-green-500/20 text-green-500'
      case 'rejected': return 'bg-red-500/20 text-red-500'
      case 'ready': return 'bg-blue-500/20 text-blue-500'
      case 'picked_up': return 'bg-gray-500/20 text-gray-400'
      default: return 'bg-muted/20 text-muted'
    }
  }

  const formatPickupTime = (pickupType: string, pickupTime: string | null) => {
    if (pickupType === 'ASAP') return t('immediate')
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

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('th-TH', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    })
  }

  // Client-side search filter
  const filteredOrders = orders.filter(order => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      order.order_number.toLowerCase().includes(query) ||
      order.customer_name.toLowerCase().includes(query) ||
      order.customer_phone.includes(query)
    )
  })

  const totalPages = Math.ceil(totalCount / pageSize)
  const canApprove = selectedOrder && !selectedOrder.approved_at && !selectedOrder.rejected_at
  const canReject = selectedOrder && !selectedOrder.approved_at && !selectedOrder.rejected_at

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted">{t('loadingOrders')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      {feedback && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg ${
          feedback.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {feedback.message}
        </div>
      )}

      <div className="max-w-7xl mx-auto px-5 py-8">
        <h1 className="text-3xl font-bold text-text mb-8">{t('adminOrders')}</h1>

        {/* Order Accepting Control */}
        <div className="mb-6 bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-lg font-semibold text-text">{t('orderAccepting')}</h2>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  orderAccepting.enabled ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                }`}>
                  {orderAccepting.enabled ? t('open') : t('closed')}
                </span>
              </div>
              <p className="text-sm text-muted">
                {orderAccepting.enabled ? t('customersCanOrder') : t('customersBlocked')}
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
              {toggling ? t('processing') : (orderAccepting.enabled ? t('closeShop') : t('openShop'))}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 bg-card border border-border rounded-lg p-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-text mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value)
                  setCurrentPage(1)
                }}
                className="w-full px-4 py-2 bg-bg border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="ready">Ready</option>
                <option value="picked_up">Picked Up</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-2">Date</label>
              <select
                value={dateFilter}
                onChange={(e) => {
                  setDateFilter(e.target.value as 'all' | 'today')
                  setCurrentPage(1)
                }}
                className="w-full px-4 py-2 bg-bg border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All</option>
                <option value="today">Today</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-2">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Order #, name, phone..."
                className="w-full px-4 py-2 bg-bg border border-border rounded-lg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">{t('orderNumber')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">{t('customer')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">{t('pickup')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">{t('total')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">{t('status')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted">Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => openDrawer(order)}
                  className="border-b border-border hover:bg-border/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-4 text-text font-medium">{order.order_number}</td>
                  <td className="px-4 py-4 text-text">{order.customer_name}</td>
                  <td className="px-4 py-4 text-text">{formatPickupTime(order.pickup_type, order.pickup_time)}</td>
                  <td className="px-4 py-4 text-primary font-semibold">฿{order.total_amount_dec?.toFixed(2)}</td>
                  <td className="px-4 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {order.status || 'pending'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-muted">
                    {new Date(order.created_at).toLocaleDateString('en-GB')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredOrders.length === 0 && (
            <div className="px-4 py-12 text-center">
              <p className="text-muted">{t('noOrdersFound')}</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">
              Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalCount)} of {totalCount}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-card border border-border text-text rounded-lg hover:bg-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="px-4 py-2 bg-primary/10 text-primary rounded-lg font-medium">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-card border border-border text-text rounded-lg hover:bg-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={closeDrawer}></div>
          <div className="relative w-full max-w-2xl bg-card border-l border-border overflow-y-auto">
            <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-bold text-text flex items-center gap-3">
                  Order #{selectedOrder.order_number}
                  <button
                    onClick={() => copyToClipboard(selectedOrder.order_number)}
                    className="p-1 text-muted hover:text-primary transition-colors"
                    title="Copy order number"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedOrder.status)}`}>
                    {selectedOrder.status || 'pending'}
                  </span>
                  <span className="text-sm text-muted">{formatDateTime(selectedOrder.created_at)}</span>
                </div>
              </div>
              <button
                onClick={closeDrawer}
                className="p-2 text-muted hover:text-text transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Customer Info */}
              <div>
                <h3 className="text-sm font-semibold text-text mb-3">Customer Information</h3>
                <div className="bg-bg border border-border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted">Name:</span>
                    <span className="text-sm text-text font-medium">{selectedOrder.customer_name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted">Phone:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-text font-medium">{selectedOrder.customer_phone}</span>
                      <button
                        onClick={() => copyToClipboard(selectedOrder.customer_phone)}
                        className="p-1 text-muted hover:text-primary transition-colors"
                        title="Copy phone"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pickup Info */}
              <div>
                <h3 className="text-sm font-semibold text-text mb-3">Pickup Information</h3>
                <div className="bg-bg border border-border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted">Type:</span>
                    <span className="text-sm text-text font-medium">{selectedOrder.pickup_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted">Time:</span>
                    <span className="text-sm text-text font-medium">
                      {formatPickupTime(selectedOrder.pickup_type, selectedOrder.pickup_time)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Total Amount */}
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-text">Total Amount</span>
                  <span className="text-3xl font-bold text-primary">฿{selectedOrder.total_amount_dec?.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Slip */}
              <div>
                <h3 className="text-sm font-semibold text-text mb-3">Payment Slip</h3>
                {selectedOrder.slip_url ? (
                  <a
                    href={selectedOrder.slip_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open Slip
                  </a>
                ) : (
                  <p className="text-sm text-muted">No slip uploaded</p>
                )}
              </div>

              {/* Customer Note */}
              {selectedOrder.customer_note && (
                <div>
                  <h3 className="text-sm font-semibold text-text mb-3">Customer Note</h3>
                  <div className="bg-bg border border-border rounded-lg p-4">
                    <p className="text-sm text-text">{selectedOrder.customer_note}</p>
                  </div>
                </div>
              )}

              {/* Order Items */}
              <div>
                <h3 className="text-sm font-semibold text-text mb-3">Order Items</h3>
                {drawerLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {orderItems.map((item) => {
                      const options = item.selected_options_json
                      return (
                        <div key={item.id} className="bg-bg border border-border rounded-lg p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-text">
                                {item.qty}x {item.name_th}
                                {item.name_en && <span className="text-muted ml-1">({item.name_en})</span>}
                              </p>
                            </div>
                            <p className="text-sm font-semibold text-primary">฿{item.final_price * item.qty}</p>
                          </div>
                          {options && Array.isArray(options) && options.length > 0 && (
                            <ul className="text-xs text-muted space-y-1 ml-4">
                              {options.map((opt: any, idx: number) => {
                                if (opt.choice_names_th && Array.isArray(opt.choice_names_th)) {
                                  return <li key={idx}>• {opt.choice_names_th.join(', ')}</li>
                                }
                                return null
                              })}
                            </ul>
                          )}
                          {item.note && (
                            <p className="text-xs text-muted italic mt-2">Note: {item.note}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 sticky bottom-0 bg-card pt-4 pb-2 border-t border-border">
                {canApprove && (
                  <button
                    onClick={handleApprove}
                    disabled={processing}
                    className="flex-1 py-3 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {processing ? 'Processing...' : 'Approve'}
                  </button>
                )}
                {canReject && (
                  <button
                    onClick={() => setShowRejectModal(true)}
                    disabled={processing}
                    className="flex-1 py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reject
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-5">
          <div className="bg-card border border-border rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold text-text mb-4">Reject Order #{selectedOrder.order_number}</h2>
            <p className="text-muted text-sm mb-4">Optional: Provide a reason for rejection</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Out of stock, Invalid payment, etc."
              className="w-full p-3 bg-bg border border-border text-text rounded-lg resize-none mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
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
