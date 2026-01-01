'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function OrderClosedPage() {
  const [customMessage, setCustomMessage] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'order_accepting')
          .single()

        if (!error && data?.value?.message) {
          setCustomMessage(data.value.message)
        }
      } catch (err) {
        // Fail silently, use default message
        console.error('[CLOSED] Error fetching custom message:', err)
      }
    }

    fetchSettings()
  }, [])

  const defaultMessage = `ร้านปิดรับออเดอร์ชั่วคราว
ขออภัยในความไม่สะดวกครับ

สามารถดูเมนูได้ที่ปุ่ม MENU
ในหน้าแชท LINE ของร้าน`

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-5">
      <div className="max-w-md text-center">
        <div className="mb-8">
          <svg
            className="w-24 h-24 mx-auto mb-4 text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="whitespace-pre-line text-text text-lg leading-relaxed">
          {customMessage || defaultMessage}
        </div>
      </div>
    </div>
  )
}
