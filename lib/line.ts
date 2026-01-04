import { supabase } from './supabase'

// Fetch LINE recipient IDs from DB (with env fallback)
async function getLineRecipients(): Promise<{ approverId: string; staffId: string }> {
  const { data: settings } = await supabase
    .from('admin_settings')
    .select('line_approver_id, line_staff_id')
    .limit(1)
    .single()

  return {
    approverId: settings?.line_approver_id || process.env.LINE_APPROVER_ID || '',
    staffId: settings?.line_staff_id || process.env.LINE_STAFF_ID || ''
  }
}

// Format pickup time to Bangkok timezone
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

// ============================================================
// FLEX MESSAGE BUILDER
// ============================================================

// Standardized LINE Flex labels (Thai-first)
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
            label: 'ดูออเดอร์',
            uri: actionUrl
          },
          style: 'primary',
          color: '#0066cc',
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
  // Fetch order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    console.error('[LINE:NOTIFY] Failed to fetch order:', orderError)
    throw new Error('Failed to fetch order')
  }

  // Fetch order items
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)

  if (itemsError) {
    console.error('[LINE:NOTIFY] Failed to fetch order items:', itemsError)
    throw new Error('Failed to fetch order items')
  }

  // Format pickup time
  const pickupText = formatPickupTime(order.pickup_type, order.pickup_time)

  // Format items list
  const itemsList = items?.map(item => `${item.qty}x ${item.name_th}`) || []

  // Build Flex card for approver (NO button)
  const flexCard = buildFlexOrderCard({
    titleTH: '🔔 มีออเดอร์ใหม่รอตรวจสอบ',
    titleEN: 'กรุณาตรวจสลิปและอนุมัติ',
    fields: [
      { label: LINE_LABELS.order, value: `#${order.order_number}` },
      { label: LINE_LABELS.customerName, value: order.customer_name },
      { label: LINE_LABELS.phone, value: order.customer_phone },
      { label: LINE_LABELS.pickupTime, value: pickupText },
      { label: LINE_LABELS.total, value: `฿${order.total_amount}` }
    ],
    items: itemsList,
    noteLabel: order.customer_note ? LINE_LABELS.note : undefined,
    noteValue: order.customer_note || undefined,
    slipUrl: order.slip_url,
    showButton: false,
    footerText: 'ตรวจสอบใน Admin Panel'
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
          altText: `มีออเดอร์ใหม่รอตรวจสอบ #${order.order_number}`,
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
  // Fetch order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    console.error('[LINE:STAFF] Failed to fetch order:', orderError)
    throw new Error('Failed to fetch order')
  }

  // Fetch order items
  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)

  if (itemsError) {
    console.error('[LINE:STAFF] Failed to fetch order items:', itemsError)
    throw new Error('Failed to fetch order items')
  }

  // Format pickup time
  const pickupText = formatPickupTime(order.pickup_type, order.pickup_time)

  // Format items with options for staff (need full details)
  const itemsList = items?.map(item => {
    let itemText = `${item.qty}x ${item.name_th}`

    // Add selected options
    if (item.selected_options_json) {
      try {
        const options = item.selected_options_json
        if (Array.isArray(options) && options.length > 0) {
          const optionNames = options.flatMap((opt: { choice_names_th?: string[]; name_th?: string }) => {
            if (opt.choice_names_th && Array.isArray(opt.choice_names_th)) {
              return opt.choice_names_th
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

  // Build Flex card for staff (NO button)
  const flexCard = buildFlexOrderCard({
    titleTH: '✅ ชำระเงินเรียบร้อย',
    titleEN: 'เริ่มเตรียมออเดอร์ได้เลย!',
    fields: [
      { label: LINE_LABELS.order, value: `#${order.order_number}` },
      { label: LINE_LABELS.customerName, value: order.customer_name },
      { label: LINE_LABELS.phone, value: order.customer_phone },
      { label: LINE_LABELS.pickupTime, value: pickupText },
      { label: LINE_LABELS.total, value: `฿${order.total_amount}` }
    ],
    items: itemsList,
    noteLabel: order.customer_note ? LINE_LABELS.note : undefined,
    noteValue: order.customer_note || undefined,
    showButton: false,
    footerText: 'รายละเอียดเพิ่มเติมใน Staff Board'
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
          altText: `ชำระเงินเรียบร้อย #${order.order_number}`,
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
  // Fetch order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    console.error('[LINE:ADJUST] Failed to fetch order:', orderError)
    throw new Error('Failed to fetch order')
  }

  // Format pickup time
  const pickupText = formatPickupTime(order.pickup_type, order.pickup_time)

  // Build Flex card for staff adjustment (NO button)
  const flexCard = buildFlexOrderCard({
    titleTH: '⚠️ มีการปรับเปลี่ยนออเดอร์',
    titleEN: 'กรุณาตรวจสอบรายละเอียดใหม่',
    fields: [
      { label: LINE_LABELS.order, value: `#${order.order_number}` },
      { label: LINE_LABELS.customerName, value: order.customer_name },
      { label: LINE_LABELS.pickupTime, value: pickupText },
      { label: LINE_LABELS.total, value: `฿${order.total_amount}` }
    ],
    noteLabel: 'รายละเอียดการปรับเปลี่ยน',
    noteValue: order.adjustment_note,
    showButton: false,
    footerText: 'ตรวจสอบใน Staff Board'
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
          altText: `มีการปรับเปลี่ยนออเดอร์ #${order.order_number}`,
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
  // Fetch order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    console.error('[LINE:CUSTOMER_SLIP] Failed to fetch order:', orderError?.message || 'Not found')
    throw new Error('Failed to fetch order')
  }

  if (!order.customer_line_user_id) {
    console.error('[LINE:CUSTOMER_SLIP] No customer LINE user ID')
    throw new Error('No customer LINE user ID')
  }

  // Get LIFF ID for links
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID || ''
  const statusUrl = `https://liff.line.me/${liffId}/order/status/${orderId}`

  // Build Flex card for customer (HAS button)
  const flexCard = buildFlexOrderCard({
    titleTH: '🧾 ได้รับหลักฐานการชำระเงินแล้ว',
    titleEN: 'กำลังตรวจสอบ จะแจ้งผลให้ทราบเร็วๆ นี้',
    fields: [
      { label: LINE_LABELS.order, value: `#${order.order_number}` },
      { label: LINE_LABELS.status, value: 'รอตรวจสอบการชำระเงิน' },
      { label: LINE_LABELS.total, value: `฿${order.total_amount}` }
    ],
    showButton: true,
    actionUrl: statusUrl
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

export async function sendCustomerNotification(orderId: string, status: 'ready' | 'picked_up'): Promise<void> {
  // Fetch order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single()

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
    // Get LIFF ID for links
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID || ''
    const statusUrl = `https://liff.line.me/${liffId}/order/status/${orderId}`

    // Build Flex card for "ready" status (HAS button)
    const flexCard = buildFlexOrderCard({
      titleTH: '🍱 ออเดอร์ของคุณพร้อมแล้ว!',
      titleEN: 'มารับได้เลยค่ะ',
      fields: [
        { label: LINE_LABELS.order, value: `#${order.order_number}` },
        { label: LINE_LABELS.status, value: 'พร้อมรับ' }
      ],
      showButton: true,
      actionUrl: statusUrl
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
