'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/admin-fetch'
import Toast from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useLanguage } from '@/contexts/LanguageContext'

type Category = {
  category_code: string
  name: string
  menu_items_count: number
}

interface CategoriesClientProps {
  categories: Category[]
}

export default function CategoriesClient({ categories }: CategoriesClientProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const [isCreating, setIsCreating] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  } | null>(null)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
  }

  const handleCreate = async () => {
    if (!newCategoryName.trim()) {
      showToast(t('categoryNameRequired'), 'error')
      return
    }

    setLoadingAction('create')

    try {
      const res = await adminFetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() })
      })

      if (res.status === 401) {
        showToast('Unauthorized (admin key missing/invalid)', 'error')
        return
      }

      if (res.status === 409) {
        showToast('Category already exists', 'error')
        return
      }

      if (!res.ok) {
        const errorData = await res.json()
        showToast(errorData.error || 'Failed to create category', 'error')
        return
      }

      showToast(t('categoryCreated'), 'success')
      setNewCategoryName('')
      setIsCreating(false)
      router.refresh()
    } catch (err: any) {
      showToast(err.message || 'Failed to create category', 'error')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleEdit = (category: Category) => {
    setEditingCode(category.category_code)
    setEditingName(category.name)
  }

  const handleSaveEdit = async (categoryCode: string) => {
    if (!editingName.trim()) {
      showToast(t('categoryNameRequired'), 'error')
      return
    }

    setLoadingAction(`edit-${categoryCode}`)

    try {
      const res = await adminFetch(`/api/admin/categories/${categoryCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName.trim() })
      })

      if (res.status === 401) {
        showToast('Unauthorized (admin key missing/invalid)', 'error')
        return
      }

      if (!res.ok) {
        const errorData = await res.json()
        showToast(errorData.error || 'Failed to update category', 'error')
        return
      }

      showToast(t('categoryUpdated'), 'success')
      setEditingCode(null)
      setEditingName('')
      router.refresh()
    } catch (err: any) {
      showToast(err.message || 'Failed to update category', 'error')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleDelete = async (categoryCode: string, categoryName: string, menuItemsCount: number) => {
    if (menuItemsCount > 0) {
      showToast(`${t('cannotDeleteCategory')} ${menuItemsCount} menu item(s) are using this category. Please reassign or delete the menu items first.`, 'error')
      return
    }

    setConfirmDialog({
      isOpen: true,
      title: t('deleteCategory'),
      message: `${t('confirmDeleteMenu')} "${categoryName}"? ${t('actionCannotBeUndone')}.`,
      onConfirm: async () => {
        setConfirmDialog(null)
        setLoadingAction(`delete-${categoryCode}`)

        try {
          const res = await adminFetch(`/api/admin/categories/${categoryCode}`, {
            method: 'DELETE'
          })

          if (res.status === 401) {
            showToast('Unauthorized (admin key missing/invalid)', 'error')
            return
          }

          if (res.status === 409) {
            const errorData = await res.json()
            showToast(errorData.error || 'Cannot delete category with menu items', 'error')
            return
          }

          if (!res.ok) {
            const errorData = await res.json()
            showToast(errorData.error || 'Failed to delete category', 'error')
            return
          }

          showToast(t('categoryDeleted'), 'success')
          router.refresh()
        } catch (err: any) {
          showToast(err.message || 'Failed to delete category', 'error')
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

      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-text">{t('categoryManagement')}</h1>
          {!isCreating && (
            <button
              onClick={() => setIsCreating(true)}
              className="px-5 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              {t('createCategory')}
            </button>
          )}
        </div>

        {isCreating && (
          <div className="bg-card border border-border rounded-lg p-5 mb-6">
            <h2 className="text-lg font-semibold text-text mb-4">{t('createNewCategory')}</h2>
            <div className="flex gap-3">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder={t('enterCategoryName')}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate()
                  if (e.key === 'Escape') {
                    setIsCreating(false)
                    setNewCategoryName('')
                  }
                }}
                className="flex-1 px-4 py-2 bg-bg border border-border rounded-lg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <button
                onClick={handleCreate}
                disabled={loadingAction === 'create'}
                className="px-5 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingAction === 'create' ? t('creating') : t('create')}
              </button>
              <button
                onClick={() => {
                  setIsCreating(false)
                  setNewCategoryName('')
                }}
                className="px-5 py-2 bg-border text-text font-medium rounded-lg hover:bg-border/80 transition-colors"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        )}

        {categories.length === 0 && !isCreating ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <div className="text-muted mb-4">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <p className="text-lg font-medium">{t('noCategoriesFound')}</p>
              <p className="text-sm mt-2">{t('getStartedByCreatingCategory')}</p>
            </div>
            <button
              onClick={() => setIsCreating(true)}
              className="inline-block px-5 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              {t('createFirstCategory')}
            </button>
          </div>
        ) : categories.length > 0 ? (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-border/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text">{t('code')}</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text">{t('name')}</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text">{t('menuItems')}</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categories.map(category => (
                  <tr key={category.category_code} className="hover:bg-border/20 transition-colors">
                    <td className="px-4 py-3 text-sm text-muted">{category.category_code}</td>
                    <td className="px-4 py-3">
                      {editingCode === category.category_code ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(category.category_code)
                            if (e.key === 'Escape') {
                              setEditingCode(null)
                              setEditingName('')
                            }
                          }}
                          className="px-3 py-1 bg-bg border border-border rounded text-text focus:outline-none focus:ring-2 focus:ring-primary"
                          autoFocus
                        />
                      ) : (
                        <span className="text-text font-medium">{category.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm ${category.menu_items_count > 0 ? 'text-text font-medium' : 'text-muted'}`}>
                        {category.menu_items_count}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {editingCode === category.category_code ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveEdit(category.category_code)}
                            disabled={loadingAction === `edit-${category.category_code}`}
                            className="text-green-400 hover:text-green-300 text-sm font-medium disabled:opacity-50"
                          >
                            {loadingAction === `edit-${category.category_code}` ? t('saving') : t('save')}
                          </button>
                          <button
                            onClick={() => {
                              setEditingCode(null)
                              setEditingName('')
                            }}
                            className="text-muted hover:text-text text-sm font-medium"
                          >
                            {t('cancel')}
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleEdit(category)}
                            disabled={loadingAction !== null}
                            className="text-primary hover:text-primary/80 text-sm font-medium disabled:opacity-50"
                          >
                            {t('rename')}
                          </button>
                          <button
                            onClick={() => handleDelete(category.category_code, category.name, category.menu_items_count)}
                            disabled={loadingAction === `delete-${category.category_code}`}
                            className="text-red-400 hover:text-red-300 text-sm font-medium disabled:opacity-50"
                          >
                            {loadingAction === `delete-${category.category_code}` ? t('deleting') : t('delete')}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  )
}
