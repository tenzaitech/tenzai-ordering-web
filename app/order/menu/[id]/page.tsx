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
  subtitle?: string
  option_group_ids?: string[]
}

async function getMenuItem(menuCode: string) {
  try {
    const { data: dbItem } = await supabase
      .from('menu_items')
      .select('menu_code, name_th, name_en, price, image_url, is_active')
      .eq('menu_code', menuCode)
      .eq('is_active', true)
      .single()

    if (dbItem) {
      return {
        id: dbItem.menu_code,
        name_th: dbItem.name_th,
        name_en: dbItem.name_en || dbItem.name_th,
        category: '',
        price_thb: dbItem.price,
        image: dbItem.image_url || '/images/placeholder.jpg',
        is_sold_out: false,
        option_group_ids: []
      }
    }
  } catch (error) {
    console.error('[ITEM_DETAIL] Failed to fetch from DB, using mock data:', error)
  }

  // Fallback to mock data
  const mockItem = (menuData as MenuItem[]).find(item => item.id === menuCode)
  return mockItem || null
}

export default async function MenuDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const menuItem = await getMenuItem(id)

  if (!menuItem) {
    return <div>Item not found</div>
  }

  return <ItemDetailClient menuItem={menuItem} />
}
