export function generateOrderNumber(): string {
  const now = new Date()
  const year = now.getFullYear().toString().slice(2)
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0')

  return `${year}${month}${day}-${random}`
}

export function generatePickupTimes(): string[] {
  const times: string[] = []
  const startHour = 11
  const endHour = 21
  const endMinute = 30

  for (let hour = startHour; hour <= endHour; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      if (hour === endHour && minute > endMinute) break
      const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      times.push(timeStr)
    }
  }

  return times
}

/**
 * Generate pickup dates for the next 3 days (today, tomorrow, day after)
 * Returns array of { value: 'YYYY-MM-DD', label_th: string, label_en: string }
 */
export function generatePickupDates(): { value: string; label_th: string; label_en: string }[] {
  const dates: { value: string; label_th: string; label_en: string }[] = []
  const now = new Date()
  const bangkokOffsetMs = 7 * 60 * 60 * 1000
  const nowBangkok = new Date(now.getTime() + bangkokOffsetMs)

  const dayNamesTh = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์']
  const dayNamesEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const monthNamesTh = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  for (let i = 0; i < 3; i++) {
    const date = new Date(nowBangkok.getTime() + i * 24 * 60 * 60 * 1000)
    const year = date.getUTCFullYear()
    const month = date.getUTCMonth()
    const day = date.getUTCDate()
    const dayOfWeek = date.getUTCDay()

    const value = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

    let label_th: string
    let label_en: string

    if (i === 0) {
      label_th = `วันนี้ (${dayNamesTh[dayOfWeek]} ${day} ${monthNamesTh[month]})`
      label_en = `Today (${dayNamesEn[dayOfWeek]} ${day} ${monthNamesEn[month]})`
    } else if (i === 1) {
      label_th = `พรุ่งนี้ (${dayNamesTh[dayOfWeek]} ${day} ${monthNamesTh[month]})`
      label_en = `Tomorrow (${dayNamesEn[dayOfWeek]} ${day} ${monthNamesEn[month]})`
    } else {
      label_th = `${dayNamesTh[dayOfWeek]} ${day} ${monthNamesTh[month]}`
      label_en = `${dayNamesEn[dayOfWeek]} ${day} ${monthNamesEn[month]}`
    }

    dates.push({ value, label_th, label_en })
  }

  return dates
}

export function getCartFingerprint(items: any[]): string {
  // Create stable fingerprint from cart items
  const normalized = items.map((item) => ({
    menuId: item.menuId,
    qty: item.quantity,
    final_price: item.final_price_thb,
    note: item.note || '',
    options: item.options ? JSON.stringify(item.options) : '',
  }))

  // Sort by menuId for stability
  normalized.sort((a, b) => a.menuId.localeCompare(b.menuId))

  return JSON.stringify(normalized)
}
