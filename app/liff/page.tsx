'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/contexts/LanguageContext'

const getOS = (): 'ios' | 'android' | 'desktop' | 'unknown' => {
  if (typeof window === 'undefined') return 'unknown'
  const ua = window.navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

export default function LiffBootstrapPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [status, setStatus] = useState<'initializing' | 'logging_in' | 'error' | 'not_in_line'>('initializing')
  const [errorMessage, setErrorMessage] = useState('')
  const [userOS, setUserOS] = useState<'ios' | 'android' | 'desktop' | 'unknown'>('unknown')

  useEffect(() => {
    setUserOS(getOS())
  }, [])

  useEffect(() => {
    const initializeLiff = async () => {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID

      if (!liffId) {
        setStatus('error')
        setErrorMessage(t('liffNotConfigured'))
        return
      }

      try {
        const liff = (await import('@line/liff')).default

        await liff.init({ liffId })

        // Check if opened in LINE
        if (!liff.isInClient()) {
          setStatus('not_in_line')
          return
        }

        // Check if logged in
        if (!liff.isLoggedIn()) {
          setStatus('logging_in')
          liff.login()
          return
        }

        // Get user profile
        const profile = await liff.getProfile()
        const userId = profile.userId

        // Send userId to backend
        const response = await fetch('/api/liff/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId })
        })

        if (!response.ok) {
          throw new Error(t('failedToCreateSession'))
        }

        // Determine redirect destination
        // Check if LIFF was opened with a specific path (e.g., /order/status/[id])
        const context = liff.getContext()
        const rawPath = context?.path || ''

        // Normalize path: trim whitespace, ensure leading slash, preserve query/hash
        let normalizedPath = rawPath.trim()
        if (normalizedPath && !normalizedPath.startsWith('/')) {
          normalizedPath = '/' + normalizedPath
        }

        // Valid redirect paths (whitelist for security)
        // Using startsWith to allow /order/status/<id> and /order/status/<id>/
        const validPaths = ['/order/status/', '/order/status', '/order/menu', '/order/cart', '/order/checkout', '/order/payment', '/order/confirmed']
        const isValidPath = validPaths.some(p => {
          // Exact match or startsWith for paths that can have params
          if (p === '/order/status/') {
            return normalizedPath.startsWith(p)
          }
          // For other paths, match exactly or with trailing slash
          return normalizedPath === p || normalizedPath.startsWith(p + '/')  || normalizedPath.startsWith(p + '?')
        })

        // DEV-only logging for debugging deep links
        if (process.env.NODE_ENV !== 'production') {
          console.log('[LIFF:REDIRECT] rawPath:', rawPath, '| normalized:', normalizedPath, '| isValid:', isValidPath)
        }

        // Redirect to intended path or default to menu
        const redirectPath = isValidPath ? normalizedPath : '/order/menu'
        router.replace(redirectPath)
      } catch (error) {
        console.error('[LIFF] Initialization error:', error)
        setStatus('error')
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error')
      }
    }

    initializeLiff()
  }, [router])

  const handleOpenInLine = () => {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID
    if (!liffId) return

    const primaryUrl = `https://liff.line.me/${liffId}`
    const fallbackUrl = `line://app/${liffId}`

    let hasLeft = false

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hasLeft = true
      }
    }

    const handlePageHide = () => {
      hasLeft = true
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)

    // Primary redirect
    window.location.href = primaryUrl

    // Fallback after delay if still visible
    setTimeout(() => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)

      if (!hasLeft && document.visibilityState === 'visible') {
        window.location.href = fallbackUrl
      }
    }, 1000)
  }

  const getInstructions = () => {
    switch (userOS) {
      case 'ios':
        return t('liffInstructionsIOS')
      case 'android':
        return t('liffInstructionsAndroid')
      default:
        return t('liffInstructionsDesktop')
    }
  }

  if (status === 'not_in_line') {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID
    const primaryUrl = `https://liff.line.me/${liffId}`

    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-5">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <svg className="w-20 h-20 mx-auto text-primary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text mb-3">{t('pleaseOpenInLine')}</h1>
          <p className="text-sm text-muted mb-8 leading-relaxed">
            {getInstructions()}
          </p>
          <button
            onClick={handleOpenInLine}
            className="w-full py-4 px-6 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors mb-4"
          >
            {t('openInLine')}
          </button>
          <a
            href={primaryUrl}
            className="inline-block text-sm text-primary hover:text-primary/80 underline"
          >
            {t('ifNotOpenTapHere')}
          </a>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-5">
        <div className="text-center max-w-sm">
          <div className="mb-6">
            <svg className="w-16 h-16 mx-auto text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-text mb-3">{t('connectionError')}</h1>
          <p className="text-sm text-muted">{errorMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-center">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        </div>
        <p className="text-text font-medium">
          {status === 'initializing' ? t('connectingLine') : t('loggingIn')}
        </p>
      </div>
    </div>
  )
}
