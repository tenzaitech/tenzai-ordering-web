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
  if (authError) {
    console.error('[API:APPROVE] Admin auth failed')
    return authError
  }

  // CSRF check (relaxed in dev after successful admin auth)
  // DEV-ONLY BYPASS: Allow admin mutations with valid session but missing/invalid CSRF
  // Production: full CSRF enforcement remains unchanged
  const csrfValid = validateCsrf(request)
  if (!csrfValid) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[API:APPROVE] CSRF validation failed')
      return csrfError()
    } else {
      console.warn('[API:APPROVE] CSRF validation bypassed in development (admin session is valid)')
    }
  }

  const { ip, userAgent } = getRequestMeta(request)
  const supabase = getSupabaseServer()

  try {
    const body = await request.json()
    const { orderId } = body

    if (!orderId) {
      return NextResponse.json({ error: 'Missing orderId', reason: 'MISSING_ORDER_ID' }, { status: 400 })
    }

    // Fetch order
    const { data, error: orderError } = await supabase
      .from('orders')
      .select('status, approved_at')
      .eq('id', orderId)
      .single()

    const order = data as OrderRow | null

    if (orderError || !order) {
      console.error('[API:APPROVE] Order not found:', orderId, orderError)
      return NextResponse.json({ error: 'Order not found', reason: 'ORDER_NOT_FOUND' }, { status: 404 })
    }

    // Idempotency: exit if already approved
    if (order.approved_at) {
      console.log('[API:APPROVE] Already approved:', orderId, 'at', order.approved_at)
      return NextResponse.json({ status: 'already_approved', reason: 'ALREADY_APPROVED', approved_at: order.approved_at })
    }

    // Update order status to approved
    const approvalPayload: OrderApproval = {
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: 'admin'
    }
    const { error: updateError } = await supabase
      .from('orders')
      .update(approvalPayload)
      .eq('id', orderId)

    if (updateError) {
      console.error('[API:APPROVE] Failed to update order:', orderId, updateError)
      return NextResponse.json({ error: 'Failed to approve order', reason: 'DB_UPDATE_FAILED', details: updateError.message }, { status: 500 })
    }

    console.log('[API:APPROVE] Order approved successfully:', orderId)

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
        console.log('[API:APPROVE] Staff notification sent:', orderId)
        await supabase
          .from('orders')
          .update({ staff_notified_at: now } as any)
          .eq('id', orderId)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error('[API:APPROVE] Staff notification failed:', orderId, errorMsg)
      }

      // Send customer notification
      try {
        await sendCustomerApprovedNotification(orderId)
        console.log('[API:APPROVE] Customer notification sent:', orderId)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error('[API:APPROVE] Customer notification failed:', orderId, errorMsg)
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

    return NextResponse.json({ status: 'approved', reason: 'SUCCESS' })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[API:APPROVE] Unexpected error:', errorMsg)
    return NextResponse.json({ error: 'Internal error', reason: 'UNEXPECTED_ERROR' }, { status: 500 })
  }
}
