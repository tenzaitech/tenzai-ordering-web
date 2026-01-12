'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ImageUploaderWithCrop from '@/components/ImageUploaderWithCrop'
import Toast from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'
import { generateCode } from '@/lib/menu-import-validator'
import { adminFetch } from '@/lib/admin-fetch'
import { normalizeToastMessage } from '@/lib/toast-helpers'

type MenuItem = {
  menu_code: string
  category_code: string
  name_th: string
  name_en: string | null
  barcode: string | null
  description: string | null
  price: number
  promo_price: number | null
  promo_label: string | null
  promo_percent: number | null
  image_url: string | null
  is_active: boolean
}

type Category = {
  category_code: string
  name: string
}

type OptionGroup = {
  group_code: string
  group_name: string
}

interface MenuEditClientProps {
  menuItem: MenuItem | null
  categories: Category[]
  optionGroups: OptionGroup[]
  selectedOptionGroups: string[]
  selectedCategories: string[]
}

export default function MenuEditClient({ menuItem, categories, optionGroups, selectedOptionGroups, selectedCategories: initialSelectedCategories }: MenuEditClientProps) {
  const router = useRouter()
  const isCreateMode = !menuItem

  const [formData, setFormData] = useState({
    menu_code: menuItem?.menu_code || '',
    name_th: menuItem?.name_th || '',
    name_en: menuItem?.name_en || '',
    price: menuItem?.price?.toString() || '',
    promo_price: menuItem?.promo_price?.toString() || '',
    promo_label: menuItem?.promo_label || '',
    promo_percent: menuItem?.promo_percent?.toString() || '',
    barcode: menuItem?.barcode || '',
    description: menuItem?.description || '',
    image_url: menuItem?.image_url || '',
    is_active: menuItem?.is_active ?? true
  })

  const [selectedCategoryCodes, setSelectedCategoryCodes] = useState<string[]>(
    initialSelectedCategories.length > 0 ? initialSelectedCategories : (categories[0]?.category_code ? [categories[0].category_code] : [])
  )
  const [optionGroupIds, setOptionGroupIds] = useState<string[]>(selectedOptionGroups)
  const [isSaving, setIsSaving] = useState(false)
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const handleImageChange = (url: string | null) => {
    setFormData(prev => ({ ...prev, image_url: url || '' }))
  }

  const handleDelete = () => {
    if (!menuItem) return

    setConfirmDialog({
      isOpen: true,
      title: 'Delete Menu Item',
      message: `Are you sure you want to delete "${menuItem.name_th}"? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmDialog(null)
        setIsSaving(true)

        try {
          const res = await adminFetch(`/api/admin/menu/${menuItem.menu_code}`, {
            method: 'DELETE'
          })

          if (res.status === 401) {
            showToast('Unauthorized (admin key missing/invalid)', 'error')
            return
          }

          if (!res.ok) {
            const errorData = await res.json().catch(() => null)
            showToast(normalizeToastMessage(errorData?.error ?? errorData) || 'Failed to delete menu item', 'error')
            return
          }

          showToast('Menu item deleted successfully', 'success')
          setTimeout(() => {
            router.push('/admin/menu')
          }, 1000)
        } catch (err: any) {
          showToast(err.message || 'Failed to delete menu item', 'error')
        } finally {
          setIsSaving(false)
        }
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name_th.trim()) {
      showToast('Name (Thai) is required', 'error')
      return
    }

    if (selectedCategoryCodes.length === 0) {
      showToast('At least one category is required', 'error')
      return
    }

    const priceNum = parseInt(formData.price, 10)
    if (isNaN(priceNum) || priceNum < 0 || !/^[0-9]+$/.test(formData.price.trim())) {
      showToast('Price must be a valid integer (no decimals)', 'error')
      return
    }

    // Validate promo_price if provided
    let promoPriceNum: number | null = null
    if (formData.promo_price.trim()) {
      promoPriceNum = parseInt(formData.promo_price, 10)
      if (isNaN(promoPriceNum) || promoPriceNum < 0 || !/^[0-9]+$/.test(formData.promo_price.trim())) {
        showToast('Promo price must be a valid integer (no decimals)', 'error')
        return
      }
      if (promoPriceNum >= priceNum) {
        showToast('Promo price must be less than regular price', 'error')
        return
      }
    }

    // Validate promo_percent if provided
    let promoPercentNum: number | null = null
    if (formData.promo_percent.trim()) {
      promoPercentNum = parseInt(formData.promo_percent, 10)
      if (isNaN(promoPercentNum) || !/^[0-9]+$/.test(formData.promo_percent.trim())) {
        showToast('Promo percent must be a valid integer', 'error')
        return
      }
      if (promoPercentNum < 0 || promoPercentNum > 100) {
        showToast('Promo percent must be between 0 and 100', 'error')
        return
      }
    }

    setIsSaving(true)

    try {
      if (isCreateMode) {
        const menuCode = formData.menu_code.trim() || generateCode(formData.name_th)

        const res = await adminFetch('/api/admin/menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            menu_code: menuCode,
            category_code: selectedCategoryCodes[0], // Primary category for backward compatibility
            name_th: formData.name_th.trim(),
            name_en: formData.name_en.trim() || null,
            barcode: formData.barcode.trim() || null,
            description: formData.description.trim() || null,
            price: priceNum,
            promo_price: promoPriceNum,
            promo_label: formData.promo_label.trim() || null,
            promo_percent: promoPercentNum,
            image_url: formData.image_url.trim() || null,
            is_active: formData.is_active
          })
        })

        if (res.status === 401) {
          showToast('Unauthorized (admin key missing/invalid)', 'error')
          return
        }

        if (res.status === 409) {
          showToast('Menu code already exists', 'error')
          return
        }

        if (!res.ok) {
          const errorData = await res.json().catch(() => null)
          showToast(normalizeToastMessage(errorData?.error ?? errorData) || 'Failed to create menu item', 'error')
          return
        }

        const createData = await res.json()
        const createdMenuCode = createData.menu_code

        // Save multi-category assignments
        if (selectedCategoryCodes.length > 0) {
          await adminFetch(`/api/admin/menu/${createdMenuCode}/categories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              categories: selectedCategoryCodes.map((code, index) => ({
                category_code: code,
                sort_order: index
              }))
            })
          })
        }

        if (optionGroupIds.length > 0) {
          await adminFetch(`/api/admin/menu/${createdMenuCode}/option-groups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ group_codes: optionGroupIds })
          })
        }

        showToast('Menu item created successfully', 'success')
        setTimeout(() => {
          router.push('/admin/menu')
        }, 1000)
      } else {
        const res = await adminFetch(`/api/admin/menu/${menuItem.menu_code}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category_code: selectedCategoryCodes[0], // Primary category for backward compatibility
            name_th: formData.name_th.trim(),
            name_en: formData.name_en.trim() || null,
            barcode: formData.barcode.trim() || null,
            description: formData.description.trim() || null,
            price: priceNum,
            promo_price: promoPriceNum,
            promo_label: formData.promo_label.trim() || null,
            promo_percent: promoPercentNum,
            image_url: formData.image_url.trim() || null,
            is_active: formData.is_active
          })
        })

        if (res.status === 401) {
          showToast('Unauthorized (admin key missing/invalid)', 'error')
          return
        }

        if (!res.ok) {
          const errorData = await res.json().catch(() => null)
          showToast(normalizeToastMessage(errorData?.error ?? errorData) || 'Failed to update menu item', 'error')
          return
        }

        // Save multi-category assignments
        await adminFetch(`/api/admin/menu/${menuItem.menu_code}/categories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categories: selectedCategoryCodes.map((code, index) => ({
              category_code: code,
              sort_order: index
            }))
          })
        })

        await adminFetch(`/api/admin/menu/${menuItem.menu_code}/option-groups`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ group_codes: optionGroupIds })
        })

        showToast('Menu item updated successfully', 'success')
        setTimeout(() => {
          router.push('/admin/menu')
        }, 1000)
      }
    } catch (err: any) {
      showToast(err.message || 'An unexpected error occurred', 'error')
    } finally {
      setIsSaving(false)
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

      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-6">
          <a href="/admin/menu" className="text-primary hover:underline text-sm">
            ← Back to Menu List
          </a>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-text">
            {isCreateMode ? 'Create New Menu Item' : 'Edit Menu Item'}
          </h1>
          {!isCreateMode && (
            <button
              onClick={handleDelete}
              disabled={isSaving}
              className="px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-6 space-y-6">
          {isCreateMode && (
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Menu Code <span className="text-muted text-xs">(optional - auto-generated if empty)</span>
              </label>
              <input
                type="text"
                name="menu_code"
                value={formData.menu_code}
                onChange={handleChange}
                placeholder="Leave empty to auto-generate"
                className="w-full px-4 py-2 bg-bg border border-border rounded-lg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Name (Thai) <span className="text-primary">*</span>
              </label>
              <input
                type="text"
                name="name_th"
                value={formData.name_th}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 bg-bg border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Name (English)
              </label>
              <input
                type="text"
                name="name_en"
                value={formData.name_en}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-bg border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Categories <span className="text-primary">*</span>
              <span className="text-muted text-xs ml-2">(select one or more)</span>
            </label>
            {/* Selected categories badges */}
            {selectedCategoryCodes.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {selectedCategoryCodes.map((code, index) => (
                  <span
                    key={code}
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${
                      index === 0
                        ? 'bg-primary/20 text-primary border-primary/30'
                        : 'bg-border text-text border-border'
                    }`}
                  >
                    {index === 0 && <span className="mr-1 text-xs">★</span>}
                    {categories.find(c => c.category_code === code)?.name || code}
                  </span>
                ))}
              </div>
            )}
            {/* Category checkbox list */}
            {categories.length === 0 ? (
              <div className="p-4 bg-bg border border-border rounded-lg text-muted text-sm">
                No categories available. <a href="/admin/categories" className="text-primary hover:underline">Create one first</a>.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[...categories].sort((a, b) => {
                  const aSelected = selectedCategoryCodes.includes(a.category_code)
                  const bSelected = selectedCategoryCodes.includes(b.category_code)
                  if (aSelected === bSelected) return a.name.localeCompare(b.name)
                  return aSelected ? -1 : 1
                }).map(cat => (
                  <label
                    key={cat.category_code}
                    className="flex items-center p-2 bg-bg border border-border rounded-lg cursor-pointer hover:border-primary/30 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategoryCodes.includes(cat.category_code)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCategoryCodes(prev => [...prev, cat.category_code])
                        } else {
                          setSelectedCategoryCodes(prev => prev.filter(c => c !== cat.category_code))
                        }
                      }}
                      className="w-4 h-4 accent-primary focus:ring-primary mr-2"
                    />
                    <span className="text-sm text-text truncate">{cat.name}</span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-muted mt-1">First selected category (★) is the primary category</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Price (THB) <span className="text-primary">*</span>
            </label>
            <input
              type="text"
              name="price"
              value={formData.price}
              onChange={handleChange}
              required
              placeholder="e.g., 120"
              className="w-full px-4 py-2 bg-bg border border-border rounded-lg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Promotion Section */}
          <div className="border border-orange-500/30 rounded-lg p-4 bg-orange-500/5">
            <h3 className="text-sm font-semibold text-orange-400 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
              </svg>
              Promotion
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  Promo Price (THB)
                </label>
                <input
                  type="text"
                  name="promo_price"
                  value={formData.promo_price}
                  onChange={handleChange}
                  placeholder="e.g., 99 (leave empty for no promo)"
                  className="w-full px-4 py-2 bg-bg border border-border rounded-lg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                {formData.promo_price && Number(formData.promo_price) >= Number(formData.price) && (
                  <p className="text-xs text-red-400 mt-1">Promo price should be less than regular price</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  Promo Label
                </label>
                <input
                  type="text"
                  name="promo_label"
                  value={formData.promo_label}
                  onChange={handleChange}
                  placeholder="e.g., ลด 20%, Hot Deal"
                  className="w-full px-4 py-2 bg-bg border border-border rounded-lg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  Discount % Badge
                </label>
                <input
                  type="text"
                  name="promo_percent"
                  value={formData.promo_percent}
                  onChange={handleChange}
                  placeholder="e.g., 20 (leave empty for no badge)"
                  className="w-full px-4 py-2 bg-bg border border-border rounded-lg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                {formData.promo_percent && (Number(formData.promo_percent) < 0 || Number(formData.promo_percent) > 100) && (
                  <p className="text-xs text-red-400 mt-1">Must be 0-100</p>
                )}
              </div>
            </div>
            {formData.promo_price && Number(formData.promo_price) < Number(formData.price) && (
              <div className="mt-3 p-2 bg-green-500/10 border border-green-500/30 rounded text-sm text-green-400 flex items-center flex-wrap gap-2">
                <span>Preview:</span>
                <span className="line-through text-muted">฿{formData.price}</span>
                <span>→</span>
                <span className="font-bold">฿{formData.promo_price}</span>
                {formData.promo_label && <span className="px-2 py-0.5 bg-orange-500 text-white text-xs rounded">{formData.promo_label}</span>}
                {formData.promo_percent && Number(formData.promo_percent) >= 0 && Number(formData.promo_percent) <= 100 && (
                  <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded font-bold">-{formData.promo_percent}%</span>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Barcode
            </label>
            <input
              type="text"
              name="barcode"
              value={formData.barcode}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-bg border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 bg-bg border border-border rounded-lg text-text resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Image
            </label>
            <ImageUploaderWithCrop
              menuCode={menuItem?.menu_code || formData.menu_code || ''}
              currentImageUrl={formData.image_url || null}
              onImageChange={handleImageChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Option Groups
            </label>
            {optionGroups.length === 0 ? (
              <div className="p-4 bg-bg border border-border rounded-lg text-muted text-sm">
                No option groups available. <a href="/admin/option-groups" className="text-primary hover:underline">Create one first</a>.
              </div>
            ) : (
              <div className="space-y-2">
                {[...optionGroups].sort((a, b) => {
                  const aSelected = optionGroupIds.includes(a.group_code)
                  const bSelected = optionGroupIds.includes(b.group_code)
                  if (aSelected === bSelected) {
                    return a.group_name.localeCompare(b.group_name)
                  }
                  return aSelected ? -1 : 1
                }).map(group => (
                  <label
                    key={group.group_code}
                    className="flex items-center p-3 bg-bg border border-border rounded-lg cursor-pointer hover:border-primary/30 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={optionGroupIds.includes(group.group_code)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setOptionGroupIds(prev => [...prev, group.group_code])
                        } else {
                          setOptionGroupIds(prev => prev.filter(id => id !== group.group_code))
                        }
                      }}
                      className="w-4 h-4 accent-primary focus:ring-primary mr-3"
                    />
                    <span className="text-text">{group.group_name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_active"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
              className="w-4 h-4 accent-primary focus:ring-primary mr-3"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-text">
              Active (visible to customers)
            </label>
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-3 bg-primary text-white font-semibold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : (isCreateMode ? 'Create Menu Item' : 'Save Changes')}
            </button>
            <a
              href="/admin/menu"
              className="px-8 py-3 bg-border text-text font-medium rounded-lg hover:bg-border/80 transition-colors text-center"
            >
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}
