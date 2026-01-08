import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { isCategoryAvailable, type CategorySchedule } from '@/lib/categorySchedule'

type CartItemInput = {
  menuId: string
}

type MenuItemCategory = {
  menu_code: string
  category_code: string
}

/**
 * POST /api/order/validate-cart
 * Validates cart items against category schedules.
 * Returns 400 if any item's category is outside its schedule window.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const items: CartItemInput[] = body.items || []

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ valid: true })
    }

    // Get unique menu codes from cart
    const menuCodes = Array.from(new Set(items.map(item => item.menuId).filter(Boolean)))

    if (menuCodes.length === 0) {
      return NextResponse.json({ valid: true })
    }

    // Fetch category assignments for these menu items
    const [menuCategoriesResult, schedulesResult] = await Promise.all([
      supabase
        .from('menu_item_categories')
        .select('menu_code, category_code')
        .in('menu_code', menuCodes),
      supabase
        .from('category_schedules')
        .select('category_code, day_of_week, start_time, end_time')
    ])

    const menuCategories = (menuCategoriesResult.data ?? []) as MenuItemCategory[]
    const schedules = (schedulesResult.data ?? []) as CategorySchedule[]

    // If no schedules exist, everything is available
    if (schedules.length === 0) {
      return NextResponse.json({ valid: true })
    }

    // Also fetch legacy category_code from menu_items for items without menu_item_categories
    const { data: legacyMenuItems } = await supabase
      .from('menu_items')
      .select('menu_code, category_code')
      .in('menu_code', menuCodes)

    // Build menu_code -> category_codes map
    const menuCategoryMap = new Map<string, string[]>()
    for (const mc of menuCategories) {
      if (!menuCategoryMap.has(mc.menu_code)) {
        menuCategoryMap.set(mc.menu_code, [])
      }
      menuCategoryMap.get(mc.menu_code)!.push(mc.category_code)
    }

    // Fallback to legacy category_code if no multi-category assignment
    for (const item of (legacyMenuItems ?? [])) {
      if (!menuCategoryMap.has(item.menu_code) && item.category_code) {
        menuCategoryMap.set(item.menu_code, [item.category_code])
      }
    }

    // Get unique category codes that need schedule checking
    const allCategoryCodes = new Set<string>()
    for (const codes of Array.from(menuCategoryMap.values())) {
      for (const code of codes) {
        allCategoryCodes.add(code)
      }
    }

    // Check availability for each category
    const unavailableCategories: { code: string; nextWindow?: { start: string; end: string } }[] = []

    for (const categoryCode of Array.from(allCategoryCodes)) {
      const result = isCategoryAvailable(categoryCode, schedules)
      if (!result.available) {
        unavailableCategories.push({ code: categoryCode, nextWindow: result.nextWindow })
      }
    }

    // If any category is unavailable, find which cart items are affected
    if (unavailableCategories.length > 0) {
      const unavailableCodes = new Set(unavailableCategories.map(c => c.code))
      const invalidItems: { menuId: string; category: string; nextWindow?: { start: string; end: string } }[] = []

      for (const item of items) {
        const categories = menuCategoryMap.get(item.menuId) || []
        for (const cat of categories) {
          if (unavailableCodes.has(cat)) {
            const catInfo = unavailableCategories.find(c => c.code === cat)
            invalidItems.push({
              menuId: item.menuId,
              category: cat,
              nextWindow: catInfo?.nextWindow
            })
            break // Only report once per item
          }
        }
      }

      if (invalidItems.length > 0) {
        // Build error message
        const categoryNames = await getCategoryNames(Array.from(unavailableCodes))
        const messages = invalidItems.map(item => {
          const catName = categoryNames.get(item.category) || item.category
          if (item.nextWindow) {
            return `${catName}: available ${item.nextWindow.start}–${item.nextWindow.end}`
          }
          return `${catName}: currently unavailable`
        })

        return NextResponse.json({
          valid: false,
          error: 'Some items are outside their category schedule',
          error_th: 'บางรายการไม่อยู่ในช่วงเวลาที่เปิดให้บริการ',
          details: Array.from(new Set(messages)),
          invalidItems
        }, { status: 400 })
      }
    }

    return NextResponse.json({ valid: true })
  } catch (error) {
    console.error('[VALIDATE_CART] Error:', error)
    // On error, allow the order to proceed (fail-open for order flow)
    return NextResponse.json({ valid: true })
  }
}

async function getCategoryNames(codes: string[]): Promise<Map<string, string>> {
  const { data } = await supabase
    .from('categories')
    .select('category_code, name')
    .in('category_code', codes)

  const map = new Map<string, string>()
  for (const row of (data ?? [])) {
    map.set(row.category_code, row.name)
  }
  return map
}
