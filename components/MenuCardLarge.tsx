'use client'

import { useLanguage } from '@/contexts/LanguageContext'
import { toSquareUrl } from '@/lib/menuImages'
import MenuThumb from '@/components/MenuThumb'

interface MenuCardLargeProps {
  name_th: string
  name_en: string
  price_thb: number
  promo_price?: number
  promo_label?: string
  promo_percent?: number | null  // Manual percent badge (0-100), null = no badge
  image?: string
  is_sold_out?: boolean
  focusY?: number  // Vertical focus 0-100 for thumbnail
}

export default function MenuCardLarge({
  name_th,
  name_en,
  price_thb,
  promo_price,
  promo_label,
  promo_percent,
  image,
  is_sold_out = false,
  focusY,
}: MenuCardLargeProps) {
  const { language } = useLanguage()
  const displayName = language === 'th' ? name_th : name_en

  const promoText = promo_label || (language === 'th' ? 'โปรโมชั่น' : 'DEAL')

  return (
    <div className={`overflow-hidden ${is_sold_out ? 'opacity-40' : ''}`}>
      {/* Thumbnail - premium styling with MenuThumb */}
      <div className="relative aspect-square mb-3">
        <MenuThumb
          src={toSquareUrl(image)}
          alt={displayName}
          sizes="(max-width: 768px) 50vw, 25vw"
          focusY={focusY}
        />
        {/* Corner Promo Ribbon */}
        {promo_price && !is_sold_out && (
          <div className="absolute top-0 left-0 z-10">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-br-lg shadow-lg">
              <div className="flex items-center gap-1">
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 23c-3.9 0-7-3.1-7-7 0-2.1 1.1-4.5 2.8-6.4.3-.3.7-.5 1.1-.5.4 0 .8.2 1.1.5.6.6.6 1.5 0 2.1C8.8 13 8 14.4 8 16c0 2.2 1.8 4 4 4s4-1.8 4-4c0-1.6-.8-3-2-3.9-.6-.6-.6-1.5 0-2.1.3-.3.7-.5 1.1-.5.4 0 .8.2 1.1.5C17.9 11.5 19 13.9 19 16c0 3.9-3.1 7-7 7z"/>
                  <path d="M12 12.5c-1.4 0-2.5-1.1-2.5-2.5 0-.8.4-1.5 1-2l1.5-1.5 1.5 1.5c.6.5 1 1.2 1 2 0 1.4-1.1 2.5-2.5 2.5z"/>
                </svg>
                <span>{promoText}</span>
              </div>
            </div>
          </div>
        )}
        {/* Discount Badge - only shown if promo_percent is explicitly set */}
        {promo_price && promo_percent != null && promo_percent > 0 && !is_sold_out && (
          <div className="absolute top-0 right-0 z-10">
            <div className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-bl-lg shadow-lg">
              -{promo_percent}%
            </div>
          </div>
        )}
        {is_sold_out && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 rounded-lg">
            <span className="text-white text-sm font-medium px-3 py-1.5 bg-black/60 rounded">
              Sold out
            </span>
          </div>
        )}
      </div>

      <div className="px-1">
        <h3 className="text-text-primary font-medium text-base mb-1.5 line-clamp-2 leading-snug scale-text">
          {displayName}
        </h3>
        {promo_price ? (
          <div className="flex flex-col gap-1">
            {/* Highlighted price block */}
            <div className="inline-flex items-baseline gap-2 bg-gradient-to-r from-orange-500/15 to-red-500/10 px-2 py-1 rounded-lg w-fit">
              <span className="text-orange-400 font-bold text-xl scale-text">฿{promo_price}</span>
              <span className="text-text-muted line-through text-xs">฿{price_thb}</span>
            </div>
          </div>
        ) : (
          <p className="text-accent font-bold text-lg scale-text">฿{price_thb}</p>
        )}
      </div>
    </div>
  )
}
