import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSupabaseServer } from '@/lib/supabase-server'
import { checkLiffGate } from '@/lib/liffGate'

export const runtime = 'nodejs'

// Max slip file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

/**
 * POST /api/order/[id]/slip
 * Uploads a payment slip for an order (server-side, uses service role)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check LIFF gate (friendship + freshness)
  const gateError = await checkLiffGate()
  if (gateError) return gateError

  try {
    const { id: orderId } = await params

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID required', error_th: 'ไม่พบรหัสออเดอร์' },
        { status: 400 }
      )
    }

    // Get userId from LIFF session cookie
    const cookieStore = await cookies()
    const userIdCookie = cookieStore.get('tenzai_liff_user')

    if (!userIdCookie || !userIdCookie.value) {
      return NextResponse.json(
        { error: 'Unauthorized', error_th: 'กรุณาเข้าสู่ระบบ' },
        { status: 401 }
      )
    }

    const userId = userIdCookie.value
    const supabase = getSupabaseServer()

    // Verify order exists and belongs to user
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, status, slip_url, slip_notified_at, customer_line_user_id')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found', error_th: 'ไม่พบออเดอร์' },
        { status: 404 }
      )
    }

    // Verify ownership
    if (order.customer_line_user_id !== userId) {
      return NextResponse.json(
        { error: 'Order not found', error_th: 'ไม่พบออเดอร์' },
        { status: 404 }
      )
    }

    // Check if order is locked
    if (order.slip_notified_at || order.status === 'approved' || order.status === 'rejected') {
      return NextResponse.json(
        { error: 'Order is locked', error_th: 'ไม่สามารถอัปโหลดสลิปได้ ออเดอร์ถูกล็อค' },
        { status: 403 }
      )
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('slip') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'Slip file required', error_th: 'กรุณาแนบไฟล์สลิป' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type', error_th: 'กรุณาเลือกไฟล์รูปภาพ (JPG, PNG, WebP)' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large', error_th: 'ไฟล์ใหญ่เกินไป (สูงสุด 5MB)' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop() || 'jpg'
    const fileName = `${Date.now()}_${orderId}.${fileExt}`

    // Convert file to buffer for upload
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('slips')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('[API:SLIP] Upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload slip', error_th: 'ไม่สามารถอัปโหลดสลิปได้' },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('slips')
      .getPublicUrl(fileName)

    // Update order with slip URL and timestamp
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        slip_url: publicUrl,
        slip_notified_at: new Date().toISOString(),
      } as never)
      .eq('id', orderId)

    if (updateError) {
      console.error('[API:SLIP] Update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to save slip', error_th: 'ไม่สามารถบันทึกสลิปได้' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      slip_url: publicUrl,
    })
  } catch (error) {
    console.error('[API:SLIP] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Server error', error_th: 'เกิดข้อผิดพลาด กรุณาลองใหม่' },
      { status: 500 }
    )
  }
}
