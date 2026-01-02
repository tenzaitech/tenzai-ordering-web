import { supabase } from '@/lib/supabase'
import MenuListClient from './MenuListClient'

export const dynamic = 'force-dynamic'

type MenuItem = {
  menu_code: string
  category_code: string
  name_th: string
  name_en: string | null
  price: number
  image_url: string | null
  is_active: boolean
  updated_at: string
}

type Category = {
  category_code: string
  name: string
}

async function getMenuData() {
  const { data: categories, error: catError } = await supabase
    .from('categories')
    .select('category_code, name')
    .order('name')

  const { data: menuItems, error: menuError } = await supabase
    .from('menu_items')
    .select('menu_code, category_code, name_th, name_en, price, image_url, is_active, updated_at')
    .order('updated_at', { ascending: false })

  if (catError || menuError) {
    console.error('[ADMIN_MENU] Fetch error:', catError || menuError)
    return { categories: [], menuItems: [] }
  }

  return {
    categories: categories as Category[],
    menuItems: menuItems as MenuItem[]
  }
}

export default async function AdminMenuPage() {
  const { categories, menuItems } = await getMenuData()

  return <MenuListClient categories={categories} menuItems={menuItems} />
}
