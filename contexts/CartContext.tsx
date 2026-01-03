'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface CartItemOption {
  group_id: string
  group_name_th: string
  group_name_en: string
  choice_ids: string[]
  choice_names_th: string[]
  choice_names_en: string[]
  price_delta_thb: number
}

export interface CartItem {
  id: string
  menuId: string
  name_th: string
  name_en: string
  base_price_thb: number
  final_price_thb: number
  quantity: number
  options?: CartItemOption[]
  note?: string
}

interface CartContextType {
  items: CartItem[]
  addItem: (item: Omit<CartItem, 'id'>) => void
  updateItem: (id: string, updates: Partial<CartItem>) => void
  updateQuantity: (id: string, quantity: number) => void
  removeItem: (id: string) => void
  clearCart: () => void
  setItems: (items: CartItem[]) => void
  getTotalPrice: () => number
  getTotalItems: () => number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItemsState] = useState<CartItem[]>([])
  const [isHydrated, setIsHydrated] = useState(false)

  // Hydrate cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('tenzai_cart')
    if (savedCart) {
      try {
        const parsed = JSON.parse(savedCart)
        setItemsState(parsed)
      } catch (e) {
        console.error('Failed to parse cart from localStorage:', e)
      }
    }
    // Clean up any stale editingOrderId from previous implementation
    localStorage.removeItem('tenzai_editing_order_id')
    setIsHydrated(true)
  }, [])

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('tenzai_cart', JSON.stringify(items))
    }
  }, [items, isHydrated])

  const addItem = (newItem: Omit<CartItem, 'id'>) => {
    const id = Date.now().toString()
    setItemsState(prev => [...prev, { ...newItem, id }])
  }

  const updateItem = (id: string, updates: Partial<CartItem>) => {
    setItemsState(prev => prev.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ))
  }

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id)
      return
    }
    setItemsState(prev => prev.map(item =>
      item.id === id ? { ...item, quantity } : item
    ))
  }

  const removeItem = (id: string) => {
    setItemsState(prev => prev.filter(item => item.id !== id))
  }

  const clearCart = () => {
    setItemsState([])
  }

  const setItems = (newItems: CartItem[]) => {
    setItemsState(newItems)
  }

  const getTotalPrice = () => {
    return items.reduce((total, item) => {
      return total + (item.final_price_thb * item.quantity)
    }, 0)
  }

  const getTotalItems = () => {
    return items.reduce((total, item) => total + item.quantity, 0)
  }

  return (
    <CartContext.Provider value={{
      items,
      addItem,
      updateItem,
      updateQuantity,
      removeItem,
      clearCart,
      setItems,
      getTotalPrice,
      getTotalItems,
    }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}