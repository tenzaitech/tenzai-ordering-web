'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface CheckoutDraft {
  customerName: string
  customerPhone: string
  pickupType: 'ASAP' | 'SCHEDULED'
  pickupTime: string
  note: string
}

interface CheckoutContextType {
  draft: CheckoutDraft
  updateDraft: (updates: Partial<CheckoutDraft>) => void
  clearDraft: () => void
}

const defaultDraft: CheckoutDraft = {
  customerName: '',
  customerPhone: '',
  pickupType: 'ASAP',
  pickupTime: '',
  note: '',
}

const CheckoutContext = createContext<CheckoutContextType | undefined>(undefined)

export function CheckoutProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<CheckoutDraft>(defaultDraft)

  const updateDraft = useCallback((updates: Partial<CheckoutDraft>) => {
    setDraft((prev) => {
      // Shallow equality check to prevent unnecessary updates
      let hasChanges = false
      for (const key in updates) {
        if (prev[key as keyof CheckoutDraft] !== updates[key as keyof CheckoutDraft]) {
          hasChanges = true
          break
        }
      }
      if (!hasChanges) return prev
      return { ...prev, ...updates }
    })
  }, [])

  const clearDraft = useCallback(() => {
    setDraft(defaultDraft)
  }, [])

  return (
    <CheckoutContext.Provider value={{ draft, updateDraft, clearDraft }}>
      {children}
    </CheckoutContext.Provider>
  )
}

export function useCheckout() {
  const context = useContext(CheckoutContext)
  if (context === undefined) {
    throw new Error('useCheckout must be used within a CheckoutProvider')
  }
  return context
}
