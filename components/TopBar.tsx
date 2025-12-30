'use client'

import { useLanguage } from '@/contexts/LanguageContext'

export default function TopBar() {
  const { language, setLanguage } = useLanguage()

  return (
    <header className="sticky top-0 bg-card z-10 px-5 py-4 border-b border-border">
      <div className="max-w-mobile mx-auto flex items-center justify-between">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-primary rounded flex items-center justify-center">
            <span className="text-white font-bold text-lg">T</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setLanguage('th')}
            className={`px-3 py-1 text-sm font-medium transition-colors ${
              language === 'th' ? 'text-primary' : 'text-muted hover:text-text'
            }`}
          >
            TH
          </button>
          <span className="text-border">|</span>
          <button
            onClick={() => setLanguage('en')}
            className={`px-3 py-1 text-sm font-medium transition-colors ${
              language === 'en' ? 'text-primary' : 'text-muted hover:text-text'
            }`}
          >
            EN
          </button>
        </div>
      </div>
    </header>
  )
}
