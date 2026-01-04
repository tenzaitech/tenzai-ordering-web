import { supabase } from '@/lib/supabase'
import menuData from '@/data/menu.json'
import MenuClient from './MenuClient'

export const dynamic = 'force-dynamic'

type MenuItem = {
  id: string
  name_th: string
  name_en: string
  category: string
  category_th: string
  category_en: string
  price_thb: number
  image: string
  is_sold_out: boolean
  description?: string
  subtitle?: string
  options?: any[]
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
  image_url: string | null
  is_active: boolean
  description: string | null
}

async function getMenuData() {
  try {
    const { data: dbCategoriesData } = await supabase
      .from('categories')
      .select('category_code, name')
      .order('category_code')

    const { data: dbMenuItemsData } = await supabase
      .from('menu_items')
      .select('menu_code, category_code, name_th, name_en, price, image_url, is_active, description')
      .eq('is_active', true)
      .order('menu_code')

    const dbCategories = (dbCategoriesData ?? []) as CategoryRow[]
    const dbMenuItems = (dbMenuItemsData ?? []) as MenuItemRow[]

    if (dbCategories.length > 0 && dbMenuItems.length > 0) {
      const categoryMap = new Map(dbCategories.map(cat => [cat.category_code, cat.name]))

      const transformedItems: MenuItem[] = dbMenuItems.map(item => ({
        id: item.menu_code,
        name_th: item.name_th,
        name_en: item.name_en || item.name_th,
        category: categoryMap.get(item.category_code) || 'Other',
        category_th: categoryMap.get(item.category_code) || 'อื่นๆ',
        category_en: categoryMap.get(item.category_code) || 'Other',
        price_thb: item.price,
        image: item.image_url || '/images/placeholder.jpg',
        is_sold_out: false,
        description: item.description || undefined,
      }))

      const uniqueCategories = Array.from(new Set(transformedItems.map(item => item.category)))

      return {
        menuItems: transformedItems,
        categories: uniqueCategories
      }
    }
  } catch (error) {
    console.error('[MENU] Failed to fetch from DB, using mock data:', error)
  }

  // Fallback to mock data
  const mockCategories = ['Nigiri', 'Roll', 'Sashimi', 'Set', 'Appetizer', 'Soup', 'Salad', 'Tempura', 'Drink', 'Dessert']
  return {
    menuItems: menuData as MenuItem[],
    categories: mockCategories
  }
}

export default async function MenuPage() {
  const { menuItems, categories } = await getMenuData()

  return <MenuClient initialMenuItems={menuItems} initialCategories={categories} />
}
