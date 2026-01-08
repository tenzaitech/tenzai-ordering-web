/**
 * Invoice Storage Helpers
 * Upload PDF to Supabase Storage (private bucket) and generate signed URLs
 */
import { createClient } from '@supabase/supabase-js'
import { INVOICE_BUCKET, INVOICE_SIGNED_URL_EXPIRY } from './config'

// Create server-side Supabase client with service role for storage operations
function getStorageClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL for storage operations')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
  })
}

/**
 * Upload invoice PDF to Supabase Storage
 * Uses upsert to allow idempotent reruns
 * @param orderCode - Order number/code for filename
 * @param pdfBuffer - PDF file as Uint8Array
 * @returns Object path in storage
 */
export async function uploadInvoicePdf(orderCode: string, pdfBuffer: Uint8Array): Promise<string> {
  const supabase = getStorageClient()
  const objectPath = `invoices/${orderCode}.pdf`

  const { error } = await supabase.storage
    .from(INVOICE_BUCKET)
    .upload(objectPath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true // Idempotent - overwrites if exists
    })

  if (error) {
    console.error('[INVOICE:STORAGE] Upload failed:', error.message)
    throw new Error(`Failed to upload invoice: ${error.message}`)
  }

  console.log('[INVOICE:STORAGE] Uploaded:', objectPath)
  return objectPath
}

/**
 * Generate signed URL for invoice PDF
 * URL expires after configured duration (default 7 days)
 * @param objectPath - Path returned from uploadInvoicePdf
 * @returns Signed URL string
 */
export async function createInvoiceSignedUrl(objectPath: string): Promise<string> {
  const supabase = getStorageClient()

  const { data, error } = await supabase.storage
    .from(INVOICE_BUCKET)
    .createSignedUrl(objectPath, INVOICE_SIGNED_URL_EXPIRY)

  if (error || !data?.signedUrl) {
    console.error('[INVOICE:STORAGE] Signed URL failed:', error?.message)
    throw new Error(`Failed to create signed URL: ${error?.message}`)
  }

  console.log('[INVOICE:STORAGE] Signed URL created (expires in 7 days)')
  return data.signedUrl
}

/**
 * Combined helper: Upload PDF and return signed URL
 */
export async function uploadAndGetSignedUrl(orderCode: string, pdfBuffer: Uint8Array): Promise<string> {
  const objectPath = await uploadInvoicePdf(orderCode, pdfBuffer)
  return await createInvoiceSignedUrl(objectPath)
}
