/**
 * Invoice seller configuration
 * Easy to modify - all seller info in one place
 */
export const SELLER_INFO = {
  company_name: 'บริษัท เท็นไซ จำกัด',
  company_name_en: 'TENZAI CO., LTD.',
  tax_id: '0123456789012', // TODO: Replace with real tax ID
  address: '123 ถนนสุขุมวิท แขวงคลองตัน เขตวัฒนา กรุงเทพมหานคร 10110',
  address_en: '123 Sukhumvit Road, Klongtan, Wattana, Bangkok 10110',
  phone: '02-123-4567',
  branch: 'สำนักงานใหญ่'
} as const

// Invoice storage config
export const INVOICE_BUCKET = process.env.INVOICE_BUCKET || 'invoices'
export const INVOICE_SIGNED_URL_EXPIRY = 7 * 24 * 60 * 60 // 7 days in seconds
