import { supabase } from './supabase'

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
  let pickupText = ''
  if (order.pickup_type === 'ASAP') {
    pickupText = 'ให้ร้านทำทันที'
  } else if (order.pickup_time) {
    const date = new Date(order.pickup_time)
    const bangkokOffsetMs = 7 * 60 * 60 * 1000
    const bangkokTime = new Date(date.getTime() + bangkokOffsetMs)
    const hours = String(bangkokTime.getUTCHours()).padStart(2, '0')
    const minutes = String(bangkokTime.getUTCMinutes()).padStart(2, '0')
    const day = String(bangkokTime.getUTCDate()).padStart(2, '0')
    const month = String(bangkokTime.getUTCMonth() + 1).padStart(2, '0')
    pickupText = `${hours}:${minutes} (${day}/${month})`
  }

  // Format items (first 3)
  const itemsList = items?.slice(0, 3).map(item =>
    `${item.qty}x ${item.name_th}`
  ).join('\n') || ''

  const remainingCount = (items?.length || 0) - 3
  const itemsText = remainingCount > 0
    ? `${itemsList}\n+${remainingCount} รายการ`
    : itemsList

  // Format message
  const message = `
🔔 คำสั่งซื้อใหม่

📋 เลขที่: ${order.order_number}
👤 ชื่อ: ${order.customer_name}
📞 เบอร์: ${order.customer_phone}
⏰ รับเมื่อ: ${pickupText}

🍱 รายการ:
${itemsText}

💰 ยอดรวม: ฿${order.total_amount}
${order.customer_note ? `📝 หมายเหตุ: ${order.customer_note}\n\n` : ''}
🧾 สลิป: ${order.slip_url}
  `.trim()

  // Validate env vars
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN || !process.env.LINE_APPROVER_ID) {
    throw new Error('Missing LINE environment variables')
  }

  // Send via LINE Messaging API
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: process.env.LINE_APPROVER_ID,
      messages: [
        { type: 'text', text: message }
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
  let pickupText = ''
  if (order.pickup_type === 'ASAP') {
    pickupText = 'ให้ร้านทำทันที'
  } else if (order.pickup_time) {
    const date = new Date(order.pickup_time)
    const bangkokOffsetMs = 7 * 60 * 60 * 1000
    const bangkokTime = new Date(date.getTime() + bangkokOffsetMs)
    const hours = String(bangkokTime.getUTCHours()).padStart(2, '0')
    const minutes = String(bangkokTime.getUTCMinutes()).padStart(2, '0')
    const day = String(bangkokTime.getUTCDate()).padStart(2, '0')
    const month = String(bangkokTime.getUTCMonth() + 1).padStart(2, '0')
    pickupText = `${hours}:${minutes} (${day}/${month})`
  }

  // Format all items (staff needs full list)
  const itemsList = items?.map(item => {
    let itemText = `${item.qty}x ${item.name_th}`

    // Format selected options
    if (item.selected_options_json) {
      try {
        const options = item.selected_options_json
        if (Array.isArray(options) && options.length > 0) {
          const optionLines = options.map((opt: any) => {
            if (opt.choice_names_th && Array.isArray(opt.choice_names_th)) {
              return opt.choice_names_th.map((choice: string) => `  - ${choice}`).join('\n')
            } else if (opt.name_th) {
              return `  - ${opt.name_th}`
            } else if (typeof opt === 'string') {
              return `  - ${opt}`
            }
            return ''
          }).filter(Boolean).join('\n')

          if (optionLines) {
            itemText += '\n' + optionLines
          }
        }
      } catch (e) {
        // Ignore malformed options
      }
    }

    // Add item note
    if (item.note) {
      itemText += `\n  📝 ${item.note}`
    }

    return itemText
  }).join('\n\n') || ''

  // Format message for staff
  const message = `
✅ คำสั่งซื้อได้รับการอนุมัติ - เริ่มทำได้เลย

📋 เลขที่: ${order.order_number}
👤 ชื่อ: ${order.customer_name}
📞 เบอร์: ${order.customer_phone}
⏰ รับเมื่อ: ${pickupText}

🍱 รายการ:
${itemsList}

💰 ยอดรวม: ฿${order.total_amount}
${order.customer_note ? `📝 หมายเหตุจากลูกค้า: ${order.customer_note}` : ''}
  `.trim()

  // Validate env vars
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN || !process.env.LINE_STAFF_ID) {
    throw new Error('Missing LINE environment variables')
  }

  // Send via LINE Messaging API
  const response = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      to: process.env.LINE_STAFF_ID,
      messages: [
        { type: 'text', text: message }
      ]
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`LINE API error ${response.status}: ${errorText}`)
  }

  console.log('[LINE:STAFF] Success:', orderId)
}
