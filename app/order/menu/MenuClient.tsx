'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import UnifiedOrderHeader, { UNIFIED_HEADER_HEIGHT } from '@/components/order/UnifiedOrderHeader'
import MenuItemRow from '@/components/MenuItemRow'
import MenuCardLarge from '@/components/MenuCardLarge'
import BottomCTABar from '@/components/BottomCTABar'
import MenuItemDrawer from '@/components/MenuItemDrawer'
import { triggerHaptic } from '@/utils/haptic'
import { useLanguage } from '@/contexts/LanguageContext'
import { useCart } from '@/contexts/CartContext'
import { findItemsByMenuId } from '@/lib/cartUtils'

type Category = string

type MenuItem = {
  id: string
  name_th: string
  name_en: string
  category: string
  category_th: string
  category_en: string
  price_thb: number
  image: string
  is_sold_out: boolean
  subtitle?: string
  options?: any[]
  image_focus_y_1x1?: number
}

interface MenuClientProps {
  initialMenuItems: MenuItem[]
  initialCategories: Category[]
}

export default function MenuClient({ initialMenuItems, initialCategories }: MenuClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { language, t } = useLanguage()
  const { items: cartItems, getTotalPrice, getTotalItems } = useCart()
  const [activeCategory, setActiveCategory] = useState<Category>(initialCategories[0] || 'Menu')
  const [searchQuery, setSearchQuery] = useState('')
  const [isRestoringScroll, setIsRestoringScroll] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [drawerItem, setDrawerItem] = useState<MenuItem | null>(null)
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({})
  const observerRef = useRef<IntersectionObserver | null>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Add-to-order mode: when adding items directly to an existing DB order
  const editOrderId = searchParams.get('editOrderId')
  const mode = searchParams.get('mode')
  const isAddToOrderMode = editOrderId && mode === 'add'

  const menuItems = initialMenuItems
  const categories = initialCategories

  // Group items by category
  const itemsByCategory = categories.reduce((acc, category) => {
    acc[category] = menuItems.filter(item => item.category === category)
    return acc
  }, {} as Record<Category, MenuItem[]>)

  // Get recommended items (6 non-sold-out items from all categories)
  const recommendedItems = menuItems
    .filter(item => !item.is_sold_out)
    .slice(0, 6)

  // Filter items based on search query
  const filteredItems = searchQuery.trim()
    ? menuItems.filter(item => {
        const query = searchQuery.toLowerCase()
        return (
          item.name_th.toLowerCase().includes(query) ||
          item.name_en.toLowerCase().includes(query)
        )
      })
    : []

  // Mount animation trigger
  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-scroll active tab into view when activeCategory changes
  useEffect(() => {
    tabButtonRefs.current[activeCategory]?.scrollIntoView({
      behavior: 'smooth',
      inline: 'start',
      block: 'nearest',
    })
  }, [activeCategory])

  // Restore scroll position after returning from detail page
  useEffect(() => {
    const savedPosition = sessionStorage.getItem('menuScrollPosition')
    if (savedPosition) {
      setIsRestoringScroll(true)

      requestAnimationFrame(() => {
        window.scrollTo({
          top: parseInt(savedPosition, 10),
          behavior: 'auto'
        })
        sessionStorage.removeItem('menuScrollPosition')

        setTimeout(() => setIsRestoringScroll(false), 300)
      })
    }
  }, [])

  // Set up IntersectionObserver for scroll-based category detection
  useEffect(() => {
    if (isRestoringScroll) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const category = entry.target.getAttribute('data-category') as Category
            if (category) {
              setActiveCategory(category)
            }
          }
        })
      },
      {
        rootMargin: '-150px 0px -60% 0px',
        threshold: 0,
      }
    )

    Object.values(categoryRefs.current).forEach((ref) => {
      if (ref) {
        observerRef.current?.observe(ref)
      }
    })

    return () => {
      observerRef.current?.disconnect()
    }
  }, [categories, isRestoringScroll])

  const handleCategoryClick = (category: Category) => {
    setActiveCategory(category)
    const element = categoryRefs.current[category]
    if (element) {
      // Total offset: unified header (56px) + category bar (56px)
      const totalStickyHeight = UNIFIED_HEADER_HEIGHT + 56
      const elementPosition = element.getBoundingClientRect().top + window.scrollY
      const offsetPosition = elementPosition - totalStickyHeight

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      })
    }
  }

  const handlePickerSelect = (category: Category) => {
    setIsPickerOpen(false)
    handleCategoryClick(category)
  }

  const handleOpenSearch = () => {
    triggerHaptic()
    setIsSearchOpen(true)
  }

  const handleCloseSearch = () => {
    setIsSearchOpen(false)
    // Preserve searchQuery so reopening continues where user left off
  }

  const handleMenuItemTap = (item: MenuItem) => {
    triggerHaptic()

    // In add-to-order mode, navigate directly to item detail with order params
    if (isAddToOrderMode) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('menuScrollPosition', window.scrollY.toString())
        sessionStorage.setItem('navigationDirection', 'forward')
      }
      setTimeout(() => {
        router.push(`/order/menu/${item.id}?addToOrder=${editOrderId}`)
      }, 100)
      return
    }

    // Normal mode: Check if this item is already in cart
    const itemsInCart = findItemsByMenuId(cartItems, item.id)

    if (itemsInCart.length > 0) {
      // Show drawer for items already in cart
      setDrawerItem(item)
    } else {
      // Navigate to item detail for new items
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('menuScrollPosition', window.scrollY.toString())
        sessionStorage.setItem('navigationDirection', 'forward')
      }
      setTimeout(() => {
        router.push(`/order/menu/${item.id}`)
      }, 100)
    }
  }

  const handleRecommendedTap = (itemId: string) => {
    const item = menuItems.find(m => m.id === itemId)
    if (item) {
      handleMenuItemTap(item)
    }
  }

  const totalItems = getTotalItems()
  const totalPrice = getTotalPrice()

  // Category bar height for scroll calculations
  const CATEGORY_BAR_HEIGHT = 56

  return (
    <div className="min-h-screen bg-bg-root pb-28">
      {/* Unified Header - fixed at top, consistent with other /order/* pages */}
      <UnifiedOrderHeader
        title={language === 'th' ? 'เมนู' : 'Menu'}
        showBack={false}
        showMenu={false}
      />

      <div className="max-w-mobile mx-auto pt-14">
        {/* Sticky Category/Search Bar - sits directly under unified header */}
        <div className="sticky top-14 bg-bg-root z-40 border-b border-border-subtle shadow-sm shadow-black/20">
          <div className="flex items-center gap-2">
            {/* Search Button - Opens search overlay */}
            <button
              onClick={handleOpenSearch}
              className="flex-shrink-0 w-11 h-11 flex items-center justify-center text-text-secondary hover:text-accent active:text-accent/80 ml-2 transition-colors"
              aria-label={language === 'th' ? 'ค้นหา' : 'Search'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Category Picker Button */}
            <button
              onClick={() => setIsPickerOpen(true)}
              className="flex-shrink-0 w-9 h-9 flex items-center justify-center text-text-secondary hover:text-text-primary active:bg-bg-elevated rounded-lg transition-colors"
              aria-label={language === 'th' ? 'หมวดหมู่' : 'Categories'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Scrollable Tabs */}
            <div ref={tabsRef} className="flex-1 flex flex-nowrap overflow-x-auto scrollbar-hide py-2.5 pr-5 gap-2" style={{ WebkitOverflowScrolling: 'touch' }}>
              {categories.map(category => {
                const sampleItem = menuItems.find(item => item.category === category)
                const categoryName = language === 'th' ? sampleItem?.category_th : sampleItem?.category_en
                return (
                  <button
                    key={category}
                    ref={(el) => {
                      tabButtonRefs.current[category] = el
                    }}
                    data-category={category}
                    onClick={() => handleCategoryClick(category)}
                    className={`flex-none px-4 py-2 min-h-[40px] rounded-full whitespace-nowrap font-medium text-sm scale-text ${
                      activeCategory === category
                        ? 'bg-accent text-white'
                        : 'bg-bg-surface text-text-secondary border border-border-subtle'
                    }`}
                  >
                    {categoryName || category}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Recommended Section */}
        <div className="px-5 pt-4 pb-6">
          <h2 className="text-text-primary text-lg font-bold mb-3">Popular</h2>
          <div className="grid grid-cols-2 gap-4">
            {recommendedItems.map((item, index) => (
              <div
                key={item.id}
                className={`transition-all duration-[170ms] cursor-pointer active:scale-[0.98] active:bg-border rounded-lg ${
                  mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1.5'
                }`}
                style={{
                  transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
                  transitionDelay: mounted ? `${index * 50}ms` : '0ms'
                }}
                onClick={() => handleRecommendedTap(item.id)}
              >
                <MenuCardLarge
                  name_th={item.name_th}
                  name_en={item.name_en}
                  price_thb={item.price_thb}
                  image={item.image}
                  is_sold_out={item.is_sold_out}
                  focusY={item.image_focus_y_1x1}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Category Sections - Vertical List */}
        {categories.map((category, index) => {
          const items = itemsByCategory[category]
          if (items.length === 0) return null
          const sampleItem = items[0]
          const categoryName = language === 'th' ? sampleItem?.category_th : sampleItem?.category_en

          return (
            <div
              key={category}
              ref={(el) => {
                categoryRefs.current[category] = el
              }}
              data-category={category}
            >
              {/* Category Label - LINE MAN style: divider bar + inline label */}
              {index > 0 && <div className="h-2 bg-bg-elevated" />}
              <p className="px-5 py-2 text-text-primary font-bold text-base scale-text">{categoryName || category}</p>
              {items.map(item => (
                <MenuItemRow
                  key={item.id}
                  id={item.id}
                  name_th={item.name_th}
                  name_en={item.name_en}
                  price_thb={item.price_thb}
                  image={item.image}
                  is_sold_out={item.is_sold_out}
                  subtitle={item.subtitle}
                  onTap={() => handleMenuItemTap(item)}
                  focusY={item.image_focus_y_1x1}
                />
              ))}
            </div>
          )
        })}

        {/* Search Overlay */}
        {isSearchOpen && (
          <div className="fixed inset-0 z-50 bg-bg-root">
            {/* Search Header */}
            <div className="sticky top-0 bg-bg-surface border-b border-border-subtle px-4 py-3">
              <div className="flex items-center gap-3">
                {/* Search Input */}
                <div className="flex-1 relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('searchPlaceholder')}
                    autoFocus
                    className="w-full bg-bg-elevated border border-border-subtle rounded-lg pl-9 pr-9 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent/50"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {/* Close Button */}
                <button
                  onClick={handleCloseSearch}
                  className="flex-shrink-0 px-3 py-2 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
                >
                  {language === 'th' ? 'ยกเลิก' : 'Cancel'}
                </button>
              </div>
            </div>

            {/* Search Results */}
            <div className="overflow-y-auto" style={{ height: 'calc(100vh - 65px)' }}>
              {searchQuery.trim() ? (
                <div className="px-4 py-4">
                  <p className="text-text-muted text-xs mb-3">
                    {filteredItems.length > 0
                      ? `${filteredItems.length} ${filteredItems.length === 1 ? t('item') : t('items')}`
                      : t('noItemsFound')
                    }
                  </p>
                  {filteredItems.length > 0 && (
                    <div className="bg-bg-surface rounded-lg overflow-hidden">
                      {filteredItems.map(item => (
                        <MenuItemRow
                          key={item.id}
                          id={item.id}
                          name_th={item.name_th}
                          name_en={item.name_en}
                          price_thb={item.price_thb}
                          image={item.image}
                          is_sold_out={item.is_sold_out}
                          subtitle={item.subtitle}
                          onTap={() => {
                            handleCloseSearch()
                            handleMenuItemTap(item)
                          }}
                          focusY={item.image_focus_y_1x1}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="px-4 py-12 text-center">
                  <div className="text-text-muted mb-2">
                    <svg className="w-12 h-12 mx-auto opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <p className="text-text-muted text-sm">
                    {language === 'th' ? 'พิมพ์ชื่อเมนูที่ต้องการค้นหา' : 'Type to search menu items'}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Category Picker Modal */}
        {isPickerOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end"
            onClick={() => setIsPickerOpen(false)}
          >
            {/* Overlay */}
            <div className="absolute inset-0 bg-black/60" />

            {/* Bottom Sheet */}
            <div
              className="relative w-full bg-card rounded-t-2xl max-h-[70vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between">
                <h3 className="text-text text-lg font-semibold">{t('categories')}</h3>
                <button
                  onClick={() => setIsPickerOpen(false)}
                  className="text-muted hover:text-text transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Category List */}
              <div className="py-2">
                {categories.map(category => {
                  const itemCount = itemsByCategory[category]?.length || 0
                  const sampleItem = menuItems.find(item => item.category === category)
                  const categoryName = language === 'th' ? sampleItem?.category_th : sampleItem?.category_en
                  return (
                    <button
                      key={category}
                      onClick={() => handlePickerSelect(category)}
                      className={`w-full px-5 py-4 flex items-center justify-between min-h-[48px] transition-colors ${
                        activeCategory === category
                          ? 'bg-primary/10 text-primary'
                          : 'text-text hover:bg-border active:bg-border'
                      }`}
                    >
                      <span className="text-lg font-medium scale-text">{categoryName || category}</span>
                      <span className="text-sm text-muted">
                        {itemCount} {itemCount === 1 ? t('item') : t('items')}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Item Drawer (when tapping item already in cart) */}
        {drawerItem && (
          <MenuItemDrawer
            menuId={drawerItem.id}
            menuName_th={drawerItem.name_th}
            menuName_en={drawerItem.name_en}
            basePrice={drawerItem.price_thb}
            cartItems={findItemsByMenuId(cartItems, drawerItem.id)}
            onClose={() => setDrawerItem(null)}
          />
        )}
      </div>

      {/* Bottom CTA Bar - Different for add-to-order mode vs normal */}
      <BottomCTABar>
        {isAddToOrderMode ? (
          <button
            onClick={() => {
              triggerHaptic()
              router.push(`/order/payment?id=${editOrderId}`)
            }}
            className="w-full py-3.5 bg-card border border-border text-text font-medium rounded-lg flex items-center justify-center gap-2 hover:bg-border active:bg-border/80 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span>{language === 'th' ? 'กลับไปชำระเงิน' : 'Back to Payment'}</span>
          </button>
        ) : (
          <button
            onClick={() => {
              triggerHaptic()
              router.push('/order/cart')
            }}
            className="w-full py-3.5 bg-primary text-white font-medium rounded-lg flex items-center justify-between px-4 hover:bg-primary/90 active:bg-primary/80 transition-colors"
          >
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>{language === 'th' ? 'ตะกร้าของฉัน' : 'My Cart'}</span>
              {totalItems > 0 && (
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-sm">
                  {totalItems}
                </span>
              )}
            </div>
            <span className="font-semibold">฿{totalPrice}</span>
          </button>
        )}
      </BottomCTABar>
    </div>
  )
}
