'use client'

import { useLanguage } from '@/contexts/LanguageContext'
import { toSquareUrl } from '@/lib/menuImages'
import MenuThumb from '@/components/MenuThumb'

interface MenuCardLargeProps {
  name_th: string
  name_en: string
  price_thb: number
  image?: string
  is_sold_out?: boolean
  focusY?: number  // Vertical focus 0-100 for thumbnail
}

export default function MenuCardLarge({
  name_th,
  name_en,
  price_thb,
  image,
  is_sold_out = false,
  focusY,
}: MenuCardLargeProps) {
  const { language } = useLanguage()
  const displayName = language === 'th' ? name_th : name_en

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
        <p className="text-accent font-bold text-lg scale-text">
          ฿{price_thb}
        </p>
      </div>
    </div>
  )
}
