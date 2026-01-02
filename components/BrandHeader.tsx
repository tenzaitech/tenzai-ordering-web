'use client'

import Image from 'next/image'

export default function BrandHeader() {
  return (
    <div className="bg-bg-root py-6 px-5 border-b border-border-subtle">
      <div className="max-w-mobile mx-auto flex items-center gap-4">
        <div className="relative w-14 h-14 flex-shrink-0">
          <Image
            src="/tenzai-logo.jpg"
            alt="TENZAI SUSHI"
            fill
            className="object-cover rounded-full"
            priority
          />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-text-primary tracking-wide">TENZAI SUSHI</h1>
          <p className="text-xs text-text-secondary mt-0.5">Fresh Japanese cuisine</p>
        </div>
      </div>
    </div>
  )
}
