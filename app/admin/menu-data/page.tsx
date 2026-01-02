'use client'

import { useState } from 'react'
import { ParsedMenuData, ValidationError } from '@/lib/menu-import-validator'

export default function AdminMenuDataPage() {
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedMenuData | null>(null)
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [importResult, setImportResult] = useState<string | null>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const XLSX = await import('xlsx')

      const arrayBuffer = await file.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: 'array' })

      const data: ParsedMenuData = {
        categories: [],
        menu: [],
        options: [],
        menu_option_groups: []
      }

      // Parse categories
      if (workbook.SheetNames.includes('categories')) {
        const sheet = workbook.Sheets['categories']
        const rows = XLSX.utils.sheet_to_json(sheet) as any[]
        data.categories = rows.map(r => ({
          category_name: String(r.category_name || '').trim()
        }))
      }

      // Parse menu
      if (workbook.SheetNames.includes('menu')) {
        const sheet = workbook.Sheets['menu']
        const rows = XLSX.utils.sheet_to_json(sheet) as any[]
        data.menu = rows.map(r => ({
          menu_code: String(r.menu_code || '').trim(),
          category_name: String(r.category_name || '').trim(),
          menu_name: String(r.menu_name || '').trim(),
          menu_name_2: r.menu_name_2 ? String(r.menu_name_2).trim() : undefined,
          barcode: r.barcode ? String(r.barcode).trim() : undefined,
          description: r.description ? String(r.description).trim() : undefined,
          price: Number(r.price) || 0,
          image_url: r.image_url ? String(r.image_url).trim() : undefined
        }))
      }

      // Parse options (wide format)
      if (workbook.SheetNames.includes('options')) {
        const sheet = workbook.Sheets['options']
        const rows = XLSX.utils.sheet_to_json(sheet) as any[]
        data.options = rows.map(r => ({
          option_group_name: String(r.option_group_name || '').trim(),
          is_required: Boolean(r.is_required),
          max_select: Number(r.max_select) || 1,
          option_name_1: r.option_name_1 ? String(r.option_name_1).trim() : undefined,
          price_1: r.price_1 !== undefined && r.price_1 !== '' ? Number(r.price_1) : undefined,
          option_name_2: r.option_name_2 ? String(r.option_name_2).trim() : undefined,
          price_2: r.price_2 !== undefined && r.price_2 !== '' ? Number(r.price_2) : undefined,
          option_name_3: r.option_name_3 ? String(r.option_name_3).trim() : undefined,
          price_3: r.price_3 !== undefined && r.price_3 !== '' ? Number(r.price_3) : undefined,
          option_name_4: r.option_name_4 ? String(r.option_name_4).trim() : undefined,
          price_4: r.price_4 !== undefined && r.price_4 !== '' ? Number(r.price_4) : undefined,
          option_name_5: r.option_name_5 ? String(r.option_name_5).trim() : undefined,
          price_5: r.price_5 !== undefined && r.price_5 !== '' ? Number(r.price_5) : undefined,
          option_name_6: r.option_name_6 ? String(r.option_name_6).trim() : undefined,
          price_6: r.price_6 !== undefined && r.price_6 !== '' ? Number(r.price_6) : undefined
        }))
      }

      // Parse menu_option_groups
      if (workbook.SheetNames.includes('menu_option_groups')) {
        const sheet = workbook.Sheets['menu_option_groups']
        const rows = XLSX.utils.sheet_to_json(sheet) as any[]
        data.menu_option_groups = rows.map(r => ({
          menu_code: String(r.menu_code || '').trim(),
          option_group_name: String(r.option_group_name || '').trim()
        }))
      }

      setParsedData(data)
      setValidationErrors([])
      setImportResult(null)

      // Server-side validation and import
      const response = await fetch('/api/admin/import-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })

      const result = await response.json()
      if (response.status === 400 && result.errors) {
        setValidationErrors(result.errors)
      } else if (response.ok) {
        setImportResult(`Import successful! Imported: ${result.counts.categories} categories, ${result.counts.menu} menu items, ${result.counts.option_groups} option groups, ${result.counts.options} options, ${result.counts.menu_option_groups} mappings`)
        setParsedData(null)
      } else {
        alert('Import failed: ' + (result.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('[IMPORT] Parse error:', error)
      alert('Failed to parse file. Ensure it is a valid XLSX file.')
    }

    e.target.value = ''
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const response = await fetch('/api/admin/export-menu')
      if (!response.ok) {
        throw new Error('Export failed')
      }

      const data = await response.json()

      const XLSX = await import('xlsx')

      const wb = XLSX.utils.book_new()

      // Canonical headers for each sheet (human-friendly format)
      const headers = {
        categories: ['category_name'],
        menu: ['menu_code', 'category_name', 'menu_name', 'menu_name_2', 'barcode', 'description', 'price', 'image_url'],
        options: ['option_group_name', 'is_required', 'max_select', 'option_name_1', 'price_1', 'option_name_2', 'price_2', 'option_name_3', 'price_3', 'option_name_4', 'price_4', 'option_name_5', 'price_5', 'option_name_6', 'price_6'],
        menu_option_groups: ['menu_code', 'option_group_name']
      }

      // Categories sheet
      const categoriesWs = XLSX.utils.aoa_to_sheet([headers.categories])
      if (data.categories.length > 0) {
        XLSX.utils.sheet_add_json(categoriesWs, data.categories, {
          header: headers.categories,
          skipHeader: true,
          origin: -1
        })
      }
      XLSX.utils.book_append_sheet(wb, categoriesWs, 'categories')

      // Menu sheet
      const menuWs = XLSX.utils.aoa_to_sheet([headers.menu])
      if (data.menu.length > 0) {
        XLSX.utils.sheet_add_json(menuWs, data.menu, {
          header: headers.menu,
          skipHeader: true,
          origin: -1
        })
      }
      XLSX.utils.book_append_sheet(wb, menuWs, 'menu')

      // Options sheet (wide format)
      const optionsWs = XLSX.utils.aoa_to_sheet([headers.options])
      if (data.options.length > 0) {
        XLSX.utils.sheet_add_json(optionsWs, data.options, {
          header: headers.options,
          skipHeader: true,
          origin: -1
        })
      }
      XLSX.utils.book_append_sheet(wb, optionsWs, 'options')

      // Menu-Option Groups sheet
      const menuOptionGroupsWs = XLSX.utils.aoa_to_sheet([headers.menu_option_groups])
      if (data.menu_option_groups.length > 0) {
        XLSX.utils.sheet_add_json(menuOptionGroupsWs, data.menu_option_groups, {
          header: headers.menu_option_groups,
          skipHeader: true,
          origin: -1
        })
      }
      XLSX.utils.book_append_sheet(wb, menuOptionGroupsWs, 'menu_option_groups')

      // Download
      XLSX.writeFile(wb, `tenzai-menu-export-${new Date().toISOString().split('T')[0]}.xlsx`)

      setImportResult('Export successful!')
      setTimeout(() => setImportResult(null), 3000)
    } catch (error) {
      console.error('[EXPORT] Error:', error)
      alert('Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="max-w-4xl mx-auto px-5 py-8">
        <h1 className="text-3xl font-bold text-text mb-8">Menu Data Management</h1>

        {/* Export Section */}
        <div className="mb-8 bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold text-text mb-4">Export Current Data</h2>
          <p className="text-sm text-muted mb-4">
            Download the current menu data as an Excel file. Use this as a template for imports.
          </p>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-6 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {exporting ? 'Exporting...' : 'Export to Excel'}
          </button>
        </div>

        {/* Import Section */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="text-xl font-semibold text-text mb-4">Import Menu Data</h2>
          <p className="text-sm text-muted mb-4">
            Upload an Excel file (.xlsx) with the following sheets: categories, menu, options, menu_option_groups
          </p>

          <div className="mb-4">
            <label className="block">
              <span className="sr-only">Choose file</span>
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileUpload}
                disabled={importing}
                className="block w-full text-sm text-text file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90 disabled:opacity-50"
              />
            </label>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="mt-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-red-500 font-medium mb-2">Validation Errors ({validationErrors.length})</p>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-left border-b border-red-500/30">
                    <tr>
                      <th className="py-1 text-red-500">Sheet</th>
                      <th className="py-1 text-red-500">Row</th>
                      <th className="py-1 text-red-500">Field</th>
                      <th className="py-1 text-red-500">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationErrors.map((err, idx) => (
                      <tr key={idx} className="border-b border-red-500/10">
                        <td className="py-1 text-text">{err.sheet}</td>
                        <td className="py-1 text-text">{err.row}</td>
                        <td className="py-1 text-text">{err.field}</td>
                        <td className="py-1 text-text">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Success Message */}
          {importResult && (
            <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-green-500">{importResult}</p>
            </div>
          )}

          {/* Preview */}
          {parsedData && validationErrors.length === 0 && (
            <div className="mt-6 p-4 bg-primary/10 border border-primary/30 rounded-lg">
              <p className="text-text font-medium mb-2">Preview</p>
              <div className="text-sm text-muted space-y-1">
                <p>Categories: {parsedData.categories.length}</p>
                <p>Menu Items: {parsedData.menu.length}</p>
                <p>Option Groups: {parsedData.options.length}</p>
                <p>Menu-Option Mappings: {parsedData.menu_option_groups.length}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
