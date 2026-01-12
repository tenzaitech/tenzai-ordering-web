import { getSupabaseServer } from './supabase-server'

type AdminSettingsRow = {
  line_approver_id: string | null
  line_staff_id: string | null
}

type OrderRow = {
  [key: string]: unknown
  id: string
  order_number: string
  customer_name: string
  customer_phone: string
  pickup_type: string
  pickup_time: string | null
  total_amount_dec: number
  customer_note: string | null
  slip_url: string | null
  customer_line_user_id: string | null
  adjustment_note: string | null
}

type OrderItemRow = {
  [key: string]: unknown
  qty: number
  name_th: string
  name_en: string | null
  selected_options_json: unknown
  note: string | null
}

// ============================================================
// CANONICAL ORIGIN HELPERS
// ============================================================

/**
 * Get the canonical app origin for generating public URLs.
 * Uses NEXT_PUBLIC_APP_ORIGIN env var as single source of truth.
 */
function getAppOrigin(): string {
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN
  if (!origin) {
    console.warn('[LINE:URL] NEXT_PUBLIC_APP_ORIGIN not set, using fallback')
    return 'https://order.tenzai.com'
  }
  return origin.replace(/\/$/, '') // Remove trailing slash if present
}

/**
 * Get the LIFF deep link URL for customer-facing pages.
 * Uses liff.state query parameter to preserve target path through LIFF flow.
 * Format: https://liff.line.me/{LIFF_ID}?liff.state={ENCODED_PATH}
 *
 * Note: LINE drops path segments from LIFF URLs, so we must use liff.state
 * which LINE preserves and appends to the URL after LIFF initialization.
 */
