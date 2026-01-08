import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { checkAdminAuth } from '@/lib/admin-gate'

// Types
interface MenuRecord {
  menu_code: string
  name_en: string | null
  category_code: string | null
  image_focus_y_1x1: number | null
  image_focus_y_4x3: number | null
}

interface PreviewResult {
  filename: string
  extracted_name: string
  normalized_name: string
  matched_menu_code: string | null
  matched_menu_name: string | null
  matched_category_code: string | null
  confidence: number
  status: 'AUTO' | 'NEED_REVIEW' | 'NO_MATCH'
  slug_collision?: boolean
  top_candidates?: { menu_code: string; name_en: string; confidence: number }[]
}

interface PreviewResponse {
  results: PreviewResult[]
  candidates: {
    menu_code: string
    name_en: string
    category_code: string | null
    image_focus_y_1x1: number | null
    image_focus_y_4x3: number | null
  }[]
}

// Normalization: lowercase, trim, remove special chars, collapse spaces, replace spaces with -
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[()[\]{}.,'":;!?@#$%^&*+=<>~`|\\\/]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s/g, '-')
}

// Remove prefix pattern like "P011 " or "A01 " from filename
function extractNameFromFilename(filename: string): string {
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '')
  const withoutPrefix = nameWithoutExt.replace(/^[A-Za-z]\d+\s+/, '')
  return withoutPrefix.trim()
}

// Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 100
  if (a.length === 0 || b.length === 0) return 0
  const distance = levenshteinDistance(a, b)
  const maxLen = Math.max(a.length, b.length)
  return Math.round(((maxLen - distance) / maxLen) * 100)
}

// Find top N matching menus for a normalized name
function findTopMatches(
  normalizedName: string,
  menus: { menu_code: string; name_en: string; category_code: string | null; normalized: string }[],
  limit: number = 3
): { menu_code: string; name_en: string; category_code: string | null; confidence: number }[] {
  const matches = menus.map(menu => ({
    menu_code: menu.menu_code,
    name_en: menu.name_en,
    category_code: menu.category_code,
    confidence: calculateSimilarity(normalizedName, menu.normalized)
  }))

  matches.sort((a, b) => b.confidence - a.confidence)
  return matches.slice(0, limit)
}

function getSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
  }
  if (!supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable')
  }

  return createClient(supabaseUrl, supabaseServiceKey)
}

