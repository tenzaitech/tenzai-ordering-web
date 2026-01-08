/**
 * Branded VAT Invoice PDF Renderer
 *
 * Features:
 * - Premium A4 layout with brand header (logo optional)
 * - Anuphan font for Thai text (tighter kerning, document-grade)
 * - Single-font-per-line strategy for consistent spacing
 * - Multi-page support with repeated table headers
 * - Graceful fallback to English-only if Thai fonts unavailable
 */
import { PDFDocument, PDFPage, PDFFont, rgb, StandardFonts } from 'pdf-lib'
import * as fontkitNS from '@pdf-lib/fontkit'
import * as fs from 'fs'
import * as path from 'path'
import { SELLER_INFO } from './config'

// Robust fontkit extraction: handle CJS/ESM interop in Next.js bundling
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fontkit = (fontkitNS as any).default ?? (fontkitNS as any)

// ============================================================
// ASSET PATHS
// ============================================================
const FONT_PATH_REGULAR = path.join(process.cwd(), 'assets/fonts/Anuphan-Regular.ttf')
const FONT_PATH_BOLD = path.join(process.cwd(), 'assets/fonts/Anuphan-Bold.ttf')
const LOGO_PATH_PNG = path.join(process.cwd(), 'assets/brand/logo.png')
const LOGO_PATH_JPG = path.join(process.cwd(), 'assets/brand/logo.jpg')

// ============================================================
// A4 LAYOUT CONSTANTS (in points, 1pt = 1/72 inch)
// ============================================================
const A4_WIDTH = 595
const A4_HEIGHT = 842
const MARGIN_LEFT = 50
const MARGIN_RIGHT = 50
const MARGIN_TOP = 50
const MARGIN_BOTTOM = 50
const CONTENT_WIDTH = A4_WIDTH - MARGIN_LEFT - MARGIN_RIGHT

// Header area
const HEADER_Y = A4_HEIGHT - MARGIN_TOP
const HEADER_LOGO_MAX_HEIGHT = 36 // ~12.7mm
const HEADER_LOGO_MAX_WIDTH = 100
const HEADER_DIVIDER_Y = HEADER_Y - 55

// Invoice info
const INVOICE_INFO_Y = HEADER_DIVIDER_Y - 20

// Seller/Buyer blocks
const SELLER_BLOCK_Y = INVOICE_INFO_Y - 35
const BUYER_BLOCK_Y_OFFSET = 90 // Below seller

// Items table
const TABLE_HEADER_HEIGHT = 20
const TABLE_ROW_HEIGHT = 16
const TABLE_COL_ITEM_X = MARGIN_LEFT
const TABLE_COL_QTY_X = MARGIN_LEFT + 300
const TABLE_COL_UNIT_X = MARGIN_LEFT + 370
const TABLE_COL_AMOUNT_X = A4_WIDTH - MARGIN_RIGHT - 70

// Totals area
const TOTALS_Y_FROM_BOTTOM = 180

// Footer
const FOOTER_Y = MARGIN_BOTTOM + 30

// ============================================================
// TYPOGRAPHY SIZES
// ============================================================
const FONT_SIZE_TITLE = 18
const FONT_SIZE_SUBTITLE = 11
const FONT_SIZE_SECTION_HEADER = 11
const FONT_SIZE_BODY = 10
const FONT_SIZE_SMALL = 9
const FONT_SIZE_FOOTER = 8

// ============================================================
// COLORS
// ============================================================
const COLOR_BLACK = rgb(0, 0, 0)
const COLOR_GRAY = rgb(0.4, 0.4, 0.4)
const COLOR_LIGHT_GRAY = rgb(0.85, 0.85, 0.85)
const COLOR_BRAND = rgb(0.1, 0.1, 0.1) // Near-black for premium look

// ============================================================
// LABELS (Thai primary, English fallback)
// ============================================================
const LABELS = {
  th: {
    header: 'ใบกำกับภาษี',
    headerEn: 'TAX INVOICE',
    original: 'ต้นฉบับ',
    seller: 'ผู้ขาย',
    sellerEn: 'SELLER',
    buyer: 'ผู้ซื้อ',
    buyerEn: 'BUYER',
    taxId: 'เลขประจำตัวผู้เสียภาษี',
    taxIdShort: 'Tax ID',
    itemHeader: 'รายการ',
    itemHeaderEn: 'Item',
    qty: 'จำนวน',
    qtyEn: 'Qty',
    unitPrice: 'ราคา/หน่วย',
    unitPriceEn: 'Unit Price',
    amount: 'รวม',
    amountEn: 'Amount',
    subtotal: 'ราคาสินค้า (ก่อน VAT)',
    vat: 'ภาษีมูลค่าเพิ่ม',
    total: 'ยอดรวมทั้งสิ้น',
    currency: 'บาท',
    footer: 'เอกสารนี้ออกโดยระบบคอมพิวเตอร์ ไม่ต้องลงลายมือชื่อ',
    reference: 'เลขที่อ้างอิง',
    page: 'หน้า',
    of: 'จาก',
    amountNote: 'หมายเหตุ: ยอดรวมอ้างอิงจากยอดสุทธิในคำสั่งซื้อ'
  },
  en: {
    header: 'TAX INVOICE',
    headerEn: '',
    original: 'Original',
    seller: 'SELLER',
    sellerEn: '',
    buyer: 'BUYER',
    buyerEn: '',
    taxId: 'Tax ID',
    taxIdShort: 'Tax ID',
    itemHeader: 'Item',
    itemHeaderEn: '',
    qty: 'Qty',
    qtyEn: '',
    unitPrice: 'Unit Price',
    unitPriceEn: '',
    amount: 'Amount',
    amountEn: '',
    subtotal: 'Subtotal (before VAT)',
    vat: 'VAT',
    total: 'TOTAL',
    currency: 'THB',
    footer: 'Computer-generated document. No signature required.',
    reference: 'Reference',
    page: 'Page',
    of: 'of',
    amountNote: 'Note: Total references the net amount from the order.'
  }
}

