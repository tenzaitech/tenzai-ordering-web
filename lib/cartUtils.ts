import { CartItem, CartItemOption } from '@/contexts/CartContext'

/**
 * Generate a stable signature for cart item options
 * Used to compare if two items with same menuId have identical options
 */
export function getOptionsSignature(options?: CartItemOption[]): string {
  if (!options || options.length === 0) return ''

  // Sort by group_id, then normalize choice_ids within each group
  const normalized = [...options]
    .sort((a, b) => a.group_id.localeCompare(b.group_id))
    .map(opt => ({
      g: opt.group_id,
      c: [...opt.choice_ids].sort().join(',')
    }))

  return JSON.stringify(normalized)
}

/**
 * Find all cart items with the same menuId
 */
export function findItemsByMenuId(items: CartItem[], menuId: string): CartItem[] {
  return items.filter(item => item.menuId === menuId)
}

/**
 * Find a cart item by menuId and exact options signature
 */
export function findItemByMenuIdAndSignature(
  items: CartItem[],
  menuId: string,
  signature: string
): CartItem | undefined {
  return items.find(item =>
    item.menuId === menuId && getOptionsSignature(item.options) === signature
  )
}

/**
 * Check if a menu item exists in cart (any variant)
 */
export function isMenuInCart(items: CartItem[], menuId: string): boolean {
  return items.some(item => item.menuId === menuId)
}

/**
 * Get total quantity for a menu item across all variants
 */
export function getTotalQtyForMenu(items: CartItem[], menuId: string): number {
  return items
    .filter(item => item.menuId === menuId)
    .reduce((sum, item) => sum + item.quantity, 0)
}
