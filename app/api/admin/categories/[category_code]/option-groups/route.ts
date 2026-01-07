import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/admin-gate'

// GET: Fetch all option group assignments for a category
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category_code: string }> }
) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  try {
    const { category_code } = await params

    const { data, error } = await supabase
      .from('category_option_groups')
      .select('group_code')
      .eq('category_code', category_code)

    if (error) {
      console.error('[CATEGORY_OPTION_GROUPS_GET] Error:', error)
      return NextResponse.json({ error: 'Failed to fetch option groups' }, { status: 500 })
    }

    return NextResponse.json({ group_codes: (data || []).map(d => d.group_code) })
  } catch (error) {
    console.error('[CATEGORY_OPTION_GROUPS_GET] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST: Set all option group assignments for a category (replaces existing)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ category_code: string }> }
) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  try {
    const { category_code } = await params
    const body = await request.json()
    const groupCodes: string[] = body.group_codes || []

    if (!Array.isArray(groupCodes)) {
      return NextResponse.json({ error: 'group_codes must be an array' }, { status: 400 })
    }

    // Delete existing assignments
    const { error: deleteError } = await supabase
      .from('category_option_groups')
      .delete()
      .eq('category_code', category_code)

    if (deleteError) {
      console.error('[CATEGORY_OPTION_GROUPS_POST] Delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to update option groups' }, { status: 500 })
    }

    // Insert new assignments
    if (groupCodes.length > 0) {
      const insertData = groupCodes.map(groupCode => ({
        category_code,
        group_code: groupCode
      }))

      const { error: insertError } = await supabase
        .from('category_option_groups')
        .insert(insertData as never[])

      if (insertError) {
        console.error('[CATEGORY_OPTION_GROUPS_POST] Insert error:', insertError)
        return NextResponse.json({ error: 'Failed to insert option groups' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CATEGORY_OPTION_GROUPS_POST] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
