import { supabase } from '@/lib/supabase'
import MenuListClient from './MenuListClient'

export const dynamic = 'force-dynamic'

type MenuItem = {
  menu_code: string
  category_code: string
  name_th: string
  name_en: string | null
  price: number
  promo_price: number | null
  promo_label: string | null
  image_url: string | null
  is_active: boolean
  updated_at: string
}

type Category = {
  category_code: string
  name: string
}

type MenuItemCategory = {
  menu_code: string
  category_code: string
}

async function getMenuData() {
  const [categoriesResult, menuItemsResult, menuItemCategoriesResult, popularResult] = await Promise.all([
    supabase
      .from('categories')
      .select('category_code, name')
      .order('name'),
    supabase
      .from('menu_items')
      .select('menu_code, category_code, name_th, name_en, price, promo_price, promo_label, image_url, is_active, updated_at')
      .order('updated_at', { ascending: false }),
    supabase
      .from('menu_item_categories')
      .select('menu_code, category_code'),
    supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'popular_menus')
      .single()
  ])

  if (categoriesResult.error || menuItemsResult.error) {
    console.error('[ADMIN_MENU] Fetch error:', categoriesResult.error || menuItemsResult.error)
    return { categories: [], menuItems: [], popularMenus: [], menuCategoryMap: {} }
  }

  const popularValue = popularResult.data?.value as { menu_codes?: string[] } | undefined
  const popularMenus: string[] = popularValue?.menu_codes || []

  // Build map of menu_code -> category_codes
  const menuCategoryMap: Record<string, string[]> = {}
  const menuItemCategories = (menuItemCategoriesResult.data ?? []) as MenuItemCategory[]
  for (const mic of menuItemCategories) {
    if (!menuCategoryMap[mic.menu_code]) {
      menuCategoryMap[mic.menu_code] = []
    }
    menuCategoryMap[mic.menu_code].push(mic.category_code)
  }

  return {
    categories: categoriesResult.data as Category[],
    menuItems: menuItemsResult.data as MenuItem[],
    popularMenus,
    menuCategoryMap
  }
}

export default async function AdminMenuPage() {
  const { categories, menuItems, popularMenus, menuCategoryMap } = await getMenuData()

  return <MenuListClient categories={categories} menuItems={menuItems} popularMenus={popularMenus} menuCategoryMap={menuCategoryMap} />
}
