'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function StaffLoginPage() {
  const router = useRouter()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/staff/auth/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      })

      const data = await response.json()

      if (response.ok) {
        // Redirect to staff board
        router.push('/staff')
        router.refresh()
      } else {
        setError(data.error?.message_th || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
        setPin('')
      }
    } catch (err) {
      console.error('[STAFF:LOGIN] Error:', err)
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-root flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-8 shadow-lg">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-2xl">T</span>
            </div>
            <h1 className="text-2xl font-bold text-text-primary mb-1">
              Staff Board
            </h1>
            <p className="text-sm text-text-secondary">
              กรอก PIN เพื่อเข้าสู่ระบบ
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="กรอก PIN"
              className="w-full px-4 py-3 bg-bg-root border border-border-subtle rounded-lg text-text-primary text-center text-xl tracking-widest mb-4 focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent placeholder:text-text-muted"
              autoFocus
              required
            />

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg mb-4">
                <p className="text-sm text-red-400 text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !pin}
              className="w-full py-3 bg-accent text-white font-semibold rounded-lg hover:bg-accent/90 active:bg-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-text-muted mt-6">
          TENZAI Ordering System
        </p>
      </div>
    </div>
  )
}
