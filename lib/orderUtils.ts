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
