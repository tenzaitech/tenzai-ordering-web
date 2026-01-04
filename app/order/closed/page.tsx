'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/contexts/LanguageContext'

export default function OrderClosedPage() {
  const { t } = useLanguage()
  const [customMessage, setCustomMessage] = useState<string | null>(null)

  useEffect(() => {
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
        <h1 className="text-xl font-bold text-text mb-4">{t('shopClosedTitle')}</h1>
        <div className="whitespace-pre-line text-text text-lg leading-relaxed">
          {customMessage || t('shopClosedMessage')}
        </div>
      </div>
    </div>
  )
}