export async function POST(request: NextRequest) {
  const authError = await checkAdminAuth(request)
  if (authError) return authError

  try {
    const supabase = getSupabaseServerClient()
    const body = await request.json()
    const filenames: string[] = body.filenames

    if (!Array.isArray(filenames) || filenames.length === 0) {
      return NextResponse.json(
        { error: 'filenames array is required' },
        { status: 400 }
      )
    }

    // Fetch all menus with name_en, category_code, and focus values
    const { data: menuData, error: menuError } = await supabase
      .from('menu_items')
      .select('menu_code, name_en, category_code, image_focus_y_1x1, image_focus_y_4x3')

    if (menuError) {
      console.error('[IMAGE_IMPORT_PREVIEW] DB error:', menuError)
      return NextResponse.json(
        { error: 'Failed to fetch menu items' },
        { status: 500 }
      )
    }

    // Filter menus with valid name_en and pre-normalize
    const menus = (menuData as MenuRecord[])
      .filter(m => m.name_en && m.name_en.trim())
      .map(m => ({
        menu_code: m.menu_code,
        name_en: m.name_en!,
        category_code: m.category_code,
        image_focus_y_1x1: m.image_focus_y_1x1,
        image_focus_y_4x3: m.image_focus_y_4x3,
        normalized: normalizeName(m.name_en!)
      }))

    // Build normalized lookup for exact matches
    const normalizedLookup = new Map<string, { menu_code: string; name_en: string; category_code: string | null }>()
    for (const menu of menus) {
      normalizedLookup.set(menu.normalized, {
        menu_code: menu.menu_code,
        name_en: menu.name_en,
        category_code: menu.category_code
      })
    }

    // Collision detection: Build map of normalized slug -> menu_codes[]
    const slugToMenus = new Map<string, string[]>()
    for (const menu of menus) {
      const existing = slugToMenus.get(menu.normalized) || []
      existing.push(menu.menu_code)
      slugToMenus.set(menu.normalized, existing)
    }

    const collisionSlugs = new Set<string>()
    for (const [slug, menuCodes] of Array.from(slugToMenus.entries())) {
      if (menuCodes.length > 1) {
        collisionSlugs.add(slug)
        console.log(`[IMAGE_IMPORT_PREVIEW] Slug collision: "${slug}" -> [${menuCodes.join(', ')}]`)
      }
    }

    // Process each filename
    const results: PreviewResult[] = []

    for (const filename of filenames) {
      const extractedName = extractNameFromFilename(filename)
      const normalizedName = normalizeName(extractedName)

      // Get top 3 candidates for this filename
      const topCandidates = findTopMatches(normalizedName, menus, 3)
        .filter(c => c.confidence >= 50)
        .map(c => ({ menu_code: c.menu_code, name_en: c.name_en, confidence: c.confidence }))

      // Try exact match first
      const exactMatch = normalizedLookup.get(normalizedName)

      if (exactMatch) {
        const matchedMenu = menus.find(m => m.menu_code === exactMatch.menu_code)
        const hasCollision = matchedMenu ? collisionSlugs.has(matchedMenu.normalized) : false

        results.push({
          filename,
          extracted_name: extractedName,
          normalized_name: normalizedName,
          matched_menu_code: exactMatch.menu_code,
          matched_menu_name: exactMatch.name_en,
          matched_category_code: exactMatch.category_code,
          confidence: 100,
          status: hasCollision ? 'NEED_REVIEW' : 'AUTO',
          slug_collision: hasCollision || undefined,
          top_candidates: topCandidates.length > 0 ? topCandidates : undefined
        })
        continue
      }

      // Fuzzy match - get best match
      const topMatches = findTopMatches(normalizedName, menus, 1)
      const bestMatch = topMatches[0]

      if (!bestMatch || bestMatch.confidence < 70) {
        results.push({
          filename,
          extracted_name: extractedName,
          normalized_name: normalizedName,
          matched_menu_code: bestMatch?.menu_code || null,
          matched_menu_name: bestMatch?.name_en || null,
          matched_category_code: bestMatch?.category_code || null,
          confidence: bestMatch?.confidence || 0,
          status: 'NO_MATCH',
          top_candidates: topCandidates.length > 0 ? topCandidates : undefined
        })
      } else if (bestMatch.confidence >= 90) {
        const matchedMenu = menus.find(m => m.menu_code === bestMatch.menu_code)
        const hasCollision = matchedMenu ? collisionSlugs.has(matchedMenu.normalized) : false

        results.push({
          filename,
          extracted_name: extractedName,
          normalized_name: normalizedName,
          matched_menu_code: bestMatch.menu_code,
          matched_menu_name: bestMatch.name_en,
          matched_category_code: bestMatch.category_code,
          confidence: bestMatch.confidence,
          status: hasCollision ? 'NEED_REVIEW' : 'AUTO',
          slug_collision: hasCollision || undefined,
          top_candidates: topCandidates.length > 0 ? topCandidates : undefined
        })
      } else {
        // 70-89: NEED_REVIEW
        results.push({
          filename,
          extracted_name: extractedName,
          normalized_name: normalizedName,
          matched_menu_code: bestMatch.menu_code,
          matched_menu_name: bestMatch.name_en,
          matched_category_code: bestMatch.category_code,
          confidence: bestMatch.confidence,
          status: 'NEED_REVIEW',
          top_candidates: topCandidates.length > 0 ? topCandidates : undefined
        })
      }
    }

    // Return all menus as candidates for dropdown (including focus values)
    const candidates = menus.map(m => ({
      menu_code: m.menu_code,
      name_en: m.name_en,
      category_code: m.category_code,
      image_focus_y_1x1: m.image_focus_y_1x1,
      image_focus_y_4x3: m.image_focus_y_4x3
    }))

    const response: PreviewResponse = { results, candidates }
    return NextResponse.json(response)

  } catch (error) {
    console.error('[IMAGE_IMPORT_PREVIEW] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
