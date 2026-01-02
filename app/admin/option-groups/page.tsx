import { supabase } from '@/lib/supabase'
import OptionGroupsClient from './OptionGroupsClient'

export const dynamic = 'force-dynamic'

type OptionGroup = {
  group_code: string
  group_name: string
  is_required: boolean
  max_select: number
  updated_at: string
  menu_count: number
}

async function getOptionGroupsData() {
  const { data: optionGroups } = await supabase
    .from('option_groups')
    .select('group_code, group_name, is_required, max_select, updated_at')
    .order('group_name')

  if (!optionGroups) {
    return []
  }

  const groupsWithCounts = await Promise.all(
    optionGroups.map(async (group) => {
      const { count } = await supabase
        .from('menu_option_groups')
        .select('*', { count: 'exact', head: true })
        .eq('group_code', group.group_code)

      return {
        ...group,
        menu_count: count || 0
      }
    })
  )

  return groupsWithCounts
}

export default async function AdminOptionGroupsPage() {
  const optionGroups = await getOptionGroupsData()

  return <OptionGroupsClient optionGroups={optionGroups} />
}
