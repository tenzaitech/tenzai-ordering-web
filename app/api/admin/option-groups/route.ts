import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { generateCode } from '@/lib/menu-import-validator'
import { checkAdminAuth } from '@/lib/admin-gate'

export async function GET(request: NextRequest) {
  const authError = checkAdminAuth(request)
  if (authError) return authError

  try {
    const { data: optionGroups, error } = await supabase
      .from('option_groups')
      .select('group_code, group_name, is_required, max_select, updated_at')
      .order('group_name')

    if (error) {
      console.error('[ADMIN_OPTION_GROUPS_GET] Error:', error)
      return NextResponse.json({ error: 'Failed to fetch option groups' }, { status: 500 })
    }

    return NextResponse.json({ optionGroups })
  } catch (error) {
    console.error('[ADMIN_OPTION_GROUPS_GET] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authError = checkAdminAuth(request)
  if (authError) return authError

  try {
    const body = await request.json()

    if (!body.group_name || !body.group_name.trim()) {
      return NextResponse.json({ error: 'group_name is required' }, { status: 400 })
    }

    if (typeof body.is_required !== 'boolean') {
      return NextResponse.json({ error: 'is_required must be a boolean' }, { status: 400 })
    }

    if (typeof body.max_select !== 'number' || body.max_select < 1) {
      return NextResponse.json({ error: 'max_select must be >= 1' }, { status: 400 })
    }

    const groupCode = generateCode(body.group_name)

    const { error } = await supabase
      .from('option_groups')
      .insert({
        group_code: groupCode,
        group_name: body.group_name.trim(),
        is_required: body.is_required,
        max_select: body.max_select,
        updated_at: new Date().toISOString()
      })

    if (error) {
      console.error('[ADMIN_OPTION_GROUPS_POST] Error:', error)
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Option group already exists' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to create option group' }, { status: 500 })
    }

    return NextResponse.json({ success: true, group_code: groupCode })
  } catch (error) {
    console.error('[ADMIN_OPTION_GROUPS_POST] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
