import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { CartProvider } from '@/contexts/CartContext'
import { LanguageProvider } from '@/contexts/LanguageContext'
import { CheckoutProvider } from '@/contexts/CheckoutContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'TENZAI SUSHI - Order Online',
  description: 'Fresh sushi delivered to your door',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <CartProvider>
          <CheckoutProvider>
            {children}
          </CheckoutProvider>
        </CartProvider>
      </body>
    </html>
  )
}