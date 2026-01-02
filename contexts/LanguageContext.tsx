'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { translate } from '@/lib/i18n'

type Language = 'th' | 'en'
type LocaleScope = 'customer' | 'admin'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

interface LanguageProviderProps {
  children: ReactNode
  scope?: LocaleScope
}

export function LanguageProvider({ children, scope = 'customer' }: LanguageProviderProps) {
  const storageKey = scope === 'customer' ? 'tenzai:customer-locale' : 'tenzai:admin-locale'
  const [language, setLanguageState] = useState<Language>('th')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(storageKey) as Language | null
    const initialLanguage = stored || 'th'
    setLanguageState(initialLanguage)
    setMounted(true)
  }, [storageKey])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem(storageKey, lang)
  }

  const t = (key: string) => translate(key as any, language)

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}
