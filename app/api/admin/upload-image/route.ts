import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAdminAuth } from '@/lib/admin-gate'

const BUCKET_NAME = 'menu-images'
const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function sanitizeMenuCode(menuCode: string): string {
  return menuCode.trim().replace(/[^a-zA-Z0-9_-]/g, '_')
}

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function POST(request: NextRequest) {
  const authError = checkAdminAuth(request)
  if (authError) return authError

  try {
    const supabase = getSupabaseServerClient()

    const formData = await request.formData()
    const file = formData.get('file') as File
    const menuCode = formData.get('menu_code') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed' },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      )
    }

    const fileExt = file.name.split('.').pop()
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(7)
    const fileName = `${timestamp}_${randomStr}.${fileExt}`

    const namespace = menuCode ? sanitizeMenuCode(menuCode) : 'uncategorized'
    const storagePath = `${namespace}/${fileName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (error) {
      console.error('[UPLOAD_IMAGE] Upload error:', error)
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(storagePath)

    return NextResponse.json({
      success: true,
      url: publicUrlData.publicUrl,
      storagePath: storagePath
    })
  } catch (error) {
    console.error('[UPLOAD_IMAGE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const authError = checkAdminAuth(request)
  if (authError) return authError

  try {
    const supabase = getSupabaseServerClient()

    const body = await request.json()

    if (!body.path) {
      return NextResponse.json({ error: 'path is required' }, { status: 400 })
    }

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([body.path])

    if (error) {
      console.error('[DELETE_IMAGE] Delete error:', error)
      return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[DELETE_IMAGE] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
