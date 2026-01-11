'use client'

import { useState } from 'react'
import { adminFetch } from '@/lib/admin-fetch'
import Link from 'next/link'

type FeedbackState = {
  message: string
  type: 'success' | 'error'
} | null

export default function SecuritySettingsPage() {
  const [feedback, setFeedback] = useState<FeedbackState>(null)

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)

  // Session revoke state
  const [revokingAdmin, setRevokingAdmin] = useState(false)
  const [revokingStaff, setRevokingStaff] = useState(false)
  const [revokingAll, setRevokingAll] = useState(false)

  const showFeedback = (message: string, type: 'success' | 'error') => {
    setFeedback({ message, type })
    setTimeout(() => setFeedback(null), 5000)
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentPassword || !newPassword || !confirmPassword) {
      showFeedback('กรุณากรอกข้อมูลให้ครบถ้วน', 'error')
      return
    }

    if (newPassword.length < 8) {
      showFeedback('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร', 'error')
      return
    }

    if (newPassword !== confirmPassword) {
      showFeedback('รหัสผ่านใหม่ไม่ตรงกัน', 'error')
      return
    }

    setChangingPassword(true)

    try {
      const res = await adminFetch('/api/admin/security/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      })

      if (res.ok) {
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        showFeedback('เปลี่ยนรหัสผ่านสำเร็จ session อื่นทั้งหมดถูกยกเลิก', 'success')
      } else {
        const data = await res.json()
        showFeedback(data.error?.message_th || 'เกิดข้อผิดพลาด', 'error')
      }
    } catch (error) {
      console.error('[SECURITY] Password change error:', error)
      showFeedback('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error')
    } finally {
      setChangingPassword(false)
    }
  }

  const handleRevokeSession = async (target: 'admin' | 'staff' | 'all') => {
    const setLoading = target === 'admin' ? setRevokingAdmin :
                       target === 'staff' ? setRevokingStaff : setRevokingAll

    setLoading(true)

    try {
      const res = await adminFetch('/api/admin/security/revoke-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target })
      })

      if (res.ok) {
        const messages = {
          admin: 'ยกเลิก session ผู้ดูแลทั้งหมดแล้ว',
          staff: 'ยกเลิก session พนักงานทั้งหมดแล้ว',
          all: 'ยกเลิก session ทั้งหมดแล้ว'
        }
        showFeedback(messages[target], 'success')
      } else {
        const data = await res.json()
        showFeedback(data.error?.message_th || 'เกิดข้อผิดพลาด', 'error')
      }
    } catch (error) {
      console.error('[SECURITY] Revoke session error:', error)
      showFeedback('เกิดข้อผิดพลาด กรุณาลองใหม่', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-3xl mx-auto px-5 py-8">
        {/* Header with back link */}
        <div className="flex items-center gap-4 mb-8">
          <Link
            href="/admin/settings"
            className="text-muted hover:text-text transition-colors"
          >
            &larr; กลับ
          </Link>
          <h1 className="text-3xl font-bold text-text">ความปลอดภัย</h1>
        </div>

        {/* Feedback */}
        {feedback && (
          <div className={`mb-6 p-4 rounded-lg border ${
            feedback.type === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-red-500/10 border-red-500/30 text-red-400'
          }`}>
            {feedback.message}
          </div>
        )}

        <div className="space-y-6">
          {/* Change Password Section */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-text mb-2">เปลี่ยนรหัสผ่าน</h2>
            <p className="text-sm text-muted mb-4">
              การเปลี่ยนรหัสผ่านจะทำให้ session ผู้ดูแลทั้งหมดถูกยกเลิก (ยกเว้น session ปัจจุบัน)
            </p>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm text-muted mb-1">รหัสผ่านปัจจุบัน</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="กรอกรหัสผ่านปัจจุบัน"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">รหัสผ่านใหม่</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">ยืนยันรหัสผ่านใหม่</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-bg border border-border rounded-lg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                />
              </div>
              <button
                type="submit"
                disabled={changingPassword}
                className="w-full py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {changingPassword ? 'กำลังเปลี่ยนรหัสผ่าน...' : 'เปลี่ยนรหัสผ่าน'}
              </button>
            </form>
          </div>

          {/* Revoke Sessions Section */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-text mb-2">ยกเลิก Session</h2>
            <p className="text-sm text-muted mb-4">
              ยกเลิก session เพื่อให้ผู้ใช้ต้องเข้าสู่ระบบใหม่ ใช้เมื่อสงสัยว่ามีการเข้าถึงโดยไม่ได้รับอนุญาต
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleRevokeSession('staff')}
                disabled={revokingStaff || revokingAll}
                className="w-full py-3 bg-border text-text font-medium rounded-lg hover:bg-border/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {revokingStaff ? (
                  'กำลังยกเลิก...'
                ) : (
                  <>
                    <span>ยกเลิก Session พนักงานทั้งหมด</span>
                    <span className="text-muted text-sm">(PIN)</span>
                  </>
                )}
              </button>

              <button
                onClick={() => handleRevokeSession('admin')}
                disabled={revokingAdmin || revokingAll}
                className="w-full py-3 bg-border text-text font-medium rounded-lg hover:bg-border/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {revokingAdmin ? (
                  'กำลังยกเลิก...'
                ) : (
                  <>
                    <span>ยกเลิก Session ผู้ดูแลทั้งหมด</span>
                    <span className="text-muted text-sm">(Password)</span>
                  </>
                )}
              </button>

              <button
                onClick={() => handleRevokeSession('all')}
                disabled={revokingAdmin || revokingStaff || revokingAll}
                className="w-full py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {revokingAll ? 'กำลังยกเลิก...' : 'ยกเลิก Session ทั้งหมด'}
              </button>
            </div>
          </div>

          {/* Security Info Section */}
          <div className="bg-card border border-border rounded-lg p-6">
            <h2 className="text-lg font-semibold text-text mb-2">ข้อมูลความปลอดภัย</h2>
            <div className="space-y-3 text-sm text-muted">
              <p>
                <span className="text-text font-medium">Session หมดอายุ:</span> 8 ชั่วโมง
              </p>
              <p>
                <span className="text-text font-medium">Rate Limit:</span> 5 ครั้ง ภายใน 15 นาที (ล็อค 15 นาที)
              </p>
              <p>
                <span className="text-text font-medium">Audit Log:</span> บันทึกการเข้าสู่ระบบ/ออกจากระบบ และการดำเนินการที่สำคัญทั้งหมด
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
