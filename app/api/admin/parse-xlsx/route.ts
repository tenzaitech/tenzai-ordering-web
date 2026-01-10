import { NextRequest, NextResponse } from 'next/server'
import { checkAdminAuth } from '@/lib/admin-gate'
import type { ParsedMenuData } from '@/lib/menu-import-validator'

// Max file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024
// Max rows per sheet (DoS protection)
const MAX_ROWS_PER_SHEET = 10000

// Helper to create JSON response with no-cache header
function jsonResponse(data: object, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" }
  })
}

export async function POST(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return jsonResponse({ error: 'No file provided' }, 400)
    }

    // File size guard
    if (file.size > MAX_FILE_SIZE) {
      return jsonResponse(
        { error: 'File too large. Maximum size is ' + (MAX_FILE_SIZE / 1024 / 1024) + 'MB' },
        400
      )
    }

    // Filename extension guard
    if (file.name && !file.name.toLowerCase().endsWith('.xlsx')) {
      return jsonResponse(
        { error: 'Invalid file extension. Only .xlsx files are accepted' },
        400
      )
    }

    // MIME type guard (xlsx MIME types)
    const validMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ]
    if (file.type && !validMimes.includes(file.type)) {
      return jsonResponse(
        { error: 'Invalid file type. Only .xlsx files are accepted' },
        400
      )
    }

    // ZIP signature check (xlsx files are ZIP archives starting with "PK")
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4B) {
      return jsonResponse(
        { error: 'Invalid file format. File does not appear to be a valid xlsx' },
        400
      )
    }

    // Server-side xlsx import (vulnerability contained to server)
    const XLSX = await import('xlsx')
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
      const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[]
      if (rows.length > MAX_ROWS_PER_SHEET) {
        return jsonResponse({ error: 'categories sheet exceeds ' + MAX_ROWS_PER_SHEET + ' row limit' }, 400)
      }
      data.categories = rows.map(r => ({
        category_name: String(r.category_name || '').trim()
      }))
    }

    // Parse menu
    if (workbook.SheetNames.includes('menu')) {
      const sheet = workbook.Sheets['menu']
      const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[]
      if (rows.length > MAX_ROWS_PER_SHEET) {
        return jsonResponse({ error: 'menu sheet exceeds ' + MAX_ROWS_PER_SHEET + ' row limit' }, 400)
      }
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
      const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[]
      if (rows.length > MAX_ROWS_PER_SHEET) {
        return jsonResponse({ error: 'options sheet exceeds ' + MAX_ROWS_PER_SHEET + ' row limit' }, 400)
      }
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
      const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[]
      if (rows.length > MAX_ROWS_PER_SHEET) {
        return jsonResponse({ error: 'menu_option_groups sheet exceeds ' + MAX_ROWS_PER_SHEET + ' row limit' }, 400)
      }
      data.menu_option_groups = rows.map(r => ({
        menu_code: String(r.menu_code || '').trim(),
        option_group_name: String(r.option_group_name || '').trim()
      }))
    }

    return jsonResponse({ data })
  } catch (error) {
    // Log error server-side only (no stack trace in response)
    console.error('[PARSE-XLSX] Error:', error)
    return jsonResponse(
      { error: 'Failed to parse file. Ensure it is a valid XLSX file.' },
      400
    )
  }
}
