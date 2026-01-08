/**
 * Admin Invoice Preview Route
 * GET /api/admin/invoice-preview?order_id=xxx or ?order_code=xxx
 *
 * Returns PDF directly for testing without:
 * - Updating database
 * - Uploading to storage
 * - Generating signed URLs
 * - Sending LINE notifications
 *
 * Optional params:
 * - ?mode=fallback - test English-only mode
 * - ?debug=1 - render diagnostic page with run analysis
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { renderInvoicePdf, renderDiagnosticPdf, InvoiceOrderData, InvoiceLineItem } from '@/lib/invoice/pdf'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('order_id')
    const orderCode = searchParams.get('order_code')
    const mode = searchParams.get('mode') // 'fallback' for English-only testing
    const debug = searchParams.get('debug') === '1'

    // Debug mode: render diagnostic PDF (no order required)
    if (debug) {
      console.log('[INVOICE:PREVIEW] Rendering diagnostic PDF...')
      const { pdf, logs } = await renderDiagnosticPdf({ showBoundaryMarks: true, logRuns: true })

      // Log all diagnostic output
      console.log('\n' + '='.repeat(60))
      console.log('[INVOICE:DIAGNOSTIC] Full log output:')
      console.log('='.repeat(60))
      logs.forEach(line => console.log(line))
      console.log('='.repeat(60) + '\n')

      return new NextResponse(pdf, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'inline; filename="invoice-diagnostic.pdf"',
          'Cache-Control': 'no-store, max-age=0'
        }
      })
    }

    if (!orderId && !orderCode) {
      return NextResponse.json(
        { error: 'Missing order_id or order_code query parameter. Use ?debug=1 for diagnostic mode.' },
        { status: 400 }
      )
    }

    // Build query
    let query = supabase
      .from('orders')
      .select('id, order_number, created_at, subtotal_amount, vat_rate, vat_amount, total_amount, invoice_requested, invoice_company_name, invoice_tax_id, invoice_address')

    if (orderId) {
      query = query.eq('id', orderId)
    } else if (orderCode) {
      query = query.eq('order_number', orderCode)
    }

    const { data: orderData, error: orderError } = await query.single()

    if (orderError || !orderData) {
      console.error('[INVOICE:PREVIEW] Order not found:', orderError)
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      )
    }

    // Check if order has invoice data
    if (!orderData.invoice_company_name || !orderData.invoice_tax_id || !orderData.invoice_address) {
      return NextResponse.json(
        {
          error: 'Order missing invoice fields',
          details: {
            has_company_name: !!orderData.invoice_company_name,
            has_tax_id: !!orderData.invoice_tax_id,
            has_address: !!orderData.invoice_address
          }
        },
        { status: 400 }
      )
    }

    // Fetch order items
    const { data: orderItemsData } = await supabase
      .from('order_items')
      .select('name_th, name_en, qty, final_price')
      .eq('order_id', orderData.id)

    const items: InvoiceLineItem[] = (orderItemsData || []).map((item: { name_th: string; name_en: string; qty: number; final_price: number }) => ({
      name_th: item.name_th,
      name_en: item.name_en,
      qty: item.qty,
      final_price: item.final_price
    }))

    // Prepare invoice data
    const invoiceData: InvoiceOrderData = {
      id: orderData.id,
      order_number: orderData.order_number,
      created_at: orderData.created_at,
      subtotal_amount: orderData.subtotal_amount,
      vat_rate: orderData.vat_rate,
      vat_amount: orderData.vat_amount,
      total_amount: orderData.total_amount,
      invoice_company_name: orderData.invoice_company_name,
      invoice_tax_id: orderData.invoice_tax_id,
      invoice_address: orderData.invoice_address,
      items
    }

    console.log('[INVOICE:PREVIEW] Generating preview for:', orderData.order_number, mode ? `(mode: ${mode})` : '')

    // Generate PDF
    // Note: mode=fallback would require modifying renderInvoicePdf to accept a param
    // For now, Thai font availability is auto-detected
    const pdfBuffer = await renderInvoicePdf(invoiceData)

    // Return PDF directly
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="invoice-${orderData.order_number}-preview.pdf"`,
        'Cache-Control': 'no-store, max-age=0'
      }
    })

  } catch (error) {
    console.error('[INVOICE:PREVIEW] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate invoice preview', details: String(error) },
      { status: 500 }
    )
  }
}
