import { supabase } from '@/lib/supabase'
import menuData from '@/data/menu.json'
import ItemDetailClient from './ItemDetailClient'

export const dynamic = 'force-dynamic'

type MenuItem = {
  id: string
  name_th: string
  name_en: string
  category: string
  price_thb: number
  image: string
  is_sold_out: boolean
  description?: string
  subtitle?: string
  option_group_ids?: string[]
}

type OptionGroup = {
  id: string
  name_th: string
  name_en: string
  type: 'single' | 'multi'
  required: boolean
  min?: number
  max?: number
  choices: Array<{
    id: string
    name_th: string
    name_en: string
    price_delta_thb: number
  }>
  default_choice_ids?: string[]
}

async function getMenuItem(menuCode: string) {
  try {
    const { data: dbItem } = await supabase
      .from('menu_items')
      .select('menu_code, name_th, name_en, price, image_url, is_active, description')
      .eq('menu_code', menuCode)
      .eq('is_active', true)
      .single()

    if (dbItem) {
      const { data: menuOptionGroups } = await supabase
        .from('menu_option_groups')
        .select('group_code')
        .eq('menu_code', menuCode)

      const optionGroupIds = (menuOptionGroups || []).map(m => m.group_code)

      return {
        id: dbItem.menu_code,
        name_th: dbItem.name_th,
        name_en: dbItem.name_en || dbItem.name_th,
        category: '',
        price_thb: dbItem.price,
        image: dbItem.image_url || '/images/placeholder.jpg',
        is_sold_out: false,
        description: dbItem.description || undefined,
        option_group_ids: optionGroupIds
      }
    }
  } catch (error) {
    console.error('[ITEM_DETAIL] Failed to fetch from DB, using mock data:', error)
  }

  const mockItem = (menuData as MenuItem[]).find(item => item.id === menuCode)
  return mockItem || null
}

async function getOptionGroups(groupCodes: string[]): Promise<OptionGroup[]> {
  if (groupCodes.length === 0) return []

  try {
    const { data: groups } = await supabase
      .from('option_groups')
      .select('group_code, group_name, is_required, max_select')
      .in('group_code', groupCodes)

    if (!groups || groups.length === 0) return []

    const optionGroups: OptionGroup[] = []

    for (const group of groups) {
      const { data: options } = await supabase
        .from('options')
        .select('option_code, option_name, price_delta, sort_order')
        .eq('group_code', group.group_code)
        .order('sort_order', { ascending: true })

      optionGroups.push({
        id: group.group_code,
        name_th: group.group_name,
        name_en: group.group_name,
        type: group.max_select === 1 ? 'single' : 'multi',
        required: group.is_required,
        max: group.max_select,
        choices: (options || []).map(opt => ({
          id: opt.option_code,
          name_th: opt.option_name,
          name_en: opt.option_name,
          price_delta_thb: opt.price_delta
        }))
      })
    }

    const orderMap = new Map(groupCodes.map((code, index) => [code, index]))
    optionGroups.sort((a, b) => (orderMap.get(a.id) || 0) - (orderMap.get(b.id) || 0))

    return optionGroups
  } catch (error) {
    console.error('[ITEM_DETAIL] Failed to fetch option groups:', error)
    return []
  }
}

export default async function MenuDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const menuItem = await getMenuItem(id)

  if (!menuItem) {
    return <div>Item not found</div>
  }

  const optionGroups = await getOptionGroups(menuItem.option_group_ids || [])

  return <ItemDetailClient menuItem={menuItem} optionGroups={optionGroups} />
}
