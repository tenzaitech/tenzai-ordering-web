/**
 * Category Schedule Utilities
 * Uses Asia/Bangkok timezone consistently
 */

export type CategorySchedule = {
  category_code: string
  day_of_week: number  // 0=Sunday, 6=Saturday
  start_time: string   // HH:mm:ss or HH:mm
  end_time: string     // HH:mm:ss or HH:mm
}

export type ScheduleWindow = {
  day_of_week: number
  start_time: string
  end_time: string
}

/**
 * Get current time in Asia/Bangkok timezone
 */
export function getBangkokNow(): { dayOfWeek: number; timeString: string; hours: number; minutes: number } {
  const now = new Date()
  // Asia/Bangkok is UTC+7
  const bangkokOffset = 7 * 60 * 60 * 1000
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60 * 1000
  const bangkokTime = new Date(utcTime + bangkokOffset)

  const dayOfWeek = bangkokTime.getDay() // 0=Sunday
  const hours = bangkokTime.getHours()
  const minutes = bangkokTime.getMinutes()
  const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`

  return { dayOfWeek, timeString, hours, minutes }
}

/**
 * Parse time string to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * Check if a time is within a schedule window
 * Handles overnight windows (e.g., 22:00-02:00)
 */
export function isTimeInWindow(
  currentTime: string,
  startTime: string,
  endTime: string
): boolean {
  const current = timeToMinutes(currentTime)
  const start = timeToMinutes(startTime)
  const end = timeToMinutes(endTime)

  if (start < end) {
    // Normal window (e.g., 09:00-17:00)
    return current >= start && current < end
  } else {
    // Overnight window (e.g., 22:00-02:00)
    return current >= start || current < end
  }
}

/**
 * Check if a category is currently available based on schedules
 * Returns { available: boolean, nextWindow?: { start: string, end: string }, scheduledDays?: number[] }
 */
export function isCategoryAvailable(
  categoryCode: string,
  schedules: CategorySchedule[]
): { available: boolean; nextWindow?: { start: string; end: string }; scheduledDays?: number[]; notAvailableToday?: boolean } {
  // Filter schedules for this category
  const categorySchedules = schedules.filter(s => s.category_code === categoryCode)

  // No schedules = always available
  if (categorySchedules.length === 0) {
    return { available: true }
  }

  const { dayOfWeek, timeString } = getBangkokNow()

  // Get unique scheduled days
  const scheduledDays = Array.from(new Set(categorySchedules.map(s => s.day_of_week))).sort()

  // Check if today is a scheduled day
  const todayHasSchedule = scheduledDays.includes(dayOfWeek)

  // Check today's schedules
  const todaySchedules = categorySchedules.filter(s => s.day_of_week === dayOfWeek)

  for (const schedule of todaySchedules) {
    if (isTimeInWindow(timeString, schedule.start_time, schedule.end_time)) {
      return { available: true, scheduledDays }
    }
  }

  // Also check overnight windows from previous day
  const yesterdayDow = (dayOfWeek + 6) % 7
  const yesterdaySchedules = categorySchedules.filter(s => s.day_of_week === yesterdayDow)

  for (const schedule of yesterdaySchedules) {
    const start = timeToMinutes(schedule.start_time)
    const end = timeToMinutes(schedule.end_time)
    // Only check if it's an overnight window
    if (start > end && isTimeInWindow(timeString, schedule.start_time, schedule.end_time)) {
      return { available: true, scheduledDays }
    }
  }

  // Not available - find next window for display
  let nextWindow: { start: string; end: string } | undefined

  // Find the next available window (today or upcoming)
  for (const schedule of todaySchedules) {
    const start = timeToMinutes(schedule.start_time)
    const current = timeToMinutes(timeString)
    if (start > current) {
      nextWindow = { start: schedule.start_time.substring(0, 5), end: schedule.end_time.substring(0, 5) }
      break
    }
  }

  // If no window today, show first window of next available day
  if (!nextWindow && categorySchedules.length > 0) {
    // Sort by day of week, starting from tomorrow
    const sortedSchedules = [...categorySchedules].sort((a, b) => {
      const aDow = (a.day_of_week - dayOfWeek + 7) % 7 || 7
      const bDow = (b.day_of_week - dayOfWeek + 7) % 7 || 7
      return aDow - bDow || timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
    })
    const next = sortedSchedules[0]
    if (next) {
      nextWindow = { start: next.start_time.substring(0, 5), end: next.end_time.substring(0, 5) }
    }
  }

  return { available: false, nextWindow, scheduledDays, notAvailableToday: !todayHasSchedule }
}

/**
 * Build a map of category availability for client-side use
 */
export function buildCategoryAvailabilityMap(
  categoryCodes: string[],
  schedules: CategorySchedule[]
): Record<string, { available: boolean; nextWindow?: { start: string; end: string } }> {
  const result: Record<string, { available: boolean; nextWindow?: { start: string; end: string } }> = {}

  for (const code of categoryCodes) {
    result[code] = isCategoryAvailable(code, schedules)
  }

  return result
}
