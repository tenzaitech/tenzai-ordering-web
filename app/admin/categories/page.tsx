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

type OptionGroup = {
  group_code: string
  group_name: string
}

type CategoryOptionGroup = {
  category_code: string
  group_code: string
}

type CategorySchedule = {
  category_code: string
  day_of_week: number
  start_time: string
  end_time: string
}

const SETTINGS_KEY = 'category_order'
const HIDDEN_KEY = 'hidden_categories'

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

async function getCategoryOrder(): Promise<string[]> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .single()

  if (error || !data?.value?.order) {
    return []
  }

  return data.value.order as string[]
}

async function getHiddenCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', HIDDEN_KEY)
    .single()

  if (error || !data?.value?.hidden) {
    return []
  }

  return data.value.hidden as string[]
}

async function getOptionGroups(): Promise<OptionGroup[]> {
  const { data } = await supabase
    .from('option_groups')
    .select('group_code, group_name')
    .order('group_name')

  return (data ?? []) as OptionGroup[]
}

async function getCategoryOptionGroups(): Promise<Record<string, string[]>> {
  const { data } = await supabase
    .from('category_option_groups')
    .select('category_code, group_code')

  const result: Record<string, string[]> = {}
  for (const row of (data ?? []) as CategoryOptionGroup[]) {
    if (!result[row.category_code]) {
      result[row.category_code] = []
    }
    result[row.category_code].push(row.group_code)
  }
  return result
}

async function getCategorySchedules(): Promise<Record<string, CategorySchedule[]>> {
  const { data } = await supabase
    .from('category_schedules')
    .select('category_code, day_of_week, start_time, end_time')
    .order('day_of_week')
    .order('start_time')

  const result: Record<string, CategorySchedule[]> = {}
  for (const row of (data ?? []) as CategorySchedule[]) {
    if (!result[row.category_code]) {
      result[row.category_code] = []
    }
    result[row.category_code].push(row)
  }
  return result
}

export default async function AdminCategoriesPage() {
  const [categories, initialOrder, hiddenCategories, optionGroups, categoryOptionGroups, categorySchedules] = await Promise.all([
    getCategoriesData(),
    getCategoryOrder(),
    getHiddenCategories(),
    getOptionGroups(),
    getCategoryOptionGroups(),
    getCategorySchedules()
  ])

  return (
    <CategoriesClient
      categories={categories}
      initialOrder={initialOrder}
      hiddenCategories={hiddenCategories}
      optionGroups={optionGroups}
      categoryOptionGroups={categoryOptionGroups}
      categorySchedules={categorySchedules}
    />
  )
}
