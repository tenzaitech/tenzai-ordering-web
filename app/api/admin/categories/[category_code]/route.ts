import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/admin-gate'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ category_code: string }> }
) {
  const authError = checkAdminAuth(request)
  if (authError) return authError

  try {
    const { category_code } = await params
    const body = await request.json()

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('categories')
      .update({
        name: body.name.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('category_code', category_code)

    if (error) {
      console.error('[ADMIN_CATEGORIES_PATCH] Error:', error)
      return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ADMIN_CATEGORIES_PATCH] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ category_code: string }> }
) {
  const authError = checkAdminAuth(request)
  if (authError) return authError

  try {
    const { category_code } = await params

    const { count } = await supabase
      .from('menu_items')
      .select('*', { count: 'exact', head: true })
      .eq('category_code', category_code)

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete category: ${count} menu item(s) are using this category` },
        { status: 409 }
      )
    }

    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('category_code', category_code)

    if (error) {
      console.error('[ADMIN_CATEGORIES_DELETE] Error:', error)
      return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ADMIN_CATEGORIES_DELETE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
