'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import BrandHeader from '@/components/BrandHeader'
import MenuItemRow from '@/components/MenuItemRow'
import MenuCardLarge from '@/components/MenuCardLarge'
import { triggerHaptic } from '@/utils/haptic'
import { useLanguage } from '@/contexts/LanguageContext'

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
}

interface MenuClientProps {
  initialMenuItems: MenuItem[]
  initialCategories: Category[]
}

export default function MenuClient({ initialMenuItems, initialCategories }: MenuClientProps) {
  const router = useRouter()
  const { language, t } = useLanguage()
  const [activeCategory, setActiveCategory] = useState<Category>(initialCategories[0] || 'Menu')
  const [searchQuery, setSearchQuery] = useState('')
  const [isRestoringScroll, setIsRestoringScroll] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({})
  const observerRef = useRef<IntersectionObserver | null>(null)
  const tabsRef = useRef<HTMLDivElement>(null)
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})

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
    if (!searchQuery) {
      tabButtonRefs.current[activeCategory]?.scrollIntoView({
        behavior: 'smooth',
        inline: 'start',
        block: 'nearest',
      })
    }
  }, [activeCategory, searchQuery])

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
    if (isRestoringScroll || searchQuery.trim()) return

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
  }, [categories, searchQuery, isRestoringScroll])

  const handleCategoryClick = (category: Category) => {
    setActiveCategory(category)
    const element = categoryRefs.current[category]
    if (element) {
      const headerHeight = 73
      const tabsHeight = 68
      const offset = headerHeight + tabsHeight
      const elementPosition = element.getBoundingClientRect().top + window.scrollY
      const offsetPosition = elementPosition - offset

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

  const handleRecommendedTap = (itemId: string) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('menuScrollPosition', window.scrollY.toString())
      sessionStorage.setItem('navigationDirection', 'forward')
    }
    triggerHaptic()
    setTimeout(() => {
      router.push(`/order/menu/${itemId}`)
    }, 100)
  }

  return (
    <div className="min-h-screen bg-bg pb-20">
      <div className="max-w-mobile mx-auto">
        <BrandHeader />

        {/* Search Bar */}
        <div className="px-5 py-4 border-b border-border">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full bg-card border border-border rounded-lg pl-10 pr-10 py-3 text-text placeholder-muted focus:outline-none focus:border-primary/50 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Search Results */}
        {searchQuery.trim() && (
          <div className="px-5 py-4">
            <h2 className="text-text text-sm font-semibold mb-3">
              {t('searchResults')} {filteredItems.length > 0 && `(${filteredItems.length} ${filteredItems.length === 1 ? t('item') : t('items')})`}
            </h2>
            {filteredItems.length > 0 ? (
              <div className="bg-card rounded-lg overflow-hidden">
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
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted text-sm text-center py-8">{t('noItemsFound')}</p>
            )}
          </div>
        )}

        {/* Normal Menu View (when not searching) */}
        {!searchQuery.trim() && (
          <>
            {/* Recommended Section */}
            <div className="px-5 py-6">
              <h2 className="text-text text-xl font-semibold mb-4">{t('recommended')}</h2>
              <div className="grid grid-cols-2 gap-3">
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
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Sticky Category Tabs */}
            <div className="sticky top-[73px] bg-bg z-40 border-b border-border shadow-md shadow-black/10">
              <div className="flex items-center gap-2">
                {/* Hamburger Button */}
                <button
                  onClick={() => setIsPickerOpen(true)}
                  className="flex-shrink-0 w-12 h-12 flex items-center justify-center text-text hover:text-primary transition-colors ml-2"
                  aria-label="Open category picker"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>

                {/* Scrollable Tabs */}
                <div ref={tabsRef} className="flex-1 flex flex-nowrap overflow-x-auto scrollbar-hide py-3 pr-5 gap-2.5" style={{ WebkitOverflowScrolling: 'touch' }}>
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
                        className={`flex-none px-4 py-2.5 min-h-[44px] rounded-lg whitespace-nowrap transition-all font-medium text-sm ${
                          activeCategory === category
                            ? 'bg-primary text-white shadow-lg shadow-primary/30'
                            : 'bg-card text-muted hover:bg-border border border-border'
                        }`}
                      >
                        {categoryName || category}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Category Sections - Vertical List (only when not searching) */}
        {!searchQuery.trim() && categories.map((category, index) => {
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
              className="mb-6"
            >
              {/* Category Header - Sticky with dynamic z-index */}
              <div
                className="sticky top-[141px] bg-card px-5 py-2.5 border-b border-border/50"
                style={{ zIndex: 30 + index }}
              >
                <h2 className="text-text text-sm font-semibold leading-tight">{categoryName || category}</h2>
              </div>

              {/* Vertical List of Items */}
              <div className="bg-card">
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
                  />
                ))}
              </div>
            </div>
          )
        })}

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
                      <span className="text-lg font-medium">{categoryName || category}</span>
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
      </div>
    </div>
  )
}