// ============================================================
// INTERFACES
// ============================================================
export interface InvoiceLineItem {
  name_th: string
  name_en: string
  qty: number
  final_price: number
}

export interface InvoiceOrderData {
  id: string
  order_number: string
  created_at: string
  subtotal_amount_dec: number
  vat_rate: number
  vat_amount_dec: number
  total_amount_dec: number
  invoice_company_name: string
  invoice_tax_id: string
  invoice_address: string
  invoice_buyer_phone?: string
  items?: InvoiceLineItem[]
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/** Format date to Thai Buddhist Era: DD/MM/YYYY */
function formatThaiDate(isoDate: string): string {
  const date = new Date(isoDate)
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear() + 543
  return `${day}/${month}/${year}`
}

/** Format amount with 2 decimals and comma separators */
function formatAmount(amount: number): string {
  return amount.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

/** Strip non-ASCII characters for WinAnsi-safe fallback */
function asciiSafe(s: string): string {
  const cleaned = s.replace(/[^\x20-\x7E]/g, '').trim()
  return cleaned || '-'
}

/**
 * Normalize text BEFORE any rendering:
 * 1. NFC normalization (compose diacritics)
 * 2. Replace all non-ASCII punctuation with ASCII equivalents
 * This prevents tofu (□) from non-ASCII punctuation variants
 */
function normalizeText(text: string): string {
  if (!text) return ''

  // Step 1: NFC normalization
  let s = text.normalize('NFC')

  // Step 2: Replace non-ASCII punctuation with ASCII equivalents
  // Curly/smart quotes → straight quotes
  s = s.replace(/[\u2018\u2019\u201A\u201B]/g, "'") // ' ' ‚ ‛ → '
  s = s.replace(/[\u201C\u201D\u201E\u201F]/g, '"') // " " „ ‟ → "

  // Dashes → hyphen-minus
  s = s.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015]/g, '-') // ‐ ‑ ‒ – — ― → -

  // Spaces → regular space
  s = s.replace(/[\u00A0\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F]/g, ' ')

  // Ellipsis → three dots
  s = s.replace(/\u2026/g, '...')

  // Slashes
  s = s.replace(/[\u2044\u2215]/g, '/') // ⁄ ∕ → /

  // Colons and semicolons (fullwidth)
  s = s.replace(/\uFF1A/g, ':') // ：→ :
  s = s.replace(/\uFF1B/g, ';') // ；→ ;

  // Parentheses (fullwidth)
  s = s.replace(/\uFF08/g, '(') // （→ (
  s = s.replace(/\uFF09/g, ')') // ）→ )

  // Periods and commas (fullwidth)
  s = s.replace(/\uFF0E/g, '.') // ．→ .
  s = s.replace(/\uFF0C/g, ',') // ，→ ,

  // Percent (fullwidth)
  s = s.replace(/\uFF05/g, '%') // ％→ %

  return s
}

/**
 * Check if a character is in Thai Unicode block (U+0E00-U+0E7F)
 */
function isThaiChar(char: string): boolean {
  const code = char.charCodeAt(0)
  return code >= 0x0E00 && code <= 0x0E7F
}

/**
 * Check if text contains ANY Thai character
 * Used to determine if we should use Thai font for the entire string
 */
function containsThai(text: string): boolean {
  if (!text) return false
  for (const char of text) {
    if (isThaiChar(char)) {
      return true
    }
  }
  return false
}

/**
 * Check if text contains NO Thai characters (pure Latin/digits/punctuation)
 */
function isLatinOnly(text: string): boolean {
  return !containsThai(text)
}

/**
 * Single-font-per-line strategy for consistent spacing
 *
 * FONT CHOICE: Anuphan (document-grade Thai font)
 * - Tighter kerning than NotoSansThai, suitable for invoices
 * - Full coverage: Thai + Latin + Digits + Punctuation
 * - ~110KB font files from Google Fonts (gstatic.com)
 *
 * STRATEGY:
 * - If text contains ANY Thai → use Anuphan for entire string
 * - Pure Latin/digits → use Helvetica (optional, sharper for numbers)
 * - Single font per line eliminates spacing inconsistencies
 */
function splitIntoRuns(text: string): Array<{ text: string; isThai: boolean }> {
  if (!text) return []

  // If text contains ANY Thai character → use Anuphan for entire string
  // Anuphan has full Latin/digit/punctuation coverage
  if (containsThai(text)) {
    return [{ text, isThai: true }]
  }

  // Pure Latin/digits/punctuation → use Helvetica
  return [{ text, isThai: false }]
}

