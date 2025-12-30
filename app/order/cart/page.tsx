'use client'

import Link from 'next/link'
import { useCart } from '@/contexts/CartContext'
import { useLanguage } from '@/contexts/LanguageContext'

export default function CartPage() {
  const { items, updateQuantity, removeItem, getTotalPrice } = useCart()
  const { language } = useLanguage()

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-bg">
        <div className="max-w-mobile mx-auto">
          <header className="sticky top-0 bg-card z-10 px-5 py-4 border-b border-border flex items-center">
            <Link href="/order/menu" className="text-muted hover:text-text">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-medium flex-1 text-center mr-6 text-text">Cart</h1>
          </header>

          <div className="flex flex-col items-center justify-center h-[60vh]">
            <svg className="w-24 h-24 text-border mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-muted text-lg mb-6">Your cart is empty</p>
            <Link
              href="/order/menu"
              className="px-6 py-3 bg-primary text-white font-medium rounded-lg"
            >
              Browse Menu
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-mobile mx-auto">
        <header className="sticky top-0 bg-card z-10 px-5 py-4 border-b border-border flex items-center">
          <Link href="/order/menu" className="text-muted hover:text-text">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-medium flex-1 text-center mr-6 text-text">Cart</h1>
        </header>

        <div className="pb-32">
          <div className="px-5 py-6 space-y-4">
            {items.map((item) => {
              const itemName = language === 'th' ? item.name_th : item.name_en

              return (
                <div key={item.id} className="bg-card border border-border rounded-lg p-4 shadow-lg shadow-black/20">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-text">{itemName}</h3>
                      {item.options && item.options.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {item.options.map((option, idx) => {
                            const groupName = language === 'th' ? option.group_name_th : option.group_name_en
                            const choiceNames = language === 'th' ? option.choice_names_th : option.choice_names_en

                            return (
                              <p key={idx} className="text-sm text-muted">
                                {groupName}: {choiceNames.join(', ')}
                                {option.price_delta_thb > 0 && (
                                  <span className="text-primary ml-1">+฿{option.price_delta_thb}</span>
                                )}
                              </p>
                            )
                          })}
                        </div>
                      )}
                      {item.note && (
                        <p className="text-sm text-muted mt-2 italic">
                          {language === 'th' ? 'หมายเหตุ' : 'Note'}: {item.note}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-muted hover:text-primary ml-4 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:border-primary transition-colors text-text"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                      <span className="font-medium w-8 text-center text-text">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:border-primary transition-colors text-text"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-lg font-medium text-primary">฿{item.final_price_thb * item.quantity}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg shadow-black/30">
          <div className="max-w-mobile mx-auto p-5">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-medium text-text">Total</span>
              <span className="text-2xl font-semibold text-primary">฿{getTotalPrice()}</span>
            </div>
            <Link
              href="/order/checkout"
              className="block w-full py-4 bg-primary text-white font-medium text-center rounded-lg hover:bg-primary/90 transition-colors"
            >
              Continue to Checkout
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}