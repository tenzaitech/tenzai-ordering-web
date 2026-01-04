import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/admin-gate'

type MenuOptionGroupRow = {
  group_code: string
}

type MenuOptionGroupInsert = {
  menu_code: string
  group_code: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ menu_code: string }> }
) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  try {
    const { menu_code } = await params

    const { data, error } = await supabase
      .from('menu_option_groups')
      .select('group_code')
      .eq('menu_code', menu_code)

    if (error) {
      console.error('[ADMIN_MENU_OPTION_GROUPS_GET] Error:', error)
      return NextResponse.json({ error: 'Failed to fetch menu option groups' }, { status: 500 })
    }

    const mappings = (data ?? []) as MenuOptionGroupRow[]
    return NextResponse.json({ group_codes: mappings.map(m => m.group_code) })
  } catch (error) {
    console.error('[ADMIN_MENU_OPTION_GROUPS_GET] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ menu_code: string }> }
) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  try {
    const { menu_code } = await params
    const body = await request.json()

    if (!Array.isArray(body.group_codes)) {
      return NextResponse.json({ error: 'group_codes must be an array' }, { status: 400 })
    }

    await supabase
      .from('menu_option_groups')
      .delete()
      .eq('menu_code', menu_code)

    if (body.group_codes.length > 0) {
      const mappings: MenuOptionGroupInsert[] = body.group_codes.map((group_code: string) => ({
        menu_code,
        group_code
      }))

      const { error } = await supabase
        .from('menu_option_groups')
        .insert(mappings as never)

      if (error) {
        console.error('[ADMIN_MENU_OPTION_GROUPS_POST] Error:', error)
        return NextResponse.json({ error: 'Failed to update menu option groups' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ADMIN_MENU_OPTION_GROUPS_POST] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
