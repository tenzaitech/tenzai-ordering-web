import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { parseIntegerPrice, isValidIntegerPrice } from '@/lib/menu-import-validator'
import { checkAdminAuth } from '@/lib/admin-gate'
import { validateCsrf, csrfError } from '@/lib/csrf'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ menu_code: string }> }
) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  if (!validateCsrf(request)) {
    return csrfError()
  }

  try {
    const { menu_code } = await params
    const body = await request.json()

    if (body.name_th !== undefined && !body.name_th.trim()) {
      return NextResponse.json({ error: 'name_th cannot be empty' }, { status: 400 })
    }

    if (body.category_code !== undefined && !body.category_code.trim()) {
      return NextResponse.json({ error: 'category_code cannot be empty' }, { status: 400 })
    }

    if (body.price !== undefined && !isValidIntegerPrice(body.price)) {
      return NextResponse.json({ error: 'price must be a valid integer (no decimals)' }, { status: 400 })
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (body.name_th !== undefined) updateData.name_th = body.name_th.trim()
    if (body.name_en !== undefined) updateData.name_en = body.name_en?.trim() || null
    if (body.category_code !== undefined) updateData.category_code = body.category_code.trim()
    if (body.barcode !== undefined) updateData.barcode = body.barcode?.trim() || null
    if (body.description !== undefined) updateData.description = body.description?.trim() || null
    if (body.price !== undefined) updateData.price = parseIntegerPrice(body.price)
    if (body.promo_price !== undefined) {
      if (body.promo_price === null) {
        updateData.promo_price = null
      } else {
        if (!isValidIntegerPrice(body.promo_price)) {
          return NextResponse.json({ error: 'promo_price must be a valid integer' }, { status: 400 })
        }
        updateData.promo_price = parseIntegerPrice(body.promo_price)
      }
    }
    if (body.promo_label !== undefined) updateData.promo_label = body.promo_label?.trim() || null
    if (body.promo_percent !== undefined) {
      if (body.promo_percent === null) {
        updateData.promo_percent = null
      } else {
        const pct = parseInt(body.promo_percent, 10)
        if (isNaN(pct) || pct < 0 || pct > 100) {
          return NextResponse.json({ error: 'promo_percent must be 0-100' }, { status: 400 })
        }
        updateData.promo_percent = pct
      }
    }
    if (body.image_url !== undefined) updateData.image_url = body.image_url?.trim() || null
    if (body.is_active !== undefined) updateData.is_active = body.is_active

    const { error } = await supabase
      .from('menu_items')
      .update(updateData as never)
      .eq('menu_code', menu_code)

    if (error) {
      console.error('[ADMIN_MENU_PATCH] Error:', error)
      return NextResponse.json({ error: 'Failed to update menu item' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ADMIN_MENU_PATCH] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ menu_code: string }> }
) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  if (!validateCsrf(request)) {
    return csrfError()
  }

  try {
    const { menu_code } = await params

    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('menu_code', menu_code)

    if (error) {
      console.error('[ADMIN_MENU_DELETE] Error:', error)
      return NextResponse.json({ error: 'Failed to delete menu item' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ADMIN_MENU_DELETE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
