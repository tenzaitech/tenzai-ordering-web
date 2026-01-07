import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { checkAdminAuth } from '@/lib/admin-gate'

type Schedule = {
  day_of_week: number  // 0-6 (Sunday-Saturday)
  start_time: string   // HH:mm format
  end_time: string     // HH:mm format
}

// GET: Fetch all schedules for a category
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category_code: string }> }
) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  try {
    const { category_code } = await params

    const { data, error } = await supabase
      .from('category_schedules')
      .select('id, day_of_week, start_time, end_time')
      .eq('category_code', category_code)
      .order('day_of_week')
      .order('start_time')

    if (error) {
      console.error('[CATEGORY_SCHEDULES_GET] Error:', error)
      return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 })
    }

    return NextResponse.json({ schedules: data || [] })
  } catch (error) {
    console.error('[CATEGORY_SCHEDULES_GET] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST: Set all schedules for a category (replaces existing)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ category_code: string }> }
) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  try {
    const { category_code } = await params
    const body = await request.json()
    const schedules: Schedule[] = body.schedules || []

    if (!Array.isArray(schedules)) {
      return NextResponse.json({ error: 'schedules must be an array' }, { status: 400 })
    }

    // Validate schedules
    for (const schedule of schedules) {
      if (schedule.day_of_week < 0 || schedule.day_of_week > 6) {
        return NextResponse.json({ error: 'day_of_week must be 0-6' }, { status: 400 })
      }
      if (!schedule.start_time || !schedule.end_time) {
        return NextResponse.json({ error: 'start_time and end_time are required' }, { status: 400 })
      }
      if (schedule.start_time >= schedule.end_time) {
        return NextResponse.json({ error: 'start_time must be before end_time' }, { status: 400 })
      }
    }

    // Delete existing schedules
    const { error: deleteError } = await supabase
      .from('category_schedules')
      .delete()
      .eq('category_code', category_code)

    if (deleteError) {
      console.error('[CATEGORY_SCHEDULES_POST] Delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to update schedules' }, { status: 500 })
    }

    // Insert new schedules
    if (schedules.length > 0) {
      const insertData = schedules.map(schedule => ({
        category_code,
        day_of_week: schedule.day_of_week,
        start_time: schedule.start_time,
        end_time: schedule.end_time
      }))

      const { error: insertError } = await supabase
        .from('category_schedules')
        .insert(insertData as never[])

      if (insertError) {
        console.error('[CATEGORY_SCHEDULES_POST] Insert error:', insertError)
        return NextResponse.json({ error: 'Failed to insert schedules' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CATEGORY_SCHEDULES_POST] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
