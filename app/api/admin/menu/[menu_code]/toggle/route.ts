import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/admin-gate'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ menu_code: string }> }
) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  try {
    const { menu_code } = await params
    const body = await request.json()

    if (typeof body.is_active !== 'boolean') {
      return NextResponse.json({ error: 'is_active must be a boolean' }, { status: 400 })
    }

    const { error } = await supabase
      .from('menu_items')
      .update({
        is_active: body.is_active,
        updated_at: new Date().toISOString()
      })
      .eq('menu_code', menu_code)

    if (error) {
      console.error('[ADMIN_MENU_TOGGLE] Error:', error)
      return NextResponse.json({ error: 'Failed to toggle active status' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ADMIN_MENU_TOGGLE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
