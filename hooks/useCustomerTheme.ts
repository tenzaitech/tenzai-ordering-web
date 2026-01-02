'use client'

import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

const CUSTOMER_THEME_KEY = 'tenzai:customer-theme'

export function useCustomerTheme() {
  const [theme, setTheme] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(CUSTOMER_THEME_KEY) as Theme | null
    const initialTheme = stored || 'dark'
    setTheme(initialTheme)
    document.documentElement.setAttribute('data-theme', initialTheme)
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    const newTheme: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem(CUSTOMER_THEME_KEY, newTheme)
  }

  return { theme, toggleTheme, mounted }
}
