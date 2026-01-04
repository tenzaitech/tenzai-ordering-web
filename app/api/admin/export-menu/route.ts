import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/admin-gate'

export async function GET(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  try {
    // Fetch all canonical data
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('category_code, name')
      .order('category_code')

    if (catError) {
      console.error('[EXPORT] Categories fetch failed:', catError)
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
    }

    const { data: menuItems, error: menuError } = await supabase
      .from('menu_items')
      .select('menu_code, category_code, name_th, name_en, barcode, description, price, image_url, is_active')
      .order('menu_code')

    if (menuError) {
      console.error('[EXPORT] Menu items fetch failed:', menuError)
      return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 })
    }

    const { data: optionGroups, error: groupError } = await supabase
      .from('option_groups')
      .select('group_code, group_name, is_required, max_select')
      .order('group_code')

    if (groupError) {
      console.error('[EXPORT] Option groups fetch failed:', groupError)
      return NextResponse.json({ error: 'Failed to fetch option groups' }, { status: 500 })
    }

    const { data: options, error: optError } = await supabase
      .from('options')
      .select('option_code, group_code, option_name, price_delta, sort_order')
      .order('group_code, sort_order')

    if (optError) {
      console.error('[EXPORT] Options fetch failed:', optError)
      return NextResponse.json({ error: 'Failed to fetch options' }, { status: 500 })
    }

    const { data: menuOptionGroups, error: mapError } = await supabase
      .from('menu_option_groups')
      .select('menu_code, group_code')
      .order('menu_code, group_code')

    if (mapError) {
      console.error('[EXPORT] Menu option groups fetch failed:', mapError)
      return NextResponse.json({ error: 'Failed to fetch menu option groups' }, { status: 500 })
    }

    // Build lookup maps
    const categoryCodeToName = new Map<string, string>()
    categories?.forEach(cat => categoryCodeToName.set(cat.category_code, cat.name))

    const groupCodeToName = new Map<string, string>()
    optionGroups?.forEach(grp => groupCodeToName.set(grp.group_code, grp.group_name))

    // Transform to human-friendly format

    // 1. Categories (just names)
    const exportCategories = (categories || []).map(cat => ({
      category_name: cat.name
    }))

    // 2. Menu (resolve category_code to category_name)
    const exportMenu = (menuItems || []).map(item => ({
      menu_code: item.menu_code,
      category_name: categoryCodeToName.get(item.category_code) || '',
      menu_name: item.name_th,
      menu_name_2: item.name_en || '',
      barcode: item.barcode || '',
      description: item.description || '',
      price: item.price,
      image_url: item.image_url || ''
    }))

    // 3. Options (wide format: one row per group)
    const exportOptions: any[] = []
    const groupedOptions = new Map<string, any[]>()

    options?.forEach(opt => {
      if (!groupedOptions.has(opt.group_code)) {
        groupedOptions.set(opt.group_code, [])
      }
      groupedOptions.get(opt.group_code)!.push(opt)
    })

    optionGroups?.forEach(grp => {
      const grpOptions = groupedOptions.get(grp.group_code) || []
      const row: any = {
        option_group_name: grp.group_name,
        is_required: grp.is_required,
        max_select: grp.max_select
      }

      // Add up to 6 option slots
      for (let i = 0; i < 6; i++) {
        const opt = grpOptions[i]
        row[`option_name_${i + 1}`] = opt ? opt.option_name : ''
        row[`price_${i + 1}`] = opt ? opt.price_delta : ''
      }

      exportOptions.push(row)
    })

    // 4. Menu-Option Groups (resolve group_code to option_group_name)
    const exportMenuOptionGroups = (menuOptionGroups || []).map(mapping => ({
      menu_code: mapping.menu_code,
      option_group_name: groupCodeToName.get(mapping.group_code) || ''
    }))

    return NextResponse.json({
      categories: exportCategories,
      menu: exportMenu,
      options: exportOptions,
      menu_option_groups: exportMenuOptionGroups
    })
  } catch (error) {
    console.error('[EXPORT] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
