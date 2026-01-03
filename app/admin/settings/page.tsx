'use client'

import { useState, useEffect } from 'react'
import { adminFetch } from '@/lib/admin-fetch'

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingApprover, setTestingApprover] = useState(false)
  const [testingStaff, setTestingStaff] = useState(false)

  const [lineApproverId, setLineApproverId] = useState('')
  const [lineStaffId, setLineStaffId] = useState('')
  const [newStaffPin, setNewStaffPin] = useState('')

  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await adminFetch('/api/admin/settings')
      if (res.ok) {
        const data = await res.json()
        setLineApproverId(data.line_approver_id)
        setLineStaffId(data.line_staff_id)
      } else if (res.status === 401) {
        showFeedback('Admin access required. Please access via /admin/menu first.', 'error')
      } else {
        showFeedback('Failed to load settings', 'error')
      }
    } catch (error) {
      console.error('[ADMIN:SETTINGS] Fetch error:', error)
      showFeedback('Failed to load settings', 'error')
    } finally {
      setLoading(false)
    }
  }

  const showFeedback = (message: string, type: 'success' | 'error') => {
    setFeedback({ message, type })
    setTimeout(() => setFeedback(null), 4000)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    // Validation
    if (!lineApproverId.trim() || !lineStaffId.trim()) {
      showFeedback('LINE IDs cannot be empty', 'error')
      setSaving(false)
      return
    }

    if (newStaffPin && !/^\d{4}$/.test(newStaffPin)) {
      showFeedback('PIN must be exactly 4 digits', 'error')
      setSaving(false)
      return
    }

    try {
      const res = await adminFetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          line_approver_id: lineApproverId.trim(),
          line_staff_id: lineStaffId.trim(),
          new_staff_pin: newStaffPin || undefined
        })
      })

      if (res.ok) {
        showFeedback('Settings saved successfully!', 'success')
        setNewStaffPin('')
        if (newStaffPin) {
          showFeedback('Settings saved! Staff PIN changed - all staff sessions will be invalidated on next request.', 'success')
        }
      } else {
        const error = await res.json()
        showFeedback(error.error || 'Failed to save settings', 'error')
      }
    } catch (error) {
      console.error('[ADMIN:SETTINGS] Save error:', error)
      showFeedback('Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleTestMessage = async (target: 'approver' | 'staff') => {
    if (target === 'approver') setTestingApprover(true)
    else setTestingStaff(true)

    try {
      const res = await adminFetch('/api/admin/settings/test-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target })
      })

      if (res.ok) {
        showFeedback(`Test message sent to ${target === 'approver' ? 'approver' : 'staff'}!`, 'success')
      } else {
        const error = await res.json()
        showFeedback(error.error || 'Failed to send test message', 'error')
      }
    } catch (error) {
      console.error('[ADMIN:TEST] Error:', error)
      showFeedback('Failed to send test message', 'error')
    } finally {
      if (target === 'approver') setTestingApprover(false)
      else setTestingStaff(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-5 py-8">
        <h1 className="text-3xl font-bold text-text mb-8">System Settings</h1>

        {feedback && (
          <div className={`mb-6 p-4 rounded-lg border ${
            feedback.type === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            {feedback.message}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* LINE Approver ID */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-text mb-4">LINE Approver ID</h2>
            <p className="text-sm text-muted mb-4">
              LINE User ID that receives new order notifications (for payment approval).
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={lineApproverId}
                onChange={(e) => setLineApproverId(e.target.value)}
                placeholder="U1234567890abcdef..."
                className="flex-1 px-4 py-3 bg-bg border border-border rounded-lg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <button
                type="button"
                onClick={() => handleTestMessage('approver')}
                disabled={testingApprover || !lineApproverId.trim()}
                className="px-5 py-3 bg-border text-text font-medium rounded-lg hover:bg-border/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testingApprover ? 'Sending...' : 'Test'}
              </button>
            </div>
          </div>

          {/* LINE Staff ID */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-text mb-4">LINE Staff ID</h2>
            <p className="text-sm text-muted mb-4">
              LINE User/Group ID that receives approved order notifications (kitchen staff).
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={lineStaffId}
                onChange={(e) => setLineStaffId(e.target.value)}
                placeholder="C1234567890abcdef... or U1234567890abcdef..."
                className="flex-1 px-4 py-3 bg-bg border border-border rounded-lg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <button
                type="button"
                onClick={() => handleTestMessage('staff')}
                disabled={testingStaff || !lineStaffId.trim()}
                className="px-5 py-3 bg-border text-text font-medium rounded-lg hover:bg-border/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testingStaff ? 'Sending...' : 'Test'}
              </button>
            </div>
          </div>

          {/* Staff PIN */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-text mb-4">Change Staff PIN</h2>
            <p className="text-sm text-muted mb-4">
              4-digit PIN for staff board access. Leave empty to keep current PIN.
              <br />
              <span className="text-primary">⚠️ Changing PIN will log out all staff on their next request.</span>
            </p>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={newStaffPin}
              onChange={(e) => setNewStaffPin(e.target.value)}
              placeholder="Leave empty to keep current PIN"
              maxLength={4}
              className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-4 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  )
}
