'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCart } from '@/contexts/CartContext'

export default function FloatingCartButton() {
  const pathname = usePathname()
  const isCartPage = pathname === '/order/cart'

  // Don't render at all on cart page
  if (isCartPage) return null

  const { getTotalItems } = useCart()
  const totalItems = getTotalItems()

  return (
    <Link
      href="/order/cart"
      className="fixed bottom-6 right-6 bg-primary text-white rounded-full w-16 h-16 flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow z-50"
    >
      <div className="relative">
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        {totalItems > 0 && (
          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-medium">
            {totalItems > 99 ? '99+' : totalItems}
          </div>
        )}
      </div>
    </Link>
  )
}