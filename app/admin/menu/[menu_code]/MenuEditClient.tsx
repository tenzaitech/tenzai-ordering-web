'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ImageUploader from '@/components/ImageUploader'
import { generateCode } from '@/lib/menu-import-validator'
import { adminFetch } from '@/lib/admin-fetch'

type MenuItem = {
  menu_code: string
  category_code: string
  name_th: string
  name_en: string | null
  barcode: string | null
  description: string | null
  price: number
  image_url: string | null
  is_active: boolean
}

type Category = {
  category_code: string
  name: string
}

interface MenuEditClientProps {
  menuItem: MenuItem | null
  categories: Category[]
}

export default function MenuEditClient({ menuItem, categories }: MenuEditClientProps) {
  const router = useRouter()
  const isCreateMode = !menuItem

  const [formData, setFormData] = useState({
    menu_code: menuItem?.menu_code || '',
    name_th: menuItem?.name_th || '',
    name_en: menuItem?.name_en || '',
    category_code: menuItem?.category_code || (categories[0]?.category_code || ''),
    price: menuItem?.price?.toString() || '',
    barcode: menuItem?.barcode || '',
    description: menuItem?.description || '',
    image_url: menuItem?.image_url || '',
    is_active: menuItem?.is_active ?? true
  })

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!formData.name_th.trim()) {
      setError('Name (Thai) is required')
      return
    }

    if (!formData.category_code) {
      setError('Category is required')
      return
    }

    const priceNum = parseInt(formData.price, 10)
    if (isNaN(priceNum) || priceNum < 0 || !/^[0-9]+$/.test(formData.price.trim())) {
      setError('Price must be a valid integer (no decimals)')
      return
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
            category_code: formData.category_code,
            name_th: formData.name_th.trim(),
            name_en: formData.name_en.trim() || null,
            barcode: formData.barcode.trim() || null,
            description: formData.description.trim() || null,
            price: priceNum,
            image_url: formData.image_url.trim() || null,
            is_active: formData.is_active
          })
        })

        if (res.status === 401) {
          throw new Error('Unauthorized (admin key missing/invalid)')
        }

        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.error || 'Failed to create menu item')
        }

        setSuccess('Menu item created successfully')
        setTimeout(() => {
          router.push('/admin/menu')
        }, 1000)
      } else {
        const res = await adminFetch(`/api/admin/menu/${menuItem.menu_code}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category_code: formData.category_code,
            name_th: formData.name_th.trim(),
            name_en: formData.name_en.trim() || null,
            barcode: formData.barcode.trim() || null,
            description: formData.description.trim() || null,
            price: priceNum,
            image_url: formData.image_url.trim() || null,
            is_active: formData.is_active
          })
        })

        if (res.status === 401) {
          throw new Error('Unauthorized (admin key missing/invalid)')
        }

        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.error || 'Failed to update menu item')
        }

        setSuccess('Menu item updated successfully')
        setTimeout(() => {
          router.push('/admin/menu')
        }, 1000)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg pb-20">
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-6">
          <a href="/admin/menu" className="text-primary hover:underline text-sm">
            ← Back to Menu List
          </a>
        </div>

        <h1 className="text-3xl font-bold text-text mb-6">
          {isCreateMode ? 'Create New Menu Item' : 'Edit Menu Item'}
        </h1>

        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-500/10 border border-green-500/50 rounded-lg text-green-400">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-6 space-y-6">
          {isCreateMode && (
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Menu Code (optional - auto-generated if empty)
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

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Category <span className="text-primary">*</span>
            </label>
            <select
              name="category_code"
              value={formData.category_code}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 bg-bg border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {categories.length === 0 ? (
                <option value="">No categories available</option>
              ) : (
                categories.map(cat => (
                  <option key={cat.category_code} value={cat.category_code}>
                    {cat.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Price (THB, integer only) <span className="text-primary">*</span>
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
            <ImageUploader
              currentImageUrl={formData.image_url || null}
              onImageChange={handleImageChange}
            />
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

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : (isCreateMode ? 'Create Menu Item' : 'Save Changes')}
            </button>
            <a
              href="/admin/menu"
              className="px-6 py-3 bg-border text-text font-medium rounded-lg hover:bg-border/80 transition-colors text-center"
            >
              Cancel
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}
