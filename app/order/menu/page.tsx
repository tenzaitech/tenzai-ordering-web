import { supabase } from '@/lib/supabase'
import { getMenuDataCached } from '@/lib/cache/menuCache'
import menuData from '@/data/menu.json'
import MenuClient from './MenuClient'
import { buildCategoryAvailabilityMap, type CategorySchedule } from '@/lib/categorySchedule'

export const dynamic = 'force-dynamic'

const CATEGORY_ORDER_KEY = 'category_order'
const POPULAR_MENUS_KEY = 'popular_menus'
const HIDDEN_CATEGORIES_KEY = 'hidden_categories'

type MenuItem = {
  id: string
  name_th: string
  name_en: string
  category: string
  category_th: string
  category_en: string
  price_thb: number
  promo_price?: number
  promo_label?: string
  promo_percent?: number | null  // Manual percent badge (0-100), null = no badge
  image: string
  is_sold_out: boolean
  description?: string
  subtitle?: string
  options?: any[]
  image_focus_y_1x1?: number
}

type CategoryRow = {
  category_code: string
  name: string
}

type MenuItemRow = {
  menu_code: string
  category_code: string
  name_th: string
  name_en: string | null
  price: number
  promo_price: number | null
  promo_label: string | null
  promo_percent: number | null
  image_url: string | null
  is_active: boolean
  description: string | null
  image_focus_y_1x1: number | null
}

type MenuItemCategoryRow = {
  menu_code: string
  category_code: string
  sort_order: number
}

type CategoryScheduleRow = {
  category_code: string
  day_of_week: number
  start_time: string
  end_time: string
}

/**
 * Fetch category display order from system_settings.
 * Returns empty array if not set (use default order).
 */
async function fetchCategoryOrder(): Promise<string[]> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', CATEGORY_ORDER_KEY)
    .single()

  const value = data?.value as { order?: string[] } | undefined
  if (error || !value?.order) {
    return []
  }

  return value.order
}

/**
 * Fetch popular menu codes from system_settings.
 */
async function fetchPopularMenus(): Promise<string[]> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', POPULAR_MENUS_KEY)
    .single()

  const value = data?.value as { menu_codes?: string[] } | undefined
  if (error || !value?.menu_codes) {
    return []
  }

  return value.menu_codes
}

/**
 * Fetch hidden category codes from system_settings.
 */
async function fetchHiddenCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', HIDDEN_CATEGORIES_KEY)
    .single()

  const value = data?.value as { hidden?: string[] } | undefined
  if (error || !value?.hidden) {
    return []
  }

  return value.hidden
}

/**
 * Sort category names by saved order (which uses category_codes).
 * @param categoryNames Array of category display names
 * @param categoryCodeToName Map from category_code to name
 * @param orderCodes Array of category_codes in desired order
 */
function sortCategoriesByOrder(
  categoryNames: string[],
  categoryCodeToName: Map<string, string>,
  orderCodes: string[]
): string[] {
  if (orderCodes.length === 0) return categoryNames

  // Build reverse map: name → code
  const nameToCode = new Map<string, string>()
  for (const [code, name] of Array.from(categoryCodeToName)) {
    nameToCode.set(name, code)
  }

  // Build order map: code → index
  const orderMap = new Map(orderCodes.map((code, idx) => [code, idx]))

  return [...categoryNames].sort((a, b) => {
    const aCode = nameToCode.get(a)
    const bCode = nameToCode.get(b)
    const aIdx = aCode ? (orderMap.get(aCode) ?? Infinity) : Infinity
    const bIdx = bCode ? (orderMap.get(bCode) ?? Infinity) : Infinity
    return aIdx - bIdx
  })
}

/**
 * Fetch menu data from Supabase with parallel queries.
 * This is the raw fetch function; caching is handled by getMenuDataCached.
 * Only returns data when BOTH queries succeed - ensures cache stores complete data.
 */
