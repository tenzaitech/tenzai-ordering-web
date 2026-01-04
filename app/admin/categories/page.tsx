import { supabase } from '@/lib/supabase'
import CategoriesClient from './CategoriesClient'

export const dynamic = 'force-dynamic'

type CategoryRow = {
  category_code: string
  name: string
}

type Category = CategoryRow & {
  menu_items_count: number
}

async function getCategoriesData(): Promise<Category[]> {
  const { data } = await supabase
    .from('categories')
    .select('category_code, name')
    .order('name')

  const categories = (data ?? []) as CategoryRow[]

  if (categories.length === 0) {
    return []
  }

  const categoriesWithCounts = await Promise.all(
    categories.map(async (cat) => {
      const { count } = await supabase
        .from('menu_items')
        .select('*', { count: 'exact', head: true })
        .eq('category_code', cat.category_code)

      return {
        category_code: cat.category_code,
        name: cat.name,
        menu_items_count: count || 0
      }
    })
  )

  return categoriesWithCounts
}

export default async function AdminCategoriesPage() {
  const categories = await getCategoriesData()

  return <CategoriesClient categories={categories} />
}
