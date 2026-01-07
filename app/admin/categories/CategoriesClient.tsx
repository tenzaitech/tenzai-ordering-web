'use client'

import { useState, useRef } from 'react'
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

type OptionGroup = {
  group_code: string
  group_name: string
}

type Schedule = {
  day_of_week: number
  start_time: string
  end_time: string
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface CategoriesClientProps {
  categories: Category[]
  initialOrder: string[]
  hiddenCategories: string[]
  optionGroups: OptionGroup[]
  categoryOptionGroups: Record<string, string[]>
  categorySchedules: Record<string, Schedule[]>
}

export default function CategoriesClient({
  categories: initialCategories,
  initialOrder,
  hiddenCategories: initialHidden,
  optionGroups,
  categoryOptionGroups: initialCategoryOptionGroups,
  categorySchedules: initialCategorySchedules
}: CategoriesClientProps) {
  const router = useRouter()
  const { t } = useLanguage()

  // Reorderable list - apply initial order
  const [orderedCategories, setOrderedCategories] = useState<Category[]>(() => {
    if (initialOrder.length === 0) return initialCategories

    // Sort by initialOrder, put unordered at end
    const orderMap = new Map(initialOrder.map((code, idx) => [code, idx]))
    return [...initialCategories].sort((a, b) => {
      const aIdx = orderMap.get(a.category_code) ?? Infinity
      const bIdx = orderMap.get(b.category_code) ?? Infinity
      return aIdx - bIdx
    })
  })

  // Track if order has changed (for Save button)
  const [hasOrderChanges, setHasOrderChanges] = useState(false)
  const [isSavingOrder, setIsSavingOrder] = useState(false)

  // Visibility state
  const [hiddenCategories, setHiddenCategories] = useState<string[]>(initialHidden)
  const [hasVisibilityChanges, setHasVisibilityChanges] = useState(false)

  // Option groups state
  const [categoryOptionGroups, setCategoryOptionGroups] = useState<Record<string, string[]>>(initialCategoryOptionGroups)
  const [editingOptionGroupsFor, setEditingOptionGroupsFor] = useState<string | null>(null)
  const [tempSelectedGroups, setTempSelectedGroups] = useState<string[]>([])

  // Schedules state
  const [categorySchedules, setCategorySchedules] = useState<Record<string, Schedule[]>>(initialCategorySchedules)
  const [editingSchedulesFor, setEditingSchedulesFor] = useState<string | null>(null)
  const [tempSchedules, setTempSchedules] = useState<Schedule[]>([])
  const [everyDayMode, setEveryDayMode] = useState(false)
  const [everyDayTime, setEveryDayTime] = useState({ start: '09:00', end: '17:00' })

  // Drag state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const dragCounter = useRef(0)

  // Other state
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

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
    // Add drag visual
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5'
    }
  }

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedIndex(null)
    setDragOverIndex(null)
    dragCounter.current = 0
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
  }

  const handleDragEnter = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    dragCounter.current++
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setDragOverIndex(null)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    setDragOverIndex(null)
    dragCounter.current = 0

    if (draggedIndex === null || draggedIndex === dropIndex) return

    const newOrder = [...orderedCategories]
    const [draggedItem] = newOrder.splice(draggedIndex, 1)
    newOrder.splice(dropIndex, 0, draggedItem)

    setOrderedCategories(newOrder)
    setHasOrderChanges(true)
    setDraggedIndex(null)
  }

  // Save order
  const handleSaveOrder = async () => {
    setIsSavingOrder(true)

    try {
      const order = orderedCategories.map(c => c.category_code)

      const res = await adminFetch('/api/admin/categories/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order })
      })

      if (res.status === 401) {
        showToast('Unauthorized (admin key missing/invalid)', 'error')
        return
      }

      if (!res.ok) {
        const errorData = await res.json()
        showToast(errorData.error || 'Failed to save order', 'error')
        return
      }

      showToast(t('changesSaved') || 'Order saved', 'success')
      setHasOrderChanges(false)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save order', 'error')
    } finally {
      setIsSavingOrder(false)
    }
  }

  // Toggle visibility
  const handleToggleVisibility = (categoryCode: string) => {
    const isCurrentlyHidden = hiddenCategories.includes(categoryCode)
    if (isCurrentlyHidden) {
      setHiddenCategories(prev => prev.filter(c => c !== categoryCode))
    } else {
      setHiddenCategories(prev => [...prev, categoryCode])
    }
    setHasVisibilityChanges(true)
  }

  // Save visibility
  const handleSaveVisibility = async () => {
    setLoadingAction('visibility')

    try {
      const res = await adminFetch('/api/admin/categories/visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: hiddenCategories })
      })

      if (res.status === 401) {
        showToast('Unauthorized (admin key missing/invalid)', 'error')
        return
      }

      if (!res.ok) {
        const errorData = await res.json()
        showToast(errorData.error || 'Failed to save visibility', 'error')
        return
      }

      showToast(t('visibilitySaved') || 'Visibility saved', 'success')
      setHasVisibilityChanges(false)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save visibility', 'error')
    } finally {
      setLoadingAction(null)
    }
  }

  // Option groups handlers
  const handleOpenOptionGroupsModal = (categoryCode: string) => {
    setEditingOptionGroupsFor(categoryCode)
    setTempSelectedGroups(categoryOptionGroups[categoryCode] || [])
  }

  const handleSaveOptionGroups = async () => {
    if (!editingOptionGroupsFor) return

    setLoadingAction(`option-groups-${editingOptionGroupsFor}`)

    try {
      const res = await adminFetch(`/api/admin/categories/${editingOptionGroupsFor}/option-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_codes: tempSelectedGroups })
      })

      if (res.status === 401) {
        showToast('Unauthorized (admin key missing/invalid)', 'error')
        return
      }

      if (!res.ok) {
        const errorData = await res.json()
        showToast(errorData.error || 'Failed to save option groups', 'error')
        return
      }

      // Update local state
      setCategoryOptionGroups(prev => ({
        ...prev,
        [editingOptionGroupsFor!]: tempSelectedGroups
      }))
      showToast('Option groups saved', 'success')
      setEditingOptionGroupsFor(null)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save option groups', 'error')
    } finally {
      setLoadingAction(null)
    }
  }

  // Schedule handlers
  const handleOpenSchedulesModal = (categoryCode: string) => {
    setEditingSchedulesFor(categoryCode)
    const schedules = categorySchedules[categoryCode] || []
    setTempSchedules(schedules)

    // Detect if it's "every day" mode (all 7 days with same time)
    const days = [...new Set(schedules.map(s => s.day_of_week))]
    if (days.length === 7 && schedules.length === 7) {
      const firstSchedule = schedules[0]
      const allSameTime = schedules.every(
        s => s.start_time === firstSchedule.start_time && s.end_time === firstSchedule.end_time
      )
      if (allSameTime) {
        setEveryDayMode(true)
        setEveryDayTime({ start: firstSchedule.start_time, end: firstSchedule.end_time })
        return
      }
    }
    setEveryDayMode(false)
    setEveryDayTime({ start: '09:00', end: '17:00' })
  }

  const handleAddSchedule = () => {
    setTempSchedules(prev => [...prev, { day_of_week: 1, start_time: '09:00', end_time: '17:00' }])
  }

  const handleRemoveSchedule = (index: number) => {
    setTempSchedules(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpdateSchedule = (index: number, field: keyof Schedule, value: string | number) => {
    setTempSchedules(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  const handleSaveSchedules = async () => {
    if (!editingSchedulesFor) return

    setLoadingAction(`schedules-${editingSchedulesFor}`)

    // If every day mode, generate schedules for all 7 days
    let schedulesToSave = tempSchedules
    if (everyDayMode) {
      schedulesToSave = [0, 1, 2, 3, 4, 5, 6].map(day => ({
        day_of_week: day,
        start_time: everyDayTime.start,
        end_time: everyDayTime.end
      }))
    }

    try {
      const res = await adminFetch(`/api/admin/categories/${editingSchedulesFor}/schedules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedules: schedulesToSave })
      })

      if (res.status === 401) {
        showToast('Unauthorized (admin key missing/invalid)', 'error')
        return
      }

      if (!res.ok) {
        const errorData = await res.json()
        showToast(errorData.error || 'Failed to save schedules', 'error')
        return
      }

      // Update local state
      setCategorySchedules(prev => ({
        ...prev,
        [editingSchedulesFor!]: schedulesToSave
      }))
      showToast('Schedules saved', 'success')
      setEditingSchedulesFor(null)
      setEveryDayMode(false)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save schedules', 'error')
    } finally {
      setLoadingAction(null)
    }
  }

  // CRUD handlers (unchanged)
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
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to create category', 'error')
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
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update category', 'error')
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
        } catch (err: unknown) {
          showToast(err instanceof Error ? err.message : 'Failed to delete category', 'error')
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
          <div className="flex gap-3">
            {hasVisibilityChanges && (
              <button
                onClick={handleSaveVisibility}
                disabled={loadingAction === 'visibility'}
                className="px-5 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingAction === 'visibility' ? t('saving') : t('saveVisibility') || 'Save Visibility'}
              </button>
            )}
            {hasOrderChanges && (
              <button
                onClick={handleSaveOrder}
                disabled={isSavingOrder}
                className="px-5 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingOrder ? 'Saving...' : 'Save Order'}
              </button>
            )}
            {!isCreating && (
              <button
                onClick={() => setIsCreating(true)}
                className="px-5 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
              >
                {t('createCategory')}
              </button>
            )}
          </div>
        </div>

        {/* Reorder instructions */}
        {orderedCategories.length > 1 && (
          <p className="text-sm text-muted mb-4">
            Drag rows to reorder. Click "Save Order" to apply changes.
          </p>
        )}

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

        {orderedCategories.length === 0 && !isCreating ? (
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
        ) : orderedCategories.length > 0 ? (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-border/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text w-12"></th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text">{t('code')}</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text">{t('name')}</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-text">{t('visible') || 'Visible'}</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text">Option Groups</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text">Schedule</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text">{t('menuItems')}</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orderedCategories.map((category, index) => (
                  <tr
                    key={category.category_code}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragEnter={(e) => handleDragEnter(e, index)}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className={`transition-colors cursor-grab active:cursor-grabbing ${
                      dragOverIndex === index ? 'bg-primary/20' : 'hover:bg-border/20'
                    } ${draggedIndex === index ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-3 text-muted">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                      </svg>
                    </td>
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
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="text-text font-medium">{category.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleVisibility(category.category_code)
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          hiddenCategories.includes(category.category_code) ? 'bg-gray-600' : 'bg-green-500'
                        }`}
                        title={hiddenCategories.includes(category.category_code) ? t('hidden') || 'Hidden' : t('visible') || 'Visible'}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            hiddenCategories.includes(category.category_code) ? 'translate-x-1' : 'translate-x-6'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenOptionGroupsModal(category.category_code)
                        }}
                        className="text-left"
                      >
                        {(categoryOptionGroups[category.category_code]?.length || 0) > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {categoryOptionGroups[category.category_code].slice(0, 2).map(groupCode => {
                              const group = optionGroups.find(g => g.group_code === groupCode)
                              return (
                                <span key={groupCode} className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                  {group?.group_name || groupCode}
                                </span>
                              )
                            })}
                            {categoryOptionGroups[category.category_code].length > 2 && (
                              <span className="text-xs text-muted">+{categoryOptionGroups[category.category_code].length - 2}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted hover:text-primary">+ Add</span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOpenSchedulesModal(category.category_code)
                        }}
                        className="text-left"
                      >
                        {(categorySchedules[category.category_code]?.length || 0) > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {(() => {
                              const schedules = categorySchedules[category.category_code]
                              const days = [...new Set(schedules.map(s => s.day_of_week))].sort()
                              return (
                                <span className="text-xs text-teal-400">
                                  {days.map(d => DAY_NAMES[d]).join(', ')}
                                </span>
                              )
                            })()}
                          </div>
                        ) : (
                          <span className="text-xs text-muted hover:text-primary">Always</span>
                        )}
                      </button>
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
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSaveEdit(category.category_code)
                            }}
                            disabled={loadingAction === `edit-${category.category_code}`}
                            className="text-green-400 hover:text-green-300 text-sm font-medium disabled:opacity-50"
                          >
                            {loadingAction === `edit-${category.category_code}` ? t('saving') : t('save')}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
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
                            onClick={(e) => {
                              e.stopPropagation()
                              handleEdit(category)
                            }}
                            disabled={loadingAction !== null}
                            className="text-primary hover:text-primary/80 text-sm font-medium disabled:opacity-50"
                          >
                            {t('rename')}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(category.category_code, category.name, category.menu_items_count)
                            }}
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

        {/* Option Groups Modal */}
        {editingOptionGroupsFor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setEditingOptionGroupsFor(null)}>
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-text mb-4">
                Option Groups for &quot;{orderedCategories.find(c => c.category_code === editingOptionGroupsFor)?.name}&quot;
              </h3>
              <p className="text-sm text-muted mb-4">
                These option groups will be inherited by all menu items in this category.
              </p>
              <div className="max-h-60 overflow-y-auto space-y-2 mb-4">
                {optionGroups.length === 0 ? (
                  <p className="text-sm text-muted">No option groups available. <a href="/admin/option-groups" className="text-primary hover:underline">Create one first</a>.</p>
                ) : (
                  optionGroups.map(group => (
                    <label
                      key={group.group_code}
                      className="flex items-center p-2 bg-bg border border-border rounded-lg cursor-pointer hover:border-primary/30 transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={tempSelectedGroups.includes(group.group_code)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTempSelectedGroups(prev => [...prev, group.group_code])
                          } else {
                            setTempSelectedGroups(prev => prev.filter(g => g !== group.group_code))
                          }
                        }}
                        className="w-4 h-4 accent-primary focus:ring-primary mr-3"
                      />
                      <span className="text-sm text-text">{group.group_name}</span>
                    </label>
                  ))
                )}
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setEditingOptionGroupsFor(null)}
                  className="px-4 py-2 bg-border text-text font-medium rounded-lg hover:bg-border/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveOptionGroups}
                  disabled={loadingAction === `option-groups-${editingOptionGroupsFor}`}
                  className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {loadingAction === `option-groups-${editingOptionGroupsFor}` ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Schedules Modal */}
        {editingSchedulesFor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => { setEditingSchedulesFor(null); setEveryDayMode(false) }}>
            <div className="bg-card border border-border rounded-lg p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-text mb-2">
                Schedule for &quot;{orderedCategories.find(c => c.category_code === editingSchedulesFor)?.name}&quot;
              </h3>
              <p className="text-sm text-muted mb-4">
                Set time windows when this category is visible. Leave empty for always visible.
              </p>

              {/* Every Day Toggle */}
              <label className="flex items-center gap-3 p-3 bg-bg border border-border rounded-lg mb-4 cursor-pointer hover:border-primary/30 transition-colors">
                <input
                  type="checkbox"
                  checked={everyDayMode}
                  onChange={(e) => {
                    setEveryDayMode(e.target.checked)
                    if (e.target.checked) {
                      // Clear individual schedules when switching to every day
                      setTempSchedules([])
                    }
                  }}
                  className="w-4 h-4 accent-primary"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-text">Every day (same time)</span>
                  <p className="text-xs text-muted">Apply the same schedule to all 7 days</p>
                </div>
              </label>

              {everyDayMode ? (
                /* Every day time inputs */
                <div className="flex items-center gap-2 p-3 bg-teal-500/10 border border-teal-500/30 rounded-lg mb-4">
                  <span className="text-sm text-teal-400 font-medium">All days:</span>
                  <input
                    type="time"
                    value={everyDayTime.start}
                    onChange={(e) => setEveryDayTime(prev => ({ ...prev, start: e.target.value }))}
                    className="px-2 py-1 bg-bg border border-border rounded text-text text-sm"
                  />
                  <span className="text-muted">to</span>
                  <input
                    type="time"
                    value={everyDayTime.end}
                    onChange={(e) => setEveryDayTime(prev => ({ ...prev, end: e.target.value }))}
                    className="px-2 py-1 bg-bg border border-border rounded text-text text-sm"
                  />
                </div>
              ) : (
                /* Individual day schedules */
                <>
                  <div className="max-h-60 overflow-y-auto space-y-3 mb-4">
                    {tempSchedules.length === 0 ? (
                      <p className="text-sm text-muted text-center py-4">No schedules - category is always visible</p>
                    ) : (
                      tempSchedules.map((schedule, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-bg border border-border rounded-lg">
                          <select
                            value={schedule.day_of_week}
                            onChange={(e) => handleUpdateSchedule(index, 'day_of_week', parseInt(e.target.value))}
                            className="px-2 py-1 bg-bg border border-border rounded text-text text-sm"
                          >
                            {DAY_NAMES.map((name, i) => (
                              <option key={i} value={i}>{name}</option>
                            ))}
                          </select>
                          <input
                            type="time"
                            value={schedule.start_time}
                            onChange={(e) => handleUpdateSchedule(index, 'start_time', e.target.value)}
                            className="px-2 py-1 bg-bg border border-border rounded text-text text-sm"
                          />
                          <span className="text-muted">to</span>
                          <input
                            type="time"
                            value={schedule.end_time}
                            onChange={(e) => handleUpdateSchedule(index, 'end_time', e.target.value)}
                            className="px-2 py-1 bg-bg border border-border rounded text-text text-sm"
                          />
                          <button
                            onClick={() => handleRemoveSchedule(index)}
                            className="text-red-400 hover:text-red-300 p-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <button
                    onClick={handleAddSchedule}
                    className="w-full mb-4 py-2 border border-dashed border-border text-muted hover:text-text hover:border-primary/30 rounded-lg text-sm transition-colors"
                  >
                    + Add Time Window
                  </button>
                </>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => { setEditingSchedulesFor(null); setEveryDayMode(false) }}
                  className="px-4 py-2 bg-border text-text font-medium rounded-lg hover:bg-border/80 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSchedules}
                  disabled={loadingAction === `schedules-${editingSchedulesFor}`}
                  className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {loadingAction === `schedules-${editingSchedulesFor}` ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
