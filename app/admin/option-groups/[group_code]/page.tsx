import { supabase } from '@/lib/supabase'
import OptionGroupEditClient from './OptionGroupEditClient'

export const dynamic = 'force-dynamic'

type OptionGroup = {
  group_code: string
  group_name: string
  is_required: boolean
  max_select: number
  updated_at: string
}

type Option = {
  option_code: string
  option_name: string
  price_delta: number
  sort_order: number
}

async function getOptionGroupData(groupCode: string) {
  const { data: group } = await supabase
    .from('option_groups')
    .select('group_code, group_name, is_required, max_select, updated_at')
    .eq('group_code', groupCode)
    .single()

  const { data: options } = await supabase
    .from('options')
    .select('option_code, option_name, price_delta, sort_order')
    .eq('group_code', groupCode)
    .order('sort_order')

  return {
    group: group as OptionGroup | null,
    options: (options || []) as Option[]
  }
}

export default async function AdminOptionGroupEditPage({ params }: { params: Promise<{ group_code: string }> }) {
  const { group_code } = await params
  const { group, options } = await getOptionGroupData(group_code)

  if (!group) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text mb-2">Option Group Not Found</h1>
          <a href="/admin/option-groups" className="text-primary hover:underline">
            Back to Option Groups
          </a>
        </div>
      </div>
    )
  }

  return <OptionGroupEditClient group={group} options={options} />
}
