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
    <div
      className={`bg-card border border-border rounded-lg overflow-hidden ${
        is_sold_out ? 'opacity-50' : ''
      }`}
    >
      <div className="relative aspect-[4/3] bg-border">
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
          <>
            <div className="absolute inset-0 bg-black bg-opacity-30"></div>
            <span className="absolute top-2 right-2 text-text text-xs font-medium px-2 py-1 bg-card/80 rounded">
              Sold out
            </span>
          </>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-text font-medium text-lg mb-2 truncate">
          {displayName}
        </h3>
        <p className="text-primary font-semibold text-xl">
          ฿{price_thb}
        </p>
      </div>
    </div>
  )
}
