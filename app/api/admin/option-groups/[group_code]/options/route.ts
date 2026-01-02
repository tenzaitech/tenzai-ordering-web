import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { parseIntegerDelta, isValidIntegerDelta } from '@/lib/menu-import-validator'
import { checkAdminAuth } from '@/lib/admin-gate'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ group_code: string }> }
) {
  const authError = checkAdminAuth(request)
  if (authError) return authError

  try {
    const { group_code } = await params
    const body = await request.json()

    if (!body.option_name || !body.option_name.trim()) {
      return NextResponse.json({ error: 'option_name is required' }, { status: 400 })
    }

    if (!isValidIntegerDelta(body.price_delta)) {
      return NextResponse.json({ error: 'price_delta must be a valid integer' }, { status: 400 })
    }

    const priceDelta = parseIntegerDelta(body.price_delta)

    const { data: maxSortOrder } = await supabase
      .from('options')
      .select('sort_order')
      .eq('group_code', group_code)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const nextSortOrder = maxSortOrder ? maxSortOrder.sort_order + 1 : 0

    const optionCode = `${group_code}_${Date.now()}`

    const { error } = await supabase
      .from('options')
      .insert({
        option_code: optionCode,
        group_code: group_code,
        option_name: body.option_name.trim(),
        price_delta: priceDelta,
        sort_order: nextSortOrder
      })

    if (error) {
      console.error('[ADMIN_OPTIONS_POST] Error:', error)
      return NextResponse.json({ error: 'Failed to create option' }, { status: 500 })
    }

    return NextResponse.json({ success: true, option_code: optionCode })
  } catch (error) {
    console.error('[ADMIN_OPTIONS_POST] Unexpected error:', error)
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

    if (body.reorder) {
      const updates = body.reorder as Array<{ option_code: string; sort_order: number }>

      for (const update of updates) {
        await supabase
          .from('options')
          .update({ sort_order: update.sort_order })
          .eq('option_code', update.option_code)
          .eq('group_code', group_code)
      }

      return NextResponse.json({ success: true })
    }

    if (!body.option_code) {
      return NextResponse.json({ error: 'option_code is required' }, { status: 400 })
    }

    const updateData: any = {}

    if (body.option_name !== undefined) {
      if (!body.option_name.trim()) {
        return NextResponse.json({ error: 'option_name cannot be empty' }, { status: 400 })
      }
      updateData.option_name = body.option_name.trim()
    }

    if (body.price_delta !== undefined) {
      if (!isValidIntegerDelta(body.price_delta)) {
        return NextResponse.json({ error: 'price_delta must be a valid integer' }, { status: 400 })
      }
      updateData.price_delta = parseIntegerDelta(body.price_delta)
    }

    const { error } = await supabase
      .from('options')
      .update(updateData)
      .eq('option_code', body.option_code)
      .eq('group_code', group_code)

    if (error) {
      console.error('[ADMIN_OPTIONS_PATCH] Error:', error)
      return NextResponse.json({ error: 'Failed to update option' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ADMIN_OPTIONS_PATCH] Unexpected error:', error)
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
    const { searchParams } = new URL(request.url)
    const optionCode = searchParams.get('option_code')

    if (!optionCode) {
      return NextResponse.json({ error: 'option_code is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('options')
      .delete()
      .eq('option_code', optionCode)
      .eq('group_code', group_code)

    if (error) {
      console.error('[ADMIN_OPTIONS_DELETE] Error:', error)
      return NextResponse.json({ error: 'Failed to delete option' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ADMIN_OPTIONS_DELETE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
