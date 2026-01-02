'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { generateCode } from '@/lib/menu-import-validator'
import { adminFetch } from '@/lib/admin-fetch'

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
  const [isCreating, setIsCreating] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCode, setEditingCode] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreate = async () => {
    if (!newCategoryName.trim()) {
      setError('Category name is required')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const res = await adminFetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() })
      })

      if (res.status === 401) {
        throw new Error('Unauthorized (admin key missing/invalid)')
      }

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to create category')
      }

      setNewCategoryName('')
      setIsCreating(false)
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEdit = (category: Category) => {
    setEditingCode(category.category_code)
    setEditingName(category.name)
    setError('')
  }

  const handleSaveEdit = async (categoryCode: string) => {
    if (!editingName.trim()) {
      setError('Category name is required')
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const res = await adminFetch(`/api/admin/categories/${categoryCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName.trim() })
      })

      if (res.status === 401) {
        throw new Error('Unauthorized (admin key missing/invalid)')
      }

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to update category')
      }

      setEditingCode(null)
      setEditingName('')
      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (categoryCode: string, menuItemsCount: number) => {
    if (menuItemsCount > 0) {
      alert(`Cannot delete category: ${menuItemsCount} menu item(s) are using this category. Please reassign or delete the menu items first.`)
      return
    }

    if (!confirm('Are you sure you want to delete this category?')) {
      return
    }

    setIsSubmitting(true)
    setError('')

    try {
      const res = await adminFetch(`/api/admin/categories/${categoryCode}`, {
        method: 'DELETE'
      })

      if (res.status === 401) {
        throw new Error('Unauthorized (admin key missing/invalid)')
      }

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to delete category')
      }

      router.refresh()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg pb-20">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-text">Category Management</h1>
          <button
            onClick={() => setIsCreating(true)}
            className="px-5 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            + Create Category
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {isCreating && (
          <div className="bg-card border border-border rounded-lg p-5 mb-6">
            <h2 className="text-lg font-semibold text-text mb-4">Create New Category</h2>
            <div className="flex gap-3">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Enter category name..."
                className="flex-1 px-4 py-2 bg-bg border border-border rounded-lg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                onClick={handleCreate}
                disabled={isSubmitting}
                className="px-5 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setIsCreating(false)
                  setNewCategoryName('')
                  setError('')
                }}
                className="px-5 py-2 bg-border text-text font-medium rounded-lg hover:bg-border/80 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-border/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-text">Code</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-text">Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-text">Menu Items</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-text">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted">
                    No categories found
                  </td>
                </tr>
              ) : (
                categories.map(category => (
                  <tr key={category.category_code} className="hover:bg-border/20 transition-colors">
                    <td className="px-4 py-3 text-sm text-muted">{category.category_code}</td>
                    <td className="px-4 py-3">
                      {editingCode === category.category_code ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="px-3 py-1 bg-bg border border-border rounded text-text focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      ) : (
                        <span className="text-text font-medium">{category.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">{category.menu_items_count}</td>
                    <td className="px-4 py-3">
                      {editingCode === category.category_code ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveEdit(category.category_code)}
                            disabled={isSubmitting}
                            className="text-green-400 hover:text-green-300 text-sm font-medium disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingCode(null)
                              setEditingName('')
                              setError('')
                            }}
                            className="text-muted hover:text-text text-sm font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleEdit(category)}
                            className="text-primary hover:text-primary/80 text-sm font-medium"
                          >
                            Rename
                          </button>
                          <button
                            onClick={() => handleDelete(category.category_code, category.menu_items_count)}
                            disabled={isSubmitting}
                            className="text-red-400 hover:text-red-300 text-sm font-medium disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
