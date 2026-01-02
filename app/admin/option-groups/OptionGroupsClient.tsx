'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { adminFetch } from '@/lib/admin-fetch'
import Toast from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'

type OptionGroup = {
  group_code: string
  group_name: string
  is_required: boolean
  max_select: number
  updated_at: string
  menu_count: number
}

interface OptionGroupsClientProps {
  optionGroups: OptionGroup[]
}

export default function OptionGroupsClient({ optionGroups }: OptionGroupsClientProps) {
  const router = useRouter()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  } | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newGroup, setNewGroup] = useState({
    group_name: '',
    is_required: false,
    max_select: 1
  })

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
  }

  const handleCreate = async () => {
    if (!newGroup.group_name.trim()) {
      showToast('Group name is required', 'error')
      return
    }

    setLoadingAction('create')

    try {
      const res = await adminFetch('/api/admin/option-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGroup)
      })

      if (res.status === 401) {
        showToast('Unauthorized (admin key missing/invalid)', 'error')
        return
      }

      if (res.status === 409) {
        showToast('Option group already exists', 'error')
        return
      }

      if (!res.ok) {
        const errorData = await res.json()
        showToast(errorData.error || 'Failed to create option group', 'error')
        return
      }

      showToast('Option group created successfully', 'success')
      setNewGroup({ group_name: '', is_required: false, max_select: 1 })
      setIsCreating(false)
      router.refresh()
    } catch (err: any) {
      showToast(err.message || 'Failed to create option group', 'error')
    } finally {
      setLoadingAction(null)
    }
  }

  const handleDelete = async (groupCode: string, groupName: string, menuCount: number) => {
    if (menuCount > 0) {
      showToast(`Cannot delete option group: ${menuCount} menu item(s) are using this group`, 'error')
      return
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Delete Option Group',
      message: `Are you sure you want to delete "${groupName}"? This will also delete all options in this group. This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmDialog(null)
        setLoadingAction(`delete-${groupCode}`)

        try {
          const res = await adminFetch(`/api/admin/option-groups/${groupCode}`, {
            method: 'DELETE'
          })

          if (res.status === 401) {
            showToast('Unauthorized (admin key missing/invalid)', 'error')
            return
          }

          if (res.status === 409) {
            const errorData = await res.json()
            showToast(errorData.error || 'Cannot delete option group with menus', 'error')
            return
          }

          if (!res.ok) {
            const errorData = await res.json()
            showToast(errorData.error || 'Failed to delete option group', 'error')
            return
          }

          showToast('Option group deleted successfully', 'success')
          router.refresh()
        } catch (err: any) {
          showToast(err.message || 'Failed to delete option group', 'error')
        } finally {
          setLoadingAction(null)
        }
      }
    })
  }

  return (
    <div className="min-h-screen bg-bg pb-20">
      {toast && <Toast message={toast.message} onClose={() => setToast(null)} />}

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
          <h1 className="text-3xl font-bold text-text">Option Groups Management</h1>
          {!isCreating && (
            <button
              onClick={() => setIsCreating(true)}
              className="px-5 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              + Create Option Group
            </button>
          )}
        </div>

        {isCreating && (
          <div className="bg-card border border-border rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-text mb-4">Create New Option Group</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  Group Name <span className="text-primary">*</span>
                </label>
                <input
                  type="text"
                  value={newGroup.group_name}
                  onChange={(e) => setNewGroup(prev => ({ ...prev, group_name: e.target.value }))}
                  placeholder="e.g., Size, Toppings, Add-ons"
                  className="w-full px-4 py-2 bg-bg border border-border rounded-lg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_required"
                    checked={newGroup.is_required}
                    onChange={(e) => setNewGroup(prev => ({ ...prev, is_required: e.target.checked }))}
                    className="w-4 h-4 accent-primary focus:ring-primary mr-3"
                  />
                  <label htmlFor="is_required" className="text-sm font-medium text-text">
                    Required (customer must select)
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-2">Max Select</label>
                  <input
                    type="number"
                    min="1"
                    value={newGroup.max_select}
                    onChange={(e) => setNewGroup(prev => ({ ...prev, max_select: parseInt(e.target.value) || 1 }))}
                    className="w-full px-4 py-2 bg-bg border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCreate}
                  disabled={loadingAction === 'create'}
                  className="px-5 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingAction === 'create' ? 'Creating...' : 'Create'}
                </button>
                <button
                  onClick={() => {
                    setIsCreating(false)
                    setNewGroup({ group_name: '', is_required: false, max_select: 1 })
                  }}
                  className="px-5 py-2 bg-border text-text font-medium rounded-lg hover:bg-border/80 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {optionGroups.length === 0 && !isCreating ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <div className="text-muted mb-4">
              <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
              <p className="text-lg font-medium">No option groups found</p>
              <p className="text-sm mt-2">Create your first option group (e.g., Size, Toppings)</p>
            </div>
            <button
              onClick={() => setIsCreating(true)}
              className="inline-block px-5 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              + Create First Option Group
            </button>
          </div>
        ) : optionGroups.length > 0 ? (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-border/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text">Group Name</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text">Required</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text">Max Select</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text">Used by Menus</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text">Updated</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-text">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {optionGroups.map(group => (
                  <tr key={group.group_code} className="hover:bg-border/20 transition-colors">
                    <td className="px-4 py-3 text-sm text-text font-medium">{group.group_name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        group.is_required ? 'bg-primary/20 text-primary' : 'bg-muted/20 text-muted'
                      }`}>
                        {group.is_required ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">{group.max_select}</td>
                    <td className="px-4 py-3">
                      <span className={`text-sm ${group.menu_count > 0 ? 'text-text font-medium' : 'text-muted'}`}>
                        {group.menu_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">
                      {new Date(group.updated_at).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <Link
                          href={`/admin/option-groups/${group.group_code}`}
                          className="text-primary hover:text-primary/80 text-sm font-medium"
                        >
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(group.group_code, group.group_name, group.menu_count)}
                          disabled={loadingAction === `delete-${group.group_code}`}
                          className="text-red-400 hover:text-red-300 text-sm font-medium disabled:opacity-50"
                        >
                          {loadingAction === `delete-${group.group_code}` ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
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
