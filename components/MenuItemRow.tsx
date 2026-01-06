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
          <p className="text-accent font-bold text-lg scale-text">
            ฿{price_thb}
          </p>
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
