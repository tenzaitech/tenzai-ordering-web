'use client'

import { useEffect, useState } from 'react'

const TEXT_SCALE_KEY = 'tenzai_text_scale'
const SCALE_MIN = 1.0
const SCALE_MAX = 1.5
const SCALE_STEP = 0.1

export function useTextScale() {
  const [scale, setScaleState] = useState(1.0)
  const [mounted, setMounted] = useState(false)

  // Apply scale to CSS variable and body font-size
  const applyScale = (newScale: number) => {
    document.documentElement.style.setProperty('--text-scale', String(newScale))
    const fontSizePx = Math.round(16 * newScale)
    document.body.style.fontSize = `${fontSizePx}px`
  }

  useEffect(() => {
    const stored = localStorage.getItem(TEXT_SCALE_KEY)
    const parsed = stored ? parseFloat(stored) : NaN
    const initialScale = !isNaN(parsed) && parsed >= SCALE_MIN && parsed <= SCALE_MAX
      ? parsed
      : SCALE_MIN
    setScaleState(initialScale)
    applyScale(initialScale)
    setMounted(true)
  }, [])

  const setScale = (newScale: number) => {
    const clamped = Math.max(SCALE_MIN, Math.min(SCALE_MAX, newScale))
    const rounded = Math.round(clamped * 10) / 10
    setScaleState(rounded)
    applyScale(rounded)
    localStorage.setItem(TEXT_SCALE_KEY, String(rounded))
  }

  const increment = () => setScale(scale + SCALE_STEP)
  const decrement = () => setScale(scale - SCALE_STEP)

  const canIncrement = scale < SCALE_MAX
  const canDecrement = scale > SCALE_MIN

  // Display label as percentage
  const scaleLabel = `${Math.round(scale * 100)}%`

  return {
    scale,
    setScale,
    increment,
    decrement,
    canIncrement,
    canDecrement,
    scaleLabel,
    mounted
  }
}
