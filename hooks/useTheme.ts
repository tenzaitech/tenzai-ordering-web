'use client'

import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'
type ThemeScope = 'admin' | 'customer'

/**
 * Unified theme hook for both admin and customer scopes.
 * @param scope - 'admin' uses 'tenzai:admin-theme', 'customer' uses 'tenzai:customer-theme'
 */
export function useTheme(scope: ThemeScope = 'admin') {
  const [theme, setTheme] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  const storageKey = `tenzai:${scope}-theme`

  useEffect(() => {
    const stored = localStorage.getItem(storageKey) as Theme | null
    const initialTheme = stored || 'dark'
    setTheme(initialTheme)
    document.documentElement.setAttribute('data-theme', initialTheme)
    setMounted(true)
  }, [storageKey])

  const toggleTheme = () => {
    const newTheme: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem(storageKey, newTheme)
  }

  return { theme, toggleTheme, mounted }
}

// Convenience alias for customer pages (backwards-compatible)
export function useCustomerTheme() {
  return useTheme('customer')
}
