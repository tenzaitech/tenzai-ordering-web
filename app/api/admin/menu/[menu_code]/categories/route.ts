import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/admin-gate'
import { validateCsrf, csrfError } from '@/lib/csrf'

type CategoryAssignment = {
  category_code: string
  sort_order: number
}

// GET: Fetch all category assignments for a menu item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ menu_code: string }> }
) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  try {
    const { menu_code } = await params

    const { data, error } = await supabase
      .from('menu_item_categories')
      .select('category_code, sort_order')
      .eq('menu_code', menu_code)
      .order('sort_order')

    if (error) {
      console.error('[MENU_CATEGORIES_GET] Error:', error)
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
    }

    return NextResponse.json({ categories: data || [] })
  } catch (error) {
    console.error('[MENU_CATEGORIES_GET] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST: Set all category assignments for a menu item (replaces existing)
export async function POST(
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
    const categories: CategoryAssignment[] = body.categories || []

    if (!Array.isArray(categories)) {
      return NextResponse.json({ error: 'categories must be an array' }, { status: 400 })
    }

    // Delete existing assignments
    const { error: deleteError } = await supabase
      .from('menu_item_categories')
      .delete()
      .eq('menu_code', menu_code)

    if (deleteError) {
      console.error('[MENU_CATEGORIES_POST] Delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to update categories' }, { status: 500 })
    }

    // Insert new assignments
    if (categories.length > 0) {
      const insertData = categories.map((cat, index) => ({
        menu_code,
        category_code: cat.category_code,
        sort_order: cat.sort_order ?? index
      }))

      const { error: insertError } = await supabase
        .from('menu_item_categories')
        .insert(insertData as never[])

      if (insertError) {
        console.error('[MENU_CATEGORIES_POST] Insert error:', insertError)
        return NextResponse.json({ error: 'Failed to insert categories' }, { status: 500 })
      }
    }

    // Also update the primary category_code in menu_items (for backward compatibility)
    if (categories.length > 0) {
      await supabase
        .from('menu_items')
        .update({ category_code: categories[0].category_code } as never)
        .eq('menu_code', menu_code)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[MENU_CATEGORIES_POST] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
