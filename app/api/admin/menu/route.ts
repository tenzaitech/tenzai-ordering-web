import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateCode, parseIntegerPrice, isValidIntegerPrice } from '@/lib/menu-import-validator'
import { checkAdminAuth } from '@/lib/admin-gate'

type MenuItemInsert = {
  menu_code: string
  category_code: string
  name_th: string
  name_en: string | null
  barcode: string | null
  description: string | null
  price: number
  image_url: string | null
  is_active: boolean
  updated_at: string
}

export async function GET(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  try {
    const { data: menuItems, error } = await supabase
      .from('menu_items')
      .select('menu_code, category_code, name_th, name_en, price, image_url, is_active, updated_at')
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('[ADMIN_MENU_GET] Error:', error)
      return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 })
    }

    return NextResponse.json({ menuItems })
  } catch (error) {
    console.error('[ADMIN_MENU_GET] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  try {
    const body = await request.json()

    if (!body.name_th || !body.name_th.trim()) {
      return NextResponse.json({ error: 'name_th is required' }, { status: 400 })
    }

    if (!body.category_code || !body.category_code.trim()) {
      return NextResponse.json({ error: 'category_code is required' }, { status: 400 })
    }

    if (!isValidIntegerPrice(body.price)) {
      return NextResponse.json({ error: 'price must be a valid integer (no decimals)' }, { status: 400 })
    }

    const menuCode = body.menu_code?.trim() || generateCode(body.name_th)
    const price = parseIntegerPrice(body.price)

    const insertPayload: MenuItemInsert = {
      menu_code: menuCode,
      category_code: body.category_code.trim(),
      name_th: body.name_th.trim(),
      name_en: body.name_en?.trim() || null,
      barcode: body.barcode?.trim() || null,
      description: body.description?.trim() || null,
      price: price,
      image_url: body.image_url?.trim() || null,
      is_active: body.is_active ?? true,
      updated_at: new Date().toISOString()
    }
    const { error } = await supabase
      .from('menu_items')
      .insert(insertPayload as never)

    if (error) {
      console.error('[ADMIN_MENU_POST] Error:', error)
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Menu code already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to create menu item' }, { status: 500 })
    }

    return NextResponse.json({ success: true, menu_code: menuCode })
  } catch (error) {
    console.error('[ADMIN_MENU_POST] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
