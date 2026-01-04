import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { validateMenuData, ParsedMenuData, generateCode, parseIntegerPrice } from '@/lib/menu-import-validator'
import { checkAdminAuth } from '@/lib/admin-gate'

export async function POST(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  try {
    const data: ParsedMenuData = await request.json()

    // Apply fallbacks before validation
    let needsUncategorized = false

    // Process menu items for fallback values
    data.menu = data.menu.map(item => {
      const processedItem = { ...item }

      // Fallback: auto-generate menu_code if empty
      if (!processedItem.menu_code || processedItem.menu_code.trim() === '') {
        processedItem.menu_code = generateCode(`${item.menu_name}_${String(item.price ?? '')}`)
      }

      // Fallback: assign to Uncategorized if category_name empty
      if (!processedItem.category_name || processedItem.category_name.trim() === '') {
        processedItem.category_name = 'Uncategorized'
        needsUncategorized = true
      }

      return processedItem
    })

    // Ensure Uncategorized category exists if needed
    if (needsUncategorized) {
      const hasUncategorized = data.categories.some(cat => cat.category_name === 'Uncategorized')
      if (!hasUncategorized) {
        data.categories.push({ category_name: 'Uncategorized' })
      }
    }

    // Validate data
    const errors = validateMenuData(data)
    if (errors.length > 0) {
      return NextResponse.json({ errors }, { status: 400 })
    }

    // Build name-to-code maps for transformation
    const categoryNameToCode = new Map<string, string>()
    const groupNameToCode = new Map<string, string>()

    // 1. Transform and upsert categories
    for (const cat of data.categories) {
      const categoryCode = generateCode(cat.category_name)
      categoryNameToCode.set(cat.category_name.trim(), categoryCode)

      const { error } = await supabase
        .from('categories')
        .upsert({
          category_code: categoryCode,
          name: cat.category_name.trim(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'category_code'
        })

      if (error) {
        console.error('[IMPORT] Category upsert failed:', error)
        return NextResponse.json({ error: 'Failed to import categories' }, { status: 500 })
      }
    }

    // 2. Transform and upsert option_groups + options (from wide format)
    const optionGroupsToUpsert = new Map<string, { group_name: string; is_required: boolean; max_select: number }>()
    const optionsToUpsert: Array<{ option_code: string; group_code: string; option_name: string; price_delta: number; sort_order: number }> = []

    data.options.forEach(row => {
      const groupName = row.option_group_name.trim()
      const groupCode = generateCode(groupName)
      groupNameToCode.set(groupName, groupCode)

      // Store group metadata (will be deduplicated)
      optionGroupsToUpsert.set(groupCode, {
        group_name: groupName,
        is_required: row.is_required,
        max_select: row.max_select
      })

      // Extract options from wide format
      let sortOrder = 0
      for (let i = 1; i <= 6; i++) {
        const nameKey = `option_name_${i}` as keyof typeof row
        const priceKey = `price_${i}` as keyof typeof row
        const optionName = row[nameKey]
        const optionPrice = row[priceKey]

        if (optionName && optionName.toString().trim() !== '') {
          const optionCode = `${groupCode}_${sortOrder + 1}`
          optionsToUpsert.push({
            option_code: optionCode,
            group_code: groupCode,
            option_name: optionName.toString().trim(),
            price_delta: parseIntegerPrice(optionPrice),
            sort_order: sortOrder
          })
          sortOrder++
        }
      }
    })

    // Upsert option_groups
    for (const [groupCode, groupData] of optionGroupsToUpsert.entries()) {
      const { error } = await supabase
        .from('option_groups')
        .upsert({
          group_code: groupCode,
          group_name: groupData.group_name,
          is_required: groupData.is_required,
          max_select: groupData.max_select,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'group_code'
        })

      if (error) {
        console.error('[IMPORT] Option group upsert failed:', error)
        return NextResponse.json({ error: 'Failed to import option groups' }, { status: 500 })
      }
    }

    // Delete existing options for these groups, then insert new ones
    const groupCodes = Array.from(optionGroupsToUpsert.keys())
    if (groupCodes.length > 0) {
      const { error: deleteError } = await supabase
        .from('options')
        .delete()
        .in('group_code', groupCodes)

      if (deleteError) {
        console.error('[IMPORT] Options delete failed:', deleteError)
        return NextResponse.json({ error: 'Failed to clear existing options' }, { status: 500 })
      }
    }

    // Insert new options
    if (optionsToUpsert.length > 0) {
      const { error } = await supabase
        .from('options')
        .insert(optionsToUpsert)

      if (error) {
        console.error('[IMPORT] Options insert failed:', error)
        return NextResponse.json({ error: 'Failed to import options' }, { status: 500 })
      }
    }

    // 3. Transform and upsert menu_items
    for (const item of data.menu) {
      const categoryCode = categoryNameToCode.get(item.category_name.trim())
      if (!categoryCode) {
        console.error('[IMPORT] Category code not found for:', item.category_name)
        continue
      }

      const { error } = await supabase
        .from('menu_items')
        .upsert({
          menu_code: item.menu_code.trim(),
          category_code: categoryCode,
          name_th: item.menu_name.trim(),
          name_en: item.menu_name_2?.trim() || null,
          barcode: item.barcode?.trim() || null,
          description: item.description?.trim() || null,
          price: parseIntegerPrice(item.price),
          image_url: item.image_url?.trim() || null,
          is_active: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'menu_code'
        })

      if (error) {
        console.error('[IMPORT] Menu item upsert failed:', error)
        return NextResponse.json({ error: 'Failed to import menu items' }, { status: 500 })
      }
    }

    // 4. Replace menu_option_groups mappings
    const affectedMenuCodes = [...new Set(data.menu_option_groups.map(m => m.menu_code.trim()))]

    // Delete existing mappings for affected menus
    for (const menuCode of affectedMenuCodes) {
      const { error } = await supabase
        .from('menu_option_groups')
        .delete()
        .eq('menu_code', menuCode)

      if (error) {
        console.error('[IMPORT] Menu option groups delete failed:', error)
        return NextResponse.json({ error: 'Failed to clear menu option mappings' }, { status: 500 })
      }
    }

    // Insert new mappings (resolve option_group_name to group_code)
    const mappingsToInsert = data.menu_option_groups
      .map(m => {
        const groupCode = groupNameToCode.get(m.option_group_name.trim())
        if (!groupCode) {
          console.error('[IMPORT] Group code not found for:', m.option_group_name)
          return null
        }
        return {
          menu_code: m.menu_code.trim(),
          group_code: groupCode
        }
      })
      .filter(Boolean) as Array<{ menu_code: string; group_code: string }>

    if (mappingsToInsert.length > 0) {
      const { error } = await supabase
        .from('menu_option_groups')
        .insert(mappingsToInsert)

      if (error) {
        console.error('[IMPORT] Menu option groups insert failed:', error)
        return NextResponse.json({ error: 'Failed to import menu option mappings' }, { status: 500 })
      }
    }

    console.log('[IMPORT] Success')
    return NextResponse.json({
      success: true,
      counts: {
        categories: data.categories.length,
        menu: data.menu.length,
        option_groups: optionGroupsToUpsert.size,
        options: optionsToUpsert.length,
        menu_option_groups: mappingsToInsert.length
      }
    })
  } catch (error) {
    console.error('[IMPORT] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