async function fetchMenuDataFromDB() {
  // Run all queries in parallel (saves ~200-300ms)
  const [categoriesResult, menuItemsResult, menuItemCategoriesResult, schedulesResult, categoryOrder, popularMenus, hiddenCategories] = await Promise.all([
    supabase
      .from('categories')
      .select('category_code, name')
      .order('category_code'),
    supabase
      .from('menu_items')
      .select('menu_code, category_code, name_th, name_en, price, promo_price, promo_label, promo_percent, image_url, is_active, description, image_focus_y_1x1')
      .eq('is_active', true)
      .order('menu_code'),
    supabase
      .from('menu_item_categories')
      .select('menu_code, category_code, sort_order')
      .order('sort_order'),
    supabase
      .from('category_schedules')
      .select('category_code, day_of_week, start_time, end_time'),
    fetchCategoryOrder(),
    fetchPopularMenus(),
    fetchHiddenCategories()
  ])

  // Explicit error handling: fail if either query has an error
  if (categoriesResult.error) {
    throw new Error(`Categories query failed: ${categoriesResult.error.message}`)
  }
  if (menuItemsResult.error) {
    throw new Error(`Menu items query failed: ${menuItemsResult.error.message}`)
  }
  // menu_item_categories and schedules are optional, don't fail on error

  const dbCategories = (categoriesResult.data ?? []) as CategoryRow[]
  const dbMenuItems = (menuItemsResult.data ?? []) as MenuItemRow[]
  const dbMenuItemCategories = (menuItemCategoriesResult.data ?? []) as MenuItemCategoryRow[]
  const dbSchedules = (schedulesResult.data ?? []) as CategorySchedule[]

  // Only cache when both queries return data
  if (dbCategories.length > 0 && dbMenuItems.length > 0) {
    const categoryMap = new Map(dbCategories.map(cat => [cat.category_code, cat.name]))

    // Filter out hidden categories
    const visibleCategoryCodes = new Set(
      dbCategories
        .filter(cat => !hiddenCategories.includes(cat.category_code))
        .map(cat => cat.category_code)
    )

    // Build menu item lookup
    const menuItemMap = new Map(dbMenuItems.map(item => [item.menu_code, item]))

    // Build multi-category assignments: menu_code -> [category_codes with sort_order]
    const menuCategoryAssignments = new Map<string, { category_code: string; sort_order: number }[]>()
    for (const mic of dbMenuItemCategories) {
      if (!menuCategoryAssignments.has(mic.menu_code)) {
        menuCategoryAssignments.set(mic.menu_code, [])
      }
      menuCategoryAssignments.get(mic.menu_code)!.push({
        category_code: mic.category_code,
        sort_order: mic.sort_order
      })
    }

    // Transform items: items can appear in multiple categories
    // We create one entry per menu_code+category_code combination
    const transformedItems: MenuItem[] = []
    const seenCombinations = new Set<string>()

    for (const item of dbMenuItems) {
      const assignments = menuCategoryAssignments.get(item.menu_code)

      if (assignments && assignments.length > 0) {
        // Multi-category: add item to each assigned category
        for (const assignment of assignments) {
          if (!visibleCategoryCodes.has(assignment.category_code)) continue
          const key = `${item.menu_code}:${assignment.category_code}`
          if (seenCombinations.has(key)) continue
          seenCombinations.add(key)

          transformedItems.push({
            id: item.menu_code,
            name_th: item.name_th,
            name_en: item.name_en || item.name_th,
            category: categoryMap.get(assignment.category_code) || 'Other',
            category_th: categoryMap.get(assignment.category_code) || 'อื่นๆ',
            category_en: categoryMap.get(assignment.category_code) || 'Other',
            price_thb: item.price,
            promo_price: item.promo_price && item.promo_price < item.price ? item.promo_price : undefined,
            promo_label: item.promo_label || undefined,
            promo_percent: item.promo_percent,
            image: item.image_url || '/images/placeholder.jpg',
            is_sold_out: false,
            description: item.description || undefined,
            image_focus_y_1x1: item.image_focus_y_1x1 ?? undefined,
          })
        }
      } else {
        // Fallback: use legacy category_code
        if (!visibleCategoryCodes.has(item.category_code)) continue
        const key = `${item.menu_code}:${item.category_code}`
        if (seenCombinations.has(key)) continue
        seenCombinations.add(key)

        transformedItems.push({
          id: item.menu_code,
          name_th: item.name_th,
          name_en: item.name_en || item.name_th,
          category: categoryMap.get(item.category_code) || 'Other',
          category_th: categoryMap.get(item.category_code) || 'อื่นๆ',
          category_en: categoryMap.get(item.category_code) || 'Other',
          price_thb: item.price,
          promo_price: item.promo_price && item.promo_price < item.price ? item.promo_price : undefined,
          promo_label: item.promo_label || undefined,
          promo_percent: item.promo_percent,
          image: item.image_url || '/images/placeholder.jpg',
          is_sold_out: false,
          description: item.description || undefined,
          image_focus_y_1x1: item.image_focus_y_1x1 ?? undefined,
        })
      }
    }

    const uniqueCategories = Array.from(new Set(transformedItems.map(item => item.category)))

    // Apply saved category order (using category codes for sorting)
    const sortedCategories = sortCategoriesByOrder(uniqueCategories, categoryMap, categoryOrder)

    // Build category availability map for schedule enforcement
    const allCategoryCodes = Array.from(visibleCategoryCodes)
    const categoryAvailability = buildCategoryAvailabilityMap(allCategoryCodes, dbSchedules)

    // Also build code-to-name map for client
    const categoryCodeToNameMap: Record<string, string> = {}
    for (const [code, name] of Array.from(categoryMap)) {
      categoryCodeToNameMap[code] = name
    }

    return {
      menuItems: transformedItems,
      categories: sortedCategories,
      popularMenus,
      categoryAvailability,
      categoryCodeToName: categoryCodeToNameMap
    }
  }

  // No data from DB - throw to trigger fallback (will NOT be cached)
  throw new Error('No menu data in DB')
}

