'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin-fetch'
import Toast from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useLanguage } from '@/contexts/LanguageContext'

type MenuItem = {
  menu_code: string
  category_code: string
  name_th: string
  name_en: string | null
  price: number
  image_url: string | null
  is_active: boolean
  updated_at: string
}

type Category = {
  category_code: string
  name: string
}

interface MenuListClientProps {
  categories: Category[]
  menuItems: MenuItem[]
}

export default function MenuListClient({ categories, menuItems }: MenuListClientProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  } | null>(null)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 50

  const categoryMap = new Map(categories.map(cat => [cat.category_code, cat.name]))

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = searchQuery.trim() === '' ||
      item.name_th.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name_en?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.menu_code.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCategory = categoryFilter === 'all' || item.category_code === categoryFilter

    return matchesSearch && matchesCategory
  })

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / pageSize)
  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setCurrentPage(1)
  }

  const handleCategoryChange = (value: string) => {
    setCategoryFilter(value)
    setCurrentPage(1)
  }

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
  }

  const handleToggleActive = async (menuCode: string, currentStatus: boolean) => {
    setLoadingAction(`toggle-${menuCode}`)
    setOpenDropdown(null)
    try {
      const res = await adminFetch(`/api/admin/menu/${menuCode}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus })
      })

      if (res.status === 401) {
        showToast('Unauthorized (admin key missing/invalid)', 'error')
        return
      }

      if (!res.ok) {
        const error = await res.json()
        showToast(error.error || 'Failed to toggle status', 'error')
        return
      }

      showToast(!currentStatus ? t('menuActivated') : t('menuDeactivated'), 'success')
      router.refresh()
    } catch (error) {
      showToast('Failed to toggle active status', 'error')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleDelete = async (menuCode: string, menuName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: t('deleteMenuItem'),
      message: `${t('confirmDeleteMenu')} "${menuName}"? ${t('actionCannotBeUndone')}.`,
      onConfirm: async () => {
        setConfirmDialog(null)
        setLoadingAction(`delete-${menuCode}`)
        setOpenDropdown(null)
        try {
          const res = await adminFetch(`/api/admin/menu/${menuCode}`, {
            method: 'DELETE'
          })

          if (res.status === 401) {
            showToast('Unauthorized (admin key missing/invalid)', 'error')
            return
          }

          if (!res.ok) {
            const error = await res.json()
            showToast(error.error || 'Failed to delete menu item', 'error')
            return
          }

          showToast(t('menuItemDeleted'), 'success')
          router.refresh()
        } catch (error) {
          showToast('Failed to delete menu item', 'error')
        } finally {
          setLoadingAction(null)
        }
      }
    })
  }

  return (
    <div className="min-h-screen bg-bg pb-20">
      {toast && (
        <Toast
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel="Delete"
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
          isDestructive
        />
      )}

      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-text">{t('menuManagement')}</h1>
          <Link
            href="/admin/menu/new"
            className="px-5 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            {t('createNewItem')}
          </Link>
        </div>

        <div className="bg-card border border-border rounded-lg p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text mb-2">{t('search')}</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={t('searchByNameOrCode')}
                className="w-full px-4 py-2 bg-bg border border-border rounded-lg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-2">{t('category')}</label>
              <select
                value={categoryFilter}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-4 py-2 bg-bg border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">{t('allCategories')}</option>
                {categories.map(cat => (
                  <option key={cat.category_code} value={cat.category_code}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <div className="text-muted mb-4">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-medium">{t('noMenuItemsFound')}</p>
              <p className="text-sm mt-2">
                {searchQuery || categoryFilter !== 'all'
                  ? t('tryAdjustingFilters')
                  : t('getStartedByCreating')}
              </p>
            </div>
            {!searchQuery && categoryFilter === 'all' && (
              <Link
                href="/admin/menu/new"
                className="inline-block px-5 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                {t('createFirstMenuItem')}
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-border/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-text">{t('image')}</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-text">{t('code')}</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-text">{t('nameTh')}</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-text">{t('nameEn')}</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-text">{t('category')}</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-text">{t('price')}</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-text">{t('status')}</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-text">{t('updated')}</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-text w-16 sticky right-0 bg-border/50"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedItems.map(item => (
                    <tr key={item.menu_code} className="hover:bg-border/20 transition-colors">
                      <td className="px-4 py-3">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name_th} className="w-12 h-12 object-cover rounded" />
                        ) : (
                          <div className="w-12 h-12 bg-border rounded flex items-center justify-center text-muted text-xs">
                            {t('noImage')}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">{item.menu_code}</td>
                      <td className="px-4 py-3 text-sm text-text font-medium">{item.name_th}</td>
                      <td className="px-4 py-3 text-sm text-muted">{item.name_en || '-'}</td>
                      <td className="px-4 py-3 text-sm text-muted">{categoryMap.get(item.category_code) || '-'}</td>
                      <td className="px-4 py-3 text-sm text-text font-medium">฿{item.price}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                            item.is_active
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {item.is_active ? t('active') : t('inactive')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">
                        {new Date(item.updated_at).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-3 text-center relative sticky right-0 bg-card">
                        <button
                          onClick={() => setOpenDropdown(openDropdown === item.menu_code ? null : item.menu_code)}
                          disabled={loadingAction !== null}
                          className="p-1 text-muted hover:text-text transition-colors disabled:opacity-50"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                          </svg>
                        </button>

                        {openDropdown === item.menu_code && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                            <div className="absolute right-0 mt-1 w-40 bg-card border border-border rounded-lg shadow-lg z-20 overflow-hidden">
                              <Link
                                href={`/admin/menu/${item.menu_code}`}
                                className="block px-4 py-2 text-sm text-text hover:bg-border transition-colors"
                                onClick={() => setOpenDropdown(null)}
                              >
                                {t('edit')}
                              </Link>
                              <button
                                onClick={() => handleToggleActive(item.menu_code, item.is_active)}
                                disabled={loadingAction === `toggle-${item.menu_code}`}
                                className="w-full text-left px-4 py-2 text-sm text-text hover:bg-border transition-colors disabled:opacity-50"
                              >
                                {loadingAction === `toggle-${item.menu_code}`
                                  ? t('updating')
                                  : item.is_active ? t('setInactive') : t('setActive')}
                              </button>
                              <button
                                onClick={() => handleDelete(item.menu_code, item.name_th)}
                                disabled={loadingAction === `delete-${item.menu_code}`}
                                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-border transition-colors disabled:opacity-50"
                              >
                                {loadingAction === `delete-${item.menu_code}` ? t('deleting') : t('delete')}
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-muted">
              Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, filteredItems.length)} of {filteredItems.length}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-card border border-border text-text rounded-lg hover:bg-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="px-4 py-2 bg-primary/10 text-primary rounded-lg font-medium">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-card border border-border text-text rounded-lg hover:bg-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