/** Simple text wrapper for long strings */
function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxChars) {
      currentLine = (currentLine + ' ' + word).trim()
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = word
    }
  }
  if (currentLine) lines.push(currentLine)

  return lines
}

/** Try to load logo from assets/brand/ */
async function tryLoadLogo(pdfDoc: PDFDocument): Promise<{ image: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null; width: number; height: number }> {
  try {
    // Try PNG first
    if (fs.existsSync(LOGO_PATH_PNG)) {
      const logoBytes = fs.readFileSync(LOGO_PATH_PNG)
      const image = await pdfDoc.embedPng(logoBytes)
      const dims = image.scale(1)
      // Scale to fit max dimensions while preserving aspect ratio
      const scale = Math.min(HEADER_LOGO_MAX_WIDTH / dims.width, HEADER_LOGO_MAX_HEIGHT / dims.height, 1)
      return { image, width: dims.width * scale, height: dims.height * scale }
    }

    // Try JPG
    if (fs.existsSync(LOGO_PATH_JPG)) {
      const logoBytes = fs.readFileSync(LOGO_PATH_JPG)
      const image = await pdfDoc.embedJpg(logoBytes)
      const dims = image.scale(1)
      const scale = Math.min(HEADER_LOGO_MAX_WIDTH / dims.width, HEADER_LOGO_MAX_HEIGHT / dims.height, 1)
      return { image, width: dims.width * scale, height: dims.height * scale }
    }
  } catch (err) {
    console.warn('[INVOICE:PDF] Logo load failed (continuing without logo):', err)
  }

  return { image: null, width: 0, height: 0 }
}

// ============================================================
// DIAGNOSTIC HELPERS (dev-only)
// ============================================================

/** Check if we're in debug mode */
const DEBUG_MODE = process.env.NODE_ENV !== 'production'

/** Diagnostic logger - only logs in dev */
function diagLog(...args: unknown[]): void {
  if (DEBUG_MODE) {
    console.log('[INVOICE:DIAG]', ...args)
  }
}

/** Dump Unicode codepoints for a string */
function dumpCodepoints(label: string, text: string): string {
  const codepoints = Array.from(text).map(c => `U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`).join(' ')
  return `[${label}] "${text}" → ${codepoints}`
}

/** Dump run splitting results */
function dumpRuns(text: string, runs: Array<{ text: string; isThai: boolean }>): void {
  console.log(`[DIAG:RUNS] Input: "${text}"`)
  runs.forEach((run, i) => {
    const codepoints = Array.from(run.text).map(c => `U+${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`).join(' ')
    console.log(`  Run ${i}: type=${run.isThai ? 'THAI' : 'LATIN'} text="${run.text}" codes=[${codepoints}]`)
  })
}

/** Verify font files exist and log details */
function verifyFontFiles(): { regularExists: boolean; boldExists: boolean; regularSize: number; boldSize: number; regularPath: string; boldPath: string } {
  const regularPath = FONT_PATH_REGULAR
  const boldPath = FONT_PATH_BOLD

  let regularExists = false
  let boldExists = false
  let regularSize = 0
  let boldSize = 0

  try {
    regularExists = fs.existsSync(regularPath)
    if (regularExists) {
      regularSize = fs.statSync(regularPath).size
    }
  } catch (e) {
    diagLog('Error checking regular font:', e)
  }

  try {
    boldExists = fs.existsSync(boldPath)
    if (boldExists) {
      boldSize = fs.statSync(boldPath).size
    }
  } catch (e) {
    diagLog('Error checking bold font:', e)
  }

  diagLog('='.repeat(60))
  diagLog('FONT FILE VERIFICATION:')
  diagLog(`  Regular path: ${regularPath}`)
  diagLog(`  Regular exists: ${regularExists}, size: ${regularSize} bytes`)
  diagLog(`  Bold path: ${boldPath}`)
  diagLog(`  Bold exists: ${boldExists}, size: ${boldSize} bytes`)
  diagLog(`  CWD: ${process.cwd()}`)
  diagLog('='.repeat(60))

  return { regularExists, boldExists, regularSize, boldSize, regularPath, boldPath }
}

// ============================================================
// DIAGNOSTIC PDF RENDERER (for debug=1 mode)
// ============================================================

export interface DiagnosticOptions {
  showBoundaryMarks?: boolean
  logRuns?: boolean
}

