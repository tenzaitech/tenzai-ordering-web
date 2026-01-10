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

    setImporting(true)
    try {
      // Upload file to server for parsing (xlsx vulnerability contained server-side)
      const formData = new FormData()
      formData.append('file', file)

      const parseResponse = await fetch('/api/admin/parse-xlsx', {
        method: 'POST',
        body: formData
      })

      const parseResult = await parseResponse.json()
      if (!parseResponse.ok) {
        alert(parseResult.error || 'Failed to parse file')
        return
      }

      const data: ParsedMenuData = parseResult.data
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
        setImportResult("Import successful! Imported: " + result.counts.categories + " categories, " + result.counts.menu + " menu items, " + result.counts.option_groups + " option groups, " + result.counts.options + " options, " + result.counts.menu_option_groups + " mappings")
        setParsedData(null)
      } else {
        alert('Import failed: ' + (result.error || 'Unknown error'))
      }
    } catch (error) {
      console.error('[IMPORT] Parse error:', error)
      alert('Failed to parse file. Ensure it is a valid XLSX file.')
    } finally {
      setImporting(false)
    }

    e.target.value = ''
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      // Server now returns xlsx binary directly
      const response = await fetch('/api/admin/export-menu')
      if (!response.ok) {
        throw new Error('Export failed')
      }

      // Download the binary file
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = response.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'menu-export.xlsx'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

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
            Upload an Excel file (.xlsx) with the following sheets: categories, menu, options, menu_option_groups.
            Maximum file size: 5MB.
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
