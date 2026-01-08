/**
 * Checkout Draft Persistence
 * Saves cart + checkout state before payment navigation
 * Allows restoration on Back from payment page
 */
import { CartItem } from '@/contexts/CartContext'

const DRAFT_KEY = 'tenzai_checkout_draft'
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface CheckoutDraftData {
  cartItems: CartItem[]
  customerName: string
  customerPhone: string
  pickupType: 'ASAP' | 'SCHEDULED'
  pickupDate: string // YYYY-MM-DD format
  pickupTime: string
  customerNote: string
  invoiceRequested: boolean
  invoiceCompanyName: string
  invoiceTaxId: string
  invoiceAddress: string
  activeOrderId: string | null
  savedAt: number // timestamp
}

/**
 * Save checkout draft to localStorage
 * Call this BEFORE navigating to payment page
 */
export function saveCheckoutDraft(data: Omit<CheckoutDraftData, 'savedAt'>): void {
  try {
    const draft: CheckoutDraftData = {
      ...data,
      savedAt: Date.now()
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch (e) {
    console.error('[DRAFT] Failed to save checkout draft:', e)
  }
}

/**
 * Load checkout draft from localStorage
 * Returns null if no draft, expired, or invalid
 */
export function loadCheckoutDraft(): CheckoutDraftData | null {
  try {
    const saved = localStorage.getItem(DRAFT_KEY)
    if (!saved) return null

    const draft: CheckoutDraftData = JSON.parse(saved)

    // Check expiration
    if (Date.now() - draft.savedAt > DRAFT_TTL_MS) {
      clearCheckoutDraft()
      return null
    }

    // Validate required fields
    if (!Array.isArray(draft.cartItems)) {
      clearCheckoutDraft()
      return null
    }

    return draft
  } catch (e) {
    console.error('[DRAFT] Failed to load checkout draft:', e)
    clearCheckoutDraft()
    return null
  }
}

/**
 * Clear checkout draft from localStorage
 * Call this when order is confirmed or abandoned
 */
export function clearCheckoutDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch (e) {
    console.error('[DRAFT] Failed to clear checkout draft:', e)
  }
}

/**
 * Check if a valid draft exists (without loading full data)
 */
export function hasCheckoutDraft(): boolean {
  try {
    const saved = localStorage.getItem(DRAFT_KEY)
    if (!saved) return false

    const draft = JSON.parse(saved)
    if (Date.now() - draft.savedAt > DRAFT_TTL_MS) {
      clearCheckoutDraft()
      return false
    }
    return Array.isArray(draft.cartItems) && draft.cartItems.length > 0
  } catch {
    return false
  }
}
