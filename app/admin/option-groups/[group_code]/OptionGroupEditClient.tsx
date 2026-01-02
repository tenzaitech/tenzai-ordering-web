'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { adminFetch } from '@/lib/admin-fetch'
import Toast from '@/components/Toast'
import ConfirmDialog from '@/components/ConfirmDialog'

type OptionGroup = {
  group_code: string
  group_name: string
  is_required: boolean
  max_select: number
  updated_at: string
}

type Option = {
  option_code: string
  option_name: string
  price_delta: number
  sort_order: number
}

interface OptionGroupEditClientProps {
  group: OptionGroup
  options: Option[]
}

export default function OptionGroupEditClient({ group, options: initialOptions }: OptionGroupEditClientProps) {
  const router = useRouter()
  const [formData, setFormData] = useState({
    group_name: group.group_name,
    is_required: group.is_required,
    max_select: group.max_select
  })
  const [options, setOptions] = useState(initialOptions)
  const [editingOption, setEditingOption] = useState<string | null>(null)
  const [editingOptionData, setEditingOptionData] = useState({ option_name: '', price_delta: '' })
  const [isAddingOption, setIsAddingOption] = useState(false)
  const [newOption, setNewOption] = useState({ option_name: '', price_delta: '0' })
  const [isSaving, setIsSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  } | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
  }

  const handleGroupUpdate = async () => {
    if (!formData.group_name.trim()) {
      showToast('Group name is required', 'error')
      return
    }

    setIsSaving(true)

    try {
      const res = await adminFetch(`/api/admin/option-groups/${group.group_code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.status === 401) {
        showToast('Unauthorized (admin key missing/invalid)', 'error')
        return
      }

      if (!res.ok) {
        const errorData = await res.json()
        showToast(errorData.error || 'Failed to update option group', 'error')
        return
      }

      showToast('Option group updated successfully', 'success')
      router.refresh()
    } catch (err: any) {
      showToast(err.message || 'Failed to update option group', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddOption = async () => {
    if (!newOption.option_name.trim()) {
      showToast('Option name is required', 'error')
      return
    }

    const trimmed = newOption.price_delta.trim()
    if (!/^-?[0-9]+$/.test(trimmed)) {
      showToast('Price delta must be a valid integer (negative/positive/zero)', 'error')
      return
    }

    setIsSaving(true)

    try {
      const res = await adminFetch(`/api/admin/option-groups/${group.group_code}/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          option_name: newOption.option_name.trim(),
          price_delta: parseInt(newOption.price_delta, 10)
        })
      })

      if (res.status === 401) {
        showToast('Unauthorized (admin key missing/invalid)', 'error')
        return
      }

      if (!res.ok) {
        const errorData = await res.json()
        showToast(errorData.error || 'Failed to add option', 'error')
        return
      }

      showToast('Option added successfully', 'success')
      setNewOption({ option_name: '', price_delta: '0' })
      setIsAddingOption(false)
      router.refresh()
    } catch (err: any) {
      showToast(err.message || 'Failed to add option', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditOption = (option: Option) => {
    setEditingOption(option.option_code)
    setEditingOptionData({
      option_name: option.option_name,
      price_delta: option.price_delta.toString()
    })
  }

  const handleSaveOption = async (optionCode: string) => {
    if (!editingOptionData.option_name.trim()) {
      showToast('Option name is required', 'error')
      return
    }

    const trimmed = editingOptionData.price_delta.trim()
    if (!/^-?[0-9]+$/.test(trimmed)) {
      showToast('Price delta must be a valid integer (negative/positive/zero)', 'error')
      return
    }

    setIsSaving(true)

    try {
      const res = await adminFetch(`/api/admin/option-groups/${group.group_code}/options`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          option_code: optionCode,
          option_name: editingOptionData.option_name.trim(),
          price_delta: parseInt(editingOptionData.price_delta, 10)
        })
      })

      if (res.status === 401) {
        showToast('Unauthorized (admin key missing/invalid)', 'error')
        return
      }

      if (!res.ok) {
        const errorData = await res.json()
        showToast(errorData.error || 'Failed to update option', 'error')
        return
      }

      showToast('Option updated successfully', 'success')
      setEditingOption(null)
      router.refresh()
    } catch (err: any) {
      showToast(err.message || 'Failed to update option', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteOption = (optionCode: string, optionName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Option',
      message: `Are you sure you want to delete "${optionName}"? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmDialog(null)
        setIsSaving(true)

        try {
          const res = await adminFetch(`/api/admin/option-groups/${group.group_code}/options?option_code=${optionCode}`, {
            method: 'DELETE'
          })

          if (res.status === 401) {
            showToast('Unauthorized (admin key missing/invalid)', 'error')
            return
          }

          if (!res.ok) {
            const errorData = await res.json()
            showToast(errorData.error || 'Failed to delete option', 'error')
            return
          }

          showToast('Option deleted successfully', 'success')
          router.refresh()
        } catch (err: any) {
          showToast(err.message || 'Failed to delete option', 'error')
        } finally {
          setIsSaving(false)
        }
      }
    })
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newOptions = [...options]
    const draggedOption = newOptions[draggedIndex]
    newOptions.splice(draggedIndex, 1)
    newOptions.splice(index, 0, draggedOption)

    setOptions(newOptions)
    setDraggedIndex(index)
  }

  const handleDragEnd = async () => {
    if (draggedIndex === null) return

    const reorder = options.map((opt, idx) => ({
      option_code: opt.option_code,
      sort_order: idx
    }))

    setIsSaving(true)

    try {
      const res = await adminFetch(`/api/admin/option-groups/${group.group_code}/options`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reorder })
      })

      if (res.status === 401) {
        showToast('Unauthorized (admin key missing/invalid)', 'error')
        return
      }

      if (!res.ok) {
        const errorData = await res.json()
        showToast(errorData.error || 'Failed to reorder options', 'error')
        router.refresh()
        return
      }

      showToast('Options reordered successfully', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to reorder options', 'error')
      router.refresh()
    } finally {
      setIsSaving(false)
      setDraggedIndex(null)
    }
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

      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <a href="/admin/option-groups" className="text-primary hover:underline text-sm">
            ← Back to Option Groups
          </a>
        </div>

        <h1 className="text-3xl font-bold text-text mb-6">Edit Option Group</h1>

        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-text mb-4">Group Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Group Name <span className="text-primary">*</span>
              </label>
              <input
                type="text"
                value={formData.group_name}
                onChange={(e) => setFormData(prev => ({ ...prev, group_name: e.target.value }))}
                className="w-full px-4 py-2 bg-bg border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_required"
                  checked={formData.is_required}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_required: e.target.checked }))}
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
                  value={formData.max_select}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_select: parseInt(e.target.value) || 1 }))}
                  className="w-full px-4 py-2 bg-bg border border-border rounded-lg text-text focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="pt-2">
              <button
                onClick={handleGroupUpdate}
                disabled={isSaving}
                className="px-5 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save Group Settings'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-text">Options</h2>
            {!isAddingOption && (
              <button
                onClick={() => setIsAddingOption(true)}
                className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors text-sm"
              >
                + Add Option
              </button>
            )}
          </div>

          {isAddingOption && (
            <div className="mb-4 p-4 bg-bg border border-border rounded-lg">
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-sm font-medium text-text mb-2">Option Name</label>
                  <input
                    type="text"
                    value={newOption.option_name}
                    onChange={(e) => setNewOption(prev => ({ ...prev, option_name: e.target.value }))}
                    placeholder="e.g., Small, Medium, Large"
                    className="w-full px-4 py-2 bg-card border border-border rounded-lg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text mb-2">Price Delta (฿)</label>
                  <input
                    type="text"
                    value={newOption.price_delta}
                    onChange={(e) => setNewOption(prev => ({ ...prev, price_delta: e.target.value }))}
                    placeholder="0"
                    className="w-full px-4 py-2 bg-card border border-border rounded-lg text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAddOption}
                  disabled={isSaving}
                  className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm"
                >
                  {isSaving ? 'Adding...' : 'Add'}
                </button>
                <button
                  onClick={() => {
                    setIsAddingOption(false)
                    setNewOption({ option_name: '', price_delta: '0' })
                  }}
                  className="px-4 py-2 bg-border text-text font-medium rounded-lg hover:bg-border/80 transition-colors text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {options.length === 0 ? (
            <div className="text-center py-8 text-muted">
              <p>No options yet. Add your first option above.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {options.map((option, index) => (
                <div
                  key={option.option_code}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`p-4 bg-bg border border-border rounded-lg cursor-move hover:border-primary/50 transition-colors ${
                    draggedIndex === index ? 'opacity-50' : ''
                  }`}
                >
                  {editingOption === option.option_code ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <input
                          type="text"
                          value={editingOptionData.option_name}
                          onChange={(e) => setEditingOptionData(prev => ({ ...prev, option_name: e.target.value }))}
                          className="w-full px-3 py-2 bg-card border border-border rounded text-text focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editingOptionData.price_delta}
                          onChange={(e) => setEditingOptionData(prev => ({ ...prev, price_delta: e.target.value }))}
                          className="flex-1 px-3 py-2 bg-card border border-border rounded text-text focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <button
                          onClick={() => handleSaveOption(option.option_code)}
                          disabled={isSaving}
                          className="text-green-400 hover:text-green-300 text-sm font-medium disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingOption(null)}
                          className="text-muted hover:text-text text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-muted" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                        </svg>
                        <span className="text-text font-medium">{option.option_name}</span>
                        {option.price_delta !== 0 && (
                          <span className="text-sm text-primary font-medium">
                            {option.price_delta > 0 ? '+' : ''}฿{option.price_delta}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleEditOption(option)}
                          className="text-primary hover:text-primary/80 text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteOption(option.option_code, option.option_name)}
                          disabled={isSaving}
                          className="text-red-400 hover:text-red-300 text-sm font-medium disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
