'use client'

import Link from 'next/link'
import { useLanguage } from '@/contexts/LanguageContext'

const adminSections = [
  {
    href: '/admin/orders',
    titleKey: 'orders',
    descKey: 'ordersDesc',
    primary: true
  },
  {
    href: '/admin/menu',
    titleKey: 'menu',
    descKey: 'menuDesc'
  },
  {
    href: '/admin/categories',
    titleKey: 'categories',
    descKey: 'categoriesDesc'
  },
  {
    href: '/admin/option-groups',
    titleKey: 'options',
    descKey: 'optionsDesc'
  },
  {
    href: '/admin/menu-data',
    titleKey: 'importExport',
    descKey: 'importExportDesc'
  }
]

export default function AdminDashboard() {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-bg-root">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-text-primary mb-2">{t('operations')}</h1>
          <p className="text-text-secondary">{t('restaurantManagement')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {adminSections.map(section => (
            <Link
              key={section.href}
              href={section.href}
              className="block group"
            >
              <div className={`h-full px-6 py-5 bg-bg-surface border border-border-subtle rounded-lg ${
                section.primary ? 'ring-1 ring-accent/20' : ''
              }`}>
                <h2 className={`text-lg font-semibold mb-1 ${
                  section.primary ? 'text-accent' : 'text-text-primary'
                }`}>
                  {t(section.titleKey as any)}
                </h2>
                <p className="text-sm text-text-secondary">
                  {t(section.descKey as any)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
