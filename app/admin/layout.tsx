'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext'

const navItems = [
  { href: '/admin', labelKey: 'dashboard' },
  { href: '/admin/orders', labelKey: 'orders' },
  { href: '/admin/menu', labelKey: 'menu' },
  { href: '/admin/categories', labelKey: 'categories' },
  { href: '/admin/option-groups', labelKey: 'options' }
]

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { theme, toggleTheme, mounted } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const isDev = process.env.NODE_ENV !== 'production'

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin'
    }
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-bg-root">
      {/* Mobile Header */}
      <header className="lg:hidden sticky top-0 z-50 bg-bg-surface border-b border-border-subtle">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Admin</h1>
            {isDev && <span className="text-xs text-text-muted">Development</span>}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 mr-1">
              <button
                onClick={() => setLanguage('th')}
                className={`px-2 py-1 text-xs font-medium ${
                  language === 'th' ? 'text-accent' : 'text-text-secondary'
                }`}
              >
                TH
              </button>
              <span className="text-border-subtle text-xs">|</span>
              <button
                onClick={() => setLanguage('en')}
                className={`px-2 py-1 text-xs font-medium ${
                  language === 'en' ? 'text-accent' : 'text-text-secondary'
                }`}
              >
                EN
              </button>
            </div>
            {mounted && (
              <button
                onClick={toggleTheme}
                className="p-2 text-text-secondary hover:bg-bg-elevated rounded"
                aria-label="Toggle theme"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {theme === 'dark' ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  )}
                </svg>
              </button>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-text-primary hover:bg-bg-elevated rounded"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <nav className="border-t border-border-subtle">
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-4 py-3 text-sm font-medium border-b border-border-subtle ${
                  isActive(item.href)
                    ? 'bg-accent-soft text-accent'
                    : 'text-text-primary hover:bg-bg-elevated'
                }`}
              >
                {t(item.labelKey as any)}
              </Link>
            ))}
          </nav>
        )}
      </header>

      <div className="lg:flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-56 min-h-screen bg-bg-surface border-r border-border-subtle sticky top-0">
          <div className="px-5 py-6 border-b border-border-subtle">
            <div className="flex items-center justify-between mb-1">
              <h1 className="text-xl font-bold text-text-primary">TENZAI</h1>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setLanguage('th')}
                    className={`px-2 py-1 text-xs font-medium ${
                      language === 'th' ? 'text-accent' : 'text-text-secondary'
                    }`}
                  >
                    TH
                  </button>
                  <span className="text-border-subtle text-xs">|</span>
                  <button
                    onClick={() => setLanguage('en')}
                    className={`px-2 py-1 text-xs font-medium ${
                      language === 'en' ? 'text-accent' : 'text-text-secondary'
                    }`}
                  >
                    EN
                  </button>
                </div>
                {mounted && (
                  <button
                    onClick={toggleTheme}
                    className="p-1.5 text-text-secondary hover:bg-bg-elevated rounded"
                    aria-label="Toggle theme"
                    title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {theme === 'dark' ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                      )}
                    </svg>
                  </button>
                )}
              </div>
            </div>
            {isDev && <span className="text-xs text-text-muted">Development</span>}
          </div>
          <nav className="px-3 pt-4">
            {navItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2 mb-1 rounded text-sm font-medium ${
                  isActive(item.href)
                    ? 'bg-accent-soft text-accent'
                    : 'text-text-primary hover:bg-bg-elevated'
                }`}
              >
                {t(item.labelKey as any)}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider scope="admin">
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </LanguageProvider>
  )
}
