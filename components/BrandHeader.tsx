'use client'

import Image from 'next/image'

export default function BrandHeader() {
  return (
    <div className="bg-bg py-4 px-5 border-b border-border">
      <div className="max-w-mobile mx-auto flex flex-col items-center">
        <div className="relative w-20 h-20 mb-2">
          <Image
            src="/tenzai-logo.jpg"
            alt="TENZAI SUSHI"
            fill
            className="object-contain rounded-full"
            priority
          />
        </div>
        <h1 className="text-lg font-medium text-text tracking-wide">TENZAI SUSHI</h1>
      </div>
    </div>
  )
}
