'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LanguageProvider } from '@/contexts/LanguageContext'
import TopBar from '@/components/TopBar'
import FloatingCartButton from '@/components/FloatingCartButton'

export default function OrderLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // Skip gate check if already on closed page
    if (pathname === '/order/closed') return

    const checkOrderAccepting = async () => {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'order_accepting')
          .single()

        // If setting doesn't exist or error occurred, default to enabled (fail-open)
        if (error) {
          if (error.code !== 'PGRST116') {
            console.error('[GATE] Error fetching setting:', error)
          }
          return
        }

        if (data) {
          const { enabled } = data.value as { enabled: boolean; message?: string }
          if (!enabled) {
            router.replace('/order/closed')
          }
        }
      } catch (err) {
        // On unexpected error, fail-open (allow ordering)
        console.error('[GATE] Unexpected error:', err)
      }
    }

    checkOrderAccepting()
  }, [pathname, router])

  return (
    <LanguageProvider scope="customer">
      <TopBar />
      {children}
      <FloatingCartButton />
    </LanguageProvider>
  )
}