export async function renderDiagnosticPdf(options: DiagnosticOptions = {}): Promise<{ pdf: Uint8Array; logs: string[] }> {
  const logs: string[] = []
  const log = (msg: string) => { logs.push(msg); console.log(msg) }

  // PHASE 0: Verify font files
  log('='.repeat(60))
  log('[DIAG] PHASE 0: Font File Verification')
  log('='.repeat(60))

  const fontInfo = verifyFontFiles()
  log(`Regular font: exists=${fontInfo.regularExists}, size=${fontInfo.regularSize} bytes`)
  log(`Bold font: exists=${fontInfo.boldExists}, size=${fontInfo.boldSize} bytes`)
  log(`Path: ${fontInfo.regularPath}`)

  if (fontInfo.regularSize < 50000 || fontInfo.boldSize < 50000) {
    log('⚠️  WARNING: Font files are suspiciously small!')
    log('   Expected Anuphan to be ~110KB for full glyph coverage')
  }

  const pdfDoc = await PDFDocument.create()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfDoc.registerFontkit(fontkit as any)
  log('fontkit registered')

  const latinRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const latinBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  log('Helvetica fonts embedded')

  let thaiRegular: PDFFont | null = null
  let thaiBold: PDFFont | null = null
  let thaiLoadError: string | null = null

  try {
    const fontRegularBytes = fs.readFileSync(FONT_PATH_REGULAR)
    const fontBoldBytes = fs.readFileSync(FONT_PATH_BOLD)
    log(`Font bytes read: regular=${fontRegularBytes.length}, bold=${fontBoldBytes.length}`)

    // Check font file header (TrueType signature: 0x00010000 or 'true')
    const regularHeader = fontRegularBytes.slice(0, 4)
    log(`Regular font header: ${Array.from(regularHeader).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}`)

    thaiRegular = await pdfDoc.embedFont(fontRegularBytes)
    log('Thai regular font embedded - SUCCESS')

    thaiBold = await pdfDoc.embedFont(fontBoldBytes)
    log('Thai bold font embedded - SUCCESS')

    // Try to measure a Thai character to verify font has Thai glyphs
    try {
      const testThaiChar = 'ก'  // Thai Ko Kai
      const testWidth = thaiRegular.widthOfTextAtSize(testThaiChar, 12)
      log(`Thai glyph test: 'ก' width at 12pt = ${testWidth}`)
      if (testWidth === 0) {
        log('⚠️  WARNING: Thai character has zero width - font may not have Thai glyphs!')
      }
    } catch (glyphErr) {
      log(`⚠️  Thai glyph test FAILED: ${glyphErr}`)
    }
  } catch (err) {
    thaiLoadError = String(err)
    log(`⚠️  Thai fonts FAILED to embed: ${thaiLoadError}`)
  }

  const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])

  // Test strings
  const testStrings = [
    { label: 'A', text: 'ผู้ขาย / SELLER', desc: 'Mixed Thai + slash + Latin' },
    { label: 'B', text: 'ผู้ซื้อ / BUYER', desc: 'Mixed Thai + slash + Latin' },
    { label: 'C', text: 'ยอดรวมทั้งสิ้น', desc: 'Pure Thai (no spaces)' },
    { label: 'D', text: 'ราคา/หน่วย', desc: 'Thai with slash' },
    { label: 'E', text: 'บริษัท เท็นไซ จำกัด', desc: 'Thai with SPACES' },
    { label: 'F', text: 'เอกสารนี้ออกโดยระบบคอมพิวเตอร์', desc: 'Long Thai sentence' },
    { label: 'G', text: 'ก ข ค ง จ ฉ ช ซ', desc: 'Thai consonants' },
    { label: 'H', text: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', desc: 'Latin uppercase' },
    { label: 'I', text: '0123456789', desc: 'Digits' },
    { label: 'J', text: '/ - : ( ) . , %', desc: 'Punctuation' },
  ]

  let y = A4_HEIGHT - 50
  const fontSize = 11
  const lineHeight = fontSize * 1.6

  // Title
  page.drawText('DIAGNOSTIC PAGE - Thai Font Rendering Test', {
    x: MARGIN_LEFT, y, font: latinBold, size: 16, color: COLOR_BLACK
  })
  y -= 25

  // Font status
  page.drawText(`Font Status: ${thaiLoadError ? 'FAILED - ' + thaiLoadError : 'Thai fonts loaded OK'}`, {
    x: MARGIN_LEFT, y, font: latinRegular, size: 9, color: thaiLoadError ? rgb(0.8, 0, 0) : rgb(0, 0.5, 0)
  })
  y -= 15

  page.drawText(`Font file sizes: Regular=${fontInfo.regularSize}B, Bold=${fontInfo.boldSize}B`, {
    x: MARGIN_LEFT, y, font: latinRegular, size: 9, color: COLOR_GRAY
  })
  y -= 30

  // Column headers
  page.drawText('Test', { x: MARGIN_LEFT, y, font: latinBold, size: 10, color: COLOR_BLACK })
  page.drawText('Thai Font (Anuphan)', { x: MARGIN_LEFT + 30, y, font: latinBold, size: 10, color: COLOR_BLACK })
  page.drawText('Helvetica (fallback)', { x: MARGIN_LEFT + 280, y, font: latinBold, size: 10, color: COLOR_BLACK })
  y -= 5

  // Separator line
  page.drawLine({
    start: { x: MARGIN_LEFT, y },
    end: { x: A4_WIDTH - MARGIN_RIGHT, y },
    thickness: 0.5,
    color: COLOR_GRAY
  })
  y -= 15

  log('\n' + '='.repeat(60))
  log('[DIAG] PHASE 1: Rendering Test')
  log('='.repeat(60))

  for (const { label, text, desc } of testStrings) {
    log(`\n[${label}] ${desc}: "${text}"`)

    // Label
    page.drawText(`${label})`, { x: MARGIN_LEFT, y, font: latinBold, size: fontSize, color: COLOR_BLACK })

    // Thai font column (if available)
    if (thaiRegular) {
      try {
        page.drawText(text, { x: MARGIN_LEFT + 30, y, font: thaiRegular, size: fontSize, color: COLOR_BLACK })
        log(`   Thai font: rendered OK`)
      } catch (e) {
        page.drawText('[ERROR]', { x: MARGIN_LEFT + 30, y, font: latinRegular, size: fontSize, color: rgb(0.8, 0, 0) })
        log(`   Thai font: ERROR - ${e}`)
      }
    } else {
      page.drawText('[NOT LOADED]', { x: MARGIN_LEFT + 30, y, font: latinRegular, size: fontSize, color: rgb(0.8, 0, 0) })
      log(`   Thai font: NOT LOADED`)
    }

    // Helvetica column (will show tofu for Thai)
    try {
      // For Helvetica, only show ASCII-safe version
      const safeText = asciiSafe(text)
      page.drawText(safeText, { x: MARGIN_LEFT + 280, y, font: latinRegular, size: fontSize, color: COLOR_GRAY })
      log(`   Helvetica: rendered (ASCII-safe: "${safeText}")`)
    } catch (e) {
      log(`   Helvetica: ERROR - ${e}`)
    }

    y -= lineHeight
  }

  // Summary section
  y -= 20
  page.drawLine({
    start: { x: MARGIN_LEFT, y: y + 10 },
    end: { x: A4_WIDTH - MARGIN_RIGHT, y: y + 10 },
    thickness: 0.5,
    color: COLOR_GRAY
  })

  page.drawText('DIAGNOSIS:', { x: MARGIN_LEFT, y, font: latinBold, size: 12, color: COLOR_BLACK })
  y -= 18

  const diagnosis = thaiLoadError
    ? [
        'PROBLEM: Thai font failed to load!',
        `Error: ${thaiLoadError}`,
        'ACTION: Check font file path and validity',
      ]
    : [
        'FONT SYSTEM: Anuphan (document-grade Thai font)',
        '- Tighter kerning than NotoSansThai',
        '- Full coverage: Thai + Latin + Digits + Punctuation',
        '- ~110KB font files from Google Fonts',
        '- Single font per line for consistent spacing',
        'STATUS: Ready for production invoices',
      ]

  for (const line of diagnosis) {
    page.drawText(line, { x: MARGIN_LEFT, y, font: latinRegular, size: 9, color: COLOR_BLACK })
    y -= 14
  }

  return { pdf: await pdfDoc.save(), logs }
}

