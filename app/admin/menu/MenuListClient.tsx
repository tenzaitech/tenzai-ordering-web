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
  promo_price: number | null
  promo_label: string | null
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
  popularMenus: string[]
  menuCategoryMap: Record<string, string[]>
}

export default function MenuListClient({ categories, menuItems, popularMenus: initialPopular, menuCategoryMap }: MenuListClientProps) {
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
  const [openCategoryDropdown, setOpenCategoryDropdown] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 50
  const [popularMenus, setPopularMenus] = useState<string[]>(initialPopular)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

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

  const handleTogglePopular = async (menuCode: string) => {
    const isCurrentlyPopular = popularMenus.includes(menuCode)
    const newPopular = isCurrentlyPopular
      ? popularMenus.filter(code => code !== menuCode)
      : [...popularMenus, menuCode]

    // Optimistic update
    setPopularMenus(newPopular)
    setLoadingAction(`popular-${menuCode}`)

    try {
      const res = await adminFetch('/api/admin/menu/popular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menu_codes: newPopular })
      })

      if (!res.ok) {
        // Revert on failure
        setPopularMenus(popularMenus)
        showToast('Failed to update popular status', 'error')
        return
      }

      showToast(isCurrentlyPopular ? t('removedFromPopular') : t('addedToPopular'), 'success')
    } catch {
      setPopularMenus(popularMenus)
      showToast('Failed to update popular status', 'error')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleChangeCategory = async (menuCode: string, newCategoryCode: string) => {
    setLoadingAction(`category-${menuCode}`)
    setOpenDropdown(null)
    setOpenCategoryDropdown(null)

    try {
      const res = await adminFetch(`/api/admin/menu/${menuCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_code: newCategoryCode })
      })

      if (res.status === 401) {
        showToast('Unauthorized (admin key missing/invalid)', 'error')
        return
      }

      if (!res.ok) {
        const error = await res.json()
        showToast(error.error || 'Failed to change category', 'error')
        return
      }

      showToast(t('categoryChanged'), 'success')
      router.refresh()
    } catch {
      showToast('Failed to change category', 'error')
    } finally {
      setLoadingAction(null)
    }
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
                    <th className="px-2 py-3 text-center text-sm font-semibold text-text w-10" title={t('popular')}>
                      <svg className="w-4 h-4 mx-auto text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                    </th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-text">{t('image')}</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-text">{t('nameTh')}</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-text">{t('category')}</th>
                    <th className="px-3 py-3 text-left text-sm font-semibold text-text">{t('price')}</th>
                    <th className="px-3 py-3 text-center text-sm font-semibold text-text">{t('status')}</th>
                    <th className="px-3 py-3 text-center text-sm font-semibold text-text w-12 sticky right-0 bg-border/50"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedItems.map((item, rowIndex) => {
                    const isPopular = popularMenus.includes(item.menu_code)
                    // Open dropdown downward for first 2 rows, upward for rest
                    const openDownward = rowIndex < 2
                    return (
                    <tr key={item.menu_code} className="hover:bg-border/20 transition-colors">
                      {/* Popular star */}
                      <td className="px-2 py-3 text-center">
                        <button
                          onClick={() => handleTogglePopular(item.menu_code)}
                          disabled={loadingAction === `popular-${item.menu_code}`}
                          className={`p-1 rounded transition-colors disabled:opacity-50 ${
                            isPopular ? 'text-yellow-500 hover:text-yellow-400' : 'text-muted hover:text-yellow-500'
                          }`}
                          title={isPopular ? t('removedFromPopular') : t('addedToPopular')}
                        >
                          <svg className="w-5 h-5" fill={isPopular ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                          </svg>
                        </button>
                      </td>
                      {/* Image */}
                      <td className="px-3 py-3">
                        {item.image_url ? (
                          <button
                            onClick={() => setPreviewImage(item.image_url)}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                          >
                            <img src={item.image_url} alt={item.name_th} className="w-20 h-20 object-cover rounded" />
                          </button>
                        ) : (
                          <div className="w-20 h-20 bg-border rounded flex items-center justify-center text-muted text-xs">
                            -
                          </div>
                        )}
                      </td>
                      {/* Name */}
                      <td className="px-3 py-3">
                        <div className="text-sm text-text font-medium">{item.name_th}</div>
                        <div className="text-xs text-muted">{item.menu_code}</div>
                      </td>
                      {/* Category badges - clickable dropdown */}
                      <td className="px-3 py-3 relative">
                        <button
                          onClick={() => setOpenCategoryDropdown(openCategoryDropdown === item.menu_code ? null : item.menu_code)}
                          disabled={loadingAction === `category-${item.menu_code}`}
                          className="flex items-center gap-1 group cursor-pointer disabled:opacity-50"
                        >
                          <div className="flex flex-wrap gap-1">
                            {(menuCategoryMap[item.menu_code]?.length > 0
                              ? menuCategoryMap[item.menu_code]
                              : [item.category_code]
                            ).map((catCode, idx) => (
                              <span
                                key={catCode}
                                className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                                  idx === 0
                                    ? 'bg-primary/10 text-primary border border-primary/20'
                                    : 'bg-border text-muted'
                                }`}
                              >
                                {categoryMap.get(catCode) || catCode}
                              </span>
                            ))}
                          </div>
                          <svg className="w-3 h-3 text-muted group-hover:text-text transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {/* Inline category dropdown */}
                        {openCategoryDropdown === item.menu_code && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenCategoryDropdown(null)} />
                            <div className="absolute left-0 mt-1 w-48 bg-card border border-border rounded-lg shadow-lg z-20 overflow-hidden">
                              <div className="px-3 py-2 text-xs text-muted border-b border-border">{t('changeCategory')}</div>
                              <div className="max-h-48 overflow-y-auto">
                                {categories.map(cat => {
                                  const isCurrentPrimary = item.category_code === cat.category_code
                                  return (
                                    <button
                                      key={cat.category_code}
                                      onClick={() => handleChangeCategory(item.menu_code, cat.category_code)}
                                      disabled={loadingAction === `category-${item.menu_code}` || isCurrentPrimary}
                                      className={`w-full text-left px-3 py-2 text-sm transition-colors disabled:opacity-50 ${
                                        isCurrentPrimary
                                          ? 'bg-primary/10 text-primary'
                                          : 'text-text hover:bg-border'
                                      }`}
                                    >
                                      {cat.name}
                                      {isCurrentPrimary && <span className="ml-2 text-xs text-muted">(current)</span>}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          </>
                        )}
                      </td>
                      {/* Price */}
                      <td className="px-3 py-3 text-sm">
                        {item.promo_price && item.promo_price < item.price ? (
                          <div className="flex flex-col">
                            <span className="text-muted line-through text-xs">฿{item.price}</span>
                            <span className="text-orange-400 font-bold">฿{item.promo_price}</span>
                            {item.promo_label && (
                              <span className="text-xs text-orange-500 bg-orange-500/10 px-1 rounded mt-0.5 inline-block w-fit">{item.promo_label}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-text font-medium">฿{item.price}</span>
                        )}
                      </td>
                      {/* Active toggle */}
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => handleToggleActive(item.menu_code, item.is_active)}
                          disabled={loadingAction === `toggle-${item.menu_code}`}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
                            item.is_active ? 'bg-green-500' : 'bg-gray-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              item.is_active ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </td>
                      {/* Actions dropdown */}
                      <td className="px-3 py-3 text-center relative">
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
                            <div className="fixed inset-0 z-30" onClick={() => setOpenDropdown(null)} />
                            <div className={`absolute right-0 w-40 bg-card border border-border rounded-lg shadow-lg z-40 overflow-hidden ${
                              openDownward ? 'top-full mt-1' : 'bottom-full mb-1'
                            }`}>
                              <Link
                                href={`/admin/menu/${item.menu_code}`}
                                className="block px-4 py-2.5 text-sm text-text hover:bg-border transition-colors"
                                onClick={() => setOpenDropdown(null)}
                              >
                                {t('edit')}
                              </Link>
                              <div className="border-t border-border">
                                <button
                                  onClick={() => handleDelete(item.menu_code, item.name_th)}
                                  disabled={loadingAction === `delete-${item.menu_code}`}
                                  className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-border transition-colors disabled:opacity-50"
                                >
                                  {loadingAction === `delete-${item.menu_code}` ? t('deleting') : t('delete')}
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  )})}
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

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewImage(null)}
          onKeyDown={(e) => e.key === 'Escape' && setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
              aria-label="Close preview"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  )
}
