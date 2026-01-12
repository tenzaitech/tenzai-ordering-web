import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { sendStaffNotification, sendCustomerApprovedNotification, sendCustomerInvoiceNotification } from '@/lib/line'

export const runtime = 'nodejs'
import { renderInvoicePdf, InvoiceOrderData, InvoiceLineItem } from '@/lib/invoice/pdf'
import { uploadAndGetSignedUrl } from '@/lib/invoice/storage'
import { checkAdminAuth } from '@/lib/admin-gate'
import { validateCsrf, csrfError } from '@/lib/csrf'
import { auditLog, getRequestMeta } from '@/lib/audit-log'

type OrderRow = {
  status: string
  approved_at: string | null
}

type OrderApproval = {
  status: string
  approved_at: string
  approved_by: string
}

type StaffNotifiedUpdate = {
  staff_notified_at: string
}

export async function POST(request: NextRequest) {
  // Auth check
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  // CSRF check
  if (!validateCsrf(request)) {
    return csrfError()
  }

  const { ip, userAgent } = getRequestMeta(request)
  const supabase = getSupabaseServer()

  try {
    const body = await request.json()
    const { orderId } = body

    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId' }, { status: 400 })
    }

    // Fetch order
    const { data, error: orderError } = await supabase
      .from('orders')
      .select('status, approved_at')
      .eq('id', orderId)
      .single()

    const order = data as OrderRow | null

    if (orderError || !order) {
      console.error('[API:APPROVE] Order not found:', orderId)
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    // Idempotency: exit if already approved
    if (order.approved_at) {
      return NextResponse.json({ status: 'already_approved' })
    }

    // Update order status to approved
    const approvalPayload: OrderApproval = {
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: 'admin'
    }
    const { error: updateError } = await supabase
      .from('orders')
      .update(approvalPayload as never)
      .eq('id', orderId)

    if (updateError) {
      console.error('[API:APPROVE] Failed to update order:', updateError)
      return NextResponse.json({ error: 'Failed to approve order' }, { status: 500 })
    }

    // Audit log - order approved
    await auditLog({
      actor_type: 'admin',
      ip,
      user_agent: userAgent,
      action_code: 'ORDER_APPROVED',
      metadata: { order_id: orderId }
    })

    // Send notifications (fire-and-forget for existing staff/customer)
    Promise.resolve().then(async () => {
      const now = new Date().toISOString()

      // Send staff notification
      try {
        await sendStaffNotification(orderId)
        const staffUpdate: StaffNotifiedUpdate = { staff_notified_at: now }
        await supabase
          .from('orders')
          .update(staffUpdate as never)
          .eq('id', orderId)
      } catch (err) {
        console.error('[API:APPROVE] Staff notification failed:', err)
      }

      // Send customer notification
      try {
        await sendCustomerApprovedNotification(orderId)
      } catch (err) {
        console.error('[API:APPROVE] Customer notification failed:', err)
      }
    })

    // Invoice flow: awaited with try/catch (best-effort, never fails approval)
    try {
      // Fetch full order with invoice fields
      const { data: fullOrderData, error: fullOrderError } = await supabase
        .from('orders')
        .select('id, order_number, created_at, subtotal_amount_dec, vat_rate, vat_amount_dec, total_amount_dec, invoice_requested, invoice_company_name, invoice_tax_id, invoice_address, invoice_buyer_phone, customer_line_user_id')
        .eq('id', orderId)
        .single()

      if (fullOrderError || !fullOrderData) {
        console.error('[API:APPROVE] Failed to fetch order for invoice:', fullOrderError)
      } else if (!fullOrderData.invoice_requested) {
        console.log('[API:APPROVE] Invoice not requested, skipping')
      } else if (!fullOrderData.invoice_company_name || !fullOrderData.invoice_tax_id || !fullOrderData.invoice_address) {
        console.error('[API:APPROVE] Missing invoice fields')
      } else if (!fullOrderData.customer_line_user_id) {
        console.error('[API:APPROVE] No customer LINE user ID for invoice push')
      } else {
        // Fetch order items for the invoice
        const { data: orderItemsData } = await supabase
          .from('order_items')
          .select('name_th, name_en, qty, final_price')
          .eq('order_id', fullOrderData.id)

        const items: InvoiceLineItem[] = (orderItemsData || []).map((item: { name_th: string; name_en: string; qty: number; final_price: number }) => ({
          name_th: item.name_th,
          name_en: item.name_en,
          qty: item.qty,
          final_price: item.final_price
        }))

        // Prepare invoice data (use stored values, never recompute)
        const invoiceData: InvoiceOrderData = {
          id: fullOrderData.id,
          order_number: fullOrderData.order_number,
          created_at: fullOrderData.created_at!, // Always set when order is created
          subtotal_amount_dec: fullOrderData.subtotal_amount_dec!,
          vat_rate: fullOrderData.vat_rate!,
          vat_amount_dec: fullOrderData.vat_amount_dec!,
          total_amount_dec: fullOrderData.total_amount_dec!,
          invoice_company_name: fullOrderData.invoice_company_name!,
          invoice_tax_id: fullOrderData.invoice_tax_id!,
          invoice_address: fullOrderData.invoice_address!,
          invoice_buyer_phone: fullOrderData.invoice_buyer_phone || undefined,
          items
        }

        // Generate PDF
        console.log('[API:APPROVE] Generating invoice PDF for:', fullOrderData.order_number)
        const pdfBuffer = await renderInvoicePdf(invoiceData)

        // Upload to storage and get signed URL
        const signedUrl = await uploadAndGetSignedUrl(fullOrderData.order_number, pdfBuffer)

        // Send LINE message to customer
        await sendCustomerInvoiceNotification(
          fullOrderData.customer_line_user_id!,
          fullOrderData.order_number,
          fullOrderData.total_amount_dec!,
          signedUrl
        )

        console.log('[API:APPROVE] Invoice sent successfully:', fullOrderData.order_number)
      }
    } catch (err) {
      // Log but never fail approval
      console.error('[API:APPROVE] Invoice generation/send failed:', err)
    }

    return NextResponse.json({ status: 'approved' })
  } catch (error) {
    console.error('[API:APPROVE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
