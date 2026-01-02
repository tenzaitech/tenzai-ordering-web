import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/admin-gate'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ group_code: string }> }
) {
  const authError = checkAdminAuth(request)
  if (authError) return authError

  try {
    const { group_code } = await params

    const { data: group, error: groupError } = await supabase
      .from('option_groups')
      .select('group_code, group_name, is_required, max_select, updated_at')
      .eq('group_code', group_code)
      .single()

    if (groupError) {
      console.error('[ADMIN_OPTION_GROUP_GET] Error:', groupError)
      return NextResponse.json({ error: 'Option group not found' }, { status: 404 })
    }

    const { data: options, error: optionsError } = await supabase
      .from('options')
      .select('option_code, option_name, price_delta, sort_order')
      .eq('group_code', group_code)
      .order('sort_order')

    if (optionsError) {
      console.error('[ADMIN_OPTION_GROUP_GET] Options error:', optionsError)
      return NextResponse.json({ error: 'Failed to fetch options' }, { status: 500 })
    }

    return NextResponse.json({ group, options: options || [] })
  } catch (error) {
    console.error('[ADMIN_OPTION_GROUP_GET] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ group_code: string }> }
) {
  const authError = checkAdminAuth(request)
  if (authError) return authError

  try {
    const { group_code } = await params
    const body = await request.json()

    const updateData: any = {
      updated_at: new Date().toISOString()
    }

    if (body.group_name !== undefined) {
      if (!body.group_name.trim()) {
        return NextResponse.json({ error: 'group_name cannot be empty' }, { status: 400 })
      }
      updateData.group_name = body.group_name.trim()
    }

    if (body.is_required !== undefined) {
      if (typeof body.is_required !== 'boolean') {
        return NextResponse.json({ error: 'is_required must be a boolean' }, { status: 400 })
      }
      updateData.is_required = body.is_required
    }

    if (body.max_select !== undefined) {
      if (typeof body.max_select !== 'number' || body.max_select < 1) {
        return NextResponse.json({ error: 'max_select must be >= 1' }, { status: 400 })
      }
      updateData.max_select = body.max_select
    }

    const { error } = await supabase
      .from('option_groups')
      .update(updateData)
      .eq('group_code', group_code)

    if (error) {
      console.error('[ADMIN_OPTION_GROUP_PATCH] Error:', error)
      return NextResponse.json({ error: 'Failed to update option group' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ADMIN_OPTION_GROUP_PATCH] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ group_code: string }> }
) {
  const authError = checkAdminAuth(request)
  if (authError) return authError

  try {
    const { group_code } = await params

    const { count } = await supabase
      .from('menu_option_groups')
      .select('*', { count: 'exact', head: true })
      .eq('group_code', group_code)

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete option group: ${count} menu item(s) are using this group` },
        { status: 409 }
      )
    }

    await supabase
      .from('options')
      .delete()
      .eq('group_code', group_code)

    const { error } = await supabase
      .from('option_groups')
      .delete()
      .eq('group_code', group_code)

    if (error) {
      console.error('[ADMIN_OPTION_GROUP_DELETE] Error:', error)
      return NextResponse.json({ error: 'Failed to delete option group' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ADMIN_OPTION_GROUP_DELETE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
