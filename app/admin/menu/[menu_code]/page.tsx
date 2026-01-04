import { supabase } from '@/lib/supabase'
import MenuEditClient from './MenuEditClient'

export const dynamic = 'force-dynamic'

type MenuItem = {
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

type Category = {
  category_code: string
  name: string
}

type OptionGroup = {
  group_code: string
  group_name: string
}

type MenuOptionGroupRow = {
  group_code: string
}

async function getMenuEditData(menuCode: string) {
  const { data: categories } = await supabase
    .from('categories')
    .select('category_code, name')
    .order('name')

  const { data: optionGroups } = await supabase
    .from('option_groups')
    .select('group_code, group_name')
    .order('group_name')

  if (menuCode === 'new') {
    return {
      menuItem: null,
      categories: (categories ?? []) as Category[],
      optionGroups: (optionGroups ?? []) as OptionGroup[],
      selectedOptionGroups: []
    }
  }

  const { data: menuItem } = await supabase
    .from('menu_items')
    .select('menu_code, category_code, name_th, name_en, barcode, description, price, image_url, is_active')
    .eq('menu_code', menuCode)
    .single()

  const { data: menuOptionGroupsData } = await supabase
    .from('menu_option_groups')
    .select('group_code')
    .eq('menu_code', menuCode)

  const menuOptionGroups = (menuOptionGroupsData ?? []) as MenuOptionGroupRow[]

  return {
    menuItem: menuItem as MenuItem | null,
    categories: (categories ?? []) as Category[],
    optionGroups: (optionGroups ?? []) as OptionGroup[],
    selectedOptionGroups: menuOptionGroups.map(m => m.group_code)
  }
}

export default async function AdminMenuEditPage({ params }: { params: Promise<{ menu_code: string }> }) {
  const { menu_code } = await params
  const { menuItem, categories, optionGroups, selectedOptionGroups } = await getMenuEditData(menu_code)

  if (menu_code !== 'new' && !menuItem) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text mb-2">Menu Item Not Found</h1>
          <a href="/admin/menu" className="text-primary hover:underline">
            Back to Menu List
          </a>
        </div>
      </div>
    )
  }

  return (
    <MenuEditClient
      menuItem={menuItem}
      categories={categories}
      optionGroups={optionGroups}
      selectedOptionGroups={selectedOptionGroups}
    />
  )
}
