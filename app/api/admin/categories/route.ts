import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateCode } from '@/lib/menu-import-validator'
import { checkAdminAuth } from '@/lib/admin-gate'

export async function GET(request: NextRequest) {
  const authError = checkAdminAuth(request)
  if (authError) return authError

  try {
    const { data: categories, error } = await supabase
      .from('categories')
      .select('category_code, name')
      .order('name')

    if (error) {
      console.error('[ADMIN_CATEGORIES_GET] Error:', error)
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
    }

    return NextResponse.json({ categories })
  } catch (error) {
    console.error('[ADMIN_CATEGORIES_GET] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authError = checkAdminAuth(request)
  if (authError) return authError

  try {
    const body = await request.json()

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
    }

    const categoryCode = generateCode(body.name)

    const { error } = await supabase
      .from('categories')
      .insert({
        category_code: categoryCode,
        name: body.name.trim(),
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('[ADMIN_CATEGORIES_POST] Error:', error)
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Category code already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
    }

    return NextResponse.json({ success: true, category_code: categoryCode })
  } catch (error) {
    console.error('[ADMIN_CATEGORIES_POST] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
