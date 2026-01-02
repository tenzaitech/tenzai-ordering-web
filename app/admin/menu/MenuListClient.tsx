'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin-fetch'

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
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [isTogglingId, setIsTogglingId] = useState<string | null>(null)

  const categoryMap = new Map(categories.map(cat => [cat.category_code, cat.name]))

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = searchQuery.trim() === '' ||
      item.name_th.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name_en?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.menu_code.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCategory = categoryFilter === 'all' || item.category_code === categoryFilter

    return matchesSearch && matchesCategory
  })

  const handleToggleActive = async (menuCode: string, currentStatus: boolean) => {
    setIsTogglingId(menuCode)
    try {
      const res = await adminFetch(`/api/admin/menu/${menuCode}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !currentStatus })
      })

      if (res.status === 401) {
        alert('Unauthorized (admin key missing/invalid)')
        return
      }

      if (!res.ok) {
        const error = await res.json()
        alert(`Failed to toggle: ${error.error}`)
        return
      }

      router.refresh()
    } catch (error) {
      console.error('[TOGGLE] Error:', error)
      alert('Failed to toggle active status')
    } finally {
      setIsTogglingId(null)
    }
  }

  return (
    <div className="min-h-screen bg-bg pb-20">
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-text">Menu Management</h1>
          <Link
            href="/admin/menu/new"
            className="px-5 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            + Create New Item
          </Link>
        </div>

        <div className="bg-card border border-border rounded-lg p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text mb-2">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or code..."
                className="w-full px-4 py-2 bg-bg border border-border rounded-lg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text mb-2">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-4 py-2 bg-bg border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.category_code} value={cat.category_code}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-border/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text">Image</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text">Code</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text">Name (TH)</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text">Name (EN)</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text">Category</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text">Price</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text">Active</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text">Updated</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted">
                      No menu items found
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(item => (
                    <tr key={item.menu_code} className="hover:bg-border/20 transition-colors">
                      <td className="px-4 py-3">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name_th} className="w-12 h-12 object-cover rounded" />
                        ) : (
                          <div className="w-12 h-12 bg-border rounded flex items-center justify-center text-muted text-xs">
                            No image
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">{item.menu_code}</td>
                      <td className="px-4 py-3 text-sm text-text font-medium">{item.name_th}</td>
                      <td className="px-4 py-3 text-sm text-muted">{item.name_en || '-'}</td>
                      <td className="px-4 py-3 text-sm text-muted">{categoryMap.get(item.category_code) || '-'}</td>
                      <td className="px-4 py-3 text-sm text-text font-medium">฿{item.price}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleActive(item.menu_code, item.is_active)}
                          disabled={isTogglingId === item.menu_code}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                            item.is_active
                              ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                              : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {isTogglingId === item.menu_code ? '...' : item.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">
                        {new Date(item.updated_at).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/menu/${item.menu_code}`}
                          className="text-primary hover:text-primary/80 text-sm font-medium"
                        >
                          Edit
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
