'use client'

import Image from 'next/image'
import { useLanguage } from '@/contexts/LanguageContext'

interface MenuCardLargeProps {
  name_th: string
  name_en: string
  price_thb: number
  image?: string
  is_sold_out?: boolean
}

export default function MenuCardLarge({
  name_th,
  name_en,
  price_thb,
  image,
  is_sold_out = false,
}: MenuCardLargeProps) {
  const { language } = useLanguage()
  const displayName = language === 'th' ? name_th : name_en

  return (
    <div className={`overflow-hidden ${is_sold_out ? 'opacity-40' : ''}`}>
      <div className="relative aspect-square bg-bg-elevated rounded-lg overflow-hidden mb-3">
        {image && (
          <Image
            src={image}
            alt={displayName}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        )}
        {is_sold_out && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="text-white text-sm font-medium px-3 py-1.5 bg-black/60 rounded">
              Sold out
            </span>
          </div>
        )}
      </div>

      <div className="px-1">
        <h3 className="text-text-primary font-medium text-base mb-1.5 line-clamp-2 leading-snug">
          {displayName}
        </h3>
        <p className="text-accent font-bold text-lg">
          ฿{price_thb}
        </p>
      </div>
    </div>
  )
}
