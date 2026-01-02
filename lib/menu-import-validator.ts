export interface ValidationError {
  sheet: string
  row: number
  field: string
  message: string
}

// Human-friendly format for import/export
export interface ParsedMenuData {
  categories: Array<{ category_name: string }>
  menu: Array<{
    menu_code: string
    category_name: string
    menu_name: string
    menu_name_2?: string
    barcode?: string
    description?: string
    price: unknown
    image_url?: string
  }>
  options: Array<{
    option_group_name: string
    is_required: boolean
    max_select: number
    option_name_1?: string
    price_1?: unknown
    option_name_2?: string
    price_2?: unknown
    option_name_3?: string
    price_3?: unknown
    option_name_4?: string
    price_4?: unknown
    option_name_5?: string
    price_5?: unknown
    option_name_6?: string
    price_6?: unknown
  }>
  menu_option_groups: Array<{
    menu_code: string
    option_group_name: string
  }>
}

export function generateCode(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w\u0E00-\u0E7F-]/g, '')
}

export function isValidIntegerPrice(value: unknown): boolean {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return /^[0-9]+$/.test(trimmed) && parseInt(trimmed, 10) >= 0
  }
  return false
}

export function parseIntegerPrice(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^[0-9]+$/.test(trimmed)) {
      return parseInt(trimmed, 10)
    }
  }
  throw new Error(`Invalid price value: ${value}`)
}

export function isValidIntegerDelta(value: unknown): boolean {
  if (typeof value === 'number') {
    return Number.isInteger(value)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return /^-?[0-9]+$/.test(trimmed)
  }
  return false
}

export function parseIntegerDelta(value: unknown): number {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^-?[0-9]+$/.test(trimmed)) {
      return parseInt(trimmed, 10)
    }
  }
  throw new Error(`Invalid delta value: ${value}`)
}

function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function validateMenuData(data: ParsedMenuData): ValidationError[] {
  const errors: ValidationError[] = []

  // Validate categories
  const categoryNames = new Set<string>()
  data.categories.forEach((cat, idx) => {
    const row = idx + 2
    if (!cat.category_name || cat.category_name.trim() === '') {
      errors.push({ sheet: 'categories', row, field: 'category_name', message: 'Required field' })
    } else {
      const normalized = cat.category_name.trim()
      if (categoryNames.has(normalized)) {
        errors.push({ sheet: 'categories', row, field: 'category_name', message: 'Duplicate name' })
      }
      categoryNames.add(normalized)
    }
  })

  // Validate menu
  const menuCodes = new Set<string>()
  data.menu.forEach((item, idx) => {
    const row = idx + 2
    if (!item.menu_code || item.menu_code.trim() === '') {
      errors.push({ sheet: 'menu', row, field: 'menu_code', message: 'Required field' })
    } else {
      if (menuCodes.has(item.menu_code)) {
        errors.push({ sheet: 'menu', row, field: 'menu_code', message: 'Duplicate code' })
      }
      menuCodes.add(item.menu_code)
    }
    if (!item.category_name || item.category_name.trim() === '') {
      errors.push({ sheet: 'menu', row, field: 'category_name', message: 'Required field' })
    } else if (!categoryNames.has(item.category_name.trim())) {
      errors.push({ sheet: 'menu', row, field: 'category_name', message: 'Unknown category_name' })
    }
    if (!item.menu_name || item.menu_name.trim() === '') {
      errors.push({ sheet: 'menu', row, field: 'menu_name', message: 'Required field' })
    }
    if (!isValidIntegerPrice(item.price)) {
      errors.push({ sheet: 'menu', row, field: 'price', message: 'Must be an integer (no decimals allowed)' })
    }
    if (item.image_url && item.image_url.trim() !== '' && !isValidUrl(item.image_url)) {
      errors.push({ sheet: 'menu', row, field: 'image_url', message: 'Must be a valid http/https URL' })
    }
  })

  // Validate options (wide format)
  const optionGroupNames = new Set<string>()
  data.options.forEach((group, idx) => {
    const row = idx + 2
    if (!group.option_group_name || group.option_group_name.trim() === '') {
      errors.push({ sheet: 'options', row, field: 'option_group_name', message: 'Required field' })
    } else {
      optionGroupNames.add(group.option_group_name.trim())
    }
    if (typeof group.is_required !== 'boolean') {
      errors.push({ sheet: 'options', row, field: 'is_required', message: 'Must be true or false' })
    }
    if (typeof group.max_select !== 'number' || group.max_select < 1) {
      errors.push({ sheet: 'options', row, field: 'max_select', message: 'Must be >= 1' })
    }

    // Validate option pairs
    for (let i = 1; i <= 6; i++) {
      const nameKey = `option_name_${i}` as keyof typeof group
      const priceKey = `price_${i}` as keyof typeof group
      const optionName = group[nameKey]
      const optionPrice = group[priceKey]

      if (optionName && optionName.toString().trim() !== '') {
        if (optionPrice === undefined || optionPrice === null) {
          errors.push({ sheet: 'options', row, field: `price_${i}`, message: 'Price required when option_name provided' })
        } else if (!isValidIntegerPrice(optionPrice)) {
          errors.push({ sheet: 'options', row, field: `price_${i}`, message: 'Must be an integer (no decimals allowed)' })
        }
      }
    }
  })

  // Validate menu_option_groups
  const mappings = new Set<string>()
  data.menu_option_groups.forEach((mapping, idx) => {
    const row = idx + 2
    if (!mapping.menu_code || mapping.menu_code.trim() === '') {
      errors.push({ sheet: 'menu_option_groups', row, field: 'menu_code', message: 'Required field' })
    } else if (!menuCodes.has(mapping.menu_code)) {
      errors.push({ sheet: 'menu_option_groups', row, field: 'menu_code', message: 'Unknown menu_code' })
    }
    if (!mapping.option_group_name || mapping.option_group_name.trim() === '') {
      errors.push({ sheet: 'menu_option_groups', row, field: 'option_group_name', message: 'Required field' })
    } else if (!optionGroupNames.has(mapping.option_group_name.trim())) {
      errors.push({ sheet: 'menu_option_groups', row, field: 'option_group_name', message: 'Unknown option_group_name' })
    }
    const key = `${mapping.menu_code}:${mapping.option_group_name}`
    if (mappings.has(key)) {
      errors.push({ sheet: 'menu_option_groups', row, field: 'menu_code,option_group_name', message: 'Duplicate mapping' })
    }
    mappings.add(key)
  })

  return errors
}
