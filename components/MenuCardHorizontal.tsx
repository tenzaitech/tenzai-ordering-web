'use client'

import Image from 'next/image'
import { useLanguage } from '@/contexts/LanguageContext'

interface MenuCardHorizontalProps {
  name_th: string
  name_en: string
  price_thb: number
  image?: string
  is_sold_out?: boolean
}

export default function MenuCardHorizontal({
  name_th,
  name_en,
  price_thb,
  image,
  is_sold_out = false,
}: MenuCardHorizontalProps) {
  const { language } = useLanguage()
  const displayName = language === 'th' ? name_th : name_en

  return (
    <div
      className={`bg-card border border-border rounded-lg overflow-hidden w-44 flex-shrink-0 ${
        is_sold_out ? 'opacity-50' : ''
      }`}
    >
      <div className="relative aspect-video bg-border">
        {image && (
          <Image
            src={image}
            alt={displayName}
            fill
            className="object-cover"
            sizes="176px"
          />
        )}
        {is_sold_out && (
          <>
            <div className="absolute inset-0 bg-black bg-opacity-30"></div>
            <span className="absolute top-1.5 right-1.5 text-text text-xs font-medium px-2 py-1 bg-card/80 rounded">
              Sold out
            </span>
          </>
        )}
      </div>

      <div className="p-3">
        <h3 className="text-text text-sm font-medium mb-1.5 truncate">
          {displayName}
        </h3>
        <p className="text-primary font-semibold text-base">
          ฿{price_thb}
        </p>
      </div>
    </div>
  )
}