// ============================================================
// MAIN RENDER FUNCTION
// ============================================================

export async function renderInvoicePdf(order: InvoiceOrderData): Promise<Uint8Array> {
  // DIAGNOSTIC: Verify font files first
  const fontInfo = verifyFontFiles()

  const pdfDoc = await PDFDocument.create()

  // Register fontkit for TTF embedding
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pdfDoc.registerFontkit(fontkit as any)
  diagLog('fontkit registered successfully')

  // Always embed Latin fonts (guaranteed to work)
  const latinRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const latinBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  diagLog('Helvetica fonts embedded successfully')

  // Try to embed Thai fonts
  let thaiRegular: PDFFont | null = null
  let thaiBold: PDFFont | null = null
  let useThai = true

  try {
    if (!fontInfo.regularExists || !fontInfo.boldExists) {
      throw new Error(`Font files missing: regular=${fontInfo.regularExists}, bold=${fontInfo.boldExists}`)
    }

    const fontRegularBytes = fs.readFileSync(FONT_PATH_REGULAR)
    const fontBoldBytes = fs.readFileSync(FONT_PATH_BOLD)
    diagLog(`Font bytes read: regular=${fontRegularBytes.length}, bold=${fontBoldBytes.length}`)

    thaiRegular = await pdfDoc.embedFont(fontRegularBytes)
    diagLog('Thai regular font embedded successfully')

    thaiBold = await pdfDoc.embedFont(fontBoldBytes)
    diagLog('Thai bold font embedded successfully')

    console.log('[INVOICE:PDF] Anuphan fonts loaded successfully')
  } catch (fontError) {
    console.error('[INVOICE:PDF] Anuphan font loading FAILED:', fontError)
    console.warn('[INVOICE:PDF] Falling back to English-only mode')
    useThai = false
  }

  diagLog(`useThai = ${useThai}`)

  // Select labels based on font availability
  const L = useThai ? LABELS.th : LABELS.en

  // Try to load logo
  const logo = await tryLoadLogo(pdfDoc)

  // Font selection helpers
  const getFont = (isThai: boolean, bold: boolean): PDFFont => {
    if (isThai && useThai) {
      return bold ? (thaiBold || latinBold) : (thaiRegular || latinRegular)
    }
    return bold ? latinBold : latinRegular
  }

  // ============================================================
  // TEXT DRAWING HELPERS (with proper Thai spacing)
  // ============================================================

  /** Draw text with smart font routing - normalizes then routes by runs */
  const drawTextSmart = (
    page: PDFPage,
    text: string,
    x: number,
    y: number,
    options: { bold?: boolean; size?: number; color?: typeof COLOR_BLACK } = {}
  ): number => {
    const { bold = false, size = FONT_SIZE_BODY, color = COLOR_BLACK } = options

    // Normalize text FIRST (NFC + ASCII punctuation)
    const normalized = normalizeText(text)

    // Fallback mode: ASCII-safe only
    if (!useThai) {
      const safeText = asciiSafe(normalized)
      const font = getFont(false, bold)
      page.drawText(safeText, { x, y, font, size, color })
      return font.widthOfTextAtSize(safeText, size)
    }

    // Thai mode: split into runs and draw each run as single call
    const runs = splitIntoRuns(normalized)
    let currentX = x

    for (const run of runs) {
      const font = getFont(run.isThai, bold)
      page.drawText(run.text, { x: currentX, y, font, size, color })
      currentX += font.widthOfTextAtSize(run.text, size)
    }

    return currentX - x
  }

  /** Calculate text width with smart font routing */
  const getTextWidthSmart = (
    text: string,
    options: { bold?: boolean; size?: number } = {}
  ): number => {
    const { bold = false, size = FONT_SIZE_BODY } = options

    // Normalize text FIRST
    const normalized = normalizeText(text)

    if (!useThai) {
      const safeText = asciiSafe(normalized)
      return getFont(false, bold).widthOfTextAtSize(safeText, size)
    }

    const runs = splitIntoRuns(normalized)
    let totalWidth = 0
    for (const run of runs) {
      totalWidth += getFont(run.isThai, bold).widthOfTextAtSize(run.text, size)
    }
    return totalWidth
  }

  /** Draw right-aligned text */
  const drawTextRight = (
    page: PDFPage,
    text: string,
    y: number,
    options: { bold?: boolean; size?: number; color?: typeof COLOR_BLACK; rightX?: number } = {}
  ) => {
    const { rightX = A4_WIDTH - MARGIN_RIGHT, ...textOptions } = options
    const width = getTextWidthSmart(text, textOptions)
    drawTextSmart(page, text, rightX - width, y, textOptions)
  }

  // ============================================================
  // PAGE TEMPLATE RENDERER
  // ============================================================

  const renderPageTemplate = (page: PDFPage, pageNum: number, totalPages: number) => {
    // Header divider line
    page.drawLine({
      start: { x: MARGIN_LEFT, y: HEADER_DIVIDER_Y },
      end: { x: A4_WIDTH - MARGIN_RIGHT, y: HEADER_DIVIDER_Y },
      thickness: 1.5,
      color: COLOR_BRAND
    })

    // Logo (if available)
    if (logo.image) {
      page.drawImage(logo.image, {
        x: MARGIN_LEFT,
        y: HEADER_Y - logo.height + 5,
        width: logo.width,
        height: logo.height
      })
    }

    // Header title (right side if logo exists, left otherwise)
    const headerX = logo.image ? MARGIN_LEFT + logo.width + 20 : MARGIN_LEFT

    // Main title
    drawTextSmart(page, L.header, headerX, HEADER_Y - 15, { bold: true, size: FONT_SIZE_TITLE })
    if (L.headerEn) {
      drawTextSmart(page, L.headerEn, headerX, HEADER_Y - 32, { size: FONT_SIZE_SUBTITLE, color: COLOR_GRAY })
    }

    // Original badge (right aligned)
    drawTextRight(page, L.original, HEADER_Y - 15, { size: FONT_SIZE_SMALL, color: COLOR_GRAY })

    // Page number in footer (if multi-page)
    if (totalPages > 1) {
      const pageText = `${L.page} ${pageNum} ${L.of} ${totalPages}`
      drawTextRight(page, pageText, FOOTER_Y - 15, { size: FONT_SIZE_FOOTER, color: COLOR_GRAY })
    }
  }

  // ============================================================
  // TABLE HEADER RENDERER
  // ============================================================

  const renderTableHeader = (page: PDFPage, y: number): number => {
    // Table header background
    page.drawRectangle({
      x: MARGIN_LEFT,
      y: y - TABLE_HEADER_HEIGHT + 5,
      width: CONTENT_WIDTH,
      height: TABLE_HEADER_HEIGHT,
      color: COLOR_LIGHT_GRAY
    })

    // Column headers
    const headerY = y - 12
    drawTextSmart(page, `${L.itemHeader}${L.itemHeaderEn ? ' / ' + L.itemHeaderEn : ''}`, TABLE_COL_ITEM_X + 5, headerY, { bold: true, size: FONT_SIZE_SMALL })
    drawTextSmart(page, L.qty, TABLE_COL_QTY_X, headerY, { bold: true, size: FONT_SIZE_SMALL })
    drawTextSmart(page, L.unitPrice, TABLE_COL_UNIT_X, headerY, { bold: true, size: FONT_SIZE_SMALL })
    drawTextSmart(page, L.amount, TABLE_COL_AMOUNT_X, headerY, { bold: true, size: FONT_SIZE_SMALL })

    return y - TABLE_HEADER_HEIGHT - 5
  }

  // ============================================================
  // CALCULATE PAGINATION
  // ============================================================

  const items = order.items || []
  const itemsPerFirstPage = Math.floor((SELLER_BLOCK_Y - BUYER_BLOCK_Y_OFFSET - 80 - TOTALS_Y_FROM_BOTTOM) / TABLE_ROW_HEIGHT)
  const itemsPerContinuationPage = Math.floor((A4_HEIGHT - MARGIN_TOP - 80 - TOTALS_Y_FROM_BOTTOM) / TABLE_ROW_HEIGHT)

  let totalPages = 1
  if (items.length > itemsPerFirstPage) {
    const remainingItems = items.length - itemsPerFirstPage
    totalPages = 1 + Math.ceil(remainingItems / itemsPerContinuationPage)
  }

  // ============================================================
  // RENDER PAGES
  // ============================================================

  let currentPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])
  let currentPageNum = 1
  let itemIndex = 0
  let y = HEADER_Y

  // Render first page template
  renderPageTemplate(currentPage, currentPageNum, totalPages)

  // Invoice info line
  y = INVOICE_INFO_Y
  drawTextSmart(currentPage, `Invoice No: INV-${order.order_number}`, MARGIN_LEFT, y, { bold: true, size: FONT_SIZE_SUBTITLE })
  drawTextRight(currentPage, `Date: ${formatThaiDate(order.created_at)}`, y, { size: FONT_SIZE_BODY })

  // ============================================================
  // SELLER INFO BLOCK
  // ============================================================

  y = SELLER_BLOCK_Y
  drawTextSmart(currentPage, `${L.seller}${L.sellerEn ? ' / ' + L.sellerEn : ''}`, MARGIN_LEFT, y, { bold: true, size: FONT_SIZE_SECTION_HEADER })
  y -= 15

  const sellerName = useThai ? SELLER_INFO.company_name : (SELLER_INFO.company_name_en || SELLER_INFO.company_name)
  drawTextSmart(currentPage, sellerName, MARGIN_LEFT, y, { size: FONT_SIZE_BODY })
  y -= 13

  drawTextSmart(currentPage, `${L.taxIdShort}: ${SELLER_INFO.tax_id}`, MARGIN_LEFT, y, { size: FONT_SIZE_SMALL, color: COLOR_GRAY })
  y -= 13

  const sellerAddress = useThai ? SELLER_INFO.address : (SELLER_INFO.address_en || SELLER_INFO.address)
  const sellerAddressLines = wrapText(sellerAddress, 70)
  for (const line of sellerAddressLines) {
    drawTextSmart(currentPage, line, MARGIN_LEFT, y, { size: FONT_SIZE_SMALL })
    y -= 12
  }

  if (SELLER_INFO.phone) {
    drawTextSmart(currentPage, `Tel: ${SELLER_INFO.phone}`, MARGIN_LEFT, y, { size: FONT_SIZE_SMALL, color: COLOR_GRAY })
    y -= 12
  }

  // ============================================================
  // BUYER INFO BLOCK
  // ============================================================

  y -= 15
  drawTextSmart(currentPage, `${L.buyer}${L.buyerEn ? ' / ' + L.buyerEn : ''}`, MARGIN_LEFT, y, { bold: true, size: FONT_SIZE_SECTION_HEADER })
  y -= 15

  drawTextSmart(currentPage, order.invoice_company_name, MARGIN_LEFT, y, { size: FONT_SIZE_BODY })
  y -= 13

  drawTextSmart(currentPage, `${L.taxIdShort}: ${order.invoice_tax_id}`, MARGIN_LEFT, y, { size: FONT_SIZE_SMALL, color: COLOR_GRAY })
  y -= 13

  const buyerAddressLines = wrapText(order.invoice_address, 70)
  for (const line of buyerAddressLines) {
    drawTextSmart(currentPage, line, MARGIN_LEFT, y, { size: FONT_SIZE_SMALL })
    y -= 12
  }

  // Buyer phone (optional)
  if (order.invoice_buyer_phone) {
    drawTextSmart(currentPage, `Tel: ${order.invoice_buyer_phone}`, MARGIN_LEFT, y, { size: FONT_SIZE_SMALL, color: COLOR_GRAY })
    y -= 12
  }

  // ============================================================
  // ITEMS TABLE
  // ============================================================

  y -= 20

  // Table top line
  currentPage.drawLine({
    start: { x: MARGIN_LEFT, y: y + 5 },
    end: { x: A4_WIDTH - MARGIN_RIGHT, y: y + 5 },
    thickness: 0.5,
    color: COLOR_GRAY
  })

  y = renderTableHeader(currentPage, y)

  // ============================================================
  // COMPUTE LINE AMOUNTS - Show only if sum matches stored subtotal
  // ============================================================
  const lineAmounts: number[] = items.map(item => item.qty * item.final_price)
  const computedSum = lineAmounts.reduce((sum, amt) => sum + amt, 0)
  // Tolerance: 0.01 for decimal storage
  const tolerance = 0.01
  const showLineAmounts = Math.abs(computedSum - order.subtotal_amount_dec) <= tolerance

  // Render items
  while (itemIndex < items.length) {
    const item = items[itemIndex]

    // Check if we need a new page
    if (y < TOTALS_Y_FROM_BOTTOM + 20) {
      // Add new page
      currentPageNum++
      currentPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])
      renderPageTemplate(currentPage, currentPageNum, totalPages)

      y = A4_HEIGHT - MARGIN_TOP - 60
      y = renderTableHeader(currentPage, y)
    }

    // Item name
    const itemName = useThai
      ? (item.name_th || item.name_en || '-')
      : (item.name_en || '-')
    const displayName = itemName.length > 45 ? itemName.substring(0, 42) + '...' : itemName
    drawTextSmart(currentPage, displayName, TABLE_COL_ITEM_X + 5, y, { size: FONT_SIZE_SMALL })

    // Quantity (right-aligned in column)
    const qtyText = String(item.qty)
    const qtyWidth = latinRegular.widthOfTextAtSize(qtyText, FONT_SIZE_SMALL)
    currentPage.drawText(qtyText, {
      x: TABLE_COL_QTY_X + 30 - qtyWidth,
      y,
      font: latinRegular,
      size: FONT_SIZE_SMALL,
      color: COLOR_BLACK
    })

    // Unit price (right-aligned)
    const priceText = formatAmount(item.final_price)
    const priceWidth = latinRegular.widthOfTextAtSize(priceText, FONT_SIZE_SMALL)
    currentPage.drawText(priceText, {
      x: TABLE_COL_UNIT_X + 50 - priceWidth,
      y,
      font: latinRegular,
      size: FONT_SIZE_SMALL,
      color: COLOR_BLACK
    })

    // Amount: show computed line amount if safe, otherwise "-"
    if (showLineAmounts) {
      const lineAmount = lineAmounts[itemIndex]
      const amountText = formatAmount(lineAmount)
      const amountWidth = latinRegular.widthOfTextAtSize(amountText, FONT_SIZE_SMALL)
      currentPage.drawText(amountText, {
        x: TABLE_COL_AMOUNT_X + 40 - amountWidth,
        y,
        font: latinRegular,
        size: FONT_SIZE_SMALL,
        color: COLOR_BLACK
      })
    } else {
      currentPage.drawText('-', {
        x: TABLE_COL_AMOUNT_X + 20,
        y,
        font: latinRegular,
        size: FONT_SIZE_SMALL,
        color: COLOR_GRAY
      })
    }

    // Row separator line
    y -= 3
    currentPage.drawLine({
      start: { x: MARGIN_LEFT, y },
      end: { x: A4_WIDTH - MARGIN_RIGHT, y },
      thickness: 0.25,
      color: COLOR_LIGHT_GRAY
    })

    y -= TABLE_ROW_HEIGHT - 3
    itemIndex++
  }

  // Show note if line amounts not displayed (mismatch detected)
  if (!showLineAmounts && items.length > 0) {
    y -= 5
    drawTextSmart(currentPage, L.amountNote, MARGIN_LEFT, y, { size: FONT_SIZE_FOOTER, color: COLOR_GRAY })
    y -= 10
  }

  // ============================================================
  // TOTALS SECTION
  // ============================================================

  // Ensure totals fit on current page
  if (y < TOTALS_Y_FROM_BOTTOM - 50) {
    currentPageNum++
    currentPage = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT])
    renderPageTemplate(currentPage, currentPageNum, totalPages)
    y = A4_HEIGHT - MARGIN_TOP - 100
  }

  y -= 25

  // Totals box area
  const totalsBoxX = A4_WIDTH - MARGIN_RIGHT - 200
  const totalsLabelX = totalsBoxX + 5
  const totalsValueX = A4_WIDTH - MARGIN_RIGHT - 10

  // Subtotal
  drawTextSmart(currentPage, L.subtotal, totalsLabelX, y, { size: FONT_SIZE_BODY })
  const subtotalText = `${formatAmount(order.subtotal_amount_dec)} ${L.currency}`
  drawTextRight(currentPage, subtotalText, y, { size: FONT_SIZE_BODY, rightX: totalsValueX })
  y -= 18

  // VAT
  drawTextSmart(currentPage, `${L.vat} ${order.vat_rate}%`, totalsLabelX, y, { size: FONT_SIZE_BODY })
  const vatText = `${formatAmount(order.vat_amount_dec)} ${L.currency}`
  drawTextRight(currentPage, vatText, y, { size: FONT_SIZE_BODY, rightX: totalsValueX })
  y -= 18

  // Divider before total
  currentPage.drawLine({
    start: { x: totalsBoxX, y: y + 8 },
    end: { x: A4_WIDTH - MARGIN_RIGHT, y: y + 8 },
    thickness: 1,
    color: COLOR_BRAND
  })

  // Total
  drawTextSmart(currentPage, L.total, totalsLabelX, y, { bold: true, size: 12 })
  const totalText = `${formatAmount(order.total_amount_dec)} ${L.currency}`
  drawTextRight(currentPage, totalText, y, { bold: true, size: 12, rightX: totalsValueX })

  // ============================================================
  // FOOTER
  // ============================================================

  // Footer line
  currentPage.drawLine({
    start: { x: MARGIN_LEFT, y: FOOTER_Y + 15 },
    end: { x: A4_WIDTH - MARGIN_RIGHT, y: FOOTER_Y + 15 },
    thickness: 0.5,
    color: COLOR_GRAY
  })

  // Footer text
  drawTextSmart(currentPage, L.footer, MARGIN_LEFT, FOOTER_Y, { size: FONT_SIZE_FOOTER, color: COLOR_GRAY })
  drawTextSmart(currentPage, `${L.reference}: ${order.order_number}`, MARGIN_LEFT, FOOTER_Y - 12, { size: FONT_SIZE_FOOTER, color: COLOR_GRAY })

  // Serialize to bytes
  return await pdfDoc.save()
}
