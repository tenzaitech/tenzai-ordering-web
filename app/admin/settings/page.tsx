'use client'

import { useState, useEffect, useRef } from 'react'
import { adminFetch } from '@/lib/admin-fetch'
import { useLanguage } from '@/contexts/LanguageContext'
import { normalizeToastMessage } from '@/lib/toast-helpers'
import Link from 'next/link'

export default function AdminSettingsPage() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingApprover, setTestingApprover] = useState(false)
  const [testingStaff, setTestingStaff] = useState(false)

  const [promptPayId, setPromptPayId] = useState('')
  const [lineApproverId, setLineApproverId] = useState('')
  const [lineStaffId, setLineStaffId] = useState('')
  const [newStaffPin, setNewStaffPin] = useState('')

  // Track original values to detect changes
  const originalValues = useRef<{ promptpay_id: string; line_approver_id: string; line_staff_id: string }>({
    promptpay_id: '',
    line_approver_id: '',
    line_staff_id: ''
  })

  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Check if any field has changed
  const hasChanges =
    promptPayId !== originalValues.current.promptpay_id ||
    lineApproverId !== originalValues.current.line_approver_id ||
    lineStaffId !== originalValues.current.line_staff_id ||
    newStaffPin.length > 0

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await adminFetch('/api/admin/settings')
      if (res.ok) {
        const data = await res.json()
        setPromptPayId(data.promptpay_id || '')
        setLineApproverId(data.line_approver_id || '')
        setLineStaffId(data.line_staff_id || '')
        // Store original values for dirty tracking
        originalValues.current = {
          promptpay_id: data.promptpay_id || '',
          line_approver_id: data.line_approver_id || '',
          line_staff_id: data.line_staff_id || ''
        }
      } else if (res.status === 401) {
        showFeedback(t('adminAccessRequired'), 'error')
      } else {
        showFeedback(t('failedToLoadSettings'), 'error')
      }
    } catch (error) {
      console.error('[ADMIN:SETTINGS] Fetch error:', error)
      showFeedback(t('failedToLoadSettings'), 'error')
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

    if (!hasChanges) {
      showFeedback(t('noChangesToSave'), 'error')
      return
    }

    setSaving(true)

    // Validate only changed fields
    if (newStaffPin && !/^\d{4}$/.test(newStaffPin)) {
      showFeedback(t('pinMustBe4Digits'), 'error')
      setSaving(false)
      return
    }

    // Build payload with only changed fields (PATCH-style)
    const payload: Record<string, string> = {}

    if (promptPayId !== originalValues.current.promptpay_id) {
      payload.promptpay_id = promptPayId.trim()
    }
    if (lineApproverId !== originalValues.current.line_approver_id) {
      payload.line_approver_id = lineApproverId.trim()
    }
    if (lineStaffId !== originalValues.current.line_staff_id) {
      payload.line_staff_id = lineStaffId.trim()
    }
    if (newStaffPin) {
      payload.new_staff_pin = newStaffPin
    }

    try {
      const res = await adminFetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        // Update original values to reflect saved state
        originalValues.current = {
          promptpay_id: promptPayId,
          line_approver_id: lineApproverId,
          line_staff_id: lineStaffId
        }
        setNewStaffPin('')

        if (newStaffPin) {
          showFeedback(t('settingsSavedWithPin'), 'success')
        } else {
          showFeedback(t('settingsSaved'), 'success')
        }
      } else {
        const error = await res.json().catch(() => null)
        showFeedback(normalizeToastMessage(error?.error ?? error) || t('failedToSaveSettings'), 'error')
      }
    } catch (error) {
      console.error('[ADMIN:SETTINGS] Save error:', error)
      showFeedback(t('failedToSaveSettings'), 'error')
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
        showFeedback(t('testMessageSent'), 'success')
      } else {
        const error = await res.json().catch(() => null)
        showFeedback(normalizeToastMessage(error?.error ?? error) || t('failedToSendTestMessage'), 'error')
      }
    } catch (error) {
      console.error('[ADMIN:TEST] Error:', error)
      showFeedback(t('failedToSendTestMessage'), 'error')
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
          <p className="text-muted">{t('loadingSettings')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-5 py-8">
        <h1 className="text-3xl font-bold text-text mb-8">{t('systemSettings')}</h1>

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
          {/* PromptPay ID */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-text mb-4">{t('promptPayIdLabel')}</h2>
            <p className="text-sm text-muted mb-4">
              {t('promptPayIdDesc')}
              <br />
              <span className="text-primary">{t('promptPayIdFormat')}</span>
            </p>
            <input
              type="text"
              value={promptPayId}
              onChange={(e) => setPromptPayId(e.target.value)}
              placeholder="0988799990"
              className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* LINE Approver ID */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-text mb-4">{t('lineApproverIdLabel')}</h2>
            <p className="text-sm text-muted mb-4">
              {t('lineApproverIdDesc')}
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={lineApproverId}
                onChange={(e) => setLineApproverId(e.target.value)}
                placeholder="U1234567890abcdef..."
                className="flex-1 px-4 py-3 bg-bg border border-border rounded-lg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => handleTestMessage('approver')}
                disabled={testingApprover || !lineApproverId.trim()}
                className="px-5 py-3 bg-border text-text font-medium rounded-lg hover:bg-border/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testingApprover ? t('sending') : t('test')}
              </button>
            </div>
          </div>

          {/* LINE Staff ID */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-text mb-4">{t('lineStaffIdLabel')}</h2>
            <p className="text-sm text-muted mb-4">
              {t('lineStaffIdDesc')}
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                value={lineStaffId}
                onChange={(e) => setLineStaffId(e.target.value)}
                placeholder="C1234567890abcdef... or U1234567890abcdef..."
                className="flex-1 px-4 py-3 bg-bg border border-border rounded-lg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={() => handleTestMessage('staff')}
                disabled={testingStaff || !lineStaffId.trim()}
                className="px-5 py-3 bg-border text-text font-medium rounded-lg hover:bg-border/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testingStaff ? t('sending') : t('test')}
              </button>
            </div>
          </div>

          {/* Staff PIN */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-text mb-4">{t('changeStaffPin')}</h2>
            <p className="text-sm text-muted mb-4">
              {t('changeStaffPinDesc')}
              <br />
              <span className="text-primary">⚠️ {t('changeStaffPinWarning')}</span>
            </p>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={newStaffPin}
              onChange={(e) => setNewStaffPin(e.target.value)}
              placeholder={t('leaveEmptyToKeepPin')}
              maxLength={4}
              className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Security Settings Link */}
          <Link
            href="/admin/settings/security"
            className="block bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-text mb-1">ความปลอดภัย</h2>
                <p className="text-sm text-muted">
                  เปลี่ยนรหัสผ่านผู้ดูแล, ยกเลิก Session ทั้งหมด
                </p>
              </div>
              <span className="text-muted text-2xl">&rarr;</span>
            </div>
          </Link>

          {/* Save Button */}
          <button
            type="submit"
            disabled={saving || !hasChanges}
            className="w-full py-4 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? t('saving') : hasChanges ? t('saveSettings') : t('noChanges')}
          </button>
        </form>
      </div>
    </div>
  )
}
