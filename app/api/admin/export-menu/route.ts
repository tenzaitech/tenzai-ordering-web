import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/admin-gate'

type CategoryRow = {
  category_code: string
  name: string
}

type MenuItemRow = {
  menu_code: string
  category_code: string
  name_th: string
  name_en: string | null
  barcode: string | null
  description: string | null
  price: number
  image_url: string | null
  is_active: boolean
}

type OptionGroupRow = {
  group_code: string
  group_name: string
  is_required: boolean
  max_select: number
}

type OptionRow = {
  option_code: string
  group_code: string
  option_name: string
  price_delta: number
  sort_order: number
}

type MenuOptionGroupRow = {
  menu_code: string
  group_code: string
}

type ExportOptionRow = {
  option_group_name: string
  is_required: boolean
  max_select: number
  [key: string]: string | boolean | number
}

export async function GET(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  try {
    const { data: catData, error: catError } = await supabase
      .from('categories')
      .select('category_code, name')
      .order('category_code')

    if (catError) {
      console.error('[EXPORT] Categories fetch failed:', catError)
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
    }
    const categories = (catData ?? []) as CategoryRow[]

    const { data: menuData, error: menuError } = await supabase
      .from('menu_items')
      .select('menu_code, category_code, name_th, name_en, barcode, description, price, image_url, is_active')
      .order('menu_code')

    if (menuError) {
      console.error('[EXPORT] Menu items fetch failed:', menuError)
      return NextResponse.json({ error: 'Failed to fetch menu items' }, { status: 500 })
    }
    const menuItems = (menuData ?? []) as MenuItemRow[]

    const { data: groupData, error: groupError } = await supabase
      .from('option_groups')
      .select('group_code, group_name, is_required, max_select')
      .order('group_code')

    if (groupError) {
      console.error('[EXPORT] Option groups fetch failed:', groupError)
      return NextResponse.json({ error: 'Failed to fetch option groups' }, { status: 500 })
    }
    const optionGroups = (groupData ?? []) as OptionGroupRow[]

    const { data: optData, error: optError } = await supabase
      .from('options')
      .select('option_code, group_code, option_name, price_delta, sort_order')
      .order('group_code, sort_order')

    if (optError) {
      console.error('[EXPORT] Options fetch failed:', optError)
      return NextResponse.json({ error: 'Failed to fetch options' }, { status: 500 })
    }
    const options = (optData ?? []) as OptionRow[]

    const { data: mapData, error: mapError } = await supabase
      .from('menu_option_groups')
      .select('menu_code, group_code')
      .order('menu_code, group_code')

    if (mapError) {
      console.error('[EXPORT] Menu option groups fetch failed:', mapError)
      return NextResponse.json({ error: 'Failed to fetch menu option groups' }, { status: 500 })
    }
    const menuOptionGroups = (mapData ?? []) as MenuOptionGroupRow[]

    const categoryCodeToName = new Map<string, string>()
    categories?.forEach(cat => categoryCodeToName.set(cat.category_code, cat.name))

    const groupCodeToName = new Map<string, string>()
    optionGroups?.forEach(grp => groupCodeToName.set(grp.group_code, grp.group_name))

    const exportCategories = (categories || []).map(cat => ({
      category_name: cat.name
    }))

    const exportMenu = (menuItems || []).map(item => ({
      menu_code: item.menu_code,
      category_name: categoryCodeToName.get(item.category_code) || "",
      menu_name: item.name_th,
      menu_name_2: item.name_en || "",
      barcode: item.barcode || "",
      description: item.description || "",
      price: item.price,
      image_url: item.image_url || ""
    }))

    const exportOptions: ExportOptionRow[] = []
    const groupedOptions = new Map<string, OptionRow[]>()

    options?.forEach(opt => {
      if (!groupedOptions.has(opt.group_code)) {
        groupedOptions.set(opt.group_code, [])
      }
      groupedOptions.get(opt.group_code)!.push(opt)
    })

    optionGroups?.forEach(grp => {
      const grpOptions = groupedOptions.get(grp.group_code) || []
      const row: ExportOptionRow = {
        option_group_name: grp.group_name,
        is_required: grp.is_required,
        max_select: grp.max_select
      }
      for (let i = 0; i < 6; i++) {
        const opt = grpOptions[i]
        row["option_name_" + (i + 1)] = opt ? opt.option_name : ""
        row["price_" + (i + 1)] = opt ? opt.price_delta : ""
      }
      exportOptions.push(row)
    })

    const exportMenuOptionGroups = (menuOptionGroups || []).map(mapping => ({
      menu_code: mapping.menu_code,
      option_group_name: groupCodeToName.get(mapping.group_code) || ""
    }))

    // Generate xlsx server-side (vulnerability contained to server)
    const XLSX = await import("xlsx")
    const wb = XLSX.utils.book_new()

    const headers = {
      categories: ["category_name"],
      menu: ["menu_code", "category_name", "menu_name", "menu_name_2", "barcode", "description", "price", "image_url"],
      options: ["option_group_name", "is_required", "max_select", "option_name_1", "price_1", "option_name_2", "price_2", "option_name_3", "price_3", "option_name_4", "price_4", "option_name_5", "price_5", "option_name_6", "price_6"],
      menu_option_groups: ["menu_code", "option_group_name"]
    }

    const categoriesWs = XLSX.utils.aoa_to_sheet([headers.categories])
    if (exportCategories.length > 0) {
      XLSX.utils.sheet_add_json(categoriesWs, exportCategories, { header: headers.categories, skipHeader: true, origin: -1 })
    }
    XLSX.utils.book_append_sheet(wb, categoriesWs, "categories")

    const menuWs = XLSX.utils.aoa_to_sheet([headers.menu])
    if (exportMenu.length > 0) {
      XLSX.utils.sheet_add_json(menuWs, exportMenu, { header: headers.menu, skipHeader: true, origin: -1 })
    }
    XLSX.utils.book_append_sheet(wb, menuWs, "menu")

    const optionsWs = XLSX.utils.aoa_to_sheet([headers.options])
    if (exportOptions.length > 0) {
      XLSX.utils.sheet_add_json(optionsWs, exportOptions, { header: headers.options, skipHeader: true, origin: -1 })
    }
    XLSX.utils.book_append_sheet(wb, optionsWs, "options")

    const menuOptionGroupsWs = XLSX.utils.aoa_to_sheet([headers.menu_option_groups])
    if (exportMenuOptionGroups.length > 0) {
      XLSX.utils.sheet_add_json(menuOptionGroupsWs, exportMenuOptionGroups, { header: headers.menu_option_groups, skipHeader: true, origin: -1 })
    }
    XLSX.utils.book_append_sheet(wb, menuOptionGroupsWs, "menu_option_groups")

    const xlsxBuffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
    const today = new Date().toISOString().split("T")[0]
    const filename = "tenzai-menu-export-" + today + ".xlsx"

    return new NextResponse(xlsxBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=\"" + filename + "\"",
        "Cache-Control": "no-store"
      }
    })
  } catch (error) {
    console.error("[EXPORT] Unexpected error:", error)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
