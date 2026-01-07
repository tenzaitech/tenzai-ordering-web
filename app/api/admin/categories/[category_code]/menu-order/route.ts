import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/admin-gate'

// POST: Update sort order for menu items within a category
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ category_code: string }> }
) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  try {
    const { category_code } = await params
    const body = await request.json()
    const menuCodes: string[] = body.menu_codes || []

    if (!Array.isArray(menuCodes)) {
      return NextResponse.json({ error: 'menu_codes must be an array' }, { status: 400 })
    }

    // Update sort_order for each menu item in this category
    const updates = menuCodes.map((menuCode, index) =>
      supabase
        .from('menu_item_categories')
        .update({ sort_order: index } as never)
        .eq('menu_code', menuCode)
        .eq('category_code', category_code)
    )

    const results = await Promise.all(updates)

    const errors = results.filter(r => r.error)
    if (errors.length > 0) {
      console.error('[CATEGORY_MENU_ORDER] Errors:', errors.map(e => e.error))
      return NextResponse.json({ error: 'Failed to update some orders' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CATEGORY_MENU_ORDER] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// GET: Fetch menu items in this category ordered by sort_order
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category_code: string }> }
) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  try {
    const { category_code } = await params

    const { data, error } = await supabase
      .from('menu_item_categories')
      .select(`
        menu_code,
        sort_order,
        menu_items (
          name_th,
          name_en,
          price,
          image_url,
          is_active
        )
      `)
      .eq('category_code', category_code)
      .order('sort_order')

    if (error) {
      console.error('[CATEGORY_MENU_ORDER_GET] Error:', error)
      return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 })
    }

    return NextResponse.json({ items: data || [] })
  } catch (error) {
    console.error('[CATEGORY_MENU_ORDER_GET] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