function getLiffDeepLink(path: string): string {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID || ''
  if (!liffId) {
    console.warn('[LINE:URL] NEXT_PUBLIC_LIFF_ID not set')
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  // Encode the path in liff.state to preserve it through LIFF flow
  const encodedState = encodeURIComponent(cleanPath)
  return `https://liff.line.me/${liffId}?liff.state=${encodedState}`
}

/**
 * Get the admin panel URL (not LIFF, direct browser access).
 */
function getAdminUrl(path: string): string {
  const origin = getAppOrigin()
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${origin}${cleanPath}`
}

/**
 * Fetch LINE recipient IDs from canonical source (admin_settings table)
 *
 * CANONICAL SOURCE: admin_settings.line_approver_id, admin_settings.line_staff_id
 * FALLBACK (bootstrap only): process.env.LINE_APPROVER_ID, process.env.LINE_STAFF_ID
 *
 * The env vars serve as initial defaults before admin configures settings via UI.
 * Once admin saves settings, DB values are canonical and env vars are ignored.
 */
async function getLineRecipients(): Promise<{ approverId: string; staffId: string }> {
  const supabase = getSupabaseServer()
  const { data: settingsData } = await supabase
    .from('admin_settings')
    .select('line_approver_id, line_staff_id')
    .limit(1)
    .single()

  const settings = settingsData as AdminSettingsRow | null
  return {
    approverId: settings?.line_approver_id || process.env.LINE_APPROVER_ID || '',
    staffId: settings?.line_staff_id || process.env.LINE_STAFF_ID || ''
  }
}

// Format pickup time to Bangkok timezone (Thai - for customers)
function formatPickupTime(pickupType: string, pickupTime: string | null): string {
  if (pickupType === 'ASAP') {
    return 'ให้ร้านทำทันที'
  } else if (pickupTime) {
    const date = new Date(pickupTime)
    const bangkokOffsetMs = 7 * 60 * 60 * 1000
    const bangkokTime = new Date(date.getTime() + bangkokOffsetMs)
    const hours = String(bangkokTime.getUTCHours()).padStart(2, '0')
    const minutes = String(bangkokTime.getUTCMinutes()).padStart(2, '0')
    const day = String(bangkokTime.getUTCDate()).padStart(2, '0')
    const month = String(bangkokTime.getUTCMonth() + 1).padStart(2, '0')
    return `${hours}:${minutes} (${day}/${month})`
  }
  return ''
}

// Format pickup time EN-first for staff (Myanmar-friendly)
function formatPickupTimeEN(pickupType: string, pickupTime: string | null): string {
  if (pickupType === 'ASAP') {
    return 'ASAP'
  } else if (pickupTime) {
    const date = new Date(pickupTime)
    const bangkokOffsetMs = 7 * 60 * 60 * 1000
    const bangkokTime = new Date(date.getTime() + bangkokOffsetMs)
    const hours = String(bangkokTime.getUTCHours()).padStart(2, '0')
    const minutes = String(bangkokTime.getUTCMinutes()).padStart(2, '0')
    return `Scheduled ${hours}:${minutes}`
  }
  return ''
}

// ============================================================
// FLEX MESSAGE BUILDER
// ============================================================

// Standardized LINE Flex labels (Thai-first for customers)
const LINE_LABELS = {
  order: 'ออเดอร์',
  customerName: 'ชื่อลูกค้า',
  phone: 'เบอร์โทร',
  pickupTime: 'รับเมื่อ',
  total: 'ยอดรวม',
  items: 'รายการ',
  note: 'หมายเหตุ',
  status: 'สถานะ'
} as const

// EN-first labels for staff/approver (Myanmar-friendly)
const STAFF_LABELS = {
  order: 'Order',
  customerName: 'Name',
  phone: 'Phone',
  pickupTime: 'Pickup',
  total: 'Total',
  items: 'Items',
  note: 'Note',
  status: 'Status'
} as const

// Brand styling constants
const BRAND = {
  name: 'TENZAI',
  headerBg: '#2d2d2d',       // Premium dark charcoal
  headerText: '#ffffff',     // White text on dark
  headerSubtext: '#b0b0b0',  // Subtle gray for subtitle
  accent: '#e8b923'          // Gold accent (optional future use)
} as const

interface FlexField {
  label: string
  value: string
}

interface FlexCardOptions {
  titleTH: string
  titleEN?: string
  fields: FlexField[]
  items?: string[]
  noteLabel?: string
  noteValue?: string
  slipUrl?: string
  actionUrl?: string
  showButton?: boolean
  buttonLabel?: string
  buttonColor?: string
  footerText?: string
}

function buildFlexOrderCard(options: FlexCardOptions): object {
  const {
    titleTH,
    titleEN,
    fields,
    items,
    noteLabel,
    noteValue,
    slipUrl,
    actionUrl,
    showButton = false,
    buttonLabel,
    buttonColor,
    footerText
  } = options

  // Header contents with brand styling
  const headerContents: object[] = [
    {
      type: 'text',
      text: titleTH,
      weight: 'bold',
      size: 'lg',
      color: BRAND.headerText,
      wrap: true
    }
  ]

  if (titleEN) {
    headerContents.push({
      type: 'text',
      text: titleEN,
      size: 'sm',
      color: BRAND.headerSubtext,
      margin: 'xs',
      wrap: true
    })
  }

  // Body contents
  const bodyContents: object[] = []

  // Add key-value fields (baseline layout for proper alignment)
  for (const field of fields) {
    if (field.value) {
      bodyContents.push({
        type: 'box',
        layout: 'baseline',
        margin: 'md',
        spacing: 'sm',
        contents: [
          {
            type: 'text',
            text: field.label,
            size: 'sm',
            color: '#666666',
            flex: 2,
            wrap: false
          },
          {
            type: 'text',
            text: field.value,
            size: 'sm',
            color: '#1a1a1a',
            flex: 5,
            wrap: true,
            align: 'end'
          }
        ]
      })
    }
  }

  // Add items section if present
  if (items && items.length > 0) {
    bodyContents.push({
      type: 'separator',
      margin: 'lg'
    })

    bodyContents.push({
      type: 'text',
      text: LINE_LABELS.items,
      size: 'sm',
      color: '#666666',
      margin: 'lg',
      weight: 'bold'
    })

    // Show up to 8 items with proper wrapping
    const displayItems = items.slice(0, 8)
    const remainingCount = items.length - 8

    for (const item of displayItems) {
      bodyContents.push({
        type: 'box',
        layout: 'horizontal',
        margin: 'sm',
        contents: [
          {
            type: 'text',
            text: '•',
            size: 'sm',
            color: '#888888',
            flex: 0
          },
          {
            type: 'text',
            text: item,
            size: 'sm',
            color: '#1a1a1a',
            flex: 1,
            wrap: true,
            margin: 'sm'
          }
        ]
      })
    }

    if (remainingCount > 0) {
      bodyContents.push({
        type: 'text',
        text: `และอีก ${remainingCount} รายการ…`,
        size: 'xs',
        color: '#888888',
        margin: 'md'
      })
    }
  }

  // Add note section if present
  if (noteLabel && noteValue) {
    bodyContents.push({
      type: 'separator',
      margin: 'lg'
    })

    bodyContents.push({
      type: 'text',
      text: noteLabel,
      size: 'sm',
      color: '#666666',
      margin: 'lg',
      weight: 'bold'
    })

    bodyContents.push({
      type: 'text',
      text: noteValue,
      size: 'sm',
      color: '#1a1a1a',
      margin: 'sm',
      wrap: true
    })
  }

  // Add slip URL if present (for approver)
  if (slipUrl) {
    bodyContents.push({
      type: 'separator',
      margin: 'lg'
    })

    bodyContents.push({
      type: 'text',
      text: '🧾 ดูสลิป',
      size: 'sm',
      color: '#0066cc',
      margin: 'lg',
      action: {
        type: 'uri',
        uri: slipUrl
      },
      decoration: 'underline'
    })
  }

  // Build footer
  let footer: object | undefined

  if (showButton && actionUrl) {
    footer = {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: buttonLabel || 'ดูออเดอร์',
            uri: actionUrl
          },
          style: 'primary',
          color: buttonColor || '#0066cc',
          height: 'sm'
        }
      ],
      paddingAll: 'lg'
    }
  } else if (footerText) {
    footer = {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: footerText,
          size: 'xs',
          color: '#888888',
          align: 'center',
          wrap: true
        }
      ],
      paddingAll: 'md'
    }
  }

  // Build bubble with brand header
  const bubble: Record<string, unknown> = {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: headerContents,
      backgroundColor: BRAND.headerBg,
      paddingAll: 'lg'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: bodyContents,
      paddingAll: 'lg'
    }
  }

  if (footer) {
    bubble.footer = footer
  } else {
    // Default brand footer when no action button
    bubble.footer = {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: BRAND.name,
          size: 'xxs',
          color: '#aaaaaa',
          align: 'center'
        }
      ],
      paddingAll: 'sm'
    }
  }

  return bubble
}

// ============================================================
// NOTIFICATION FUNCTIONS
// ============================================================

export async function sendSlipNotification(orderId: string): Promise<void> {
  const supabase = getSupabaseServer()
  // Fetch order
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  const order = orderData as OrderRow | null
  if (orderError || !order) {
    console.error('[LINE:NOTIFY] Failed to fetch order:', orderError)
    throw new Error('Failed to fetch order')
  }

  // Fetch order items
  const { data: itemsData, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)

  const items = (itemsData ?? []) as OrderItemRow[]
  if (itemsError) {
    console.error('[LINE:NOTIFY] Failed to fetch order items:', itemsError)
    throw new Error('Failed to fetch order items')
  }

  // Format pickup time (EN-first for approver)
  const pickupText = formatPickupTimeEN(order.pickup_type, order.pickup_time)

  // Format items list (EN names with fallback to TH)
  const itemsList = items?.map(item => `${item.qty}x ${item.name_en || item.name_th}`) || []

  // Build admin approve URL (protected by admin session)
  const approveUrl = getAdminUrl(`/admin/orders/${orderId}`)

  // Build Flex card for approver (HAS Approve button, EN-first)
  const flexCard = buildFlexOrderCard({
    titleTH: 'New paid order to verify',
    titleEN: 'Check slip and approve',
    fields: [
      { label: STAFF_LABELS.order, value: `#${order.order_number}` },
      { label: STAFF_LABELS.customerName, value: order.customer_name },
      { label: STAFF_LABELS.phone, value: order.customer_phone },
      { label: STAFF_LABELS.pickupTime, value: pickupText },
      { label: STAFF_LABELS.total, value: `฿${order.total_amount_dec?.toFixed(2)}` }
    ],
    items: itemsList,
    noteLabel: order.customer_note ? STAFF_LABELS.note : undefined,
    noteValue: order.customer_note || undefined,
    slipUrl: order.slip_url || undefined,
    showButton: true,
    buttonLabel: 'Approve Order',
    buttonColor: '#22c55e',
    actionUrl: approveUrl
  })

  // Get approver ID from DB/env
  const { approverId } = await getLineRecipients()

  if (!approverId) {
    throw new Error('LINE_APPROVER_ID not configured')
  }

  // Validate env vars
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    throw new Error('Missing LINE_CHANNEL_ACCESS_TOKEN')
  }

  // Send via LINE Messaging API
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: approverId,
      messages: [
        {
          type: 'flex',
          altText: `New order to verify #${order.order_number}`,
          contents: flexCard
        }
      ]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LINE API error ${response.status}: ${errorText}`)
  }

  console.log('[LINE:NOTIFY] Success:', orderId)
}

export async function sendStaffNotification(orderId: string): Promise<void> {
  const supabase = getSupabaseServer()
  // Fetch order
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  const order = orderData as OrderRow | null
  if (orderError || !order) {
    console.error('[LINE:STAFF] Failed to fetch order:', orderError)
    throw new Error('Failed to fetch order')
  }

  // Fetch order items
  const { data: itemsData, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)

  const items = (itemsData ?? []) as OrderItemRow[]
  if (itemsError) {
    console.error('[LINE:STAFF] Failed to fetch order items:', itemsError)
    throw new Error('Failed to fetch order items')
  }

  // Format pickup time (EN-first for staff)
  const pickupText = formatPickupTimeEN(order.pickup_type, order.pickup_time)

  // Format items with options for staff (EN names, need full details)
  const itemsList = items?.map(item => {
    let itemText = `${item.qty}x ${item.name_en || item.name_th}`

    // Add selected options (EN-first with fallback)
    if (item.selected_options_json) {
      try {
        const options = item.selected_options_json
        if (Array.isArray(options) && options.length > 0) {
          const optionNames = options.flatMap((opt: { choice_names_en?: string[]; choice_names_th?: string[]; name_en?: string; name_th?: string }) => {
            if (opt.choice_names_en && Array.isArray(opt.choice_names_en)) {
              return opt.choice_names_en
            } else if (opt.choice_names_th && Array.isArray(opt.choice_names_th)) {
              return opt.choice_names_th
            } else if (opt.name_en) {
              return [opt.name_en]
            } else if (opt.name_th) {
              return [opt.name_th]
            }
            return []
          })
          if (optionNames.length > 0) {
            itemText += ` (${optionNames.join(', ')})`
          }
        }
      } catch {
        // Ignore malformed options
      }
    }

    // Add item note
    if (item.note) {
      itemText += ` 📝${item.note}`
    }

    return itemText
  }) || []

  // Build Flex card for staff (NO button, EN-first)
  const flexCard = buildFlexOrderCard({
    titleTH: 'Order approved (paid)',
    titleEN: 'Start preparing now',
    fields: [
      { label: STAFF_LABELS.order, value: `#${order.order_number}` },
      { label: STAFF_LABELS.customerName, value: order.customer_name },
      { label: STAFF_LABELS.phone, value: order.customer_phone },
      { label: STAFF_LABELS.pickupTime, value: pickupText },
      { label: STAFF_LABELS.total, value: `฿${order.total_amount_dec?.toFixed(2)}` }
    ],
    items: itemsList,
    noteLabel: order.customer_note ? STAFF_LABELS.note : undefined,
    noteValue: order.customer_note || undefined,
    showButton: false,
    footerText: 'Details in Staff Board'
  })

  // Get staff ID from DB/env
  const { staffId } = await getLineRecipients()

  if (!staffId) {
    throw new Error('LINE_STAFF_ID not configured')
  }

  // Validate env vars
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    throw new Error('Missing LINE_CHANNEL_ACCESS_TOKEN')
  }

  // Send via LINE Messaging API
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: staffId,
      messages: [
        {
          type: 'flex',
          altText: `Order approved #${order.order_number}`,
          contents: flexCard
        }
      ]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LINE API error ${response.status}: ${errorText}`)
  }

  console.log('[LINE:STAFF] Success:', orderId)
}

export async function sendStaffAdjustmentNotification(orderId: string): Promise<void> {
  const supabase = getSupabaseServer()
  // Fetch order
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  const order = orderData as OrderRow | null
  if (orderError || !order) {
    console.error('[LINE:ADJUST] Failed to fetch order:', orderError)
    throw new Error('Failed to fetch order')
  }

  // Format pickup time (EN-first for staff)
  const pickupText = formatPickupTimeEN(order.pickup_type, order.pickup_time)

  // Build Flex card for staff adjustment (NO button, EN-first)
  const flexCard = buildFlexOrderCard({
    titleTH: 'Order updated',
    titleEN: 'Check new details',
    fields: [
      { label: STAFF_LABELS.order, value: `#${order.order_number}` },
      { label: STAFF_LABELS.customerName, value: order.customer_name },
      { label: STAFF_LABELS.pickupTime, value: pickupText },
      { label: STAFF_LABELS.total, value: `฿${order.total_amount_dec?.toFixed(2)}` }
    ],
    noteLabel: 'Changes',
    noteValue: order.adjustment_note || undefined,
    showButton: false,
    footerText: 'Check in Staff Board'
  })

  // Get staff ID from DB/env
  const { staffId } = await getLineRecipients()

  if (!staffId) {
    throw new Error('LINE_STAFF_ID not configured')
  }

  // Validate env vars
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    throw new Error('Missing LINE_CHANNEL_ACCESS_TOKEN')
  }

  // Send via LINE Messaging API
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: staffId,
      messages: [
        {
          type: 'flex',
          altText: `Order updated #${order.order_number}`,
          contents: flexCard
        }
      ]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LINE API error ${response.status}: ${errorText}`)
  }

  console.log('[LINE:ADJUST] Success:', orderId)
}

export async function sendCustomerSlipConfirmation(orderId: string): Promise<void> {
  const supabase = getSupabaseServer()
  // Fetch order
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  const order = orderData as OrderRow | null
  if (orderError || !order) {
    console.error('[LINE:CUSTOMER_SLIP] Failed to fetch order:', orderError?.message || 'Not found')
    throw new Error('Failed to fetch order')
  }

  if (!order.customer_line_user_id) {
    console.error('[LINE:CUSTOMER_SLIP] No customer LINE user ID')
    throw new Error('No customer LINE user ID')
  }

  // Build Flex card for customer (NO button)
  const flexCard = buildFlexOrderCard({
    titleTH: '🧾 ได้รับหลักฐานการชำระเงินแล้ว',
    titleEN: 'กำลังตรวจสอบ จะแจ้งผลให้ทราบเร็วๆ นี้',
    fields: [
      { label: LINE_LABELS.order, value: `#${order.order_number}` },
      { label: LINE_LABELS.status, value: 'รอตรวจสอบการชำระเงิน' },
      { label: LINE_LABELS.total, value: `฿${order.total_amount_dec?.toFixed(2)}` }
    ],
    showButton: false
  })

  // Validate env vars
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    throw new Error('Missing LINE_CHANNEL_ACCESS_TOKEN')
  }

  // Send via LINE Messaging API
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: order.customer_line_user_id,
      messages: [
        {
          type: 'flex',
          altText: `ได้รับหลักฐานการชำระเงินแล้ว #${order.order_number}`,
          contents: flexCard
        }
      ]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LINE API error ${response.status}: ${errorText}`)
  }

  console.log('[LINE:CUSTOMER_SLIP] Success:', orderId)
}

export async function sendCustomerApprovedNotification(orderId: string): Promise<void> {
  const supabase = getSupabaseServer()
  // Fetch order
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  const order = orderData as OrderRow | null
  if (orderError || !order) {
    console.error('[LINE:CUSTOMER_APPROVED] Failed to fetch order:', orderError?.message || 'Not found')
    throw new Error('Failed to fetch order')
  }

  if (!order.customer_line_user_id) {
    console.error('[LINE:CUSTOMER_APPROVED] No customer LINE user ID')
    throw new Error('No customer LINE user ID')
  }

  // Fetch order items for summary
  const { data: itemsData, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)

  const items = (itemsData ?? []) as OrderItemRow[]
  if (itemsError) {
    console.error('[LINE:CUSTOMER_APPROVED] Failed to fetch order items:', itemsError)
    // Continue without items - don't fail the notification
  }

  // Validate env vars
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    throw new Error('Missing LINE_CHANNEL_ACCESS_TOKEN')
  }

  // Format pickup time
  const pickupText = formatPickupTime(order.pickup_type, order.pickup_time)

  // Format items list (TH names for customer)
  const itemsList = items?.map(item => `${item.qty}x ${item.name_th}`) || []

  // Build fields
  const fields: FlexField[] = [
    { label: LINE_LABELS.order, value: `#${order.order_number}` },
    { label: LINE_LABELS.status, value: 'ชำระเงินสำเร็จ' },
    { label: LINE_LABELS.total, value: `฿${order.total_amount_dec?.toFixed(2)}` }
  ]

  // Add pickup time if available
  if (pickupText) {
    fields.push({ label: LINE_LABELS.pickupTime, value: pickupText })
  }

  // Build Flex card for customer with items summary
  const flexCard = buildFlexOrderCard({
    titleTH: '✅ ออเดอร์ได้รับการยืนยันแล้ว',
    titleEN: 'กำลังเตรียมอาหารให้คุณ',
    fields,
    items: itemsList.length > 0 ? itemsList : undefined,
    showButton: false
  })

  // Send via LINE Messaging API
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: order.customer_line_user_id,
      messages: [
        {
          type: 'flex',
          altText: `ออเดอร์ได้รับการยืนยันแล้ว #${order.order_number}`,
          contents: flexCard
        }
      ]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LINE API error ${response.status}: ${errorText}`)
  }

  console.log('[LINE:CUSTOMER_APPROVED] Success:', orderId)
}

export async function sendCustomerInvoiceNotification(
  customerLineUserId: string,
  orderNumber: string,
  totalAmount: number,
  invoicePdfUrl: string
): Promise<void> {
  // Validate env vars
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    throw new Error('Missing LINE_CHANNEL_ACCESS_TOKEN')
  }

  // Build Flex card for invoice notification
  const formattedTotal = typeof totalAmount === 'number'
    ? totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : totalAmount
  const flexCard = buildFlexOrderCard({
    titleTH: 'ใบกำกับภาษีพร้อมแล้ว',
    titleEN: 'Your VAT Invoice is ready',
    fields: [
      { label: LINE_LABELS.order, value: `#${orderNumber}` },
      { label: LINE_LABELS.total, value: `฿${formattedTotal}` }
    ],
    showButton: true,
    buttonLabel: 'เปิดใบกำกับภาษี (PDF)',
    buttonColor: '#0066cc',
    actionUrl: invoicePdfUrl
  })

  // Send via LINE Messaging API
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: customerLineUserId,
      messages: [
        {
          type: 'flex',
          altText: `ใบกำกับภาษีพร้อมแล้ว #${orderNumber}`,
          contents: flexCard
        }
      ]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LINE API error ${response.status}: ${errorText}`)
  }

  console.log('[LINE:INVOICE] Success: order', orderNumber)
}

export async function sendCustomerNotification(orderId: string, status: 'ready' | 'picked_up'): Promise<void> {
  const supabase = getSupabaseServer()
  // Fetch order
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  const order = orderData as OrderRow | null
  if (orderError || !order) {
    console.error('[LINE:CUSTOMER] Failed to fetch order:', orderError?.message || 'Not found')
    throw new Error('Failed to fetch order')
  }

  if (!order.customer_line_user_id) {
    console.error('[LINE:CUSTOMER] No customer LINE user ID')
    throw new Error('No customer LINE user ID')
  }

  // Validate env vars
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
    throw new Error('Missing LINE_CHANNEL_ACCESS_TOKEN')
  }

  let message: object

  if (status === 'ready') {
    // Build Flex card for "ready" status (NO button)
    const flexCard = buildFlexOrderCard({
      titleTH: '🍱 ออเดอร์ของคุณพร้อมแล้ว!',
      titleEN: 'มารับได้เลยค่ะ',
      fields: [
        { label: LINE_LABELS.order, value: `#${order.order_number}` },
        { label: LINE_LABELS.status, value: 'พร้อมรับ' }
      ],
      showButton: false
    })

    message = {
      type: 'flex',
      altText: `ออเดอร์พร้อมแล้ว #${order.order_number}`,
      contents: flexCard
    }
  } else {
    // Keep "picked_up" as text message (simple thank you)
    message = {
      type: 'text',
      text: `✅ ขอบคุณที่มารับออเดอร์ค่ะ\n\n📋 ออเดอร์ #${order.order_number}\n\n🙏 ขอบคุณที่อุดหนุน TENZAI\nหวังว่าจะได้พบกันอีกนะคะ`
    }
  }

  // Send via LINE Messaging API
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: order.customer_line_user_id,
      messages: [message]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LINE API error ${response.status}: ${errorText}`)
  }

  console.log('[LINE:CUSTOMER] Success:', orderId, status)
}
