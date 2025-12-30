'use client'

import Image from 'next/image'
import Link from 'next/link'

interface MenuItemRowProps {
  id: string
  name_th: string
  name_en: string
  price_thb: number
  image: string
  is_sold_out?: boolean
  subtitle?: string
}

export default function MenuItemRow({
  id,
  name_th,
  name_en,
  price_thb,
  image,
  is_sold_out = false,
  subtitle,
}: MenuItemRowProps) {
  const handleClick = () => {
    if (!is_sold_out && typeof window !== 'undefined') {
      sessionStorage.setItem('menuScrollPosition', window.scrollY.toString())
    }
  }

  return (
    <Link
      href={is_sold_out ? '#' : `/order/menu/${id}`}
      className={`block ${is_sold_out ? 'pointer-events-none' : ''}`}
      scroll={false}
      onClick={handleClick}
    >
      <div
        id={`menu-item-${id}`}
        className={`flex items-center gap-3 px-5 py-4 bg-card border-b border-border transition-all ${
          is_sold_out ? 'opacity-50' : 'active:bg-border'
        }`}
      >
        {/* Image */}
        <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-border">
          <Image
            src={image}
            alt={name_en}
            fill
            className="object-cover"
            sizes="96px"
          />
          {is_sold_out && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <span className="text-white text-xs font-medium px-2 py-1 bg-black/80 rounded">
                Sold out
              </span>
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <h3 className="text-text font-medium text-base line-clamp-1 mb-0.5">
            {name_en}
          </h3>
          <p className="text-muted text-xs line-clamp-1 mb-1">
            {name_th}
          </p>
          {subtitle && (
            <p className="text-muted text-xs line-clamp-1 mb-1">
              {subtitle}
            </p>
          )}
          <p className="text-primary font-semibold text-base">
            ฿{price_thb}
          </p>
        </div>

        {/* Add Button */}
        {!is_sold_out && (
          <div className="w-10 h-10 flex-shrink-0 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 4v16m8-8H4" />
            </svg>
          </div>
        )}
      </div>
    </Link>
  )
}
