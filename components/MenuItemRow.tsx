'use client'

import { useRouter } from 'next/navigation'
import { triggerHaptic } from '@/utils/haptic'
import { useLanguage } from '@/contexts/LanguageContext'
import { toSquareUrl } from '@/lib/menuImages'
import MenuThumb from '@/components/MenuThumb'

interface MenuItemRowProps {
  id: string
  name_th: string
  name_en: string
  price_thb: number
  promo_price?: number
  promo_label?: string
  promo_percent?: number | null  // Manual percent badge (0-100), null = no badge
  image: string
  is_sold_out?: boolean
  description?: string
  subtitle?: string
  onTap?: () => void // Custom tap handler (for drawer support)
  focusY?: number    // Vertical focus 0-100 for thumbnail
}

export default function MenuItemRow({
  id,
  name_th,
  name_en,
  price_thb,
  promo_price,
  promo_label,
  promo_percent,
  image,
  is_sold_out = false,
  description,
  subtitle,
  onTap,
  focusY,
}: MenuItemRowProps) {
  const router = useRouter()
  const { language, t } = useLanguage()

  const displayName = language === 'th' ? name_th : name_en
  const displayDescription = description ?? subtitle
  const promoText = promo_label || (language === 'th' ? 'โปรโมชั่น' : 'DEAL')

  // Calculate savings for display (only if promo_price is set and less than price)
  const savings = promo_price && promo_price < price_thb ? price_thb - promo_price : 0

  const handleClick = () => {
    if (is_sold_out) return

    triggerHaptic()

    // Use custom handler if provided (for drawer support)
    if (onTap) {
      onTap()
      return
    }

    // Default: navigate to item detail
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('menuScrollPosition', window.scrollY.toString())
      sessionStorage.setItem('navigationDirection', 'forward')
    }
    setTimeout(() => {
      router.push(`/order/menu/${id}`)
    }, 100)
  }

  return (
    <div
      className={`block ${is_sold_out ? 'pointer-events-none' : 'cursor-pointer'}`}
      onClick={handleClick}
    >
      <div
        id={`menu-item-${id}`}
        className={`flex items-center gap-4 px-5 py-4 bg-bg-root border-b border-border-subtle ${
          is_sold_out ? 'opacity-40' : 'active:bg-bg-surface'
        }`}
      >
        {/* Thumbnail - premium styling with MenuThumb */}
        <div className="relative w-28 h-28 flex-shrink-0">
          <MenuThumb
            src={toSquareUrl(image)}
            alt={name_en}
            sizes="112px"
            focusY={focusY}
          />
          {/* Corner Promo Ribbon */}
          {promo_price && !is_sold_out && (
            <div className="absolute top-0 left-0 z-10">
              <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-br-md shadow-md">
                <div className="flex items-center gap-0.5">
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 23c-3.9 0-7-3.1-7-7 0-2.1 1.1-4.5 2.8-6.4.3-.3.7-.5 1.1-.5.4 0 .8.2 1.1.5.6.6.6 1.5 0 2.1C8.8 13 8 14.4 8 16c0 2.2 1.8 4 4 4s4-1.8 4-4c0-1.6-.8-3-2-3.9-.6-.6-.6-1.5 0-2.1.3-.3.7-.5 1.1-.5.4 0 .8.2 1.1.5C17.9 11.5 19 13.9 19 16c0 3.9-3.1 7-7 7z"/>
                    <path d="M12 12.5c-1.4 0-2.5-1.1-2.5-2.5 0-.8.4-1.5 1-2l1.5-1.5 1.5 1.5c.6.5 1 1.2 1 2 0 1.4-1.1 2.5-2.5 2.5z"/>
                  </svg>
                  <span className="truncate max-w-[50px]">{promoText}</span>
                </div>
              </div>
            </div>
          )}
          {/* Discount Badge - only shown if promo_percent is explicitly set */}
          {promo_price && promo_percent != null && promo_percent > 0 && !is_sold_out && (
            <div className="absolute top-0 right-0 z-10">
              <div className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-bl-md shadow-md">
                -{promo_percent}%
              </div>
            </div>
          )}
          {is_sold_out && (
            <div className="absolute inset-0 z-10 bg-black/60 flex items-center justify-center rounded-lg">
              <span className="text-white text-xs font-medium px-2.5 py-1 bg-black/70 rounded">
                {t('soldOut')}
              </span>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <h3 className="text-text-primary font-semibold text-base line-clamp-2 mb-1.5 leading-snug scale-text">
            {displayName}
          </h3>
          {displayDescription && displayDescription.trim() && (
            <p className="text-text-secondary text-sm line-clamp-2 mb-2 leading-snug">
              {displayDescription}
            </p>
          )}
          {promo_price ? (
            <div className="flex flex-col gap-0.5">
              {/* Highlighted price block */}
              <div className="inline-flex items-baseline gap-2 bg-gradient-to-r from-orange-500/15 to-red-500/10 px-2 py-1 rounded-lg w-fit">
                <span className="text-orange-400 font-bold text-xl scale-text">฿{promo_price}</span>
                <span className="text-text-muted line-through text-sm">฿{price_thb}</span>
              </div>
              {/* Savings indicator */}
              {savings > 0 && (
                <span className="text-green-500 text-xs font-medium px-2">
                  {language === 'th' ? `ประหยัด ฿${savings}` : `Save ฿${savings}`}
                </span>
              )}
            </div>
          ) : (
            <p className="text-accent font-bold text-lg scale-text">฿{price_thb}</p>
          )}
        </div>

        {/* Add Button */}
        {!is_sold_out && (
          <div className="w-11 h-11 flex-shrink-0 rounded-full bg-accent flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 4v16m8-8H4" />
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}