const isProduction = process.env.NODE_ENV === 'production'

type CategoryAvailabilityMap = Record<string, { available: boolean; nextWindow?: { start: string; end: string } }>

async function getMenuData(): Promise<{
  menuItems: MenuItem[];
  categories: string[];
  popularMenus: string[];
  categoryAvailability: CategoryAvailabilityMap;
  categoryCodeToName: Record<string, string>;
  error?: boolean
}> {
  try {
    // Use cached data with 60s TTL + inflight deduplication
    return await getMenuDataCached(fetchMenuDataFromDB)
  } catch (error) {
    console.error('[MENU] Failed to fetch from DB:', error)

    // In production: return error state (no mock data)
    if (isProduction) {
      return { menuItems: [], categories: [], popularMenus: [], categoryAvailability: {}, categoryCodeToName: {}, error: true }
    }

    // Non-production only: fallback to mock data for development
    console.warn('[MENU] Using mock data (non-production only)')
    const mockCategories = ['Nigiri', 'Roll', 'Sashimi', 'Set', 'Appetizer', 'Soup', 'Salad', 'Tempura', 'Drink', 'Dessert']
    return {
      menuItems: menuData as MenuItem[],
      categories: mockCategories,
      popularMenus: [],
      categoryAvailability: {},
      categoryCodeToName: {}
    }
  }
}

export default async function MenuPage() {
  const { menuItems, categories, popularMenus, categoryAvailability, categoryCodeToName, error } = await getMenuData()

  return (
    <MenuClient
      initialMenuItems={menuItems}
      initialCategories={categories}
      popularMenus={popularMenus}
      categoryAvailability={categoryAvailability}
      categoryCodeToName={categoryCodeToName}
      loadError={error}
    />
  )
}
